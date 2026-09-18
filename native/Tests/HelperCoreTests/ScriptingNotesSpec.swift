import Foundation
import Testing

@testable import HelperCore

// Notes has no framework, so it is scripted. Upstream built each script out of strings, with the
// folder name and the search text spliced in (upstream #67, #58, #75). Here the scripts are
// constants compiled into the helper, and everything that varies travels beside them as JSON.
@Suite("scripting Notes")
struct ScriptingNotesSpec {
  let folders = #"""
    {"noteFolders":[{"identifier":"folder-1","name":"Notes","account":{"identifier":"account-icloud","name":"iCloud"}}]}
    """#

  @Test("reads the note folders out of what the note-folders script answers, and hands that script nothing")
  func readsTheNoteFolders() throws {
    let runner = FakeScriptRunner().answering("note_folders", with: folders)

    let read = try ScriptedNoteStore(runner: runner).noteFolders(within: 8)

    #expect(read == [iCloudNotes])
    #expect(runner.runs.map(\.script) == ["note_folders"])
    #expect(runner.runs.first?.arguments.isEmpty == true)
  }

  @Test("given a note folder to read, hands its identifier to the script as an argument and never as part of the script, with the time it may take")
  func handsTheNoteFolderOverAsAnArgument() throws {
    let hostile = #"x" & (do shell script "id") & ""#
    let runner = FakeScriptRunner().answering("notes_in_note_folder", with: #"{"notes":[]}"#)

    _ = try ScriptedNoteStore(runner: runner).notes(inNoteFolderIdentified: hostile, within: 3)

    #expect(runner.runs.first?.arguments["noteFolder"] as? String == hostile)
    #expect(runner.budgets == [3])
    #expect(!NotesScripts.notesInNoteFolder.source.contains("do shell script"))
  }

  @Test("reads each note's title, when it was modified and its text out of the script's answer, the title exactly as the store reports it")
  func readsTheNotesOfANoteFolder() throws {
    let runner = FakeScriptRunner().answering(
      "notes_in_note_folder",
      with: #"""
        {"notes":[{"identifier":"note-1","title":"Groceries","modified":"2026-09-10T09:00:00.000Z","textState":"read","text":"Shopping\nMilk"},{"identifier":"note-2","title":"Safe code","modified":"2026-09-10T09:00:00Z","textState":"locked","text":null},{"identifier":"note-3","title":"Scans","modified":"2026-09-10T09:00:00Z","textState":"unread","text":null}]}
        """#)

    let notes = try ScriptedNoteStore(runner: runner)
      .notes(inNoteFolderIdentified: "folder-1", within: 8)

    #expect(
      notes == [
        aNote("note-1", titled: "Groceries", saying: "Shopping\nMilk"),
        aLockedNote("note-2", titled: "Safe code"),
        aNoteWhoseTextWouldNotBeRead("note-3", titled: "Scans"),
      ])
  }

  // An empty date once became the year 1, and a note dated to the year 1 is an invented note.
  @Test("given a note with a date that cannot be read, or text in a state it has never heard of, refuses the whole answer rather than inventing the note")
  func refusesANoteItCannotRead() {
    let undated = FakeScriptRunner().answering(
      "notes_in_note_folder",
      with: #"""
        {"notes":[{"identifier":"note-1","title":"Groceries","modified":"","textState":"read","text":"Milk"}]}
        """#)

    #expect(throws: NotesUnreadable.self) {
      try ScriptedNoteStore(runner: undated).notes(inNoteFolderIdentified: "folder-1", within: 8)
    }
  }

  @Test("given a note that is not there, or is kept outside the note folders asked about, answers with nothing rather than a failure")
  func answersWithNothingForAMissingNote() throws {
    let runner = FakeScriptRunner().answering("note", with: #"{"note":null}"#)
    let store = ScriptedNoteStore(runner: runner)

    #expect(
      try store.note(identifier: "note-gone", inNoteFoldersIdentified: ["folder-1"], within: 8)
        == nil)
    #expect(runner.runs.first?.arguments["identifier"] as? String == "note-gone")
    #expect(runner.runs.first?.arguments["noteFolders"] as? [String] == ["folder-1"])
  }

  @Test("given one note, reads it in full together with the note folder the script found it in and how many attachments it has")
  func readsOneNoteInFull() throws {
    let runner = FakeScriptRunner().answering(
      "note",
      with: #"""
        {"note":{"note":{"identifier":"note-1","title":"Groceries","modified":"2026-09-10T09:00:00Z","textState":"read","text":"Milk"},"attachments":2,"noteFolder":{"identifier":"folder-1","name":"Notes","account":{"identifier":"account-icloud","name":"iCloud"}}}}
        """#)

    let found = try ScriptedNoteStore(runner: runner)
      .note(identifier: "note-1", inNoteFoldersIdentified: ["folder-1"], within: 8)

    #expect(found?.noteFolder == iCloudNotes)
    #expect(found?.attachments == 2)
    #expect(found?.note.text == .read("Milk"))
  }

  // Bulk reads of a large folder fail with -1741 (#6). What Notes said goes up verbatim: that
  // number is the only clue anybody gets.
  @Test("given the script fails, reports that Notes could not be read with the error's number and words, verbatim")
  func reportsAScriptThatFailed() {
    let runner = FakeScriptRunner().failing(
      "notes_in_note_folder", with: ScriptFailed(number: -1741, message: "An error occurred."))

    #expect(throws: NotesUnreadable(number: -1741, evidence: "An error occurred. (-1741)")) {
      try ScriptedNoteStore(runner: runner).notes(inNoteFolderIdentified: "folder-1", within: 8)
    }
  }

  @Test("given the script answers with something that is not the record it promised, reports that rather than reading it as no notes")
  func reportsAnAnswerItCannotRead() {
    let runner = FakeScriptRunner().answering("notes_in_note_folder", with: #"{"oops":true}"#)

    #expect(throws: NotesUnreadable.self) {
      try ScriptedNoteStore(runner: runner).notes(inNoteFolderIdentified: "folder-1", within: 8)
    }
  }

  @Test("holds, and asks for, the permission to control Notes and no other app")
  func asksForNotesAndNothingElse() throws {
    let runner = FakeScriptRunner()
    let store = ScriptedNoteStore(runner: runner)

    _ = try store.permission()
    _ = try store.requestPermission()

    #expect(runner.asked.map(\.app) == [notesApp, notesApp])
    #expect(runner.asked.map(\.asking) == [false, true])
  }

  // ANierbeck 3005df4: a Notes that never came up read as "you have no notes".
  @Test("given Notes will not start, says so with what happened, rather than reporting a permission nobody was asked for")
  func saysWhenNotesWillNotStart() {
    let runner = FakeScriptRunner()
    runner.failsToStart = ScriptFailed.didNotStart(notesApp, within: 5)

    #expect(
      throws: NotesUnreadable(
        number: -600, evidence: "Notes did not start within 5 seconds. (-600)")
    ) {
      try ScriptedNoteStore(runner: runner).permission()
    }
  }
}

@Suite("the setting for controlling Notes")
struct TheSettingForControllingNotesSpec {
  // setup --remove names this setting after the helper has gone, from a copy the server keeps
  // (spec/release/permission-settings.spec.ts), so it is a constant, and this holds it to the app.
  @Test("is the entry System Settings lists Notes under, among the apps the helper may control")
  func isTheAutomationEntryForNotes() {
    #expect(notesPermissionSetting == notesApp.permissionSetting)
  }
}
