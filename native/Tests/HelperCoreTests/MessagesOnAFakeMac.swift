import Foundation
import SQLite3

@testable import HelperCore

// The words a messages scenario uses to set a Mac up without having one. The message store is a
// SQLite database, so a scenario builds a small one with the columns of the real store that the
// helper reads, and the helper reads it exactly as it reads the user's: read-only, by path.

/// When a scenario's messages happen, as instants.
let nineOClock = Date(timeIntervalSince1970: 1_789_722_000)  // 2026-09-18T09:00:00Z

/// A message store on disk, in a directory of its own, filled by a scenario.
final class AMessageStoreFile: @unchecked Sendable {
  let path: String
  private var database: OpaquePointer?
  private var nextMessage = 1

  init() {
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("apple-native-mcp-\(UUID().uuidString)")
    try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    path = directory.appendingPathComponent("chat.db").path

    sqlite3_open(path, &database)
    run(
      """
      CREATE TABLE handle (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL,
        service TEXT NOT NULL);
      CREATE TABLE chat (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT UNIQUE NOT NULL,
        style INTEGER, chat_identifier TEXT, service_name TEXT, display_name TEXT);
      CREATE TABLE message (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT UNIQUE NOT NULL,
        text TEXT, attributedBody BLOB, handle_id INTEGER DEFAULT 0, service TEXT,
        date INTEGER, is_from_me INTEGER DEFAULT 0, is_sent INTEGER DEFAULT 0,
        is_delivered INTEGER DEFAULT 0, error INTEGER DEFAULT 0,
        associated_message_type INTEGER DEFAULT 0, item_type INTEGER DEFAULT 0);
      CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER);
      CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER,
        message_date INTEGER DEFAULT 0);
      """)
  }

  deinit { sqlite3_close(database) }

  /// A chat with these participants, as Messages stores it: 45 for one-to-one, 43 for a group.
  @discardableResult
  func chat(_ guid: String, group: Bool = false, with handles: [String]) -> AMessageStoreFile {
    run(
      "INSERT INTO chat (guid, style, chat_identifier) VALUES (?, ?, ?)",
      [guid, group ? 43 : 45, guid])
    for handle in handles {
      run(
        "INSERT INTO handle (id, service) SELECT ?, 'iMessage' "
          + "WHERE NOT EXISTS (SELECT 1 FROM handle WHERE id = ?)", [handle, handle])
      run(
        "INSERT INTO chat_handle_join (chat_id, handle_id) SELECT c.ROWID, h.ROWID "
          + "FROM chat c, handle h WHERE c.guid = ? AND h.id = ?", [guid, handle])
    }
    return self
  }

  /// A message in a chat. By default one the other person sent, which is real traffic.
  @discardableResult
  func message(
    in chat: String, from handle: String? = nil, text: String? = nil, at instant: Date,
    fromUser: Bool = false, sent: Bool = true, delivered: Bool = false, error: Int = 0,
    reactingTo: Bool = false, groupEvent: Bool = false, service: String = "iMessage"
  ) -> AMessageStoreFile {
    let guid = "message-\(nextMessage)"
    nextMessage += 1
    let nanoseconds = Int64((instant.timeIntervalSinceReferenceDate * 1_000_000_000).rounded())
    run(
      "INSERT INTO message (guid, text, handle_id, service, date, is_from_me, is_sent, "
        + "is_delivered, error, associated_message_type, item_type) VALUES (?, ?, "
        + "COALESCE((SELECT ROWID FROM handle WHERE id = ?), 0), ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        guid, text, handle, service, nanoseconds, fromUser ? 1 : 0, sent ? 1 : 0,
        delivered ? 1 : 0, error, reactingTo ? 2000 : 0, groupEvent ? 1 : 0,
      ])
    run(
      "INSERT INTO chat_message_join (chat_id, message_id, message_date) "
        + "SELECT c.ROWID, m.ROWID, m.date FROM chat c, message m WHERE c.guid = ? AND m.guid = ?",
      [chat, guid])
    return self
  }

  private func run(_ statements: String) {
    sqlite3_exec(database, statements, nil, nil, nil)
  }

  /// One statement, its values bound rather than written into it.
  private func run(_ statement: String, _ values: [Any?]) {
    var prepared: OpaquePointer?
    sqlite3_prepare_v2(database, statement, -1, &prepared, nil)
    defer { sqlite3_finalize(prepared) }

    let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    for (index, value) in values.enumerated() {
      let position = Int32(index + 1)
      switch value {
      case let text as String: sqlite3_bind_text(prepared, position, text, -1, transient)
      case let number as Int: sqlite3_bind_int64(prepared, position, Int64(number))
      case let number as Int64: sqlite3_bind_int64(prepared, position, number)
      default: sqlite3_bind_null(prepared, position)
      }
    }
    sqlite3_step(prepared)
  }
}

/// A message store where this Mac has none, for scenarios about something else.
let noMessageStore = SQLiteMessageStore(path: "/nonexistent/chat.db")

/// The helper, reading the message store at this path.
func helperReading(
  messagesAt path: String, probing: @escaping @Sendable (String) -> Int32 = openingForReading
) -> Helper {
  Helper(
    calendarStore: aCalendarStore(), reminderStore: aReminderStore(),
    contactStore: aContactStore(),
    messageStore: SQLiteMessageStore(path: path, probing: probing))
}

/// The helper, reading a message store a scenario filled.
func helperReading(_ store: AMessageStoreFile) -> Helper {
  helperReading(messagesAt: store.path)
}
