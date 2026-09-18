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
  public let notes: String?
  public let isCompleted: Bool
  public let due: Due?
  public let reminderList: ReminderList

  public init(
    identifier: String, title: String, notes: String?, isCompleted: Bool, due: Due?,
    reminderList: ReminderList
  ) {
    self.identifier = identifier
    self.title = title
    self.notes = notes
    self.isCompleted = isCompleted
    self.due = due
    self.reminderList = reminderList
  }
}
