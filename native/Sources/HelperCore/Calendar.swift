import Foundation

/// The source a calendar belongs to: iCloud, CalDAV, Exchange or local. Two calendars can share a
/// title, so the account is what tells them apart to a reader.
public struct CalendarAccount: Equatable, Hashable, Sendable {
  public let identifier: String
  public let title: String

  public init(identifier: String, title: String) {
    self.identifier = identifier
    self.title = title
  }
}

/// A container of events, addressed by its identifier because titles repeat across accounts.
public struct Calendar: Equatable, Hashable, Sendable {
  public let identifier: String
  public let title: String
  public let account: CalendarAccount

  public init(identifier: String, title: String, account: CalendarAccount) {
    self.identifier = identifier
    self.title = title
    self.account = account
  }
}

/// An entry in a calendar. One occurrence of a series is an event too: it carries the series'
/// event identifier and the original start that addresses it within the series.
public struct Event: Equatable, Sendable {
  public let eventIdentifier: String
  public let title: String
  public let start: Date
  public let end: Date
  public let isAllDay: Bool
  public let location: String?
  public let notes: String?
  /// The start this occurrence has within its series, or nil when the event belongs to no series.
  public let originalStart: Date?
  public let calendar: Calendar

  public init(
    eventIdentifier: String,
    title: String,
    start: Date,
    end: Date,
    isAllDay: Bool,
    location: String?,
    notes: String?,
    originalStart: Date?,
    calendar: Calendar
  ) {
    self.eventIdentifier = eventIdentifier
    self.title = title
    self.start = start
    self.end = end
    self.isAllDay = isAllDay
    self.location = location
    self.notes = notes
    self.originalStart = originalStart
    self.calendar = calendar
  }
}

/// The start and end instants a read covers. The start is inside the range and the end is the
/// first instant outside it, so two ranges laid end to end neither overlap nor leave a gap.
public struct Range: Equatable, Sendable {
  public let start: Date
  public let end: Date

  /// A range has to move forwards. An end at or before its start is no range at all.
  public init?(from start: Date, to end: Date) {
    guard end > start else { return nil }
    self.start = start
    self.end = end
  }
}

extension Event {
  /// An event is in a range when the two overlap, not when the range contains it: a meeting that
  /// started before the range began is still on when the range begins.
  func falls(in range: Range) -> Bool {
    start < range.end && end > range.start
  }
}

extension Array where Element == Event {
  /// Ordered by start. Events starting together fall back to title and then to event identifier,
  /// so the same range always reads the same way.
  func inTheOrderTheyStart() -> [Event] {
    sorted { left, right in
      if left.start != right.start { return left.start < right.start }
      if left.title != right.title { return left.title < right.title }
      return left.eventIdentifier < right.eventIdentifier
    }
  }
}
