import Foundation

/// Writing to the calendar: the rules that sit between the protocol and EventKit.
struct CalendarWriting: Sendable {
  let store: CalendarStore

  /// The calendar the user set in Calendar for new events, or nil when they have none. The helper
  /// never picks one for them: the first calendar may be a subscription or somebody else's.
  func defaultCalendar() -> Result<Calendar?, NamedFailure> {
    store.whenPermitted(\.allowsWriting) { .success(store.defaultCalendar()) }
  }

  func create(_ event: NewEvent) -> Result<CreatedEvent, NamedFailure> {
    store.whenPermitted(\.allowsWriting) {
      let named = store.calendars().first { $0.identifier == event.calendarIdentifier }
      guard let calendar = named else {
        return .failure(.calendarNotFound(identifier: event.calendarIdentifier))
      }
      guard calendar.acceptsNewEvents else {
        return .failure(.calendarNotWritable(title: calendar.title))
      }

      return saving(event, in: calendar)
    }
  }

  private func saving(
    _ event: NewEvent, in calendar: Calendar
  ) -> Result<CreatedEvent, NamedFailure> {
    do {
      let saved = try store.save(event, in: calendar)
      guard let held = store.event(identifier: saved.eventIdentifier) else {
        return .success(CreatedEvent(event: saved, confirmed: false))
      }
      return .success(CreatedEvent(event: held, confirmed: true))
    } catch {
      return .failure(.eventNotSaved(evidence: error.evidence))
    }
  }
}
