import Testing

@testable import HelperCore

@Suite("asking for the reminders")
struct AskingForTheRemindersSpec {
  func asking(reminderLists: [String], includeCompleted: Bool = false) -> String {
    let named = reminderLists.map { #""\#($0)""# }.joined(separator: ",")
    return #"{"protocolVersion":1,"id":"4","request":"reminders","reminderLists":[\#(named)],"includeCompleted":\#(includeCompleted)}"#
  }

  // An index keeps to small fixed fields (ADR-0006), so a reminder's notes never cross the wire.
  @Test("given an open reminder, returns it as a record: its identity, its state, and its reminder list with that list's calendar account, but not its notes")
  func returnsAReminderAsARecord() {
    let helper = helperReading(
      aReminderStore().holding(groceries).holding(
        aReminder("Oat milk", in: groceries)))

    #expect(
      helper.respond(to: asking(reminderLists: ["list-groceries"]))
        == #"""
        {"id":"4","protocolVersion":1,"result":{"reminders":[{"completed":false,"due":null,"identifier":"reminder:Oat milk","reminderList":{"account":{"identifier":"account-icloud","title":"iCloud"},"identifier":"list-groceries","title":"Groceries"},"title":"Oat milk"}],"unreadReminderLists":[]}}
        """#)
  }

  // Upstream #34 and #64: a date with no time came back as midnight UTC, the evening before
  // anywhere west of Greenwich.
  @Test("given a reminder due on a date with no time of day, writes the date alone")
  func writesADueDateAlone() {
    let helper = helperReading(
      aReminderStore().holding(errands).holding(
        aReminder("Bins out", in: errands, due: .date(year: 2026, month: 9, day: 25))))

    #expect(helper.respond(to: asking(reminderLists: ["list-errands"])).contains(#""due":{"date":"2026-09-25"}"#))
  }

  @Test("given a reminder due at a time, writes the instant, for the server to show in the user's time zone")
  func writesADueTimeAsAnInstant() {
    let helper = helperReading(
      aReminderStore().holding(errands).holding(
        aReminder("Call the plumber", in: errands, due: .time(at("2026-09-25T21:00:00Z")))))

    #expect(
      helper.respond(to: asking(reminderLists: ["list-errands"]))
        .contains(#""due":{"time":"2026-09-25T21:00:00Z"}"#))
  }

  // Upstream #53: years of completed reminders are what made every read time out.
  @Test("given completed reminders are not wanted, asks the store for open ones only")
  func leavesOutCompletedReminders() {
    let helper = helperReading(
      aReminderStore().holding(groceries).holding(
        aReminder("Oat milk", in: groceries), aReminder("Bread", in: groceries, completed: true)))

    let response = helper.respond(to: asking(reminderLists: ["list-groceries"]))
    #expect(response.contains(#""title":"Oat milk""#))
    #expect(!response.contains(#""title":"Bread""#))
  }

  @Test("given completed reminders are wanted, returns them marked as completed")
  func marksCompletedReminders() {
    let helper = helperReading(
      aReminderStore().holding(groceries).holding(
        aReminder("Bread", in: groceries, completed: true)))

    #expect(
      helper.respond(to: asking(reminderLists: ["list-groceries"], includeCompleted: true))
        .contains(#""completed":true"#))
  }

  @Test("given one reminder list, reads that one and no other")
  func readsOnlyTheListsNamed() {
    let store = aReminderStore().holding(groceries, errands)

    _ = helperReading(store).respond(to: asking(reminderLists: ["list-errands"]))

    #expect(store.record.reminderListsRead == [[errands]])
  }

  // EventKit reads "no calendars" as "every calendar", so asking for none must never reach it.
  @Test("given no reminder lists, answers with no reminders and never asks the store for every one")
  func readsNothingForNoLists() {
    let store = aReminderStore().holding(groceries).holding(aReminder("Oat milk", in: groceries))

    #expect(
      helperReading(store).respond(to: asking(reminderLists: []))
        == #"{"id":"4","protocolVersion":1,"result":{"reminders":[],"unreadReminderLists":[]}}"#)
    #expect(store.record.reminderListsRead.isEmpty)
  }

  // A reminder list can be deleted between being listed and being read; reading the rest would
  // present a short answer as the whole of what was asked.
  @Test("given an identifier no reminder list has, refuses and names it rather than reading the others")
  func refusesAnUnknownList() {
    let store = aReminderStore().holding(groceries)

    let response = helperReading(store).respond(
      to: asking(reminderLists: ["list-groceries", "list-gone"]))

    #expect(response.contains(#""code":"reminder_list_unknown""#))
    #expect(response.contains(#""evidence":"list-gone""#))
    #expect(store.record.reminderListsRead.isEmpty)
  }

  @Test("given the reminders permission was refused, reports the permission failure")
  func reportsThePermissionFailure() {
    let response = helperReading(aReminderStore().permission(.refused).holding(groceries))
      .respond(to: asking(reminderLists: ["list-groceries"]))

    #expect(response.contains(#""code":"reminders_permission_missing""#))
  }

  @Test("given reminder lists that are not identifiers, refuses the request as malformed")
  func refusesListsThatAreNotIdentifiers() {
    let response = helperReading(aReminderStore()).respond(
      to: #"{"protocolVersion":1,"id":"4","request":"reminders","reminderLists":"list-groceries","includeCompleted":false}"#)

    #expect(response.contains(#""code":"request_malformed""#))
  }

  @Test("given no word on completed reminders, refuses the request rather than choosing for the server")
  func refusesARequestSilentOnCompletedReminders() {
    let response = helperReading(aReminderStore()).respond(
      to: #"{"protocolVersion":1,"id":"4","request":"reminders","reminderLists":[]}"#)

    #expect(response.contains(#""code":"request_malformed""#))
  }
}
