import Foundation

@testable import HelperCore

// The words a scenario uses to set up a Mac's reminders without having one.

let onMyMac = CalendarAccount(identifier: "account-local", title: "On My Mac")

let groceries = ReminderList(identifier: "list-groceries", title: "Groceries", account: iCloud)
let localGroceries = ReminderList(
  identifier: "list-local-groceries", title: "Groceries", account: onMyMac)
let errands = ReminderList(identifier: "list-errands", title: "Errands", account: iCloud)

func aReminder(
  _ title: String,
  in list: ReminderList,
  completed: Bool = false,
  due: Due? = nil,
  notes: String? = nil
) -> Reminder {
  Reminder(
    identifier: "reminder:\(title)", title: title, notes: notes, isCompleted: completed, due: due,
    reminderList: list)
}

/// A reminder store that is not a Mac's: it holds whatever a scenario says it holds, so every
/// rule above EventKit is specified without a permission, a prompt or a real reminder.
struct FakeReminderStore: ReminderStore {
  /// How many times macOS was asked, and which reminder lists the store was asked to read, so a
  /// scenario can say what the helper did not do.
  final class Record: @unchecked Sendable {
    var timesAsked = 0
    var reminderListsRead: [[ReminderList]] = []
    var deadlines: [Date] = []
  }

  var permissionHeld: Permission = .granted
  var answersWhenAsked: Permission = .refused
  var heldReminderLists: [ReminderList] = []
  var held: [Reminder] = []
  /// Reminder lists too large, or too far away, to answer by any deadline.
  var slow: [ReminderList] = []
  /// Reminder lists deleted after they were listed and before they were read.
  var deleted: [ReminderList] = []
  let record = Record()

  func permission() -> Permission { permissionHeld }

  func requestPermission() -> Permission {
    record.timesAsked += 1
    return answersWhenAsked
  }

  func reminderLists() -> [ReminderList] { heldReminderLists }

  func reminders(
    in reminderLists: [ReminderList], includingCompleted: Bool, answeringBy deadline: Date
  ) -> RemindersRead {
    record.reminderListsRead.append(reminderLists)
    record.deadlines.append(deadline)
    let answering = reminderLists.filter { !slow.contains($0) && !deleted.contains($0) }
    return RemindersRead(
      reminders: held.filter {
        answering.contains($0.reminderList) && (includingCompleted || !$0.isCompleted)
      },
      unreadReminderLists: reminderLists.filter { slow.contains($0) },
      goneReminderLists: reminderLists.filter { deleted.contains($0) })
  }

  // MARK: builders

  func permission(_ permission: Permission) -> FakeReminderStore {
    var store = self
    store.permissionHeld = permission
    return store
  }

  /// What the user will choose when macOS asks them.
  func answering(_ permission: Permission) -> FakeReminderStore {
    var store = self
    store.answersWhenAsked = permission
    return store
  }

  func holding(_ reminderLists: ReminderList...) -> FakeReminderStore {
    var store = self
    store.heldReminderLists += reminderLists
    return store
  }

  func deletedBeforeReading(_ reminderLists: ReminderList...) -> FakeReminderStore {
    var store = self
    store.deleted += reminderLists
    return store
  }

  func tooSlowToRead(_ reminderLists: ReminderList...) -> FakeReminderStore {
    var store = self
    store.slow += reminderLists
    return store
  }

  func holding(_ reminders: Reminder...) -> FakeReminderStore {
    var store = self
    store.held += reminders
    return store
  }
}

func aReminderStore() -> FakeReminderStore { FakeReminderStore() }

/// Reading a fake Mac's reminders at a fixed instant, so a scenario can say when the deadline is.
func readingReminders(_ store: FakeReminderStore, at now: Date) -> RemindersReading {
  RemindersReading(store: store, clock: { now })
}

func helperReading(_ store: FakeReminderStore) -> Helper {
  Helper(calendarStore: aCalendarStore(), reminderStore: store, contactStore: aContactStore(), messageStore: noMessageStore)
}
