import Foundation

/// Reading the reminders: the rules that sit between the protocol and EventKit.
struct RemindersReading: Sendable {
  /// How long the reminder lists have to answer, together. REM-V7 in findings.md measured a
  /// library of thousands in well under this.
  static let timeBudget: TimeInterval = 2

  let store: ReminderStore
  var clock: @Sendable () -> Date = { Date() }

  func permission() -> Permission {
    store.permission()
  }

  func requestPermission() -> Permission {
    .askingOnce(held: store.permission(), ask: store.requestPermission)
  }

  func reminderLists() -> Result<[ReminderList], NamedFailure> {
    store.permission().whenItAllows(
      \.allowsReading, else: NamedFailure.remindersPermissionMissing
    ) { .success(store.reminderLists()) }
  }

  /// The reminders in the reminder lists with these identifiers. Every identifier has to name a
  /// reminder list: one deleted since it was listed is refused, not skipped, so a short answer is
  /// never presented as the whole of what was asked.
  /// With text to match, only the reminders whose title or notes mention it.
  func reminders(
    inReminderListsNamed identifiers: [String], includingCompleted: Bool, matching: String? = nil
  ) -> Result<RemindersRead, NamedFailure> {
    reminderLists().flatMap { known in
      var wanted: [ReminderList] = []
      for identifier in identifiers {
        guard let list = known.first(where: { $0.identifier == identifier }) else {
          return .failure(.reminderListUnknown(identifier: identifier))
        }
        wanted.append(list)
      }

      guard !wanted.isEmpty else {
        return .success(RemindersRead(reminders: [], unreadReminderLists: []))
      }

      let read = store.reminders(
        in: wanted, includingCompleted: includingCompleted,
        answeringBy: clock().addingTimeInterval(Self.timeBudget))

      if let gone = read.goneReminderLists.first {
        return .failure(.reminderListUnknown(identifier: gone.identifier))
      }

      // Nothing answering is a failure, never an empty answer that reads as "no reminders".
      guard read.unreadReminderLists.count < wanted.count else {
        return .failure(.remindersTimedOut(seconds: Self.timeBudget, reminderLists: wanted.count))
      }
      guard let matching else { return .success(read) }
      return .success(
        RemindersRead(
          reminders: read.reminders.filter { $0.mentions(matching) },
          unreadReminderLists: read.unreadReminderLists))
    }
  }
}
