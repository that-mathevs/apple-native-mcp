import Foundation

public let notesApp = ScriptedApp(bundleIdentifier: "com.apple.Notes", name: "Notes")

/// Notes as its scripts reach it. Every script is a constant, every argument is JSON beside it,
/// and what comes back is decoded into the helper's own types or refused.
public struct ScriptedNoteStore: NoteStore {
  private let runner: ScriptRunner

  public init(runner: ScriptRunner) {
    self.runner = runner
  }

  public func permission() throws(NotesUnreadable) -> Permission {
    try permission(asking: false)
  }

  public func requestPermission() throws(NotesUnreadable) -> Permission {
    try permission(asking: true)
  }

  public func noteFolders(within budget: TimeInterval) throws(NotesUnreadable) -> [NoteFolder] {
    let answer: NoteFoldersAnswer = try asking(NotesScripts.noteFolders, [:], within: budget)
    return answer.noteFolders.map(\.noteFolder)
  }

  public func notes(
    inNoteFolderIdentified identifier: String, within budget: TimeInterval
  ) throws(NotesUnreadable) -> [HeldNote] {
    let answer: NotesAnswer = try asking(
      NotesScripts.notesInNoteFolder, ["noteFolder": identifier], within: budget)
    return try answer.notes.map { (record) throws(NotesUnreadable) in try record.heldNote() }
  }

  public func note(
    identifier: String, inNoteFoldersIdentified allowed: [String], within budget: TimeInterval
  ) throws(NotesUnreadable) -> NoteInFull? {
    let answer: NoteAnswer = try asking(
      NotesScripts.note, ["identifier": identifier, "noteFolders": allowed], within: budget)
    guard let found = answer.note else { return nil }
    return NoteInFull(
      note: try found.note.heldNote(), noteFolder: found.noteFolder.noteFolder,
      attachments: found.attachments)
  }

  private func permission(asking: Bool) throws(NotesUnreadable) -> Permission {
    do {
      return try runner.automationPermission(for: notesApp, asking: asking)
    } catch {
      throw NotesUnreadable(number: error.number, evidence: error.evidence)
    }
  }

  private func asking<Answer: Decodable>(
    _ script: StaticScript, _ arguments: [String: Any], within budget: TimeInterval
  ) throws(NotesUnreadable) -> Answer {
    let json: Data
    do {
      json = try runner.run(script, arguments: arguments, within: budget)
    } catch {
      throw NotesUnreadable(number: error.number, evidence: error.evidence)
    }

    do {
      return try JSONDecoder().decode(Answer.self, from: json)
    } catch {
      throw NotesUnreadable(
        number: nil,
        evidence: "The \(script.name) script answered with a record this helper cannot read.")
    }
  }
}

// What the scripts answer with. A field that is missing or of the wrong kind fails the whole
// decode: an untitled note invented out of a malformed answer is worse than no answer.

private struct NoteFoldersAnswer: Decodable {
  let noteFolders: [NoteFolderRecord]
}

private struct NotesAnswer: Decodable {
  let notes: [NoteRecord]
}

private struct NoteAnswer: Decodable {
  struct Found: Decodable {
    let note: NoteRecord
    let noteFolder: NoteFolderRecord
    let attachments: Int
  }

  let note: Found?
}

private struct NoteFolderRecord: Decodable {
  struct Account: Decodable {
    let identifier: String
    let name: String
  }

  let identifier: String
  let name: String
  let account: Account

  var noteFolder: NoteFolder {
    NoteFolder(
      identifier: identifier, name: name,
      account: NotesAccount(identifier: account.identifier, name: account.name))
  }
}

private struct NoteRecord: Decodable {
  let identifier: String
  let title: String
  let modified: String
  /// "read", "locked" or "unread": what could be had of the text, said rather than implied.
  let textState: String
  let text: String?

  /// A date that cannot be read, or a state the helper has never heard of, refuses the whole
  /// answer: a note dated to the year 1 is an invented note.
  func heldNote() throws(NotesUnreadable) -> HeldNote {
    guard let modified = Instant.read(modified), let text = noteText else {
      throw NotesUnreadable(
        number: nil, evidence: "The script answered with a note this helper cannot read.")
    }
    return HeldNote(identifier: identifier, title: title, modified: modified, text: text)
  }

  private var noteText: NoteText? {
    switch (textState, text) {
    case ("read", .some(let text)): .read(text)
    case ("locked", _): .locked
    case ("unread", _): .unread
    default: nil
    }
  }
}
