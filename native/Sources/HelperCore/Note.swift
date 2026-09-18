import Foundation

/// A top-level Notes container such as iCloud or On My Mac. It owns note folders.
public struct NotesAccount: Equatable, Sendable {
  public let identifier: String
  public let name: String

  public init(identifier: String, name: String) {
    self.identifier = identifier
    self.name = name
  }
}

/// A container of notes inside a notes account. Every account has a folder called Notes, so the
/// identifier addresses it and the account tells a reader which one it is.
public struct NoteFolder: Equatable, Sendable {
  public let identifier: String
  public let name: String
  public let account: NotesAccount

  public init(identifier: String, name: String, account: NotesAccount) {
    self.identifier = identifier
    self.name = name
    self.account = account
  }
}

/// What could be had of a note's text. A locked note's cannot be read, and one that would not
/// come back is not a note that says nothing: each is said, never shown as empty text.
public enum NoteText: Equatable, Sendable {
  case read(String)
  case locked
  case unread
}

/// A note as the store holds it. Its title is whatever the store reports, never worked out from
/// its text (#23).
public struct HeldNote: Equatable, Sendable {
  public let identifier: String
  public let title: String
  public let modified: Date
  public let text: NoteText

  public init(identifier: String, title: String, modified: Date, text: NoteText) {
    self.identifier = identifier
    self.title = title
    self.modified = modified
    self.text = text
  }

  public var isLocked: Bool { text == .locked }
}

/// A note a search found, and the identifier of the note folder it was read from. The folder
/// cannot be asked of the note: in Notes 4.13 a note's `container` is broken, and its bulk form
/// answers with nulls (#6).
struct FoundNote: Equatable, Sendable {
  let note: HeldNote
  let noteFolderIdentifier: String
}

/// One note in full: the note, the note folder it is kept in, and how many attachments its text
/// leaves out.
public struct NoteInFull: Equatable, Sendable {
  public let note: HeldNote
  public let noteFolder: NoteFolder
  public let attachments: Int

  public init(note: HeldNote, noteFolder: NoteFolder, attachments: Int) {
    self.note = note
    self.noteFolder = noteFolder
    self.attachments = attachments
  }
}

/// The notes as the helper reaches them. Scripting Notes sits behind this and nothing else does,
/// so the rules above it are specified against a fake and `swift test` needs no permission.
public protocol NoteStore: Sendable {
  /// Whether the helper may control Notes, which is a permission of its own, granted per app.
  /// macOS can only say for an app that is running, so this may have to start Notes, and fails
  /// when Notes will not start.
  func permission() throws(NotesUnreadable) -> Permission

  /// Ask macOS, which prompts the user, and report what they chose.
  func requestPermission() throws(NotesUnreadable) -> Permission

  /// Every note folder of every notes account.
  func noteFolders(within budget: TimeInterval) throws(NotesUnreadable) -> [NoteFolder]

  /// Every note in one note folder, with its text where that can be read. One folder at a time is
  /// what lets one folder fail on its own, and keeps a folder nobody asked for from being read.
  func notes(
    inNoteFolderIdentified identifier: String, within budget: TimeInterval
  ) throws(NotesUnreadable) -> [HeldNote]

  /// One note in full, or nil when it is not in any of these note folders. Its text is read only
  /// once it is known to be kept in one of them.
  func note(
    identifier: String, inNoteFoldersIdentified allowed: [String], within budget: TimeInterval
  ) throws(NotesUnreadable) -> NoteInFull?
}

/// Notes, or part of it, would not be read. It carries the error's number, which is what tells a
/// refused permission from a timeout, and what Notes said, verbatim.
public struct NotesUnreadable: Error, Equatable, Sendable {
  public let number: Int?
  public let evidence: String

  public init(number: Int?, evidence: String) {
    self.number = number
    self.evidence = evidence
  }
}

/// A note folder that would not be read, and what went wrong.
struct UnreadNoteFolder: Equatable, Sendable {
  let identifier: String
  let failure: NamedFailure
}

/// What a search came to: the notes that mention the search text, the note folders that would
/// not be read, and how many notes' text would not, so a short answer is never mistaken for a
/// thorough one.
struct NotesMentioning: Equatable, Sendable {
  let notes: [FoundNote]
  let unreadNoteFolders: [UnreadNoteFolder]
  let notesUnread: Int
}

/// Reading the notes: the rules that sit between the protocol and the scripts.
struct NotesReading: Sendable {
  let store: NoteStore
  /// What one request may spend on scripts, all of them together. It sits under the server's
  /// budget for the request, so the caller hears what was found rather than a helper gone quiet.
  var timeBudget: TimeInterval = scriptTimeBudget
  var now: @Sendable () -> Date = { Date() }

  /// Less than this left, and a script is not worth starting.
  private static let leastWorthStarting: TimeInterval = 0.5

  func permission() -> Result<Permission, NamedFailure> {
    asking(store.permission)
  }

  func requestPermission() -> Result<Permission, NamedFailure> {
    permission().flatMap { held in
      held == .undecided ? asking(store.requestPermission) : .success(held)
    }
  }

