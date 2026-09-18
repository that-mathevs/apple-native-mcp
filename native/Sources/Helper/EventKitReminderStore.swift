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

  func reminders(in reminderLists: [ReminderList], includingCompleted: Bool) -> [Reminder] {
    let calendars = reminderLists.compactMap { store.calendar(withIdentifier: $0.identifier) }
    // EventKit reads no calendars as every calendar, which is never what an empty ask means.
    guard !calendars.isEmpty else { return [] }

    // Completed reminders are left out in the fetch itself: years of them are what made
    // upstream's reads time out (upstream #53).
    let predicate =
      includingCompleted
      ? store.predicateForReminders(in: calendars)
      : store.predicateForIncompleteReminders(
        withDueDateStarting: nil, ending: nil, calendars: calendars)

    let fetched = DispatchSemaphore(value: 0)
    nonisolated(unsafe) var found: [EKReminder] = []
    store.fetchReminders(matching: predicate) { reminders in
      found = reminders ?? []
      fetched.signal()
    }
    fetched.wait()

    return found.map { reminder in
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
