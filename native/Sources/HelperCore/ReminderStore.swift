import Foundation

/// The reminders as the helper reaches them. EventKit sits behind this and nothing else does, so
/// the rules above it are specified against a fake and `swift test` needs no permission.
public protocol ReminderStore: Sendable {
  /// What macOS currently allows.
  func permission() -> Permission

  /// Ask macOS for reminders access, which prompts the user, and report what they chose.
  /// Only ever called while the permission is undecided: macOS prompts once and no more.
  func requestPermission() -> Permission

  /// Every reminder list the helper can see.
  func reminderLists() -> [ReminderList]

  /// The reminders in these reminder lists, open ones only unless completed ones are wanted too,
  /// from every list that answers by the deadline; the rest are named as unanswered. Never called
  /// with none: EventKit reads no reminder lists as every reminder list.
  func reminders(
    in reminderLists: [ReminderList], includingCompleted: Bool, answeringBy deadline: Date
  ) -> RemindersRead

  /// The reminder list the user set for new reminders, or nil when there is none.
  func defaultReminderList() -> ReminderList?

  /// Save a new reminder in a reminder list, adding nothing it was not given, and answer with it
  /// as built.
  func save(_ reminder: NewReminder, in reminderList: ReminderList) throws(ReminderNotSaved)
    -> Reminder

  /// A reminder as the store now holds it, or nil when it cannot find one by that identifier.
  func reminder(identifier: String) -> HeldReminder?
}

/// The store would not save a reminder. It carries what the store said, verbatim.
public struct ReminderNotSaved: Error, Equatable, Sendable {
  public let evidence: String

  public init(evidence: String) {
    self.evidence = evidence
  }
}
