import Testing

@testable import HelperCore

@Suite("asking for the calendars")
struct AskingForTheCalendarsSpec {
  let asking = #"{"protocolVersion":1,"id":"3","request":"calendars"}"#

  // A subscription whose server is down still exists, and the user still needs its identifier to
  // exclude it; only reading its events can fail.
  @Test("names every calendar, readable or not, with its identifier, its title, its calendar account and whether it accepts new events")
  func namesEveryCalendar() {
    let standUp = anEvent(
      "Stand-up", from: "2026-09-22T09:00:00Z", to: "2026-09-22T09:15:00Z", in: work)
    let helper = helperReading(
      aCalendarStore()
        .holding(standUp)
        .unableToRead(teamFeed, saying: "The server responded with status 503"))

    #expect(
      helper.respond(to: asking)
        == #"""
        {"id":"3","protocolVersion":1,"result":{"calendars":[{"acceptsNewEvents":true,"account":{"identifier":"account-icloud","title":"iCloud"},"identifier":"calendar-work","title":"Work"},{"acceptsNewEvents":false,"account":{"identifier":"account-subscriptions","title":"Subscriptions"},"identifier":"calendar-team-feed","title":"Team feed"}]}}
        """#)
  }

  @Test("given the calendar permission was refused, refuses and names the setting to enable rather than listing nothing")
  func refusesWithoutThePermission() {
    let response = helperReading(aCalendarStore().permission(.refused)).respond(to: asking)
    #expect(response.contains(#""code":"calendar_permission_missing""#))
  }
}
