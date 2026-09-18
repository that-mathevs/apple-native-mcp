/// Reading the reminders: the rules that sit between the protocol and EventKit.
struct RemindersReading: Sendable {
  let store: ReminderStore

  func permission() -> Permission {
    store.permission()
  }

  func requestPermission() -> Permission {
    .askingOnce(held: store.permission(), ask: store.requestPermission)
  }

  func reminderLists() -> Result<[ReminderList], NamedFailure> {
    let permission = store.permission()
    guard permission.allowsReading else {
      return .failure(.remindersPermissionMissing(permission: permission))
    }
    return .success(store.reminderLists())
  }

  /// The reminders in the reminder lists with these identifiers. Every identifier has to name a
  /// reminder list: one deleted since it was listed is refused, not skipped, so a short answer is
  /// never presented as the whole of what was asked.
  func reminders(inReminderListsNamed identifiers: [String], includingCompleted: Bool) -> Result<
    [Reminder], NamedFailure
  > {
    reminderLists().flatMap { known in
      var wanted: [ReminderList] = []
      for identifier in identifiers {
        guard let list = known.first(where: { $0.identifier == identifier }) else {
          return .failure(.reminderListUnknown(identifier: identifier))
        }
        wanted.append(list)
      }

      guard !wanted.isEmpty else { return .success([]) }
      return .success(store.reminders(in: wanted, includingCompleted: includingCompleted))
    }
  }
}
