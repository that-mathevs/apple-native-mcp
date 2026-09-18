import Darwin
import Foundation
import Testing

@testable import HelperCore

@Suite("asking for the chats")
struct AskingForTheChatsSpec {
  let asking = #"{"protocolVersion":1,"id":"5","request":"chats","limit":20}"#

  // User story 24: a reply meant for one person must not land in a group by accident.
  @Test("lists one entry per chat, newest first, each with its kind and its participants' handles")
  func listsTheChatsNewestFirst() {
    let store = AMessageStoreFile()
      .chat("iMessage;-;+15551230001", with: ["+15551230001"])
      .chat("iMessage;+;chat001", group: true, with: ["+15551230001", "ben@example.com"])
      .message(in: "iMessage;-;+15551230001", from: "+15551230001", text: "Hi", at: nineOClock)
      .message(
        in: "iMessage;+;chat001", from: "ben@example.com", text: "Wall at 6?",
        at: nineOClock.addingTimeInterval(60))

    #expect(
      helperReading(store).respond(to: asking)
        == #"""
        {"id":"5","protocolVersion":1,"result":{"chats":[{"identifier":"iMessage;+;chat001","kind":"group","lastTimestamp":"2026-09-18T09:01:00Z","participants":["+15551230001","ben@example.com"]},{"identifier":"iMessage;-;+15551230001","kind":"one-to-one","lastTimestamp":"2026-09-18T09:00:00Z","participants":["+15551230001"]}],"truncated":false}}
        """#)
  }

  // Upstream #48: a send to a string Messages did not know created a chat holding nothing but the
  // failed send. It is not a conversation, and listing it would offer it as someone to reply to.
  @Test("given a chat holding only the user's own failed sends, leaves it out: a failed send is not real traffic")
  func leavesOutAGhostChat() {
    let store = AMessageStoreFile()
      .chat("iMessage;-;Anna", with: ["Anna"])
      .message(
        in: "iMessage;-;Anna", text: "Hi Anna", at: nineOClock, direction: .outgoing, sent: false,
        deliveryError: 22)

    #expect(
      helperReading(store).respond(to: asking)
        == #"{"id":"5","protocolVersion":1,"result":{"chats":[],"truncated":false}}"#)
  }

  @Test("given a chat whose only traffic is the user's delivered messages, lists it: the store confirmed they left")
  func listsAChatOfDeliveredSends() {
    let store = AMessageStoreFile()
      .chat("iMessage;-;+15551230001", with: ["+15551230001"])
      .message(in: "iMessage;-;+15551230001", text: "On my way", at: nineOClock, direction: .outgoing)

    #expect(helperReading(store).respond(to: asking).contains("iMessage;-;+15551230001"))
  }

  // faces-sh cad640a counted participants; a group down to one other person then read as a
  // one-to-one chat, and a reply meant for it would reach one person privately.
  @Test("given a group chat left with one other person, still calls it a group chat")
  func keepsAShrunkenGroupAGroup() {
    let store = AMessageStoreFile()
      .chat("iMessage;+;chat001", group: true, with: ["ben@example.com"])
      .message(
        in: "iMessage;+;chat001", from: "ben@example.com", text: "Just us now", at: nineOClock)

    #expect(helperReading(store).respond(to: asking).contains(#""kind":"group""#))
  }

  // A reaction is not a message (MSG-91), so it must not make a chat look newer than anything
  // read_chat would show in it.
  @Test("given a reaction as the newest thing in a chat, dates the chat by its newest message")
  func datesAChatByItsNewestMessage() {
    let store = AMessageStoreFile()
      .chat("iMessage;-;+15551230001", with: ["+15551230001"])
      .message(in: "iMessage;-;+15551230001", from: "+15551230001", text: "Hi", at: nineOClock)
      .message(
        in: "iMessage;-;+15551230001", from: "+15551230001", text: "Liked “Hi”",
        at: nineOClock.addingTimeInterval(3600), reaction: true)

    #expect(
      helperReading(store).respond(to: asking).contains(#""lastTimestamp":"2026-09-18T09:00:00Z""#))
  }

  // chrischall f1f2bb1 and ANierbeck cd72bdf read only phone numbers, and lost everyone reached by
  // email address.
  @Test("given someone reached by email address, lists the chat with that handle")
  func listsAnEmailHandle() {
    let store = AMessageStoreFile()
      .chat("iMessage;-;ana@example.com", with: ["ana@example.com"])
      .message(in: "iMessage;-;ana@example.com", from: "ana@example.com", text: "Hi", at: nineOClock)

    #expect(helperReading(store).respond(to: asking).contains(#""participants":["ana@example.com"]"#))
  }

  // morquis 96759b3 merged every chat a person was in into one stream (MSG-C3).
  @Test("given a person in a group chat and a one-to-one chat, lists the two as separate chats")
  func keepsAPersonsChatsApart() {
    let store = AMessageStoreFile()
      .chat("iMessage;-;ben@example.com", with: ["ben@example.com"])
      .chat("iMessage;+;chat001", group: true, with: ["ben@example.com", "+15551230001"])
      .message(in: "iMessage;-;ben@example.com", from: "ben@example.com", text: "1", at: nineOClock)
      .message(
        in: "iMessage;+;chat001", from: "ben@example.com", text: "2",
        at: nineOClock.addingTimeInterval(60))

    let response = helperReading(store).respond(to: asking)

    #expect(response.contains(#""identifier":"iMessage;-;ben@example.com","kind":"one-to-one""#))
    #expect(response.contains(#""identifier":"iMessage;+;chat001","kind":"group""#))
  }

  @Test("given more chats than asked for, answers the newest and says it is truncated")
  func truncatesAtTheLimit() {
    let store = AMessageStoreFile()
      .chat("iMessage;-;older", with: ["older@example.com"])
      .chat("iMessage;-;newer", with: ["newer@example.com"])
      .message(in: "iMessage;-;older", from: "older@example.com", text: "1", at: nineOClock)
      .message(
        in: "iMessage;-;newer", from: "newer@example.com", text: "2",
        at: nineOClock.addingTimeInterval(60))

    let response = helperReading(store).respond(
      to: #"{"protocolVersion":1,"id":"5","request":"chats","limit":1}"#)

    #expect(response.contains("iMessage;-;newer"))
    #expect(!response.contains("iMessage;-;older"))
    #expect(response.contains(#""truncated":true"#))
  }

  @Test("given no limit, or one outside what it answers, refuses the request rather than choosing one")
  func refusesAMissingLimit() {
    let helper = helperReading(AMessageStoreFile())
    for limit in ["", #","limit":0"#, #","limit":501"#] {
      let response = helper.respond(to: #"{"protocolVersion":1,"id":"5","request":"chats"\#(limit)}"#)
      #expect(response.contains(#""code":"request_malformed""#))
    }
  }
}

@Suite("reaching the message store")
struct ReachingTheMessageStoreSpec {
  let asking = #"{"protocolVersion":1,"id":"5","request":"chats","limit":20}"#

  // Upstream #62 and #66: a refused permission read as no messages at all.
  @Test("given macOS refuses the store, fails as a missing permission naming the setting to turn on, never as no chats")
  func failsAsAMissingPermission() {
    let store = AMessageStoreFile()
    let refusing = helperReading(messagesAt: store.path, probing: { _ in EPERM })

    let response = refusing.respond(to: asking)

    #expect(response.contains(#""code":"message_store_permission_missing""#))
    #expect(response.contains("Privacy & Security > Full Disk Access > apple-native-mcp"))
    #expect(response.contains("Operation not permitted"))
  }

  // A file the user's own access mode refuses is not one Full Disk Access would open; blaming it
  // for every refusal is what upstream #62 did (MSG-C11).
  @Test("given a store refused by its own access mode, fails as unreadable rather than as a missing permission")
  func failsAsUnreadableWhenTheModeRefuses() {
    let store = AMessageStoreFile()
    let refusing = helperReading(messagesAt: store.path, probing: { _ in EACCES })

    #expect(refusing.respond(to: asking).contains(#""code":"message_store_unreadable""#))
  }

  // faces-sh 431f4b1: Messages holds the store while it writes, and a read that waited on it
  // forever held the whole session.
  @Test("given Messages holding the store locked, waits briefly and then fails rather than hanging")
  func failsRatherThanHangingOnALock() {
    let store = AMessageStoreFile()
    store.lockedByMessages()

    let started = Date()
    let response = helperReading(store).respond(to: asking)

    let waited = Date().timeIntervalSince(started)

    #expect(response.contains(#""code":"message_store_unreadable""#))
    #expect(response.contains("database is locked"))
    #expect(waited >= 0.5 && waited < 5)
  }

  @Test("given no message store on this Mac, fails as not found rather than as a missing permission")
  func failsAsNotFound() {
    let response = helperReading(messagesAt: "/nonexistent/chat.db").respond(to: asking)

    #expect(response.contains(#""code":"message_store_not_found""#))
  }

  @Test("given a store that is there but is not a database, fails as unreadable with what the store said")
  func failsAsUnreadable() throws {
    let path = FileManager.default.temporaryDirectory
      .appendingPathComponent("apple-native-mcp-\(UUID().uuidString)-chat.db").path
    try Data("not a database at all, just text that fills a page or two".utf8).write(
      to: URL(fileURLWithPath: path))

    let response = helperReading(messagesAt: path).respond(to: asking)

    #expect(response.contains(#""code":"message_store_unreadable""#))
    #expect(response.contains("file is not a database"))
  }
}
