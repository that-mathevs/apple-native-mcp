import Foundation
import Testing

@testable import HelperCore

// Upstream built a new event out of an AppleScript string, so a quote in a title ended the string
// and the rest of the title ran (chrischall 18660e4). Here a new event is fields of a JSON request
// and properties of an event: nothing is ever assembled into something that could be run.
@Suite("asking to create an event")
struct AskingToCreateAnEventSpec {
  func asking(_ fields: String) -> String {
    #"{"protocolVersion":1,"id":"5","request":"create_event","# + fields + "}"
  }

  let lunch =
    #""calendarIdentifier":"calendar-work","title":"Lunch","start":"2026-09-22T12:30:00Z","end":"2026-09-22T13:30:00Z""#

  @Test("given a calendar, a title and a start and end, creates the event there and answers with it as the store holds it")
  func createsTheEvent() {
    let store = aCalendarStore().having(work)
    let response = helperReading(store).respond(to: asking(lunch))

    #expect(response.contains(#""confirmed":true"#))
    #expect(response.contains(#""title":"Lunch""#))
    #expect(response.contains(#""start":"2026-09-22T12:30:00Z""#))
    #expect(response.contains(#""identifier":"calendar-work""#))
    #expect(store.saved.events.map(\.title) == ["Lunch"])
  }

