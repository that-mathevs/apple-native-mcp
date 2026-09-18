import Foundation
import Testing

@testable import HelperCore

@Suite("asking for the default reminder list")
struct AskingForTheDefaultReminderListSpec {
  let asking = #"{"protocolVersion":1,"id":"6","request":"default_reminder_list"}"#

  // mjmcg bde3e31: the user already chose a default list in Reminders' own settings.
  @Test("given the user set a default reminder list, names it")
  func namesTheDefault() {
    let helper = helperReading(aReminderStore().holding(groceries, errands).defaultingTo(errands))

    #expect(helper.respond(to: asking).contains(#""reminderList":{"account""#))
    #expect(helper.respond(to: asking).contains(#""identifier":"list-errands""#))
  }

  @Test("given no default reminder list, answers with none rather than picking the first")
  func answersNoneRatherThanPicking() {
    let helper = helperReading(aReminderStore().holding(groceries, errands))

    #expect(helper.respond(to: asking).contains(#""reminderList":null"#))
  }
}

@Suite("creating a reminder")
struct CreatingAReminderSpec {
  func creating(_ fields: String) -> String {
    #"{"protocolVersion":1,"id":"7","request":"create_reminder",\#(fields)}"#
  }

  let stamps = #""reminderListIdentifier":"list-errands","title":"Buy stamps""#

  @Test("given a reminder list and a title, saves it there and answers with it as the store now holds it")
  func savesAndAnswersWithWhatIsHeld() {
    let store = aReminderStore().holding(groceries, errands)

    let response = helperReading(store).respond(to: creating(stamps))

    #expect(response.contains(#""confirmed":true"#))
    #expect(response.contains(#""title":"Buy stamps""#))
    #expect(response.contains(#""identifier":"list-errands""#))
    #expect(store.record.saved.map(\.title) == ["Buy stamps"])
  }

  // Upstream #34 and #64: a due date became a midnight in UTC, the evening before here.
  @Test("given a due date, saves the day alone with no time of day")
  func savesADueDateAlone() {
    let store = aReminderStore().holding(errands)

    _ = helperReading(store).respond(to: creating(stamps + #","due":{"date":"2026-09-25"}"#))

    #expect(store.record.saved.map(\.due) == [.date(year: 2026, month: 9, day: 25)])
  }

  @Test("given a due time, saves that instant")
  func savesADueTime() {
    let store = aReminderStore().holding(errands)

    _ = helperReading(store).respond(
      to: creating(stamps + #","due":{"time":"2026-09-25T21:00:00.000Z"}"#))

    #expect(store.record.saved.map(\.due) == [.time(at("2026-09-25T21:00:00Z"))])
  }

  // #20: a due time says when a reminder is due, not that the user wants to be interrupted.
  @Test("answers with how many alerts the store holds on it, so an alert nobody asked for would show")
  func reportsTheAlertsHeld() {
    let response = helperReading(aReminderStore().holding(errands)).respond(to: creating(stamps))

    #expect(response.contains(#""alerts":0"#))
  }

  @Test("given a reminder list the store does not have, refuses and saves nothing")
  func refusesAnUnknownList() {
    let store = aReminderStore().holding(groceries)

    let response = helperReading(store).respond(to: creating(stamps))

    #expect(response.contains(#""code":"reminder_list_unknown""#))
    #expect(store.record.saved.isEmpty)
  }

  // therealap 1a09e54 reported success before looking. Unconfirmed is not a failure to retry.
  @Test("given the store saved it and then could not find it, answers unconfirmed with what it saved")
  func answersUnconfirmedWhenNotFoundAfterwards() {
    let response = helperReading(aReminderStore().holding(errands).losingSightOfWhatItSaves())
      .respond(to: creating(stamps))

    #expect(response.contains(#""confirmed":false"#))
    #expect(response.contains(#""title":"Buy stamps""#))
  }

  @Test("given the store refused to save it, reports what the store said")
  func reportsARefusedSave() {
    let response = helperReading(
      aReminderStore().holding(errands).refusingToSave(saying: "The calendar is read-only.")
    ).respond(to: creating(stamps))

    #expect(response.contains(#""code":"reminder_not_saved""#))
    #expect(response.contains("The calendar is read-only."))
  }

  @Test("given the reminders permission was refused, reports the permission failure and saves nothing")
  func refusesWithoutPermission() {
    let store = aReminderStore().permission(.refused).holding(errands)

    let response = helperReading(store).respond(to: creating(stamps))

    #expect(response.contains(#""code":"reminders_permission_missing""#))
    #expect(store.record.saved.isEmpty)
  }

  @Test(
    "given a request the helper cannot read as a reminder, refuses it as malformed and saves nothing",
    arguments: [
      #""reminderListIdentifier":"list-errands""#,  // no title
      #""reminderListIdentifier":"list-errands","title":"  ""#,  // a blank title
      #""title":"Buy stamps""#,  // no reminder list
      stampsWith(#""due":{"date":"2026-09-25","time":"2026-09-25T21:00:00Z"}"#),  // both
      stampsWith(#""due":{"date":"next friday"}"#),
      stampsWith(#""due":{"date":"2026-02-30"}"#),
      stampsWith(#""due":{"time":"five o'clock"}"#),
    ])
  func refusesWhatItCannotRead(fields: String) {
    let store = aReminderStore().holding(errands)

    let response = helperReading(store).respond(to: creating(fields))

    #expect(response.contains(#""code":"request_malformed""#))
    #expect(store.record.saved.isEmpty)
  }
}

private func stampsWith(_ due: String) -> String {
  #""reminderListIdentifier":"list-errands","title":"Buy stamps","# + due
}
