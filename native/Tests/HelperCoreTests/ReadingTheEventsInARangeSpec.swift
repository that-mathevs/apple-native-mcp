import Testing

@testable import HelperCore

@Suite("reading the events in a range")
struct ReadingTheEventsInARangeSpec {
  let tuesday = aRange(from: "2026-09-22T00:00:00Z", to: "2026-09-23T00:00:00Z")

  @Test("given events across several calendars, returns them in the order they start")
  func ordersEventsByStart() {
    let reading = readingACalendar(
      aCalendarStore().holding(
        anEvent("Retro", from: "2026-09-22T16:00:00Z", to: "2026-09-22T17:00:00Z", in: work),
        anEvent("Breakfast", from: "2026-09-22T07:00:00Z", to: "2026-09-22T08:00:00Z", in: personal),
        anEvent("Stand-up", from: "2026-09-22T09:00:00Z", to: "2026-09-22T09:15:00Z", in: work)))

    #expect(reading.events(in: tuesday).answer.events.map(\.title) == ["Breakfast", "Stand-up", "Retro"])
  }

  @Test("given two events starting at the same instant, orders them by title so the same range always reads the same way")
  func ordersEventsStartingTogetherByTitle() {
    let reading = readingACalendar(
      aCalendarStore().holding(
        anEvent("Standup", from: "2026-09-22T09:00:00Z", to: "2026-09-22T09:15:00Z", in: work),
        anEvent("Physio", from: "2026-09-22T09:00:00Z", to: "2026-09-22T10:00:00Z", in: personal)))

    #expect(reading.events(in: tuesday).answer.events.map(\.title) == ["Physio", "Standup"])
  }

  @Test("given an event already under way when the range begins, includes it: a meeting that started earlier is still on")
  func includesAnEventAlreadyUnderWay() {
    let reading = readingACalendar(
      aCalendarStore().holding(
        anEvent("Red-eye", from: "2026-09-21T22:00:00Z", to: "2026-09-22T06:00:00Z", in: personal)))

    #expect(reading.events(in: tuesday).answer.events.map(\.title) == ["Red-eye"])
  }

  @Test("given an event that ends exactly when the range begins, leaves it out")
  func leavesOutAnEventThatEndsWhenTheRangeBegins() {
    let reading = readingACalendar(
      aCalendarStore().holding(
        anEvent("Night shift", from: "2026-09-21T16:00:00Z", to: "2026-09-22T00:00:00Z", in: work)))

    #expect(reading.events(in: tuesday).answer.events.isEmpty)
  }

  @Test("given an event that begins exactly when the range ends, leaves it out: the end of a range is the first instant outside it")
  func leavesOutAnEventThatBeginsWhenTheRangeEnds() {
    let reading = readingACalendar(
      aCalendarStore().holding(
        anEvent("Late flight", from: "2026-09-23T00:00:00Z", to: "2026-09-23T04:00:00Z", in: personal)))

    #expect(reading.events(in: tuesday).answer.events.isEmpty)
  }

  @Test("given each event, names the calendar and the calendar account it belongs to, so work can be told from personal")
  func namesTheCalendarAndItsAccount() {
    let reading = readingACalendar(
      aCalendarStore().holding(
        anEvent("Stand-up", from: "2026-09-22T09:00:00Z", to: "2026-09-22T09:15:00Z", in: work)))

    let found = reading.events(in: tuesday).answer.events
    #expect(found.first?.calendar.title == "Work")
    #expect(found.first?.calendar.account.title == "iCloud")
  }

  // A series that collapsed into one entry is the complaint behind user story 3 in the v1 spec.
  @Test("given a daily series, returns one occurrence per day in the range rather than the series once")
  func expandsASeriesIntoItsOccurrences() {
    let week = aRange(from: "2026-09-21T00:00:00Z", to: "2026-09-24T00:00:00Z")
    let reading = readingACalendar(
      aCalendarStore().holding(
        occurrenceOfASeries("Stand-up", on: "2026-09-21T09:00:00Z", lasting: 15),
        occurrenceOfASeries("Stand-up", on: "2026-09-22T09:00:00Z", lasting: 15),
        occurrenceOfASeries("Stand-up", on: "2026-09-23T09:00:00Z", lasting: 15)))

    let found = reading.events(in: week).answer.events
    #expect(found.count == 3)
    #expect(Set(found.map(\.eventIdentifier)) == ["series:Stand-up"])
  }

  @Test("given an occurrence of a series, addresses it by the series and its original start, because every occurrence shares one event identifier")
  func addressesAnOccurrenceBySeriesAndOriginalStart() {
    let reading = readingACalendar(
      aCalendarStore().holding(occurrenceOfASeries("Stand-up", on: "2026-09-22T09:00:00Z", lasting: 15)))

    let occurrence = reading.events(in: tuesday).answer.events.first
    #expect(occurrence?.eventIdentifier == "series:Stand-up")
    #expect(occurrence?.originalStart == at("2026-09-22T09:00:00Z"))
  }

  @Test("given an event that belongs to no series, reports no original start: there is no series to address it within")
  func reportsNoOriginalStartForALoneEvent() {
    let reading = readingACalendar(
      aCalendarStore().holding(
        anEvent("Dentist", from: "2026-09-22T11:00:00Z", to: "2026-09-22T12:00:00Z", in: personal)))

    #expect(reading.events(in: tuesday).answer.events.first?.originalStart == nil)
  }

  // Upstream #65: a missing permission has to say which setting to change, and where.
  @Test("given the calendar permission was refused, refuses the read and names the setting to enable")
  func refusesWithoutThePermission() {
    let reading = readingACalendar(aCalendarStore().permission(.refused))

    guard case .failure(let failure) = reading.events(in: tuesday) else {
      Issue.record("the read answered without the permission")
      return
    }
    #expect(failure.code == .calendarPermissionMissing)
    #expect(failure.sentence.contains("System Settings > Privacy & Security > Calendars"))
    #expect(failure.evidence == "refused")
  }

  @Test("given the permission covers writing only, refuses the read: writing is not reading")
  func refusesWithWriteOnlyPermission() {
    let reading = readingACalendar(aCalendarStore().permission(.writeOnly))

    guard case .failure(let failure) = reading.events(in: tuesday) else {
      Issue.record("the read answered with a write-only permission")
      return
    }
    #expect(failure.code == .calendarPermissionMissing)
  }

  // User story 6: a subscribed calendar that is offline must not take the rest of the answer with it.
  @Test("given one calendar that cannot be read, answers with every other calendar's events anyway")
  func answersDespiteOneUnreadableCalendar() {
    let reading = readingACalendar(
      aCalendarStore()
        .holding(anEvent("Stand-up", from: "2026-09-22T09:00:00Z", to: "2026-09-22T09:15:00Z", in: work))
        .unableToRead(teamFeed, saying: "The server responded with status 503"))

    #expect(reading.events(in: tuesday).answer.events.map(\.title) == ["Stand-up"])
  }

  @Test("given a calendar that cannot be read, names that calendar and repeats what the store said, so nobody mistakes a gap for an empty day")
  func namesTheCalendarThatCouldNotBeRead() {
    let reading = readingACalendar(
      aCalendarStore().unableToRead(teamFeed, saying: "The server responded with status 503"))

    let missed = reading.events(in: tuesday).answer.unreadableCalendars
    #expect(missed.map(\.code) == [.calendarUnreadable])
    #expect(missed.first?.sentence.contains("Team feed") == true)
    #expect(missed.first?.evidence == "The server responded with status 503")
  }
}
