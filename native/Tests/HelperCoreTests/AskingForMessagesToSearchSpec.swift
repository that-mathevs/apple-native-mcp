import Foundation
import Testing

@testable import HelperCore

// The server parses the search query and ranks what matches; the helper scans the messages with
// their text read as a chat read reads it, so a search sees exactly what a reader would.
@Suite("asking for messages to search")
struct AskingForMessagesToSearchSpec {
  let climbing = "iMessage;+;chat001"
  let withBen = "iMessage;-;ben@example.com"
  let wholeDay = #""range":{"start":"2026-09-18T00:00:00Z","end":"2026-09-19T00:00:00Z"}"#

  func asking(chat: String = "null", ceiling: Int = 100, range: String? = nil) -> String {
    #"{"protocolVersion":1,"id":"7","request":"messages_to_search",\#(range ?? wholeDay),"chat":\#(chat),"ceiling":\#(ceiling)}"#
  }

  var twoChats: AMessageStoreFile {
    AMessageStoreFile()
      .chat(climbing, group: true, with: ["ben@example.com", "+15551230001"])
      .chat(withBen, with: ["ben@example.com"])
      .message(in: climbing, from: "ben@example.com", text: "oldest", at: nineOClock)
      .message(
        in: withBen, from: "ben@example.com", text: "middle",
        at: nineOClock.addingTimeInterval(60))
      .message(
        in: climbing, text: "newest", at: nineOClock.addingTimeInterval(120), direction: .outgoing)
  }

  @Test("answers the messages of every chat in the range, newest first, each naming its chat")
  func scansEveryChatNewestFirst() throws {
    let response = helperReading(twoChats).respond(to: asking())

    let newest = try #require(response.range(of: "newest")).lowerBound
    let middle = try #require(response.range(of: "middle")).lowerBound
    let oldest = try #require(response.range(of: "oldest")).lowerBound
    #expect(newest < middle && middle < oldest)
    #expect(response.contains(#""chat":"iMessage;-;ben@example.com""#))
    #expect(response.contains(#""truncated":false"#))
  }

  @Test("given more messages than its ceiling, answers the newest and says it stopped")
  func stopsAtTheCeiling() {
    let response = helperReading(twoChats).respond(to: asking(ceiling: 2))

    #expect(!response.contains("oldest"))
    #expect(response.contains(#""truncated":true"#))
  }

  @Test("given a chat, answers that chat's messages alone")
  func scansOneChat() {
    let response = helperReading(twoChats).respond(to: asking(chat: #""\#(withBen)""#))

    #expect(response.contains("middle"))
    #expect(!response.contains("newest"))
  }

  @Test("given a chat no chat is, refuses it as unknown rather than answering with nothing")
  func refusesAnUnknownChat() {
    #expect(
      helperReading(twoChats).respond(to: asking(chat: #""iMessage;-;nobody""#))
        .contains(#""code":"chat_unknown""#))
  }

  @Test("leaves out reactions, which nobody wrote to a chat")
  func leavesOutReactions() {
    let store = twoChats.message(
      in: climbing, from: "ben@example.com", text: "Loved “newest”",
      at: nineOClock.addingTimeInterval(180), reaction: true)

    #expect(!helperReading(store).respond(to: asking()).contains("Loved"))
  }

  @Test("reads each message's text as a chat read does, from its archived text first")
  func readsArchivedText() {
    let store = twoChats.message(
      in: withBen, from: "ben@example.com",
      archive: anArchive(of: written("bring the rope")), at: nineOClock.addingTimeInterval(240))

    #expect(helperReading(store).respond(to: asking()).contains(#""text":"bring the rope""#))
  }

  @Test("given no range, or a ceiling past what it scans, refuses the request rather than choosing")
  func refusesWhatItWouldHaveToChoose() {
    let helper = helperReading(twoChats)

    #expect(helper.respond(to: asking(range: #""range":null"#)).contains("request_malformed"))
    #expect(helper.respond(to: asking(ceiling: 20_001)).contains("request_malformed"))
  }
}
