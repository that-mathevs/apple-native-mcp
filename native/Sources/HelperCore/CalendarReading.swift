/// What a read of a range came to: the range it covered, the occurrences in it, and the calendars
/// that would not answer. A calendar that could not be read is named rather than silently missing,
/// so an empty day is never mistaken for a free one.
struct EventsInRange: Equatable, Sendable {
  let range: Range
  let events: [Event]
  let unreadableCalendars: [NamedFailure]
}

/// Reading the calendar: the rules that sit between the protocol and EventKit.
struct CalendarReading: Sendable {
  let store: CalendarStore

  func permission() -> CalendarPermission {
    store.permission()
  }

  func events(in range: Range) -> Result<EventsInRange, NamedFailure> {
    let permission = store.permission()
    guard permission.allowsReading else {
      return .failure(.calendarPermissionMissing(permission: permission))
    }

    var found: [Event] = []
    var unreadable: [NamedFailure] = []
    for calendar in store.calendars() {
      do {
        found += try store.events(in: range, from: calendar).filter { $0.falls(in: range) }
      } catch {
        unreadable.append(.calendarUnreadable(title: calendar.title, evidence: error.evidence))
      }
    }

    return .success(
      EventsInRange(
        range: range, events: found.inTheOrderTheyStart(), unreadableCalendars: unreadable))
  }
}
