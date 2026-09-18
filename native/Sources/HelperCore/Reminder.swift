import Foundation

/// A container of reminders in one account, addressed by its identifier because titles repeat
/// across accounts.
public struct ReminderList: Equatable, Hashable, Sendable {
  public let identifier: String
  public let title: String
  public let account: CalendarAccount

  public init(identifier: String, title: String, account: CalendarAccount) {
    self.identifier = identifier
    self.title = title
    self.account = account
  }
}

/// What a read of some reminder lists found. The ones that did not answer in time are named
/// rather than silently missing, so a short answer is never mistaken for the whole; the ones
/// deleted since they were listed are named apart, because they are gone rather than slow.
public struct RemindersRead: Equatable, Sendable {
  public let reminders: [Reminder]
  public let unreadReminderLists: [ReminderList]
  public let goneReminderLists: [ReminderList]

  public init(
    reminders: [Reminder], unreadReminderLists: [ReminderList],
    goneReminderLists: [ReminderList] = []
  ) {
    self.reminders = reminders
    self.unreadReminderLists = unreadReminderLists
    self.goneReminderLists = goneReminderLists
  }
}

/// When a reminder is due: a due date is a day with no time of day, and a due time is an
/// instant. A due date is never given a time, not even midnight (upstream #34, #64).
public enum Due: Equatable, Sendable {
  case date(year: Int, month: Int, day: Int)
  case time(Date)
}

/// An item in a reminder list. It is open until it is completed.
public struct Reminder: Equatable, Sendable {
  public let identifier: String
  public let title: String
  public let isCompleted: Bool
  public let due: Due?
  public let reminderList: ReminderList

  public init(
    identifier: String, title: String, isCompleted: Bool, due: Due?, reminderList: ReminderList
  ) {
    self.identifier = identifier
    self.title = title
    self.isCompleted = isCompleted
    self.due = due
    self.reminderList = reminderList
  }
}
