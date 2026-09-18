import Foundation
import Testing

@testable import HelperCore

@Suite("asking for a chat's messages")
struct AskingForAChatSpec {
  let climbing = "iMessage;+;chat001"

  func asking(_ chat: String, limit: Int = 50, range: String = "") -> String {
    let chatField = String(
      data: try! JSONSerialization.data(withJSONObject: chat, options: .fragmentsAllowed),
      encoding: .utf8)!
    return #"{"protocolVersion":1,"id":"6","request":"chat_messages","chat":\#(chatField),"limit":\#(limit)\#(range)}"#
  }

  var aClimbingChat: AMessageStoreFile {
    AMessageStoreFile()
      .chat(climbing, group: true, with: ["+15551230001", "ben@example.com"])
      .message(in: climbing, from: "ben@example.com", text: "Wall at 6?", at: nineOClock)
      .message(in: climbing, text: "I'm in", at: nineOClock.addingTimeInterval(300), direction: .outgoing)
  }

  // Upstream #62 matched messages by handle alone, which dropped everything the user sent and
  // every group chat (MSG-C3, MSG-V1).
  @Test("answers the chat's messages from both sides in time order, each with its direction, handle, timestamp, service and, for the user's, how far it got")
  func answersBothSidesInTimeOrder() {
    #expect(
      helperReading(aClimbingChat).respond(to: asking(climbing))
        == #"""
        {"id":"6","protocolVersion":1,"result":{"messages":[{"chat":"iMessage;+;chat001","delivery":null,"direction":"incoming","handle":"ben@example.com","identifier":"message-1","service":"iMessage","text":"Wall at 6?","timestamp":"2026-09-18T09:00:00Z"},{"chat":"iMessage;+;chat001","delivery":{"delivered":false,"error":null,"sent":true},"direction":"outgoing","handle":null,"identifier":"message-2","service":"iMessage","text":"I'm in","timestamp":"2026-09-18T09:05:00Z"}],"truncated":false}}
        """#)
  }

  // faces-sh 431f4b1: a tapback is stored as a message row, and read back it looked like someone
  // had written "Loved “Wall at 6?”".
  @Test("given a reaction to a message, leaves it out: a reaction is not a message")
  func leavesOutReactions() {
    let store = aClimbingChat.message(
      in: climbing, from: "ben@example.com", text: "Loved “I'm in”",
      at: nineOClock.addingTimeInterval(600), reaction: true)

    #expect(!helperReading(store).respond(to: asking(climbing)).contains("Loved"))
  }

  @Test("given a group event such as a rename, leaves it out: nobody wrote it to the chat")
  func leavesOutGroupEvents() {
    let store = aClimbingChat.message(
      in: climbing, from: "ben@example.com", text: "Ben named the conversation",
      at: nineOClock.addingTimeInterval(600), groupEvent: true)

    #expect(!helperReading(store).respond(to: asking(climbing)).contains("named the conversation"))
  }

  @Test("given more messages than asked for, answers the newest in time order and says older ones were left")
  func answersTheNewest() {
    let response = helperReading(aClimbingChat).respond(to: asking(climbing, limit: 1))

    #expect(response.contains("I'm in"))
    #expect(!response.contains("Wall at 6?"))
    #expect(response.contains(#""truncated":true"#))
  }

  @Test("given a range, answers the messages from its first instant up to, not including, its end")
  func answersWithinTheRange() {
    let range = #","range":{"start":"2026-09-18T09:00:00Z","end":"2026-09-18T09:05:00Z"}"#

    let response = helperReading(aClimbingChat).respond(to: asking(climbing, range: range))

    #expect(response.contains("Wall at 6?"))
    #expect(!response.contains("I'm in"))
  }

  @Test("given a range with only one bound, reads from it or up to it")
  func answersWithinAnOpenRange() {
    let range = #","range":{"start":"2026-09-18T09:01:00Z","end":null}"#

    let response = helperReading(aClimbingChat).respond(to: asking(climbing, range: range))

    #expect(!response.contains("Wall at 6?"))
    #expect(response.contains("I'm in"))
  }

  @Test("given a range whose end is not after its start, refuses the request rather than answering with no messages")
  func refusesABackwardsRange() {
    for range in [
      #","range":{"start":"2026-09-18T10:00:00Z","end":"2026-09-18T09:00:00Z"}"#,
      #","range":{"start":"2026-09-18T10:00:00Z","end":"2026-09-18T10:00:00Z"}"#,
    ] {
      #expect(
        helperReading(aClimbingChat).respond(to: asking(climbing, range: range))
          .contains(#""code":"request_malformed""#))
    }
  }

  // ADR-0005: a failed send is not real traffic. Shown as a plain outgoing message, it would read
  // as something the other person received.
  @Test("given one of the user's sends that failed, says it was not sent and gives its delivery error")
  func marksAFailedSend() {
    let store = aClimbingChat.message(
      in: climbing, text: "Anyone?", at: nineOClock.addingTimeInterval(600), direction: .outgoing,
      sent: false, deliveryError: 22)

    #expect(
      helperReading(store).respond(to: asking(climbing))
        .contains(
          #""delivery":{"delivered":false,"error":22,"sent":false},"direction":"outgoing""#
        ))
  }

  @Test("given the user's send that was delivered, says it was sent and delivered, with no delivery error")
  func marksADeliveredSend() {
    let store = aClimbingChat.message(
      in: climbing, text: "Here", at: nineOClock.addingTimeInterval(600), direction: .outgoing,
      delivered: true)

    #expect(
      helperReading(store).respond(to: asking(climbing))
        .contains(#""delivery":{"delivered":true,"error":null,"sent":true},"direction":"outgoing""#))
  }

  @Test("given a bound that is not an instant, refuses the request rather than reading without it")
  func refusesAnUnreadableBound() {
    let range = #","range":{"start":"last tuesday","end":null}"#

    #expect(
      helperReading(aClimbingChat).respond(to: asking(climbing, range: range))
        .contains(#""code":"request_malformed""#))
  }

  @Test("given a chat identifier no chat has, refuses it as unknown rather than answering with no messages")
  func refusesAnUnknownChat() {
    let response = helperReading(aClimbingChat).respond(to: asking("iMessage;-;nobody"))

    #expect(response.contains(#""code":"chat_unknown""#))
    #expect(response.contains("iMessage;-;nobody"))
  }

  // Upstream #62 built its SQL out of the handle it was given; a quote in it ended the string.
  @Test("given a chat identifier full of quotes and SQL, matches it literally and changes nothing")
  func matchesAHostileIdentifierLiterally() {
    let hostile = "x'; DROP TABLE message; --"
    let store = aClimbingChat
      .chat(hostile, with: ["ben@example.com"])
      .message(in: hostile, from: "ben@example.com", text: "Odd one", at: nineOClock)
    let helper = helperReading(store)

    #expect(helper.respond(to: asking(hostile)).contains("Odd one"))
    #expect(helper.respond(to: asking(climbing)).contains("Wall at 6?"))
  }

  @Test("reads the store without changing a byte of it")
  func leavesTheStoreAsItWas() throws {
    let store = aClimbingChat
    let before = try Data(contentsOf: URL(fileURLWithPath: store.path))

    _ = helperReading(store).respond(to: asking(climbing))
    _ = helperReading(store).respond(to: #"{"protocolVersion":1,"id":"5","request":"chats","limit":5}"#)

    #expect(try Data(contentsOf: URL(fileURLWithPath: store.path)) == before)
  }
}
