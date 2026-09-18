@testable import HelperCore

/// A helper with an empty fake behind every store a scenario does not name, so a scenario sets up
/// only the store its behaviour reads, and a new store is added here and nowhere else.
func aHelper(
  calendarStore: CalendarStore = aCalendarStore(),
  reminderStore: ReminderStore = aReminderStore(),
  contactStore: ContactStore = aContactStore(),
  messageStore: MessageStore = noMessageStore,
  noteStore: NoteStore = aNoteStore()
) -> Helper {
  Helper(
    calendarStore: calendarStore, reminderStore: reminderStore, contactStore: contactStore,
    messageStore: messageStore, noteStore: noteStore)
}
