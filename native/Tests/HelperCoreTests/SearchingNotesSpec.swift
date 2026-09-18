import Foundation
import Testing

@testable import HelperCore

// A note's folder cannot be asked of the note: in Notes 4.13 `container` is broken, and its bulk
// form answers with nulls and no error (#6). So notes are read a note folder at a time, which is
// also what lets one folder fail on its own and keeps an excluded folder from being read at all.
@Suite("searching notes")
struct SearchingNotesSpec {
  let boiler = aNote("note-boiler", titled: "Boiler", saying: "The number is on the FRIDGE door.")
  let warranty = aNote("note-fridge", titled: "Fridge warranty", saying: "Expires in March.")

  @Test("given search text that appears only in a note's text, or only in its title, finds the note, ignoring case, and says which note folder it was in")
  func findsByTextAndByTitle() {
    let reading = readingNotes(
      aNoteStore().holding(boiler, in: iCloudNotes).holding(warranty, in: localNotes))

    let found = reading.notesMentioning("fridge", inNoteFoldersIdentified: ["folder-1", "folder-2"])
      .read

    #expect(found.notes.map(\.note.identifier) == ["note-boiler", "note-fridge"])
    #expect(found.notes.map(\.noteFolderIdentifier) == ["folder-1", "folder-2"])
  }

  @Test("searches only the note folders it was asked to, and never reads another")
  func readsOnlyTheNoteFoldersAsked() {
    let store = aNoteStore().holding(boiler, in: iCloudNotes).holding(warranty, in: localNotes)

    let found = readingNotes(store)
      .notesMentioning("fridge", inNoteFoldersIdentified: ["folder-2"]).read

    #expect(found.notes.map(\.note.identifier) == ["note-fridge"])
    #expect(store.reads.noteFolders == ["folder-2"])
  }

