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
  /// Searched, and never sent: an index keeps to small fixed fields (ADR-0006).
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

extension Reminder {
  /// Whether the title or the notes mention some text, ignoring case: both are upper-cased, then
  /// compared code unit by code unit, which the server's fake store does the same way (Greek's
  /// final sigma folds alike upper-cased, and lower-casing folds it by position). The text is
  /// compared and never interpreted, so it matches only itself.
  func mentions(_ text: String) -> Bool {
    let sought = text.uppercased()
    return [title, notes].contains {
      $0?.uppercased().range(of: sought, options: .literal) != nil
    }
  }
}

/// A reminder that does not exist yet, and the reminder list it is to be created in. It carries no
/// alert, and there is no way to give it one: a due time says when it is due (#20).
public struct NewReminder: Equatable, Sendable {
  public let title: String
  public let reminderListIdentifier: String
  public let due: Due?
  /// Saved as given, and never sent back: an index keeps to small fixed fields (ADR-0006).
  public let notes: String?

  public init(title: String, reminderListIdentifier: String, due: Due?, notes: String? = nil) {
    self.title = title
    self.reminderListIdentifier = reminderListIdentifier
    self.due = due
    self.notes = notes
  }
}

/// A reminder as the store holds it, and how many alerts it holds on it.
public struct HeldReminder: Equatable, Sendable {
  public let reminder: Reminder
  public let alerts: Int

  public init(reminder: Reminder, alerts: Int) {
    self.reminder = reminder
    self.alerts = alerts
  }
}

/// What became of a new reminder. Confirmed means the store showed it afterwards; unconfirmed
/// means it was saved and could not be found again, which is never a failure to retry.
struct CreatedReminder: Equatable, Sendable {
  let reminder: Reminder
  let confirmed: Bool
  /// How many alerts the store holds on it, known only when it could be read back.
  let alerts: Int?
  /// Whether the store holds notes on it, known only when it could be read back.
  let hasNotes: Bool?
}
