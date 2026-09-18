import Testing

@testable import HelperCore

@Suite("asking for one event")
struct AskingForOneEventSpec {
  let monday = occurrenceOfASeries("Stand-up", on: "2026-09-21T09:00:00Z", lasting: 15)
  let tuesday = occurrenceOfASeries("Stand-up", on: "2026-09-22T09:00:00Z", lasting: 15)

  @Test("given an event identifier, returns that event as a record")
  func returnsTheEvent() {
    let helper = helperReading(
      aCalendarStore().holding(
        anEvent("Review", from: "2026-09-22T15:00:00Z", to: "2026-09-22T16:00:00Z", in: work)))

    let response = helper.respond(
      to: #"{"protocolVersion":1,"id":"4","request":"event","eventIdentifier":"event:Review"}"#)

    #expect(response.contains(#""result":{"event":{"allDay":false"#))
    #expect(response.contains(#""eventIdentifier":"event:Review""#))
  }

  // Every occurrence of a series shares one event identifier (arr2036 9097294), so the original
  // start is what tells the helper which of them was meant.
  @Test("given an occurrence's original start, returns that occurrence with its own start and end, not the series' first")
  func returnsTheOccurrenceThatWasAskedFor() {
    let helper = helperReading(aCalendarStore().holding(monday, tuesday))

    let response = helper.respond(
      to: #"""
        {"protocolVersion":1,"id":"4","request":"event","eventIdentifier":"series:Stand-up","originalStart":"2026-09-22T09:00:00.000Z"}
        """#)

    #expect(response.contains(#""start":"2026-09-22T09:00:00Z""#))
    #expect(response.contains(#""end":"2026-09-22T09:15:00Z""#))
  }

  @Test("given an identifier that matches no event, answers with no event rather than a failure: not finding it is an answer")
  func answersWithNoEvent() {
    #expect(
      helperReading(aCalendarStore()).respond(
        to: #"{"protocolVersion":1,"id":"4","request":"event","eventIdentifier":"event:Gone"}"#)
        == #"{"id":"4","protocolVersion":1,"result":{"event":null}}"#)
  }

  @Test("given no event identifier, refuses the request rather than guessing at an event")
  func refusesARequestWithNoIdentifier() {
    let response = helperReading(aCalendarStore()).respond(
      to: #"{"protocolVersion":1,"id":"4","request":"event"}"#)
    #expect(response.contains(#""code":"request_malformed""#))
  }

  @Test("given an original start that is not an instant, refuses it rather than answering with the series' first occurrence")
  func refusesAnOriginalStartThatIsNotAnInstant() {
    let response = helperReading(aCalendarStore().holding(monday)).respond(
      to: #"""
        {"protocolVersion":1,"id":"4","request":"event","eventIdentifier":"series:Stand-up","originalStart":"tuesday"}
        """#)
    #expect(response.contains(#""code":"request_malformed""#))
  }

  @Test("given the calendar permission was refused, refuses and names the setting to enable rather than answering with no event")
  func refusesWithoutThePermission() {
    let response = helperReading(aCalendarStore().permission(.refused)).respond(
      to: #"{"protocolVersion":1,"id":"4","request":"event","eventIdentifier":"event:Review"}"#)
    #expect(response.contains(#""code":"calendar_permission_missing""#))
  }
}