  // upstream #67, KassebaumEngineering 1d47e74: a quote in the search text ended the script.
  @Test("given search text full of quotes, backslashes and pattern characters, matches only notes that contain those very characters")
  func matchesSearchTextLiterally() {
    let odd = aNote("note-odd", titled: "Odd", saying: #"say "hi" \ .* $(id)"#)
    let reading = readingNotes(aNoteStore().holding(boiler, odd, in: iCloudNotes))

    let quoted = reading.notesMentioning(#""hi" \ .*"#, inNoteFoldersIdentified: ["folder-1"])
    let pattern = reading.notesMentioning(".*", inNoteFoldersIdentified: ["folder-1"])

    #expect(quoted.read.notes.map(\.note.identifier) == ["note-odd"])
    #expect(pattern.read.notes.map(\.note.identifier) == ["note-odd"])
  }

  // A locked note's text can't be read. Saying it is locked is what keeps its silence from
  // reading as "this note says nothing".
  @Test("given a locked note, finds it by its title and says it is locked")
  func findsALockedNoteByItsTitle() {
    let reading = readingNotes(
      aNoteStore().holding(aLockedNote("note-pins", titled: "Fridge safe code"), in: iCloudNotes))

    let found = reading.notesMentioning("fridge", inNoteFoldersIdentified: ["folder-1"]).read

    #expect(found.notes.map(\.note.text) == [.locked])
  }

  // NN3: a note whose text would not come back cannot be said not to mention something.
  @Test("given a note whose text would not be read, counts it as unread rather than treating it as a note that says nothing")
  func countsANoteItCouldNotRead() {
    let reading = readingNotes(
      aNoteStore().holding(
        boiler, aNoteWhoseTextWouldNotBeRead("note-huge", titled: "Scans"), in: iCloudNotes))

    let found = reading.notesMentioning("fridge", inNoteFoldersIdentified: ["folder-1"]).read

    #expect(found.notes.map(\.note.identifier) == ["note-boiler"])
    #expect(found.notesUnread == 1)
  }

  // therealap 2efb44b: a smart folder shows a note its own folder already holds (NOT-24).
  @Test("given a note that two note folders both show, reports it once")
  func reportsANoteOnce() {
    let smart = NoteFolder(identifier: "folder-smart", name: "Recent", account: iCloudNotesAccount)
    let reading = readingNotes(
      aNoteStore().holding(boiler, in: iCloudNotes).holding(boiler, in: smart))

    let found = reading.notesMentioning(
      "fridge", inNoteFoldersIdentified: ["folder-1", "folder-smart"]
    ).read

    #expect(found.notes.map(\.noteFolderIdentifier) == ["folder-1"])
  }

  @Test("given one note folder that would not be read, searches the others anyway and names the one it could not read, with what Notes said")
  func oneBadNoteFolderFailsOnItsOwn() {
    let reading = readingNotes(
      aNoteStore().holding(boiler, in: iCloudNotes).holding(warranty, in: localNotes)
        .unableToRead(
          localNotes, saying: NotesUnreadable(number: -1741, evidence: "An error occurred. (-1741)")
        ))

    let found = reading.notesMentioning("fridge", inNoteFoldersIdentified: ["folder-1", "folder-2"])
      .read

    #expect(found.notes.map(\.note.identifier) == ["note-boiler"])
    #expect(found.unreadNoteFolders.map(\.identifier) == ["folder-2"])
    #expect(found.unreadNoteFolders.first?.failure.evidence == "An error occurred. (-1741)")
  }

  // The server gives a whole request ten seconds (#61). Note folders read one after another each
  // with a budget of their own would add up past that, and the caller would hear only that the
  // helper went quiet, losing what had already been found.
  @Test("given note folders that together outlast the time budget, gives each only what is left of it, and names the ones it never reached as unread")
  func sharesOneTimeBudgetAcrossTheNoteFolders() {
    let clock = ManualClock()
    var store = aNoteStore().holding(boiler, in: iCloudNotes).holding(warranty, in: localNotes)
    store.taking = { _ in clock.advance(by: 6) }
    let reading = NotesReading(store: store, timeBudget: 8, now: clock.now)

    let found = reading.notesMentioning(
      "fridge", inNoteFoldersIdentified: ["folder-1", "folder-2", "folder-3"]
    ).read

    #expect(store.reads.budgets == [8, 2])
    #expect(found.unreadNoteFolders.map(\.identifier) == ["folder-3"])
    #expect(found.unreadNoteFolders.first?.failure.code == .notesTimedOut)
  }

  @Test("given Notes may not be controlled, refuses and names the setting rather than finding nothing")
  func refusesWithoutThePermission() {
    let reading = readingNotes(aNoteStore().holding(boiler, in: iCloudNotes).permission(.refused))

    let answer = reading.notesMentioning("fridge", inNoteFoldersIdentified: ["folder-1"])

    #expect(answer.failure?.code == .notesPermissionMissing)
    #expect(answer.failure?.sentence.contains("Automation > apple-native-mcp > Notes") == true)
  }

  // ANierbeck 3005df4 (NOT-13): a Notes that never came up read as "you have no notes", and a
  // permission that could not be asked about is not a permission nobody has been asked for.
  @Test("given Notes does not start in time, says that Notes did not start, not that a permission is missing")
  func saysWhenNotesDidNotStart() {
    let reading = readingNotes(
      aNoteStore().whereNotesWillNotStart(
        saying: NotesUnreadable(
          number: -600, evidence: "Notes did not start within 5 seconds. (-600)")))

    let answer = reading.noteFolders()

    #expect(answer.failure?.code == .notesUnreadable)
    #expect(answer.failure?.evidence.contains("did not start") == true)
  }

  // morquis 97d5918, faces-sh 42c2fd7 (X-54, X-26): told apart by number, never by wording.
  @Test("given a script refused for want of permission, or one that timed out, says which by the error's number")
  func tellsARefusalFromATimeoutByNumber() {
    let refused = readingNotes(
      aNoteStore().holding(in: iCloudNotes)
        .unableToRead(iCloudNotes, saying: NotesUnreadable(number: -1743, evidence: "(-1743)")))
    let slow = readingNotes(
      aNoteStore().holding(in: iCloudNotes)
        .unableToRead(iCloudNotes, saying: NotesUnreadable(number: -1712, evidence: "(-1712)")))

    let refusal = refused.notesMentioning("x", inNoteFoldersIdentified: ["folder-1"]).read
    let timeout = slow.notesMentioning("x", inNoteFoldersIdentified: ["folder-1"]).read

    #expect(refusal.unreadNoteFolders.first?.failure.code == .notesPermissionMissing)
    #expect(timeout.unreadNoteFolders.first?.failure.code == .notesTimedOut)
  }
}

/// A clock a scenario moves by hand, so a time budget is specified without anybody waiting.
final class ManualClock: @unchecked Sendable {
  private var instant = Date(timeIntervalSince1970: 0)

  func advance(by seconds: TimeInterval) { instant += seconds }

  var now: @Sendable () -> Date {
    { self.instant }
  }
}
