import Testing

@testable import HelperCore

// A bare national number on a contact card names a handle only while no other handle the store
// holds has its digits (#17), so the server asks for every handle the store holds.
@Suite("asking for the handles")
struct AskingForTheHandlesSpec {
  let asking = #"{"protocolVersion":1,"id":"8","request":"handles"}"#

  @Test("answers every handle the message store holds, each once, in order")
  func answersEveryHandle() {
    let store = AMessageStoreFile()
      .chat("iMessage;-;+447700900123", with: ["+447700900123"])
      .chat("iMessage;+;chat001", group: true, with: ["+447700900123", "ben@example.com"])

    #expect(
      helperReading(store).respond(to: asking)
        == #"{"id":"8","protocolVersion":1,"result":{"handles":["+447700900123","ben@example.com"]}}"#)
  }

  @Test("given no message store on this Mac, fails as not found rather than answering none")
  func failsWithoutAStore() {
    #expect(
      helperReading(messagesAt: "/nonexistent/chat.db").respond(to: asking)
        .contains(#""code":"message_store_not_found""#))
  }
}
