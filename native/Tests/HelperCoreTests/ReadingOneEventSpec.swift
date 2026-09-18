import Foundation
import Testing

@testable import HelperCore

// Every occurrence of a series shares the series' event identifier (arr2036 9097294), so one
// occurrence is found by looking for that identifier near its original start. These are the rules
// for where to look, which EventKit itself has no opinion about.
@Suite("reading one event")
struct ReadingOneEventSpec {
  let monday = occurrenceOfASeries("Stand-up", on: "2026-09-21T09:00:00Z", lasting: 15)
  let tuesday = occurrenceOfASeries("Stand-up", on: "2026-09-22T09:00:00Z", lasting: 15)

  /// Tuesday's stand-up, which the user dragged to another time. It keeps its original start.
  func tuesdayMoved(to start: String) -> Event {
    Event(
      eventIdentifier: "series:Stand-up", title: "Stand-up", start: at(start),
      end: at(start).addingTimeInterval(15 * 60), isAllDay: false, location: nil, notes: nil,
      originalStart: at("2026-09-22T09:00:00Z"), calendar: work)
  }

  @Test("given an occurrence sitting at its original start, finds it and answers with its own start and end")
  func findsAnOccurrenceWhereItShouldBe() {
    let reading = readingACalendar(aCalendarStore().holding(monday, tuesday))

    let found = reading.event(
      identifier: "series:Stand-up", originalStart: at("2026-09-22T09:00:00Z")
    ).found

    #expect(found == tuesday)
  }

  @Test("given an occurrence the user moved to another week, still finds it by its original start")
  func findsAnOccurrenceThatWasMoved() {
    let moved = tuesdayMoved(to: "2026-10-13T14:00:00Z")
    let reading = readingACalendar(aCalendarStore().holding(monday, moved))

    let found = reading.event(
      identifier: "series:Stand-up", originalStart: at("2026-09-22T09:00:00Z")
    ).found

    #expect(found?.start == at("2026-10-13T14:00:00Z"))
  }

  // The protocol writes an instant to the second, and a calendar server may hold a fraction of one.
  @Test("given an original start written to the second, finds an occurrence whose own carries a fraction of a second")
  func matchesAnOriginalStartToTheSecond() {
    let fractional = Event(
      eventIdentifier: "series:Stand-up", title: "Stand-up", start: at("2026-09-22T09:00:00.400Z"),
      end: at("2026-09-22T09:15:00Z"), isAllDay: false, location: nil, notes: nil,
      originalStart: at("2026-09-22T09:00:00.400Z"), calendar: work)
    let reading = readingACalendar(aCalendarStore().holding(fractional))

    let found = reading.event(
      identifier: "series:Stand-up", originalStart: at("2026-09-22T09:00:00Z")
    ).found

    #expect(found == fractional)
  }

  @Test("given an original start that no occurrence of the series has, answers with nothing rather than with another occurrence")
  func answersWithNothingForAnOriginalStartNoOccurrenceHas() {
    let reading = readingACalendar(aCalendarStore().holding(monday, tuesday))

    let found = reading.event(
      identifier: "series:Stand-up", originalStart: at("2026-09-23T09:00:00Z")
    ).found

    #expect(found == nil)
  }

  // chrischall c1bf44b: upstream scanned every event for an identifier and timed out on a miss.
  @Test("given an identifier no event has, answers with nothing at once, without reading a single range")
  func answersAMissWithoutReadingARange() {
    let store = aCalendarStore().holding(monday)
    let reading = readingACalendar(store)

    let found = reading.event(
      identifier: "event:Gone", originalStart: at("2026-09-22T09:00:00Z")
    ).found

    #expect(found == nil)
    #expect(store.reads.ranges.isEmpty)
  }

  @Test("looks for an occurrence only in the calendar its series belongs to, so the search does not grow with the number of calendars")
  func readsOnlyTheCalendarTheSeriesBelongsTo() {
    let store = aCalendarStore().holding(
      monday, tuesday,
      anEvent("Dentist", from: "2026-09-22T09:00:00Z", to: "2026-09-22T09:30:00Z", in: personal))
    let reading = readingACalendar(store)

    _ = reading.event(identifier: "series:Stand-up", originalStart: at("2026-09-22T09:00:00Z"))

    #expect(Set(store.reads.calendars) == [work])
  }
}