  func noteFolders() -> Result<[NoteFolder], NamedFailure> {
    whenNotesMayBeControlled(readingTheNoteFolders)
  }

  private func readingTheNoteFolders() -> Result<[NoteFolder], NamedFailure> {
    do {
      return .success(try store.noteFolders(within: timeBudget))
    } catch {
      return .failure(.notes(error))
    }
  }

  /// The notes in these note folders whose title or text mentions the search text, each once.
  /// The folders share one time budget: each gets what is left of it, and one that is never
  /// reached is named as unread, as is one that fails. A search never stops at the first failure.
  func notesMentioning(
    _ searchText: String, inNoteFoldersIdentified identifiers: [String]
  ) -> Result<NotesMentioning, NamedFailure> {
    whenNotesMayBeControlled {
      let started = now()
      var found: [FoundNote] = []
      var unread: [UnreadNoteFolder] = []
      var notesUnread = 0

      for identifier in identifiers {
        let left = timeBudget - now().timeIntervalSince(started)
        switch notes(in: identifier, within: left) {
        case .failure(let failure):
          unread.append(UnreadNoteFolder(identifier: identifier, failure: failure))
        case .success(let notes):
          let fresh = notes.filter { note in
            !found.contains { $0.note.identifier == note.identifier }
          }
          notesUnread += fresh.filter { $0.text == .unread }.count
          found += fresh.filter { $0.mentions(searchText) }
            .map { FoundNote(note: $0, noteFolderIdentifier: identifier) }
        }
      }
      return .success(
        NotesMentioning(notes: found, unreadNoteFolders: unread, notesUnread: notesUnread))
    }
  }

  /// One note in full, or nil when no note in these note folders has that identifier.
  func note(
    identifier: String, inNoteFoldersIdentified allowed: [String]
  ) -> Result<NoteInFull?, NamedFailure> {
    whenNotesMayBeControlled { readingTheNote(identifier, in: allowed) }
  }

  private func readingTheNote(
    _ identifier: String, in allowed: [String]
  ) -> Result<NoteInFull?, NamedFailure> {
    do {
      return .success(
        try store.note(
          identifier: identifier, inNoteFoldersIdentified: allowed, within: timeBudget))
    } catch {
      return .failure(.notes(error))
    }
  }

  private func notes(
    in identifier: String, within left: TimeInterval
  ) -> Result<[HeldNote], NamedFailure> {
    guard left >= Self.leastWorthStarting else {
      return .failure(.notesTimedOut(evidence: "The time budget ran out before this note folder."))
    }
    do {
      return .success(try store.notes(inNoteFolderIdentified: identifier, within: left))
    } catch {
      return .failure(.notes(error))
    }
  }

  private func asking(
    _ ask: () throws(NotesUnreadable) -> Permission
  ) -> Result<Permission, NamedFailure> {
    do {
      return .success(try ask())
    } catch {
      return .failure(.notes(error))
    }
  }

  private func whenNotesMayBeControlled<Answer>(
    _ read: () -> Result<Answer, NamedFailure>
  ) -> Result<Answer, NamedFailure> {
    permission().flatMap { held in
      held.whenItAllows(\.allowsReading, else: NamedFailure.notesPermissionMissing, read)
    }
  }
}

extension HeldNote {
  /// Whether the title or the text mentions the search text, ignoring case the way the
  /// reminders do: both sides are upper-cased and compared code unit by code unit, so the
  /// server's fake store folds the same way. It is compared and never interpreted: a quote or
  /// a `.*` matches only itself. A locked or unread text mentions nothing.
  func mentions(_ searchText: String) -> Bool {
    let sought = searchText.uppercased()
    let readText: String = if case .read(let text) = text { text } else { "" }
    return [title, readText].contains {
      $0.uppercased().range(of: sought, options: .literal) != nil
    }
  }
}

extension NoteFolder {
  var asFields: [String: Any] {
    [
      "identifier": identifier, "name": name,
      "account": ["identifier": account.identifier, "name": account.name],
    ]
  }
}

extension UnreadNoteFolder {
  var asFields: [String: Any] {
    failure.asFields.merging(["noteFolder": identifier]) { failureField, _ in failureField }
  }
}

extension HeldNote {
  /// A note as an index carries it: small fixed fields and never its text, so an answer's size
  /// does not depend on how much anybody wrote.
  var asIndexFields: [String: Any] {
    [
      "identifier": identifier, "title": title, "modified": Instant.written(modified),
      "isLocked": isLocked,
    ]
  }
}

extension FoundNote {
  var asFields: [String: Any] {
    note.asIndexFields.merging(["noteFolder": noteFolderIdentifier]) { index, _ in index }
  }
}

extension NoteInFull {
  /// A note in full. Text that could not be had is null, never an empty string that would read
  /// as a note with nothing in it, and `textUnread` tells a failed read from a locked note.
  var asFields: [String: Any] {
    let text: Any = if case .read(let read) = note.text { read } else { NSNull() }
    return note.asIndexFields.merging([
      "text": text, "textUnread": note.text == .unread, "attachments": attachments,
      "noteFolder": noteFolder.asFields,
    ]) { index, _ in index }
  }
}
