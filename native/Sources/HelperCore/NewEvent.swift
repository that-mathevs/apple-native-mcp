import Foundation

/// A day on the calendar, with no time and no time zone. An all-day event is made of these, and
/// they stay days all the way to the store: a day turned into an instant and back slides to the
/// day before or after whenever the two turnings disagree about the time zone (upstream #34).
public struct Day: Equatable, Comparable, Sendable {
  public let year: Int
  public let month: Int
  public let day: Int

  /// Read `YYYY-MM-DD`. A day that is not on the calendar, such as the 30th of February, is no
  /// day at all, rather than the 2nd of March.
  public init?(_ text: String) {
    let parts = text.split(separator: "-", omittingEmptySubsequences: false).map { Int($0) }
    guard parts.count == 3, let year = parts[0], let month = parts[1], let day = parts[2] else {
      return nil
    }

    var gregorian = Foundation.Calendar(identifier: .gregorian)
    gregorian.timeZone = TimeZone(identifier: "UTC")!
    let asked = DateComponents(year: year, month: month, day: day)
    guard asked.isValidDate(in: gregorian) else { return nil }

    self.year = year
    self.month = month
    self.day = day
  }

  public static func < (left: Day, right: Day) -> Bool {
    (left.year, left.month, left.day) < (right.year, right.month, right.day)
  }
}

/// When a new event is: a range of instants, or whole days.
public enum EventTime: Equatable, Sendable {
  case timed(Range)
  case allDay(firstDay: Day, lastDay: Day)

  public var isAllDay: Bool {
    if case .allDay = self { true } else { false }
  }
}

/// An event that does not exist yet.
public struct NewEvent: Equatable, Sendable {
  public let title: String
  public let calendarIdentifier: String
  public let time: EventTime
  public let location: String?
  public let notes: String?
}

/// What creating an event came to: the event as the store holds it, and whether the store could
/// show it afterwards. A save that cannot be read back is said to be unconfirmed rather than
/// failed, because a failure would have the caller create the event a second time.
struct CreatedEvent: Equatable, Sendable {
  let event: Event
  let confirmed: Bool
}

/// The store would not save the event. It carries what the store said, verbatim.
public struct EventNotSaved: Error, Equatable, Sendable {
  public let evidence: String

  public init(evidence: String) {
    self.evidence = evidence
  }
}