  @Test("given a title, location and notes full of quotes, backslashes, line breaks and script text, saves each exactly as given")
  func savesTextExactly() {
    let store = aCalendarStore().having(work)
    let hostile = #"Lunch\" & do shell script \"rm -rf ~\" \\ `id` $(whoami)\nsecond line"#

    _ = helperReading(store).respond(
      to: asking(
        #""calendarIdentifier":"calendar-work","title":""# + hostile + #"","location":""# + hostile
          + #"","notes":""# + hostile
          + #"","start":"2026-09-22T12:30:00Z","end":"2026-09-22T13:30:00Z""#))

    let expected = "Lunch\" & do shell script \"rm -rf ~\" \\ `id` $(whoami)\nsecond line"
    #expect(store.saved.events.first?.title == expected)
    #expect(store.saved.events.first?.location == expected)
    #expect(store.saved.events.first?.notes == expected)
  }

  // Upstream #34: an all-day event made from a midnight instant slid to the day before for
  // everyone west of UTC. Days arrive as days and reach the store as days.
  @Test("given an all-day event, takes its days as days and hands them to the store as days, never as instants")
  func keepsAnAllDayEventOnItsDays() {
    let store = aCalendarStore().having(work)

    _ = helperReading(store).respond(
      to: asking(
        #""calendarIdentifier":"calendar-work","title":"Conference","firstDay":"2026-09-22","lastDay":"2026-09-24""#
      ))

    #expect(
      store.saved.events.first?.time
        == .allDay(firstDay: Day("2026-09-22")!, lastDay: Day("2026-09-24")!))
  }

  @Test("given a day that is not on the calendar, refuses it rather than rolling it into the next month")
  func refusesADayThatDoesNotExist() {
    let response = helperReading(aCalendarStore().having(work)).respond(
      to: asking(
        #""calendarIdentifier":"calendar-work","title":"Conference","firstDay":"2026-02-30","lastDay":"2026-02-30""#
      ))
    #expect(response.contains(#""code":"request_malformed""#))
  }

  @Test("given both a start and a day, refuses the request: it could mean either")
  func refusesBothKindsOfTime() {
    let response = helperReading(aCalendarStore().having(work)).respond(
      to: asking(lunch + #","firstDay":"2026-09-22","lastDay":"2026-09-22""#))
    #expect(response.contains(#""code":"request_malformed""#))
  }

  @Test("given no title or no calendar, refuses the request: the helper never picks a calendar of its own")
  func refusesARequestThatLeavesOutTheCalendar() {
    let helper = helperReading(aCalendarStore().having(work))
    let noCalendar = helper.respond(
      to: asking(#""title":"Lunch","start":"2026-09-22T12:30:00Z","end":"2026-09-22T13:30:00Z""#))
    let noTitle = helper.respond(
      to: asking(
        #""calendarIdentifier":"calendar-work","start":"2026-09-22T12:30:00Z","end":"2026-09-22T13:30:00Z""#
      ))

    #expect(noCalendar.contains(#""code":"request_malformed""#))
    #expect(noTitle.contains(#""code":"request_malformed""#))
  }

  @Test("given a calendar the store does not have, refuses and saves nothing, rather than saving it somewhere else")
  func refusesAnUnknownCalendar() {
    let store = aCalendarStore().having(work)
    let response = helperReading(store).respond(
      to: asking(lunch.replacingOccurrences(of: "calendar-work", with: "calendar-gone")))

    #expect(response.contains(#""code":"calendar_not_found""#))
    #expect(store.saved.events.isEmpty)
  }

  @Test("given a calendar that does not accept new events, refuses and saves nothing")
  func refusesACalendarThatIsNotWritable() {
    let store = aCalendarStore().having(teamFeed)
    let response = helperReading(store).respond(
      to: asking(lunch.replacingOccurrences(of: "calendar-work", with: "calendar-team-feed")))

    #expect(response.contains(#""code":"calendar_not_writable""#))
    #expect(store.saved.events.isEmpty)
  }

  @Test("given the permission covers writing only, still creates the event: writing is what was allowed")
  func createsWithAWriteOnlyPermission() {
    let store = aCalendarStore().having(work).permission(.writeOnly)
    let response = helperReading(store).respond(to: asking(lunch))

    #expect(response.contains(#""title":"Lunch""#))
    #expect(store.saved.events.count == 1)
  }

  @Test("given the calendar permission was refused, refuses and names the setting to enable, and saves nothing")
  func refusesWithoutThePermission() {
    let store = aCalendarStore().having(work).permission(.refused)
    let response = helperReading(store).respond(to: asking(lunch))

    #expect(response.contains(#""code":"calendar_permission_missing""#))
    #expect(store.saved.events.isEmpty)
  }

  @Test("given the store would not save the event, reports that with what the store said, verbatim")
  func reportsAStoreThatWouldNotSave() {
    let store = aCalendarStore().having(work).refusingToSave(saying: "The calendar is read only.")
    let response = helperReading(store).respond(to: asking(lunch))

    #expect(response.contains(#""code":"event_not_saved""#))
    #expect(response.contains(#""evidence":"The calendar is read only.""#))
  }

  // therealap 1a09e54 reported success as soon as the save returned. A save that cannot be read
  // back is not a failure either: saying so would have an agent create the event a second time.
  @Test("given the store saved the event but cannot show it afterwards, answers with the event and says it is unconfirmed")
  func saysWhenASaveIsUnconfirmed() {
    let store = aCalendarStore().having(work).losingSightOfWhatItSaves()
    let response = helperReading(store).respond(to: asking(lunch))

    #expect(response.contains(#""confirmed":false"#))
    #expect(response.contains(#""title":"Lunch""#))
  }
}

@Suite("asking for the default calendar")
struct AskingForTheDefaultCalendarSpec {
  let asking = #"{"protocolVersion":1,"id":"6","request":"default_calendar"}"#

  @Test("names the calendar the user set in Calendar for new events")
  func namesTheDefaultCalendar() {
    let response = helperReading(aCalendarStore().having(work, personal).defaultingTo(personal))
      .respond(to: asking)
    #expect(response.contains(#""identifier":"calendar-personal""#))
  }

  @Test("given the user has no default calendar, answers with none rather than choosing one for them")
  func answersWithNoneWhenThereIsNoDefault() {
    #expect(
      helperReading(aCalendarStore().having(work)).respond(to: asking)
        == #"{"id":"6","protocolVersion":1,"result":{"calendar":null}}"#)
  }

  @Test("given the calendar permission was refused, refuses and names the setting to enable")
  func refusesWithoutThePermission() {
    let response = helperReading(aCalendarStore().permission(.refused)).respond(to: asking)
    #expect(response.contains(#""code":"calendar_permission_missing""#))
  }
}
