import Foundation
import Testing

@testable import HelperCore

// EventKit has no text predicate for reminders, so the helper matches after the fetch, and a
// reminder's notes are searched here without ever being sent (REM-C5).
@Suite("searching the reminders")
struct SearchingTheRemindersSpec {
  func searching(for text: String) -> String {
    #"{"protocolVersion":1,"id":"5","request":"reminders","reminderLists":["list-errands"],"#
      + #""includeCompleted":true,"matching":\#(quoted(text))}"#
  }

  func quoted(_ text: String) -> String {
    String(decoding: try! JSONEncoder().encode(text), as: UTF8.self)
  }

  // gene-jelly c5a0edd read titles only, so a reminder whose detail was in its notes was not found.
  @Test("given text found only in a reminder's notes, finds it, and sends the notes nowhere")
  func findsTextInNotes() {
    let helper = helperReading(
      aReminderStore().holding(errands).holding(
        aReminder("Call Sam", in: errands, notes: "ask about the plumber"),
        aReminder("Milk", in: errands)))

    let response = helper.respond(to: searching(for: "plumber"))

    #expect(response.contains(#""title":"Call Sam""#))
    #expect(!response.contains(#""title":"Milk""#))
    #expect(!response.contains("ask about"))
  }

  @Test("given text that differs from a title only in letter case, finds it")
  func ignoresCase() {
    let helper = helperReading(
      aReminderStore().holding(errands).holding(aReminder("Oat Milk", in: errands)))

    #expect(helper.respond(to: searching(for: "oat milk")).contains(#""title":"Oat Milk""#))
  }

  // boutquin 2894ab6: search text was spliced into AppleScript, so a quote ended the string.
  @Test("given text that closes a string and runs a command, compares it as text and nothing else")
  func comparesHostileTextLiterally() {
    let hostile = #""); do shell script "open -a Calculator"#
    let helper = helperReading(
      aReminderStore().holding(errands).holding(
        aReminder("Note \(hostile)", in: errands), aReminder("Calculator batteries", in: errands)))

    let response = helper.respond(to: searching(for: hostile))

    #expect(response.contains("Note"))
    #expect(!response.contains("Calculator batteries"))
  }

  // felkru 12ad33f: a percent sign in a SQL LIKE pattern matched anything at all.
  @Test("given a percent sign, matches only a percent sign")
  func matchesAPercentSignLiterally() {
    let helper = helperReading(
      aReminderStore().holding(errands).holding(
        aReminder("50% off voucher", in: errands), aReminder("500 grams flour", in: errands)))

    let response = helper.respond(to: searching(for: "50%"))

    #expect(response.contains("voucher"))
    #expect(!response.contains("flour"))
  }

  @Test("given text to match that is blank, refuses the request rather than matching every reminder")
  func refusesBlankText() {
    let helper = helperReading(aReminderStore().holding(errands))

    #expect(helper.respond(to: searching(for: "")).contains(#""code":"request_malformed""#))
    #expect(helper.respond(to: searching(for: "  ")).contains(#""code":"request_malformed""#))
  }

  // The server's fake store folds case the same way, so a scenario it passes holds here too.
  @Test(
    "folds case as the server's fake store does",
    arguments: [
      ("ΟΔΟΣ", "οδος", true),  // Greek's final sigma
      ("Straße", "STRASSE", true),
      ("cafe\u{301}", "cafe", true),  // an accent written as its own mark
      ("caf\u{e9}", "cafe\u{301}", false),  // one accent written two ways
    ])
  func foldsCaseAsTheFakeDoes(title: String, text: String, found: Bool) {
    #expect(aReminder(title, in: errands).mentions(text) == found)
  }

  @Test("given text to match that is not text, refuses the request as malformed")
  func refusesTextThatIsNotText() {
    let response = helperReading(aReminderStore().holding(errands)).respond(
      to: #"{"protocolVersion":1,"id":"5","request":"reminders","reminderLists":[],"#
        + #""includeCompleted":true,"matching":7}"#)

    #expect(response.contains(#""code":"request_malformed""#))
  }
}
