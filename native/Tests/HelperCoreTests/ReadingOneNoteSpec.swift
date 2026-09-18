import Testing

@testable import HelperCore

@Suite("reading one note")
struct ReadingOneNoteSpec {
  let shopping = aNote("note-shopping", titled: "Groceries", saying: "Shopping\nMilk")

  @Test("given a note identifier, returns the whole note, the note folder it was found in and how many attachments its text leaves out")
  func returnsTheNoteInFull() {
    let reading = readingNotes(
      aNoteStore().holding(in: iCloudNotes).holding(shopping, in: localNotes)
        .with(2, attachmentsOn: "note-shopping"))

    let found = reading.note(
      identifier: "note-shopping", inNoteFoldersIdentified: ["folder-1", "folder-2"]
    ).read

    #expect(found?.note == shopping)
    #expect(found?.noteFolder == localNotes)
    #expect(found?.attachments == 2)
  }

  // #23: forks derived a title from the first line of the text, and then renamed notes behind
  // the user's back when the text changed.
  @Test("reports the title the store reports, not the first line of the text")
  func reportsTheStoresTitle() {
    let reading = readingNotes(aNoteStore().holding(shopping, in: iCloudNotes))

    let found = reading.note(identifier: "note-shopping", inNoteFoldersIdentified: ["folder-1"])

    #expect(found.read?.note.title == "Groceries")
  }

  // Story 50: a folder the settings keep from the agent is never read. The server says which
  // note folders a note may be read from, so the text of one kept elsewhere never leaves Notes.
  @Test("given a note kept in a note folder it was not told it may read from, answers as for a note that is not there")
  func readsOnlyFromTheNoteFoldersItMay() {
    let reading = readingNotes(aNoteStore().holding(shopping, in: localNotes))

    let found = reading.note(identifier: "note-shopping", inNoteFoldersIdentified: ["folder-1"])

    #expect(found.read == nil)
  }

  @Test("given an identifier no note has, answers with nothing rather than a failure: not finding it is an answer")
  func answersWithNothingForAnUnknownNote() {
    let reading = readingNotes(aNoteStore().holding(shopping, in: iCloudNotes))

    let found = reading.note(identifier: "note-gone", inNoteFoldersIdentified: ["folder-1"])

    #expect(found.read == nil)
  }
}
