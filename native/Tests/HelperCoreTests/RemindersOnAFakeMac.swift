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
    var saved: [NewReminder] = []
  }

  var permissionHeld: Permission = .granted
  var answersWhenAsked: Permission = .refused
  var heldReminderLists: [ReminderList] = []
  var held: [Reminder] = []
  var defaultList: ReminderList?
  var keepsWhatItSaves = true
  var refusesToSave: String?

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

  func defaultReminderList() -> ReminderList? { defaultList }

  func save(_ reminder: NewReminder, in reminderList: ReminderList) throws(ReminderNotSaved)
    -> Reminder
  {
    if let said = refusesToSave { throw ReminderNotSaved(evidence: said) }
    record.saved.append(reminder)
    return Reminder(
      identifier: "reminder:new:\(record.saved.count)", title: reminder.title, notes: nil,
      isCompleted: false, due: reminder.due, reminderList: reminderList)
  }

  /// What it saved, read back as it would be: in the list it went to, with no alert on it.
  func reminder(identifier: String) -> HeldReminder? {
    guard keepsWhatItSaves,
      let number = Int(identifier.split(separator: ":").last ?? ""),
      record.saved.indices.contains(number - 1)
    else { return nil }

    let saved = record.saved[number - 1]
    guard let list = heldReminderLists.first(where: {
      $0.identifier == saved.reminderListIdentifier
    }) else { return nil }

    return HeldReminder(
      reminder: Reminder(
        identifier: identifier, title: saved.title, notes: nil, isCompleted: false,
        due: saved.due, reminderList: list),
      alerts: 0)
  }

  func defaultingTo(_ reminderList: ReminderList) -> FakeReminderStore {
    var store = self
    store.defaultList = reminderList
    return store
  }

  /// It saves what it is given, and then cannot find it again.
  func losingSightOfWhatItSaves() -> FakeReminderStore {
    var store = self
    store.keepsWhatItSaves = false
    return store
  }

  func refusingToSave(saying evidence: String) -> FakeReminderStore {
    var store = self
    store.refusesToSave = evidence
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
  aHelper(reminderStore: store)
}
