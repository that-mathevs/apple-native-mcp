import Foundation
import Testing

@testable import HelperCore

// chrischall 6831a90: one large reminder list held up the read, and a skipped one went unmentioned.
@Suite("reading the reminders within the time budget")
struct ReadingTheRemindersInTimeSpec {
  let now = at("2026-09-18T16:00:00Z")

  @Test("gives every reminder list one deadline, two seconds after the request arrived")
  func setsOneDeadlineForEveryList() {
    let store = aReminderStore().holding(groceries, errands)

    _ = readingReminders(store, at: now).reminders(
      inReminderListsNamed: ["list-groceries", "list-errands"], includingCompleted: false)

    #expect(store.record.deadlines == [now.addingTimeInterval(2)])
  }

  @Test("given a reminder list that does not answer by the deadline, returns the others and names it as unread")
  func namesAListThatDidNotAnswer() {
    let store = aReminderStore().holding(groceries, errands)
      .holding(aReminder("Oat milk", in: groceries))
      .tooSlowToRead(errands)

    let read = readingReminders(store, at: now).reminders(
      inReminderListsNamed: ["list-groceries", "list-errands"], includingCompleted: false)

    #expect(
      read == .success(
        RemindersRead(
          reminders: [aReminder("Oat milk", in: groceries)], unreadReminderLists: [errands])))
  }

  // danielk-am ad3e9e9: a store that never answered read as a Mac with no reminders at all.
  @Test("given no reminder list answers by the deadline, reports that the read timed out rather than that there are no reminders")
  func timesOutWhenNothingAnswered() {
    let store = aReminderStore().holding(groceries, errands).tooSlowToRead(groceries, errands)

    let read = readingReminders(store, at: now).reminders(
      inReminderListsNamed: ["list-groceries", "list-errands"], includingCompleted: false)

    guard case .failure(let failure) = read else {
      Issue.record("the read answered instead of timing out")
      return
    }
    #expect(failure.code == .remindersTimedOut)
  }

  // Deleted between being listed and being read, it is gone, not slow: a timeout would misname it.
  @Test("given a reminder list deleted before it could be read, refuses it by identifier rather than calling it slow")
  func refusesAListDeletedMidRead() {
    let store = aReminderStore().holding(groceries, errands).deletedBeforeReading(errands)

    let read = readingReminders(store, at: now).reminders(
      inReminderListsNamed: ["list-groceries", "list-errands"], includingCompleted: false)

    #expect(read == .failure(.reminderListUnknown(identifier: "list-errands")))
  }
}
