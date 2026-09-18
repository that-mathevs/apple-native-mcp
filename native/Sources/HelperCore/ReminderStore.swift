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

  /// The reminders in these reminder lists, open ones only unless completed ones are wanted too.
  /// Never called with none: EventKit reads no reminder lists as every reminder list.
  func reminders(in reminderLists: [ReminderList], includingCompleted: Bool) -> [Reminder]
}
