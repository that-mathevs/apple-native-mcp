import Testing

@testable import HelperCore

// Upstream put the search text and the note's name into the script it ran, where a quote
// ended the string and the rest ran (upstream #67, #58, #75). Here they are fields of a JSON
// request, compared by the helper and never made part of anything that runs.
@Suite("asking for notes")
struct AskingForNotesSpec {
  let boiler = aNote("note-boiler", titled: "Boiler", saying: "The number is on the fridge.")

  @Test("names every note folder with its identifier and the notes account it belongs to, so two folders called Notes stay apart")
  func namesEveryNoteFolder() {
    let helper = helperReading(aNoteStore().holding(in: iCloudNotes).holding(in: localNotes))

    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"9","request":"note_folders"}"#)
        == #"""
        {"id":"9","protocolVersion":1,"result":{"noteFolders":[{"account":{"identifier":"account-icloud","name":"iCloud"},"identifier":"folder-1","name":"Notes"},{"account":{"identifier":"account-local","name":"On My Mac"},"identifier":"folder-2","name":"Notes"}]}}
        """#)
  }

  // faces-sh 94149a2: an index that carried every note's text was 2.3 MB.
  @Test("given a search, answers with the notes that mention the search text, each with the note folder it was read from and never its text")
  func answersASearchWithoutAnyText() {
    let helper = helperReading(aNoteStore().holding(boiler, in: iCloudNotes))

    let response = helper.respond(
      to: #"""
        {"protocolVersion":1,"id":"9","request":"notes_mentioning","text":"FRIDGE","noteFolders":["folder-1"]}
        """#)

    #expect(
      response
        == #"""
        {"id":"9","protocolVersion":1,"result":{"notes":[{"identifier":"note-boiler","isLocked":false,"modified":"2026-09-10T09:00:00Z","noteFolder":"folder-1","title":"Boiler"}],"notesUnread":0,"unreadNoteFolders":[]}}
        """#)
  }

  @Test("given a search that names no text or no note folders, refuses it: the helper never decides what to search or where")
  func refusesASearchThatLeavesOutWhatOrWhere() {
    let helper = helperReading(aNoteStore().holding(boiler, in: iCloudNotes))
    let noText = helper.respond(
      to: #"""
        {"protocolVersion":1,"id":"9","request":"notes_mentioning","noteFolders":["folder-1"]}
        """#)
    let noFolders = helper.respond(
      to: #"{"protocolVersion":1,"id":"9","request":"notes_mentioning","text":"fridge"}"#)
    let emptyText = helper.respond(
      to: #"""
        {"protocolVersion":1,"id":"9","request":"notes_mentioning","text":"","noteFolders":["folder-1"]}
        """#)

    #expect(noText.contains(#""code":"request_malformed""#))
    #expect(noFolders.contains(#""code":"request_malformed""#))
    #expect(emptyText.contains(#""code":"request_malformed""#))
  }

  @Test("given a note identifier, returns the note in full: its text, how many attachments its text leaves out, and where it is kept")
  func returnsOneNoteInFull() {
    let shopping = aNote("note-shopping", titled: "Groceries", saying: "Shopping\nMilk")
    let helper = helperReading(
      aNoteStore().holding(shopping, in: localNotes).with(2, attachmentsOn: "note-shopping"))

    let response = helper.respond(
      to: #"""
        {"protocolVersion":1,"id":"9","request":"note","identifier":"note-shopping","noteFolders":["folder-2"]}
        """#)

    #expect(response.contains(#""text":"Shopping\nMilk""#))
    #expect(response.contains(#""attachments":2"#))
    #expect(response.contains(#""title":"Groceries""#))
    #expect(response.contains(#""identifier":"folder-2""#))
  }

  @Test("given a locked note, says it is locked and sends no text at all, rather than an empty one")
  func sendsNoTextForALockedNote() {
    let pins = aLockedNote("note-pins", titled: "Safe code")
    let response = helperReading(aNoteStore().holding(pins, in: iCloudNotes)).respond(
      to: #"""
        {"protocolVersion":1,"id":"9","request":"note","identifier":"note-pins","noteFolders":["folder-1"]}
        """#)

    #expect(response.contains(#""isLocked":true"#))
    #expect(response.contains(#""text":null"#))
    #expect(response.contains(#""textUnread":false"#))
  }

  @Test("given an identifier no note has, answers with no note rather than a failure")
  func answersWithNoNote() {
    #expect(
      helperReading(aNoteStore().holding(in: iCloudNotes)).respond(
        to: #"""
          {"protocolVersion":1,"id":"9","request":"note","identifier":"note-gone","noteFolders":["folder-1"]}
          """#)
        == #"{"id":"9","protocolVersion":1,"result":{"note":null}}"#)
  }

  // The server says which note folders a note may be read from; the helper never decides.
  @Test("given a request for a note that does not say which note folders it may be read from, refuses it")
  func refusesANoteRequestWithNoNoteFolders() {
    let response = helperReading(aNoteStore().holding(boiler, in: iCloudNotes)).respond(
      to: #"{"protocolVersion":1,"id":"9","request":"note","identifier":"note-boiler"}"#)
    #expect(response.contains(#""code":"request_malformed""#))
  }

  @Test("given Notes may not be controlled, refuses every notes request and names the setting to change")
  func refusesWithoutThePermission() {
    let helper = helperReading(aNoteStore().holding(boiler, in: iCloudNotes).permission(.refused))

    for request in [
      #"{"protocolVersion":1,"id":"9","request":"note_folders"}"#,
      #"""
      {"protocolVersion":1,"id":"9","request":"note","identifier":"note-boiler","noteFolders":[]}
      """#,
    ] {
      let response = helper.respond(to: request)
      #expect(response.contains(#""code":"notes_permission_missing""#))
      #expect(response.contains("Automation > apple-native-mcp > Notes"))
    }
  }

  @Test("reports whether Notes may be controlled without reading a single note")
  func reportsThePermission() {
    #expect(
      helperReading(aNoteStore().permission(.undecided)).respond(
        to: #"{"protocolVersion":1,"id":"9","request":"notes_permission"}"#)
        == #"{"id":"9","protocolVersion":1,"result":{"state":"undecided"}}"#)
  }
}
