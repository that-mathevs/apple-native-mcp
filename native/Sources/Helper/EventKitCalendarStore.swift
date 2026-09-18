import EventKit
import Foundation
import HelperCore

/// The one place EventKit is touched. Everything above it is specified against a fake, so nothing
/// but this file needs a Mac with a calendar on it.
final class EventKitCalendarStore: CalendarStore, @unchecked Sendable {
  private let events = EKEventStore()

  /// The user's answer, once they have given one in this process: EventKit can go on reporting
  /// the permission as undecided after it (#57). Mutable state is safe here only because the
  /// session serves one request at a time on one thread (Session.swift).
  private var answer: Permission?

  func permission() -> Permission {
    .held(reported: Permission(EKEventStore.authorizationStatus(for: .event)), answered: answer)
  }

  func requestPermission() -> Permission {
    answer = .asking(events.requestFullAccessToEvents)
    return permission()
  }

  func calendars() -> [HelperCore.Calendar] {
    events.calendars(for: .event).map(asCalendar)
  }

  func events(in range: HelperCore.Range, from calendar: HelperCore.Calendar) throws(
    CalendarUnreadable
  ) -> [Event] {
    // A calendar can be removed, or a subscription dropped, between being listed and being read.
    guard let found = events.calendar(withIdentifier: calendar.identifier) else {
      throw CalendarUnreadable(
        evidence: "No calendar with identifier \(calendar.identifier) is in the event store")
    }

    // EventKit expands a series into its occurrences for us; the rules above decide what to keep.
    let matching = events.predicateForEvents(
      withStart: range.start, end: range.end, calendars: [found])
    return events.events(matching: matching).compactMap { asEvent($0, in: calendar) }
  }

  func event(identifier: String) -> Event? {
    events.event(withIdentifier: identifier).flatMap { asEvent($0) }
  }

  func defaultCalendar() -> HelperCore.Calendar? {
    events.defaultCalendarForNewEvents.map(asCalendar)
  }

  func save(_ event: NewEvent, in calendar: HelperCore.Calendar) throws(EventNotSaved) -> Event {
    guard let found = events.calendar(withIdentifier: calendar.identifier) else {
      throw EventNotSaved(
        evidence: "No calendar with identifier \(calendar.identifier) is in the event store")
    }

    // Every piece of text is a property of the event. Nothing here is assembled into a script.
    let new = EKEvent(eventStore: events)
    new.calendar = found
    new.title = event.title
    new.location = event.location
    new.notes = event.notes

    switch event.time {
    case .timed(let range):
      new.startDate = range.start
      new.endDate = range.end
    case .allDay(let firstDay, let lastDay):
      // A day becomes an instant here and nowhere else, in this Mac's own time zone, which is
      // the user's. EventKit reads only the day out of an all-day event's start and end.
      let local = Foundation.Calendar.current
      guard
        let start = local.date(from: components(firstDay)),
        let end = local.date(from: components(lastDay))
      else { throw EventNotSaved(evidence: "That day does not exist in this Mac's calendar") }
      new.isAllDay = true
      new.startDate = start
      new.endDate = end
    }

    do {
      try events.save(new, span: .thisEvent, commit: true)
    } catch {
      throw EventNotSaved(evidence: error.localizedDescription)
    }

    guard let saved = asEvent(new, in: calendar) else {
      throw EventNotSaved(evidence: "The event store saved an event with no start or end")
    }
    return saved
  }

  private func components(_ day: Day) -> DateComponents {
    DateComponents(year: day.year, month: day.month, day: day.day)
  }

  private func asCalendar(_ calendar: EKCalendar) -> HelperCore.Calendar {
    let source = calendar.source
    return HelperCore.Calendar(
      identifier: calendar.calendarIdentifier,
      title: calendar.title,
      account: CalendarAccount(
        identifier: source?.sourceIdentifier ?? "", title: source?.title ?? ""),
      acceptsNewEvents: calendar.allowsContentModifications)
  }

  private func asEvent(_ event: EKEvent, in calendar: HelperCore.Calendar? = nil) -> Event? {
    guard let start = event.startDate, let end = event.endDate else { return nil }
    guard let calendar = calendar ?? event.calendar.map(asCalendar) else { return nil }
    return Event(
      eventIdentifier: event.eventIdentifier ?? event.calendarItemIdentifier,
      title: event.title ?? "",
      start: start,
      end: end,
      isAllDay: event.isAllDay,
      location: event.location,
      notes: event.notes,
      // An occurrence the user moved or edited is detached from its series and reports no
      // recurrence rules of its own, but it still has the original start that addresses it.
      originalStart: event.hasRecurrenceRules || event.isDetached ? event.occurrenceDate : nil,
      calendar: calendar)
  }
}
