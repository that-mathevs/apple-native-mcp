import Foundation

/// The calendar as the helper reaches it. EventKit sits behind this and nothing else does, so the
/// rules above it are specified against a fake and `swift test` needs neither a permission nor a
/// single real event.
public protocol CalendarStore: Sendable {
  /// What macOS currently allows.
  func permission() -> Permission

  /// Ask macOS for calendar access, which prompts the user, and report what they chose.
  /// Only ever called while the permission is undecided: macOS prompts once and no more.
  func requestPermission() -> Permission

  /// Every calendar the helper can see, including ones it may turn out not to be able to read.
  func calendars() -> [Calendar]

  /// The occurrences one calendar holds in a range, a series already expanded into them.
  /// Asking one calendar at a time is what lets one bad calendar fail on its own.
  func events(in range: Range, from calendar: Calendar) throws(CalendarUnreadable) -> [Event]

  /// The event an identifier names, or nil when there is none. For a series this is whichever
  /// occurrence the store thinks of first: telling occurrences apart is the reading's job.
  func event(identifier: String) -> Event?

  /// The calendar the user set in Calendar for new events, or nil when there is none.
  func defaultCalendar() -> Calendar?

  /// Save a new event in a calendar, and answer with the event as the store now believes it to
  /// be. An all-day event arrives as days, and the store alone decides which instants those are.
  func save(_ event: NewEvent, in calendar: Calendar) throws(EventNotSaved) -> Event
}

/// One calendar would not answer — an offline subscription, a server that refused. It carries what
/// the store said, verbatim, because that sentence is the only clue the user has.
public struct CalendarUnreadable: Error, Equatable, Sendable {
  public let evidence: String

  public init(evidence: String) {
    self.evidence = evidence
  }
}

extension CalendarStore {
  /// Do the work only while macOS allows it, and otherwise refuse with the setting to change.
  /// Reading and writing ask for different things: a write-only grant allows adding and no more.
  func whenPermitted<Answer>(
    _ allows: KeyPath<Permission, Bool>, _ work: () -> Result<Answer, NamedFailure>
  ) -> Result<Answer, NamedFailure> {
    let held = permission()
    guard held[keyPath: allows] else {
      return .failure(.calendarPermissionMissing(permission: held))
    }
    return work()
  }
}
