import EventKit
import Foundation
import HelperCore

/// The one place EventKit's reminders are touched. Everything above it is specified against a
/// fake, so nothing but this file needs a Mac with reminders on it.
final class EventKitReminderStore: ReminderStore, @unchecked Sendable {
  private let store = EKEventStore()

  /// The user's answer, once they have given one in this process: EventKit can go on reporting
  /// the permission as undecided after it (#57). Mutable state is safe here only because the
  /// session serves one request at a time on one thread (Session.swift).
  private var answer: Permission?

  func permission() -> Permission {
    .held(reported: Permission(EKEventStore.authorizationStatus(for: .reminder)), answered: answer)
  }

  func requestPermission() -> Permission {
    answer = .asking(store.requestFullAccessToReminders)
    return permission()
  }

  func reminderLists() -> [ReminderList] {
    store.calendars(for: .reminder).map(reminderList)
  }

  func reminders(
    in reminderLists: [ReminderList], includingCompleted: Bool, answeringBy deadline: Date
  ) -> RemindersRead {
    let answers = Answers()
    var fetches: [String: Any] = [:]
    var gone: [ReminderList] = []

    // One fetch per reminder list, all at once, so one large list cannot hold up the rest.
    for list in reminderLists {
      guard let calendar = store.calendar(withIdentifier: list.identifier) else {
        gone.append(list)
        continue
      }
      fetches[list.identifier] = store.fetchReminders(
        matching: predicate(for: calendar, includingCompleted: includingCompleted)
      ) { reminders in
        answers.record(reminders ?? [], for: list.identifier)
      }
    }

    let answered = answers.waitingFor(fetches.count, until: deadline)

    // A fetch still running is cancelled rather than left to finish for nobody.
    for (identifier, fetch) in fetches where answered[identifier] == nil {
      store.cancelFetchRequest(fetch)
    }

    return RemindersRead(
      reminders: reminderLists.flatMap { answered[$0.identifier] ?? [] }.map(reminder),
      unreadReminderLists: reminderLists.filter {
        answered[$0.identifier] == nil && !gone.contains($0)
      },
      goneReminderLists: gone)
  }

  func defaultReminderList() -> ReminderList? {
    store.defaultCalendarForNewReminders().map(reminderList)
  }

  /// Built from what it was given and nothing more: no alarm is ever added (#20). Whether macOS
  /// notifies at a due time with no alarm on it is its own question, REM-V4 in findings.md.
  func save(_ new: NewReminder, in list: ReminderList) throws(ReminderNotSaved) -> Reminder {
    guard let calendar = store.calendar(withIdentifier: list.identifier) else {
      throw ReminderNotSaved(evidence: "No reminder list with identifier \(list.identifier)")
    }

    let saved = EKReminder(eventStore: store)
    saved.title = new.title
    saved.calendar = calendar
    saved.dueDateComponents = new.due.map(components)

    do {
      try store.save(saved, commit: true)
    } catch {
      throw ReminderNotSaved(evidence: error.localizedDescription)
    }
    return reminder(saved)
  }

  func reminder(identifier: String) -> HeldReminder? {
    guard let held = store.calendarItem(withIdentifier: identifier) as? EKReminder else {
      return nil
    }
    return HeldReminder(reminder: reminder(held), alerts: held.alarms?.count ?? 0)
  }

  /// A due date is a day with no hour and no time zone, so no clock can move it. A due time is
  /// the day and time the user's clock shows at that instant, in the user's time zone.
  private func components(_ due: Due) -> DateComponents {
    switch due {
    case .date(let year, let month, let day):
      return DateComponents(year: year, month: month, day: day)
    case .time(let instant):
      var calendar = Foundation.Calendar(identifier: .gregorian)
      calendar.timeZone = .current
      var parts = calendar.dateComponents(
        [.year, .month, .day, .hour, .minute, .second], from: instant)
      parts.timeZone = .current
      return parts
    }
  }

  /// Completed reminders are left out in the fetch itself: years of them are what made
  /// upstream's reads time out (upstream #53).
  private func predicate(for calendar: EKCalendar, includingCompleted: Bool) -> NSPredicate {
    includingCompleted
      ? store.predicateForReminders(in: [calendar])
      : store.predicateForIncompleteReminders(
        withDueDateStarting: nil, ending: nil, calendars: [calendar])
  }

  private func reminder(_ reminder: EKReminder) -> Reminder {
    // Which of EventKit's identifiers addresses a reminder for good waits on REM-V6 in
    // findings.md; this is the one EventKit itself looks a reminder up by.
    Reminder(
      identifier: reminder.calendarItemIdentifier,
      title: reminder.title ?? "",
      notes: reminder.notes,
      isCompleted: reminder.isCompleted,
      due: reminder.dueDateComponents.flatMap(due),
      reminderList: reminderList(reminder.calendar))
  }

  private func reminderList(_ calendar: EKCalendar) -> ReminderList {
    let source = calendar.source
    return ReminderList(
      identifier: calendar.calendarIdentifier,
      title: calendar.title,
      account: CalendarAccount(
        identifier: source?.sourceIdentifier ?? "", title: source?.title ?? ""))
  }

  /// A due date is components with no hour: the day alone, with no time zone to shift it. A due
  /// time has an hour, and is read in the zone it was saved in, or the Mac's when it has none.
  private func due(_ components: DateComponents) -> Due? {
    guard let year = components.year, let month = components.month, let day = components.day
    else { return nil }
    guard components.hour != nil else { return .date(year: year, month: month, day: day) }

    var calendar = Foundation.Calendar(identifier: .gregorian)
    calendar.timeZone = components.timeZone ?? .current
    return calendar.date(from: components).map(Due.time)
  }
}

/// What the fetches have answered so far. EventKit answers on threads of its own, may answer
/// after the deadline, and may never call back for a fetch that was cancelled, so waiting is on a
/// condition this class owns rather than on anything that must be balanced.
private final class Answers: @unchecked Sendable {
  private let condition = NSCondition()
  private var byReminderList: [String: [EKReminder]] = [:]

  func record(_ reminders: [EKReminder], for identifier: String) {
    condition.lock()
    byReminderList[identifier] = reminders
    condition.broadcast()
    condition.unlock()
  }

  /// What has answered once this many have, or once the deadline passes, whichever is first.
  func waitingFor(_ expected: Int, until deadline: Date) -> [String: [EKReminder]] {
    condition.lock()
    defer { condition.unlock() }
    while byReminderList.count < expected, condition.wait(until: deadline) {}
    return byReminderList
  }
}
