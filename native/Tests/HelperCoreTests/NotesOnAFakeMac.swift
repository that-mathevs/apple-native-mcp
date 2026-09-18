import Foundation

@testable import HelperCore

// The words a notes scenario uses to set a Mac up without having one.

let iCloudNotesAccount = NotesAccount(identifier: "account-icloud", name: "iCloud")
let localNotesAccount = NotesAccount(identifier: "account-local", name: "On My Mac")

let iCloudNotes = NoteFolder(identifier: "folder-1", name: "Notes", account: iCloudNotesAccount)
let localNotes = NoteFolder(identifier: "folder-2", name: "Notes", account: localNotesAccount)

func aNote(
  _ identifier: String, titled title: String, saying text: String,
  modified: String = "2026-09-10T09:00:00Z"
) -> HeldNote {
  HeldNote(identifier: identifier, title: title, modified: at(modified), text: .read(text))
}

func aLockedNote(_ identifier: String, titled title: String) -> HeldNote {
  HeldNote(
    identifier: identifier, title: title, modified: at("2026-09-10T09:00:00Z"), text: .locked)
}

func aNoteWhoseTextWouldNotBeRead(_ identifier: String, titled title: String) -> HeldNote {
  HeldNote(
    identifier: identifier, title: title, modified: at("2026-09-10T09:00:00Z"), text: .unread)
}

/// A note store that is not a Mac's: it holds whatever a scenario says it holds.
struct FakeNoteStore: NoteStore {
  final class Reads: @unchecked Sendable {
    var noteFolders: [String] = []
    var budgets: [TimeInterval] = []
  }

  var permissionHeld: Permission = .granted
  var held: [(NoteFolder, [HeldNote])] = []
  var attachments: [String: Int] = [:]
  var refusing: [String: NotesUnreadable] = [:]
  var failsToStart: NotesUnreadable?
  /// How long each note folder takes to read, on the scenario's own clock.
  var taking: @Sendable (String) -> Void = { _ in }
  let reads = Reads()

  func permission() throws(NotesUnreadable) -> Permission {
    if let failure = failsToStart { throw failure }
    return permissionHeld
  }

  func requestPermission() throws(NotesUnreadable) -> Permission { try permission() }

  func noteFolders(within budget: TimeInterval) throws(NotesUnreadable) -> [NoteFolder] {
    held.map(\.0)
  }

  func notes(
    inNoteFolderIdentified identifier: String, within budget: TimeInterval
  ) throws(NotesUnreadable) -> [HeldNote] {
    reads.noteFolders.append(identifier)
    reads.budgets.append(budget)
    taking(identifier)
    if let failure = refusing[identifier] { throw failure }
    return held.first { $0.0.identifier == identifier }?.1 ?? []
  }

  func note(
    identifier: String, inNoteFoldersIdentified allowed: [String], within budget: TimeInterval
  ) throws(NotesUnreadable) -> NoteInFull? {
    for (noteFolder, notes) in held where allowed.contains(noteFolder.identifier) {
      if let note = notes.first(where: { $0.identifier == identifier }) {
        return NoteInFull(
          note: note, noteFolder: noteFolder, attachments: attachments[identifier] ?? 0)
      }
    }
    return nil
  }

  func holding(_ notes: HeldNote..., in noteFolder: NoteFolder) -> FakeNoteStore {
    var store = self
    store.held.append((noteFolder, notes))
    return store
  }

  func with(_ count: Int, attachmentsOn identifier: String) -> FakeNoteStore {
    var store = self
    store.attachments[identifier] = count
    return store
  }

  func unableToRead(_ noteFolder: NoteFolder, saying failure: NotesUnreadable) -> FakeNoteStore {
    var store = self
    store.refusing[noteFolder.identifier] = failure
    return store
  }

  func permission(_ permission: Permission) -> FakeNoteStore {
    var store = self
    store.permissionHeld = permission
    return store
  }

  func whereNotesWillNotStart(saying failure: NotesUnreadable) -> FakeNoteStore {
    var store = self
    store.failsToStart = failure
    return store
  }
}

func aNoteStore() -> FakeNoteStore { FakeNoteStore() }

func readingNotes(_ store: FakeNoteStore) -> NotesReading { NotesReading(store: store) }

func helperReading(_ store: FakeNoteStore) -> Helper { aHelper(noteStore: store) }

extension Result where Failure == NamedFailure {
  /// What a read came to, for scenarios about a read that succeeds.
  var read: Success { try! get() }
}
