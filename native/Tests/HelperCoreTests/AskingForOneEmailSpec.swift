import Foundation
import Testing

@testable import HelperCore

@Suite("asking for one email in full")
struct AskingForOneEmailSpec {
  let asking =
    #"{"protocolVersion":1,"id":"10","request":"email","mailAccount":"account-personal","mailbox":["INBOX"],"messageId":"dinner@example.test","storeIdentifier":41,"longestBody":100000}"#

  let dinner = anEmail(
    41, "Dinner", received: "2026-09-17T19:00:30Z", read: true, messageId: "dinner@example.test",
    body: "At eight.")

  // fpjnijweide 42c9e11 picked an email out again by its subject, and opened another one.
  @Test("returns the email with that Message-ID in that mailbox, in full: its correspondents, its dates, its body and its attachments")
  func returnsTheEmailInFull() {
    let store = aMailStore().holding(personalMail).holding(
      in: personalMail, mailbox: ["INBOX"],
      dinner.inFull(
        to: [Correspondent(name: "Ada Lovelace", address: "ada@example.test")],
        cc: [Correspondent(name: nil, address: "grace@example.test")],
        sent: "2026-09-17T19:00:00Z",
        attachments: [EmailAttachment(name: "menu.pdf", contentType: nil, size: 48_211)]))

    #expect(
      helperReading(store).respond(to: asking)
        == #"""
        {"id":"10","protocolVersion":1,"result":{"email":{"attachments":[{"contentType":null,"name":"menu.pdf","size":48211}],"bcc":[],"body":"At eight.","bodyCharacters":9,"cc":[{"address":"grace@example.test","name":null}],"isRead":true,"mailAccountName":"Personal","receivedAt":"2026-09-17T19:00:30Z","sender":"Sam Okafor <sam@example.test>","sentAt":"2026-09-17T19:00:00Z","storeIdentifier":41,"subject":"Dinner","to":[{"address":"ada@example.test","name":"Ada Lovelace"}]}}}
        """#)
  }

  // A store identifier is Mail's number for an email while it runs. It is where to look first,
  // and the Message-ID alone says whether what is there is the email (findings MAIL-C7).
  @Test("given a store identifier that now points at another email, returns the email with the Message-ID, never the one the identifier points at")
  func neverTrustsTheStoreIdentifier() {
    let store = aMailStore().holding(personalMail).holding(
      in: personalMail, mailbox: ["INBOX"],
      anEmail(41, "Password reset", received: "2026-09-18T09:00:00Z", messageId: "reset@example.test"),
      anEmail(77, "Dinner", received: "2026-09-17T19:00:30Z", messageId: "dinner@example.test"))

    let answer = helperReading(store).respond(to: asking)

    #expect(answer.contains(#""subject":"Dinner""#) && answer.contains(#""storeIdentifier":77"#))
  }

  @Test("given no email with that Message-ID is in that mailbox now, answers with no email rather than with another")
  func answersWithNoEmail() {
    let store = aMailStore().holding(personalMail).holding(
      in: personalMail, mailbox: ["INBOX"],
      anEmail(41, "Password reset", received: "2026-09-18T09:00:00Z", messageId: "reset@example.test"))

    #expect(
      helperReading(store).respond(to: asking)
        == #"{"id":"10","protocolVersion":1,"result":{"email":null}}"#)
  }

  // sicdigital 3c13e0d filled a missing date with the time of the call.
  @Test("given an email that does not say when it was sent, reports no sent date rather than inventing one")
  func reportsNoSentDate() {
    let store = aMailStore().holding(personalMail).holding(
      in: personalMail, mailbox: ["INBOX"], dinner)

    #expect(helperReading(store).respond(to: asking).contains(#""sentAt":null"#))
  }

  @Test("given a stale reference in a mailbox too large to look through in time, says so and that a fresh reference finds the email at once")
  func reportsAStaleReference() {
    let store = aMailStore().holding(personalMail).staleReference(inMailboxHolding: 5045)

    #expect(
      helperReading(store).respond(to: asking)
        == #"""
        {"failure":{"code":"email_reference_stale","evidence":"5045 emails","sentence":"The email was not where its reference said, and that mailbox holds 5045 emails, too many to look through for it within 8 seconds. Nothing was read. List or search again for a fresh reference, which finds the email at once."},"id":"10","protocolVersion":1}
        """#)
  }

  @Test(
    "given a request with no Message-ID, a store identifier that is not a positive number, or no limit on the body, refuses it as malformed and reads nothing",
    arguments: [
      #"{"protocolVersion":1,"id":"10","request":"email","mailAccount":"account-personal","mailbox":["INBOX"],"storeIdentifier":41,"longestBody":100000}"#,
      #"{"protocolVersion":1,"id":"10","request":"email","mailAccount":"account-personal","mailbox":["INBOX"],"messageId":"","storeIdentifier":41,"longestBody":100000}"#,
      #"{"protocolVersion":1,"id":"10","request":"email","mailAccount":"account-personal","mailbox":["INBOX"],"messageId":"x","storeIdentifier":0,"longestBody":100000}"#,
      #"{"protocolVersion":1,"id":"10","request":"email","mailAccount":"account-personal","mailbox":["INBOX"],"messageId":"x","storeIdentifier":"41","longestBody":100000}"#,
      #"{"protocolVersion":1,"id":"10","request":"email","mailAccount":"account-personal","mailbox":["INBOX"],"messageId":"x","storeIdentifier":41}"#,
    ])
  func refusesAMalformedRequest(line: String) {
    let store = aMailStore().holding(personalMail)

    #expect(helperReading(store).respond(to: line).contains(#""code":"request_malformed""#))
    #expect(store.record.timesRead == 0)
  }

  @Test("given the mail permission was refused, reports the permission failure and leaves Mail alone")
  func reportsThePermissionFailure() {
    let store = aMailStore().permission(.refused).holding(personalMail)

    #expect(helperReading(store).respond(to: asking).contains(#""code":"mail_permission_missing""#))
    #expect(store.record.timesRead == 0)
  }
}
