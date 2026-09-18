import Darwin
import Foundation
import SQLite3

/// Why the message store could not be read. Each is its own case, because each is fixed in its
/// own way: a missing permission in System Settings, a missing store not at all, and an unreadable
/// one by whatever the store said.
public enum MessageStoreRefusal: Error, Equatable, Sendable {
  case permissionMissing(evidence: String)
  case notFound(evidence: String)
  case unreadable(evidence: String)
}

/// The message store as the helper reaches it.
public protocol MessageStore: Sendable {
  /// The newest chats with real traffic, up to a limit.
  func chats(limit: Int) -> Result<ChatsRead, MessageStoreRefusal>

  /// A chat's newest messages within a range, up to a limit, reactions and group events left
  /// out. Nothing when no chat has that identifier.
  func messages(inChat identifier: String, within range: MessageRange, limit: Int) -> Result<
    MessagesRead?, MessageStoreRefusal
  >
}

/// The user's message store, a SQLite database only ever read read-only, with prepared
/// statements: nothing a request carries is ever written into a query (NN1).
///
/// Messages' own tables are read directly. Their names stay in here, and nothing above this file
/// speaks of rows or columns.
public struct SQLiteMessageStore: MessageStore {
  let path: String
  /// Try to open the file, and answer the error it failed with, or 0. macOS refuses a protected
  /// file before SQLite ever sees it, and only the error number tells a refusal from absence.
  let probing: @Sendable (String) -> Int32

  /// How long a read waits on Messages' write lock before it fails.
  static let lockWaitMilliseconds: Int32 = 1000

  public init(path: String, probing: @escaping @Sendable (String) -> Int32 = openingForReading) {
    self.path = path
    self.probing = probing
  }

  public func chats(limit: Int) -> Result<ChatsRead, MessageStoreRefusal> {
    opened().flatMap { database in
      defer { sqlite3_close(database) }

      // Real traffic is an incoming message, or an outgoing one the store shows as sent or
      // delivered with no error (ADR-0005). A chat with none of it is a ghost chat, left out.
      let newest = rows(
        in: database,
        """
        SELECT c.ROWID, c.guid, c.style, MAX(m.date)
        FROM chat c
        JOIN chat_message_join j ON j.chat_id = c.ROWID
        JOIN message m ON m.ROWID = j.message_id
        WHERE m.item_type = 0 AND m.associated_message_type = 0
          AND (m.is_from_me = 0 OR ((m.is_sent = 1 OR m.is_delivered = 1) AND m.error = 0))
        GROUP BY c.ROWID
        ORDER BY MAX(m.date) DESC, c.guid
        LIMIT ?
        """, binding: [.integer(Int64(limit) + 1)]
      ) { row in
        (row.integer(0), row.text(1) ?? "", row.integer(2), row.integer(3))
      }

      return newest.flatMap { found in
        var chats: [Chat] = []
        for (rowid, guid, style, lastDate) in found.prefix(limit) {
          let participants = rows(
            in: database,
            """
            SELECT h.id FROM chat_handle_join j JOIN handle h ON h.ROWID = j.handle_id
            WHERE j.chat_id = ? ORDER BY h.id
            """, binding: [.integer(rowid)]
          ) { row in row.text(0) ?? "" }

          switch participants {
          case .failure(let refusal): return .failure(refusal)
          case .success(let handles):
            chats.append(
              Chat(
                identifier: guid, kind: kind(ofStyle: style), participants: handles,
                lastTimestamp: instant(fromStoreDate: lastDate)))
          }
        }
        return .success(ChatsRead(chats: chats, truncated: found.count > limit))
      }
    }
  }

  public func messages(inChat identifier: String, within range: MessageRange, limit: Int)
    -> Result<MessagesRead?, MessageStoreRefusal>
  {
    opened().flatMap { database in
      defer { sqlite3_close(database) }

      let chat = rows(
        in: database, "SELECT ROWID FROM chat WHERE guid = ?", binding: [.text(identifier)]
      ) { row in row.integer(0) }

      return chat.flatMap { found in
        guard let rowid = found.first else { return .success(nil) }

        // A reaction is stored as a message that points at another (associated_message_type),
        // and a group event such as a rename as a message of another item type. Neither is
        // something anyone wrote to the chat.
        let newest = rows(
          in: database,
          """
          SELECT m.guid, m.text, m.is_from_me, h.id, m.date, m.service, m.is_sent,
            m.is_delivered, m.error
          FROM chat_message_join j
          JOIN message m ON m.ROWID = j.message_id
          LEFT JOIN handle h ON h.ROWID = m.handle_id AND m.is_from_me = 0
          WHERE j.chat_id = ? AND m.associated_message_type = 0 AND m.item_type = 0
            AND m.date >= ? AND m.date < ?
          ORDER BY m.date DESC, m.ROWID DESC
          LIMIT ?
          """,
          binding: [
            .integer(rowid), .integer(range.start.map(storeDate(from:)) ?? Int64.min),
            .integer(range.end.map(storeDate(from:)) ?? Int64.max),
            .integer(Int64(limit) + 1),
          ]
        ) { row in
          let outgoing = row.integer(2) == 1
          return Message(
            identifier: row.text(0) ?? "", chat: identifier, text: row.text(1),
            direction: outgoing ? .outgoing : .incoming, handle: row.text(3),
            timestamp: instant(fromStoreDate: row.integer(4)), service: row.text(5) ?? "",
            delivery: outgoing
              ? Delivery(
                sent: row.integer(6) == 1, delivered: row.integer(7) == 1,
                error: row.integer(8) == 0 ? nil : Int(row.integer(8)))
              : nil)
        }

        return newest.map { messages in
          MessagesRead(
            messages: messages.prefix(limit).reversed(), truncated: messages.count > limit)
        }
      }
    }
  }

