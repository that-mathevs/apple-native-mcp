import Testing

@testable import HelperCore

@Suite("reading a line of protocol")
struct ReadingALineOfProtocolSpec {
  let helper = helperReading(aCalendarStore().permitted())

  @Test("given a line that is not JSON at all, reports a malformed request and carries the line back as evidence")
  func refusesALineThatIsNotJSON() {
    #expect(
      helper.respond(to: "not json")
        == #"""
        {"failure":{"code":"request_malformed","evidence":"not json","sentence":"The helper could not read that line as a request."},"id":null,"protocolVersion":1}
        """#)
  }

  @Test("given a request with no identifier, refuses it: an answer nobody can match to a question is worse than none")
  func refusesARequestWithNoIdentifier() {
    let response = helper.respond(to: #"{"protocolVersion":1,"request":"calendar_permission"}"#)
    #expect(response.contains(#""code":"request_malformed""#))
    #expect(response.contains(#""id":null"#))
  }

  @Test("given a protocol version the helper does not speak, names the version it does speak")
  func refusesAnUnspokenProtocolVersion() {
    #expect(
      helper.respond(to: #"{"protocolVersion":2,"id":"7","request":"calendar_permission"}"#)
        == #"""
        {"failure":{"code":"protocol_version_unsupported","evidence":"2","sentence":"This helper speaks protocol version 1, so it cannot answer a request made at another version."},"id":"7","protocolVersion":1}
        """#)
  }

  @Test("given a request with no protocol version, refuses it: a version is not optional")
  func refusesARequestWithNoProtocolVersion() {
    let response = helper.respond(to: #"{"id":"7","request":"calendar_permission"}"#)
    #expect(response.contains(#""code":"request_malformed""#))
    #expect(response.contains(#""id":"7""#))
  }

  @Test("given a request it does not answer, names the request back rather than guessing at it")
  func refusesAnUnknownRequest() {
    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"7","request":"list_reminders"}"#)
        == #"""
        {"failure":{"code":"request_unknown","evidence":"list_reminders","sentence":"The helper does not answer a request by that name."},"id":"7","protocolVersion":1}
        """#)
  }

  @Test("given an unknown request at a version it does not speak, reports the version: the two sides must agree on words before they argue about them")
  func settlesTheVersionBeforeTheVocabulary() {
    let response = helper.respond(to: #"{"protocolVersion":9,"id":"7","request":"list_reminders"}"#)
    #expect(response.contains(#""code":"protocol_version_unsupported""#))
  }

  // Findings X-V9: anything on stdout that is not protocol JSON breaks the session for good.
  @Test("given a line carrying quotes and control characters, answers with one line and no raw newline")
  func answersWithOneLineWhateverArrives() {
    let response = helper.respond(to: "{\"id\": \"a \\\"quoted\\\" \\n thing\"")
    #expect(!response.contains("\n"))
    #expect(response.hasPrefix("{") && response.hasSuffix("}"))
  }

  @Test("given a line it could not read, still answers the next line: one bad request never ends the session")
  func keepsAnsweringAfterABadLine() {
    _ = helper.respond(to: "not json")
    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"1","request":"calendar_permission"}"#)
        == #"{"id":"1","protocolVersion":1,"result":{"state":"granted"}}"#)
  }
}
