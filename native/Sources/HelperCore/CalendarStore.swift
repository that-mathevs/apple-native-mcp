/// The calendar as the helper reaches it. EventKit sits behind this and nothing else does, so the
/// rules above it are specified against a fake and `swift test` needs neither a permission nor a
/// single real event.
public protocol CalendarStore: Sendable {
  /// What macOS currently allows.
  func permission() -> CalendarPermission

  /// Ask macOS for calendar access, which prompts the user, and report what they chose.
  /// Only ever called while the permission is undecided: macOS prompts once and no more.
  func requestPermission() -> CalendarPermission

  /// Every calendar the helper can see, including ones it may turn out not to be able to read.
  func calendars() -> [Calendar]

  /// The occurrences one calendar holds in a range, a series already expanded into them.
  /// Asking one calendar at a time is what lets one bad calendar fail on its own.
  func events(in range: Range, from calendar: Calendar) throws(CalendarUnreadable) -> [Event]
}

/// One calendar would not answer — an offline subscription, a server that refused. It carries what
/// the store said, verbatim, because that sentence is the only clue the user has.
public struct CalendarUnreadable: Error, Equatable, Sendable {
  public let evidence: String

  public init(evidence: String) {
    self.evidence = evidence
  }
}
