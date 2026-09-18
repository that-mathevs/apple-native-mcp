/// What a read of a range came to: the range it covered, the occurrences in it, every calendar it
/// asked, and the calendars that would not answer. A calendar that could not be read is named rather than silently missing,
/// so an empty day is never mistaken for a free one.
/// A calendar that would not answer, and what went wrong. The calendar travels with the failure so
/// the server can tell which one it was without reading its title out of a sentence.
struct UnreadableCalendar: Equatable, Sendable {
  let calendar: Calendar
  let failure: NamedFailure
}

struct EventsInRange: Equatable, Sendable {
  let range: Range
  let events: [Event]
  let calendars: [Calendar]
  let unreadableCalendars: [UnreadableCalendar]
}

/// Reading the calendar: the rules that sit between the protocol and EventKit.
struct CalendarReading: Sendable {
  let store: CalendarStore

  func permission() -> CalendarPermission {
    store.permission()
  }

  /// Ask the user, but only while there is anything to ask: macOS prompts once, so once a
  /// permission has been decided the answer is the setting to change, not another prompt.
  func requestPermission() -> CalendarPermission {
    let held = store.permission()
    guard held == .undecided else { return held }
    return store.requestPermission()
  }

  func events(in range: Range) -> Result<EventsInRange, NamedFailure> {
    let permission = store.permission()
    guard permission.allowsReading else {
      return .failure(.calendarPermissionMissing(permission: permission))
    }

    let calendars = store.calendars()
    var found: [Event] = []
    var unreadable: [UnreadableCalendar] = []
    for calendar in calendars {
      do {
        found += try store.events(in: range, from: calendar).filter { $0.falls(in: range) }
      } catch {
        unreadable.append(
          UnreadableCalendar(
            calendar: calendar,
            failure: .calendarUnreadable(title: calendar.title, evidence: error.evidence)))
      }
    }

    return .success(
      EventsInRange(
        range: range, events: found.inTheOrderTheyStart(), calendars: calendars,
        unreadableCalendars: unreadable))
  }
}
