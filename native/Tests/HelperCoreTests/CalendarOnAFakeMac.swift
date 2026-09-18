import Foundation

@testable import HelperCore

// The words a scenario uses to set a Mac up without having one.

/// An instant, written the way the protocol writes one.
func at(_ instant: String) -> Date { Instant.read(instant)! }

func aRange(from start: String, to end: String) -> HelperCore.Range {
  HelperCore.Range(from: at(start), to: at(end))!
}

let iCloud = CalendarAccount(identifier: "account-icloud", title: "iCloud")
let subscriptions = CalendarAccount(identifier: "account-subscriptions", title: "Subscriptions")

let work = HelperCore.Calendar(
  identifier: "calendar-work", title: "Work", account: iCloud, acceptsNewEvents: true)
let personal = HelperCore.Calendar(
  identifier: "calendar-personal", title: "Personal", account: iCloud, acceptsNewEvents: true)
let teamFeed = HelperCore.Calendar(
  identifier: "calendar-team-feed", title: "Team feed", account: subscriptions,
  acceptsNewEvents: false)

func anEvent(
  _ title: String,
  from start: String,
  to end: String,
  in calendar: HelperCore.Calendar,
  location: String? = nil,
  notes: String? = nil,
  allDay: Bool = false
) -> Event {
  Event(
    eventIdentifier: "event:\(title)",
    title: title,
    start: at(start),
    end: at(end),
    isAllDay: allDay,
    location: location,
    notes: notes,
    originalStart: nil,
    calendar: calendar)
}

/// One dated instance of a recurring event. Every occurrence of a series shares the series' event
/// identifier, and is told apart by the start it has within the series.
func occurrenceOfASeries(
  _ title: String,
  on start: String,
  lasting minutes: Int,
  in calendar: HelperCore.Calendar = work
) -> Event {
  Event(
    eventIdentifier: "series:\(title)",
    title: title,
    start: at(start),
    end: at(start).addingTimeInterval(TimeInterval(minutes * 60)),
    isAllDay: false,
    location: nil,
    notes: nil,
    originalStart: at(start),
    calendar: calendar)
}

/// A calendar store that is not a Mac's: it holds whatever a scenario says it holds, so every rule
/// above EventKit is specified without a permission, a prompt or a real event.
struct FakeCalendarStore: CalendarStore {
  /// How many times macOS was asked. A Mac only ever prompts once, so a scenario has to be able
  /// to say that the helper did not ask again.
  final class Asking: @unchecked Sendable {
    var times = 0
  }

  /// What was read, so a scenario can say how little the helper had to look at.
  final class Reads: @unchecked Sendable {
    var ranges: [HelperCore.Range] = []
    var calendars: [HelperCore.Calendar] = []
  }

  /// What the store was asked to save, so a scenario can say exactly what reached it.
  final class Saved: @unchecked Sendable {
    var events: [NewEvent] = []
  }

  var permissionHeld: Permission = .granted
  var held: [Event] = []
  var refusing: [HelperCore.Calendar: String] = [:]
  var answersWhenAsked: Permission = .refused
  let asking = Asking()
  let reads = Reads()
  let saved = Saved()
  var ownCalendars: [HelperCore.Calendar] = []
  var defaultCalendarHeld: HelperCore.Calendar?
  var refusesToSave: String?
  var losesSight = false

  func permission() -> Permission { permissionHeld }

  func requestPermission() -> Permission {
    asking.times += 1
    return answersWhenAsked
  }

  func calendars() -> [HelperCore.Calendar] {
    var seen: [HelperCore.Calendar] = ownCalendars
    for calendar in held.map(\.calendar) where !seen.contains(calendar) { seen.append(calendar) }
    for calendar in refusing.keys.sorted(by: { $0.identifier < $1.identifier })
    where !seen.contains(calendar) {
      seen.append(calendar)
    }
    return seen
  }

  func events(in range: HelperCore.Range, from calendar: HelperCore.Calendar) throws(
    CalendarUnreadable
  ) -> [Event] {
    reads.ranges.append(range)
    reads.calendars.append(calendar)
    if let said = refusing[calendar] { throw CalendarUnreadable(evidence: said) }
    // EventKit answers with what overlaps the range, as this does.
    return held.filter {
      $0.calendar == calendar && $0.start < range.end && $0.end > range.start
    }
  }

