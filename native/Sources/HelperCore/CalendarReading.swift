import Foundation

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

  func permission() -> Permission {
    store.permission()
  }

  func requestPermission() -> Permission {
    .askingOnce(held: store.permission(), ask: store.requestPermission)
  }

  /// Every calendar, readable or not: one whose server is down still exists, and the user still
  /// needs its identifier to exclude it.
  func calendars() -> Result<[Calendar], NamedFailure> {
    whenReadable { store.calendars() }
  }

  /// One event, or nil when no event has that identifier and original start. Not finding it is
  /// an answer, not a failure: the server decides how to say so.
  ///
  /// Every occurrence of a series shares the series' identifier, so an occurrence is looked for
  /// near its original start, in the one calendar its series belongs to. A miss on the identifier
  /// answers at once and reads nothing.
  func event(identifier: String, originalStart: Date?) -> Result<Event?, NamedFailure> {
    whenReadable {
      guard let named = store.event(identifier: identifier) else { return nil }
      guard let originalStart else { return named }

      for reach in Self.reaches {
        let around = Range(
          from: originalStart.addingTimeInterval(-reach),
          to: originalStart.addingTimeInterval(reach))!
        let occurrence = (try? store.events(in: around, from: named.calendar))?.first {
          $0.eventIdentifier == identifier && $0.began(at: originalStart)
        }
        if let occurrence { return occurrence }
      }
      return nil
    }
  }

  /// How far either side of its original start an occurrence is looked for: the day it should be
  /// on, and then, for one the user moved, as far as a four-year range reaches.
  private static let reaches: [TimeInterval] = [day, Range.longest / 2]

  private func whenReadable<Answer>(_ read: () -> Answer) -> Result<Answer, NamedFailure> {
    let permission = store.permission()
    guard permission.allowsReading else {
      return .failure(.calendarPermissionMissing(permission: permission))
    }
    return .success(read())
  }

  func events(in range: Range) -> Result<EventsInRange, NamedFailure> {
    let permission = store.permission()
    guard permission.allowsReading else {
      return .failure(.calendarPermissionMissing(permission: permission))
    }
    guard range.end.timeIntervalSince(range.start) <= Range.longest else {
      return .failure(.rangeTooLong(range))
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
