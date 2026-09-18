import Foundation
import Testing

@testable import HelperCore

@Suite("asking for a mailbox's emails")
struct AskingForAMailboxsEmailsSpec {
  let latest =
    #"{"protocolVersion":1,"id":"7","request":"latest_emails","mailAccount":"account-personal","mailbox":["INBOX"],"newest":2}"#
  let inRange =
    #"{"protocolVersion":1,"id":"8","request":"emails_in_range","mailAccount":"account-personal","mailbox":["INBOX"],"range":{"start":"2026-09-01T00:00:00Z","end":"2026-09-18T00:00:00Z"},"ceiling":2}"#

  // brightline 0833904 took the first emails in mailbox order for the latest.
  @Test("returns a mailbox's newest emails, newest first, each with the store's identifier, its subject, its sender, when it was received and whether it was read, and no body")
  func returnsTheNewestEmails() {
    let store = aMailStore().holding(personalMail).holding(
      in: personalMail, mailbox: ["INBOX"],
      anEmail(1, "Older", received: "2026-09-16T09:00:00Z"),
      anEmail(2, "Newest", received: "2026-09-18T09:00:00Z", read: true),
      anEmail(3, "Newer", received: "2026-09-17T09:00:00Z"))

    #expect(
      helperReading(store).respond(to: latest)
        == #"""
        {"id":"7","protocolVersion":1,"result":{"emails":[{"isRead":true,"receivedAt":"2026-09-18T09:00:00Z","sender":"Sam Okafor <sam@example.test>","storeIdentifier":2,"subject":"Newest"},{"isRead":false,"receivedAt":"2026-09-17T09:00:00Z","sender":"Sam Okafor <sam@example.test>","storeIdentifier":3,"subject":"Newer"}],"truncated":true,"undated":0}}
        """#)
  }

  @Test("given a range and a ceiling, returns the emails received in the range, newest first, and says when the ceiling stopped it short")
  func returnsTheEmailsInARange() {
    let store = aMailStore().holding(personalMail).holding(
      in: personalMail, mailbox: ["INBOX"],
      anEmail(1, "Before", received: "2026-08-31T23:59:59Z"),
      anEmail(2, "First", received: "2026-09-01T00:00:00Z"),
      anEmail(3, "Second", received: "2026-09-10T09:00:00Z"),
      anEmail(4, "Third", received: "2026-09-17T09:00:00Z"),
      anEmail(5, "After", received: "2026-09-18T00:00:00Z"))

    let answer = helperReading(store).respond(to: inRange)

    #expect(answer.contains(#""subject":"Third""#) && answer.contains(#""subject":"Second""#))
    #expect(!answer.contains("First") && !answer.contains("Before") && !answer.contains("After"))
    #expect(answer.contains(#""truncated":true"#))
  }

  // findings MAIL-49: an email with no date was given one that was made up. An email with none
  // cannot be placed in a range or among the latest, so it is counted rather than dropped.
  @Test("given emails Mail gives no received date, says how many there are rather than leaving them out unmentioned")
  func countsUndatedEmails() {
    let store = aMailStore().holding(personalMail)
      .holding(in: personalMail, mailbox: ["INBOX"])
      .holdingUndated(3, inMailbox: ["INBOX"])

    #expect(
      helperReading(store).respond(to: latest)
        == #"{"id":"7","protocolVersion":1,"result":{"emails":[],"truncated":false,"undated":3}}"#)
  }

  @Test(
    "given a request that names no mailbox, or asks for none or for more emails than one answer carries, refuses it as malformed and reads nothing",
    arguments: [
      #"{"protocolVersion":1,"id":"7","request":"latest_emails","mailAccount":"account-personal","newest":2}"#,
      #"{"protocolVersion":1,"id":"7","request":"latest_emails","mailAccount":"account-personal","mailbox":[],"newest":2}"#,
      #"{"protocolVersion":1,"id":"7","request":"latest_emails","mailAccount":"account-personal","mailbox":["INBOX"],"newest":0}"#,
      #"{"protocolVersion":1,"id":"7","request":"latest_emails","mailAccount":"account-personal","mailbox":["INBOX"],"newest":101}"#,
      #"{"protocolVersion":1,"id":"8","request":"emails_in_range","mailAccount":"account-personal","mailbox":["INBOX"],"ceiling":2}"#,
      #"{"protocolVersion":1,"id":"8","request":"emails_in_range","mailAccount":"account-personal","mailbox":["INBOX"],"range":{"start":"2026-09-01T00:00:00Z","end":"2026-09-18T00:00:00Z"},"ceiling":5001}"#,
    ])
  func refusesAMalformedRequest(line: String) {
    let store = aMailStore().holding(personalMail)

    #expect(helperReading(store).respond(to: line).contains(#""code":"request_malformed""#))
    #expect(store.record.timesRead == 0)
  }

  // A mailbox renamed or removed since it was listed is not an empty mailbox.
  @Test("given a path no mailbox of that mail account has, says so rather than answering with no emails")
  func refusesAnUnknownMailbox() {
    #expect(
      helperReading(aMailStore().holding(personalMail)).respond(to: latest)
        == #"""
        {"failure":{"code":"mailbox_unknown","evidence":"INBOX","sentence":"That mail account has no mailbox with that path, so no email was read."},"id":"7","protocolVersion":1}
        """#)
  }

  // A column of a mailbox is read whole and cannot be stopped once asked for, so a mailbox too
  // large to finish in time is refused while Mail is still answering (#7, #45).
  @Test("given a mailbox too large to read within the time budget, says so and how many emails it holds, rather than being given up on halfway")
  func refusesAMailboxTooLargeToRead() {
    let store = aMailStore().holding(personalMail).tooLarge(mailbox: ["INBOX"], holding: 76_188)

    #expect(
      helperReading(store).respond(to: latest)
        == #"""
        {"failure":{"code":"mailbox_too_large","evidence":"76188 emails","sentence":"That mailbox holds 76188 emails, too many to read within 8 seconds, so none was read and Mail was left alone. A shorter range would not help: a mailbox is read whole whatever the range. Search it in Mail itself."},"id":"7","protocolVersion":1}
        """#)
  }

  @Test("given the mail permission was refused, reports the permission failure and leaves Mail alone")
  func reportsThePermissionFailure() {
    let store = aMailStore().permission(.refused).holding(personalMail)

    #expect(helperReading(store).respond(to: latest).contains(#""code":"mail_permission_missing""#))
    #expect(store.record.timesRead == 0)
  }
}

@Suite("asking for more of some emails")
struct AskingForMoreOfSomeEmailsSpec {
  // A Message-ID costs ten times what any other column does, so it is asked for apart, and only
  // for the few emails that make an answer.
  @Test("returns the Message-ID of each email asked about, and leaves out one that has gone since it was listed")
  func returnsMessageIds() {
    let store = aMailStore().holding(personalMail).holding(
      in: personalMail, mailbox: ["INBOX"],
      anEmail(1, "Dinner", received: "2026-09-17T09:00:00Z", messageId: "dinner@example.test"))
    let line =
      #"{"protocolVersion":1,"id":"9","request":"email_message_ids","mailAccount":"account-personal","mailbox":["INBOX"],"emails":[1,404]}"#

    #expect(
      helperReading(store).respond(to: line)
        == #"{"id":"9","protocolVersion":1,"result":{"messageIds":{"1":"dinner@example.test"}}}"#)
  }

  // A body is read only when the server asks for it, which it does only when a caller asked for
  // bodies to be searched (#24). One the store did not reach in time is absent, not empty.
  @Test("returns the body of each email asked about that could be read in time, and leaves the others out")
  func returnsBodies() {
    let store = aMailStore().holding(personalMail).holding(
      in: personalMail, mailbox: ["INBOX"],
      anEmail(1, "Dinner", received: "2026-09-17T09:00:00Z", body: "At eight."),
      anEmail(2, "Lunch", received: "2026-09-16T09:00:00Z", body: "At one.")
    ).readingBodiesInTime(1)
    let line =
      #"{"protocolVersion":1,"id":"9","request":"email_bodies","mailAccount":"account-personal","mailbox":["INBOX"],"emails":[1,2]}"#

    #expect(
      helperReading(store).respond(to: line)
        == #"{"id":"9","protocolVersion":1,"result":{"bodies":{"1":"At eight."}}}"#)
  }

  @Test(
    "given a request that names no emails, or more than one answer carries, refuses it as malformed",
    arguments: [
      #"{"protocolVersion":1,"id":"9","request":"email_message_ids","mailAccount":"account-personal","mailbox":["INBOX"]}"#,
      #"{"protocolVersion":1,"id":"9","request":"email_message_ids","mailAccount":"account-personal","mailbox":["INBOX"],"emails":["1"]}"#,
      #"{"protocolVersion":1,"id":"9","request":"email_bodies","mailAccount":"account-personal","mailbox":["INBOX"],"emails":[]}"#,
    ])
  func refusesAMalformedRequest(line: String) {
    #expect(
      helperReading(aMailStore().holding(personalMail)).respond(to: line)
        .contains(#""code":"request_malformed""#))
  }
}