  func event(identifier: String) -> Event? {
    if losesSight { return nil }
    return (held + savedAsEvents()).filter { $0.eventIdentifier == identifier }
      .min { $0.start < $1.start }
  }

  func defaultCalendar() -> HelperCore.Calendar? { defaultCalendarHeld }

  func save(_ event: NewEvent, in calendar: HelperCore.Calendar) throws(EventNotSaved) -> Event {
    if let said = refusesToSave { throw EventNotSaved(evidence: said) }
    saved.events.append(event)
    return asEvent(event, in: calendar)
  }

  /// This Mac is in UTC: an all-day event runs from its first midnight to its last day's end.
  private func asEvent(_ event: NewEvent, in calendar: HelperCore.Calendar) -> Event {
    let (start, end): (Date, Date) =
      switch event.time {
      case .timed(let range): (range.start, range.end)
      case .allDay(let firstDay, let lastDay):
        (midnight(firstDay), midnight(lastDay).addingTimeInterval(86399))
      }
    return Event(
      eventIdentifier: "saved:\(event.title)", title: event.title, start: start, end: end,
      isAllDay: event.time.isAllDay,
      location: event.location, notes: event.notes, originalStart: nil, calendar: calendar)
  }

  private func midnight(_ day: Day) -> Date {
    var utc = Foundation.Calendar(identifier: .gregorian)
    utc.timeZone = TimeZone(identifier: "UTC")!
    return utc.date(from: DateComponents(year: day.year, month: day.month, day: day.day))!
  }

  private func savedAsEvents() -> [Event] {
    saved.events.compactMap { event in
      calendars().first { $0.identifier == event.calendarIdentifier }
        .map { asEvent(event, in: $0) }
    }
  }

  // MARK: builders

  func permission(_ permission: Permission) -> FakeCalendarStore {
    var store = self
    store.permissionHeld = permission
    return store
  }

  /// Calendars the store has whether or not anything is held in them.
  func having(_ calendars: HelperCore.Calendar...) -> FakeCalendarStore {
    var store = self
    store.ownCalendars += calendars
    return store
  }

  /// The calendar the user set in Calendar for new events.
  func defaultingTo(_ calendar: HelperCore.Calendar) -> FakeCalendarStore {
    var store = self
    store.defaultCalendarHeld = calendar
    return store
  }

  func refusingToSave(saying evidence: String) -> FakeCalendarStore {
    var store = self
    store.refusesToSave = evidence
    return store
  }

  /// The store takes an event and then cannot find it: a sync that has not landed yet.
  func losingSightOfWhatItSaves() -> FakeCalendarStore {
    var store = self
    store.losesSight = true
    return store
  }

  func permitted() -> FakeCalendarStore { permission(.granted) }

  /// What the user will choose when macOS asks them.
  func answering(_ permission: Permission) -> FakeCalendarStore {
    var store = self
    store.answersWhenAsked = permission
    return store
  }

  func holding(_ events: Event...) -> FakeCalendarStore {
    var store = self
    store.held += events
    return store
  }

  func unableToRead(_ calendar: HelperCore.Calendar, saying evidence: String) -> FakeCalendarStore {
    var store = self
    store.refusing[calendar] = evidence
    return store
  }
}

func aCalendarStore() -> FakeCalendarStore { FakeCalendarStore() }

func helperReading(_ store: FakeCalendarStore) -> Helper {
  Helper(calendarStore: store, reminderStore: aReminderStore(), contactStore: aContactStore())
}

func readingACalendar(_ store: FakeCalendarStore) -> CalendarReading { CalendarReading(store: store) }

extension Result where Failure == NamedFailure {
  /// Why a read was refused, for scenarios about a read that fails.
  var failure: NamedFailure? {
    if case .failure(let failure) = self { return failure }
    return nil
  }
}

extension Result where Success == Event?, Failure == NamedFailure {
  /// The event a read found, or nil when it found none.
  var found: Event? { (try? get()) ?? nil }
}

extension Result where Success == EventsInRange, Failure == NamedFailure {
  /// What a read answered, for scenarios about a read that succeeds.
  var answer: EventsInRange { try! get() }
}