  /// The store's own word for a chat's kind: 45 is a one-to-one chat and 43 a group chat
  /// (MSG-V2). Anything else is taken for a group, the kind a reply is careful with.
  private func kind(ofStyle style: Int64) -> ChatKind {
    style == ChatKind.oneToOneStyle ? .oneToOne : .group
  }

  private func opened() -> Result<OpaquePointer, MessageStoreRefusal> {
    switch probing(path) {
    case 0: break
    case ENOENT: return .failure(.notFound(evidence: described(ENOENT)))
    // macOS refuses a protected file with EPERM. EACCES is the file's own access mode, which no
    // setting in Privacy & Security would change.
    case EPERM: return .failure(.permissionMissing(evidence: described(EPERM)))
    case let error: return .failure(.unreadable(evidence: described(error)))
    }

    var database: OpaquePointer?
    let status = sqlite3_open_v2(path, &database, SQLITE_OPEN_READONLY, nil)
    guard status == SQLITE_OK, let database else {
      let said = database.map { String(cString: sqlite3_errmsg($0)) } ?? "SQLite error \(status)"
      sqlite3_close(database)
      return .failure(.unreadable(evidence: said))
    }
    // Messages holds the store while it writes. A read waits a moment for it, then fails rather
    // than holding the session.
    sqlite3_busy_timeout(database, Self.lockWaitMilliseconds)
    return .success(database)
  }
}

/// What the system calls an error number, in its own words.
private func described(_ error: Int32) -> String { String(cString: strerror(error)) }

/// Open the file for reading and close it again, answering the error number or 0.
public let openingForReading: @Sendable (String) -> Int32 = { path in
  let descriptor = open(path, O_RDONLY)
  guard descriptor >= 0 else { return errno }
  close(descriptor)
  return 0
}

/// Messages keeps a moment as nanoseconds since the start of 2001, in UTC.
func instant(fromStoreDate nanoseconds: Int64) -> Date {
  Date(timeIntervalSinceReferenceDate: Double(nanoseconds) / 1_000_000_000)
}

/// A moment in the store's own unit, so a bound compares like with like.
func storeDate(from instant: Date) -> Int64 {
  Int64((instant.timeIntervalSinceReferenceDate * 1_000_000_000).rounded())
}

/// A value bound into a prepared statement.
private enum Bound {
  case integer(Int64)
  case text(String)
}

/// One row of an answer, read by column.
private struct Row {
  let statement: OpaquePointer

  func integer(_ column: Int32) -> Int64 { sqlite3_column_int64(statement, column) }

  func text(_ column: Int32) -> String? {
    sqlite3_column_text(statement, column).map { String(cString: $0) }
  }
}

/// Run one prepared statement with its values bound, and read every row it answers with.
private func rows<Found>(
  in database: OpaquePointer, _ query: String, binding values: [Bound],
  reading: (Row) -> Found
) -> Result<[Found], MessageStoreRefusal> {
  var statement: OpaquePointer?
  guard sqlite3_prepare_v2(database, query, -1, &statement, nil) == SQLITE_OK, let statement
  else {
    return .failure(.unreadable(evidence: String(cString: sqlite3_errmsg(database))))
  }
  defer { sqlite3_finalize(statement) }

  let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
  for (index, value) in values.enumerated() {
    let position = Int32(index + 1)
    switch value {
    case .integer(let number): sqlite3_bind_int64(statement, position, number)
    case .text(let text): sqlite3_bind_text(statement, position, text, -1, transient)
    }
  }

  var found: [Found] = []
  while true {
    switch sqlite3_step(statement) {
    case SQLITE_ROW: found.append(reading(Row(statement: statement)))
    case SQLITE_DONE: return .success(found)
    default: return .failure(.unreadable(evidence: String(cString: sqlite3_errmsg(database))))
    }
  }
}
