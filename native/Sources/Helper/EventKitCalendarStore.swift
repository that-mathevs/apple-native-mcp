import EventKit
import Foundation
import HelperCore

/// The one place EventKit is touched. Everything above it is specified against a fake, so nothing
/// but this file needs a Mac with a calendar on it.
final class EventKitCalendarStore: CalendarStore, @unchecked Sendable {
  private let events = EKEventStore()

  func permission() -> CalendarPermission {
    switch EKEventStore.authorizationStatus(for: .event) {
    case .notDetermined: .undecided
    case .restricted: .restricted
    case .denied: .refused
    case .writeOnly: .writeOnly
    case .fullAccess: .granted
    // A state this helper has never heard of is not a state it may read in.
    @unknown default: .restricted
    }
  }

  /// Asking EventKit prompts the user, and the answer arrives on another thread. The protocol is
  /// one line in, one line out, so the session waits here rather than growing a second shape for
  /// the one request that has a person in the middle of it.
  func requestPermission() -> CalendarPermission {
    let answered = DispatchSemaphore(value: 0)
    events.requestFullAccessToEvents { _, _ in answered.signal() }
    answered.wait()
    return permission()
  }

  func calendars() -> [HelperCore.Calendar] {
    events.calendars(for: .event).map { calendar in
      let source = calendar.source
      return HelperCore.Calendar(
        identifier: calendar.calendarIdentifier,
        title: calendar.title,
        account: CalendarAccount(
          identifier: source?.sourceIdentifier ?? "", title: source?.title ?? ""))
    }
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
    return events.events(matching: matching).compactMap { event in
      guard let start = event.startDate, let end = event.endDate else { return nil }
      return Event(
        eventIdentifier: event.eventIdentifier ?? event.calendarItemIdentifier,
        title: event.title ?? "",
        start: start,
        end: end,
        isAllDay: event.isAllDay,
        location: event.location,
        notes: event.notes,
        originalStart: event.hasRecurrenceRules ? event.occurrenceDate : nil,
        calendar: calendar)
    }
  }
}
