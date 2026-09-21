/// Writing reminders: the rules that sit between the protocol and EventKit.
struct RemindersWriting: Sendable {
  let store: ReminderStore

  /// The reminder list the user set for new reminders, or nil when they have none. The helper
  /// never picks one for them.
  func defaultReminderList() -> Result<ReminderList?, NamedFailure> {
    permitted { .success(store.defaultReminderList()) }
  }

  func create(_ reminder: NewReminder) -> Result<CreatedReminder, NamedFailure> {
    permitted {
      let named = store.reminderLists().first { $0.identifier == reminder.reminderListIdentifier }
      guard let reminderList = named else {
        return .failure(.reminderListUnknown(identifier: reminder.reminderListIdentifier))
      }
      return saving(reminder, in: reminderList)
    }
  }

  private func permitted<Answer>(_ work: () -> Result<Answer, NamedFailure>) -> Result<
    Answer, NamedFailure
  > {
    store.permission().whenItAllows(
      \.allowsWriting, else: NamedFailure.remindersPermissionMissing, work)
  }

  /// Saved, then read back: a reminder is reported as created only once the store shows it.
  private func saving(
    _ reminder: NewReminder, in reminderList: ReminderList
  ) -> Result<CreatedReminder, NamedFailure> {
    do {
      let saved = try store.save(reminder, in: reminderList)
      guard let held = store.reminder(identifier: saved.identifier) else {
        return .success(
          CreatedReminder(reminder: saved, confirmed: false, alerts: nil, hasNotes: nil))
      }
      return .success(
        CreatedReminder(
          reminder: held.reminder, confirmed: true, alerts: held.alerts,
          hasNotes: !(held.reminder.notes ?? "").isEmpty))
    } catch {
      return .failure(.reminderNotSaved(evidence: error.evidence))
    }
  }
}
