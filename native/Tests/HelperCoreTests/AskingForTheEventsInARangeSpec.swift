import Testing

@testable import HelperCore

@Suite("asking for the events in a range")
struct AskingForTheEventsInARangeSpec {
  let tuesday =
    #"{"protocolVersion":1,"id":"2","request":"events_in_range","range":{"start":"2026-09-22T00:00:00Z","end":"2026-09-23T00:00:00Z"}}"#

  @Test("given an event in the range, returns it as a record: its own identity, its times, its calendar and its calendar account, beside every calendar that was asked")
  func returnsAnEventAsARecord() {
    let helper = helperReading(
      aCalendarStore().holding(
        anEvent(
          "Stand-up", from: "2026-09-22T09:00:00Z", to: "2026-09-22T09:15:00Z", in: work,
          location: "Room 2", notes: "bring the board")))

    #expect(
      helper.respond(to: tuesday)
        == #"""
        {"id":"2","protocolVersion":1,"result":{"calendars":[{"acceptsNewEvents":true,"account":{"identifier":"account-icloud","title":"iCloud"},"identifier":"calendar-work","title":"Work"}],"events":[{"allDay":false,"calendar":{"acceptsNewEvents":true,"account":{"identifier":"account-icloud","title":"iCloud"},"identifier":"calendar-work","title":"Work"},"end":"2026-09-22T09:15:00Z","eventIdentifier":"event:Stand-up","location":"Room 2","notes":"bring the board","originalStart":null,"start":"2026-09-22T09:00:00Z","title":"Stand-up"}],"range":{"end":"2026-09-23T00:00:00Z","start":"2026-09-22T00:00:00Z"},"unreadableCalendars":[]}}
        """#)
  }

  @Test("given nothing in the range, answers with no events and repeats the range it covered, so an empty answer still says what was asked")
  func answersAnEmptyRangeWithTheRangeItCovered() {
    #expect(
      helperReading(aCalendarStore()).respond(to: tuesday)
        == #"""
        {"id":"2","protocolVersion":1,"result":{"calendars":[],"events":[],"range":{"end":"2026-09-23T00:00:00Z","start":"2026-09-22T00:00:00Z"},"unreadableCalendars":[]}}
        """#)
  }

  @Test("given an occurrence of a series, carries the original start that addresses it within the series")
  func carriesTheOriginalStartOfAnOccurrence() {
    let helper = helperReading(
      aCalendarStore().holding(
        occurrenceOfASeries("Stand-up", on: "2026-09-22T09:00:00Z", lasting: 15)))

    #expect(helper.respond(to: tuesday).contains(#""originalStart":"2026-09-22T09:00:00Z""#))
  }

  // A JavaScript Date writes fractional seconds; Swift's default reader rejects them. Both sides
  // have to agree on an instant, so the helper reads either spelling.
  @Test("given a range written the way JavaScript writes an instant, reads it rather than calling it malformed")
  func readsAnInstantWithFractionalSeconds() {
    let response = helperReading(aCalendarStore()).respond(
      to: #"""
        {"protocolVersion":1,"id":"2","request":"events_in_range","range":{"start":"2026-09-22T00:00:00.000Z","end":"2026-09-23T00:00:00.000Z"}}
        """#)
    #expect(response.contains(#""events":[]"#))
  }

  @Test("given no range at all, refuses the request: the helper never invents a range of its own")
  func refusesARequestWithNoRange() {
    let response = helperReading(aCalendarStore()).respond(
      to: #"{"protocolVersion":1,"id":"2","request":"events_in_range"}"#)
    #expect(response.contains(#""code":"request_malformed""#))
  }

  @Test("given a range that ends before it begins, refuses it: a range has to move forwards")
  func refusesABackwardsRange() {
    let response = helperReading(aCalendarStore()).respond(
      to: #"""
        {"protocolVersion":1,"id":"2","request":"events_in_range","range":{"start":"2026-09-23T00:00:00Z","end":"2026-09-22T00:00:00Z"}}
        """#)
    #expect(response.contains(#""code":"request_malformed""#))
  }

  @Test("given a range that ends exactly when it begins, refuses it: no instant is inside it")
  func refusesAnEmptyRange() {
    let response = helperReading(aCalendarStore()).respond(
      to: #"""
        {"protocolVersion":1,"id":"2","request":"events_in_range","range":{"start":"2026-09-22T00:00:00Z","end":"2026-09-22T00:00:00Z"}}
        """#)
    #expect(response.contains(#""code":"request_malformed""#))
  }

  @Test("given a range bounded by something that is not an instant, refuses it rather than guessing at the date")
  func refusesARangeThatIsNotInstants() {
    let response = helperReading(aCalendarStore()).respond(
      to: #"""
        {"protocolVersion":1,"id":"2","request":"events_in_range","range":{"start":"next tuesday","end":"2026-09-23T00:00:00Z"}}
        """#)
    #expect(response.contains(#""code":"request_malformed""#))
  }

  // Upstream #65: the failure has to say which setting to change, and where.
  @Test("given the calendar permission was refused, reports the permission failure naming the setting to enable")
  func reportsThePermissionFailure() {
    #expect(
      helperReading(aCalendarStore().permission(.refused)).respond(to: tuesday)
        == #"""
        {"failure":{"code":"calendar_permission_missing","evidence":"refused","sentence":"apple-native-mcp cannot read your calendar until it is allowed to, in System Settings > Privacy & Security > Calendars > apple-native-mcp."},"id":"2","protocolVersion":1}
        """#)
  }

  // A tool never asks for a permission, and the setting is not there to turn on until macOS has
  // asked once, so a permission nobody has asked for points at setup instead (#33).
  @Test("given nobody has been asked for the calendar permission yet, says to run setup rather than naming a setting that is not there")
  func pointsAtSetupWhileUndecided() {
    #expect(
      helperReading(aCalendarStore().permission(.undecided)).respond(to: tuesday)
        == #"""
        {"failure":{"code":"calendar_permission_missing","evidence":"undecided","sentence":"apple-native-mcp has not been asked for your calendar yet. Run `npx apple-native-mcp setup` to be asked."},"id":"2","protocolVersion":1}
        """#)
  }

  // User story 6: one offline subscription must not take the whole read with it.
  @Test("given one calendar that would not answer, returns the rest and names that calendar beside them")
  func namesAnUnreadableCalendarBesideTheEvents() {
    let helper = helperReading(
      aCalendarStore()
        .holding(anEvent("Stand-up", from: "2026-09-22T09:00:00Z", to: "2026-09-22T09:15:00Z", in: work))
        .unableToRead(teamFeed, saying: "The server responded with status 503"))

    let response = helper.respond(to: tuesday)
    #expect(response.contains(#""eventIdentifier":"event:Stand-up""#))
    #expect(
      response.contains(
        #""unreadableCalendars":[{"calendar":{"acceptsNewEvents":false,"account":{"identifier":"account-subscriptions","title":"Subscriptions"},"identifier":"calendar-team-feed","title":"Team feed"},"code":"calendar_unreadable","evidence":"The server responded with status 503","sentence":"The calendar \"Team feed\" could not be read, so its events are missing from this range."}]"#
      ))
  }
}
