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
