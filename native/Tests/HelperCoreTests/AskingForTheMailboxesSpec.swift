import Testing

@testable import HelperCore

@Suite("asking for the mailboxes of a mail account")
struct AskingForTheMailboxesSpec {
  let asking =
    #"{"protocolVersion":1,"id":"6","request":"mailboxes","mailAccount":"account-personal"}"#

  // morquis 8a9b013 joined a path with "/" and admits a name containing one breaks it, and
  // morquis d76f3ec found the inbox by a list of names (findings MAIL-C14, MAIL-C3).
  @Test("returns each mailbox of that account with its path, outermost name first, and the role Mail gives it or none")
  func returnsEachMailbox() {
    let store = aMailStore().holding(personalMail).holding(
      in: personalMail,
      Mailbox(path: ["Posteingang"], role: .inbox),
      Mailbox(path: ["Clients", "Invoices 2026/27"], role: nil))

    #expect(
      helperReading(store).respond(to: asking)
        == #"""
        {"id":"6","protocolVersion":1,"result":{"mailboxes":[{"path":["Posteingang"],"role":"inbox"},{"path":["Clients","Invoices 2026/27"],"role":null}]}}
        """#)
  }

  // brightline 304f384: one request covering every account is what hung Mail, so the helper has
  // no request that reads them all.
  @Test("given a request that names no mail account, refuses it as malformed rather than reading every account")
  func refusesARequestNamingNoAccount() {
    let line = #"{"protocolVersion":1,"id":"6","request":"mailboxes"}"#
    let store = aMailStore().holding(personalMail)

    #expect(
      helperReading(store).respond(to: line)
        == #"""
        {"failure":{"code":"request_malformed","evidence":"{\"protocolVersion\":1,\"id\":\"6\",\"request\":\"mailboxes\"}","sentence":"The helper could not read that line as a request."},"id":"6","protocolVersion":1}
        """#)
    #expect(store.record.timesRead == 0)
  }

  @Test("given an identifier no mail account has, says so rather than answering with no mailboxes")
  func refusesAnUnknownAccount() {
    #expect(
      helperReading(aMailStore()).respond(to: asking)
        == #"""
        {"failure":{"code":"mail_account_unknown","evidence":"account-personal","sentence":"No mail account has that identifier, so no mailbox was read."},"id":"6","protocolVersion":1}
        """#)
  }

  @Test("given the mail permission was refused, reports the permission failure and leaves Mail alone")
  func reportsThePermissionFailure() {
    let store = aMailStore().permission(.refused).holding(personalMail)

    #expect(
      helperReading(store).respond(to: asking).contains(#""code":"mail_permission_missing""#))
    #expect(store.record.timesRead == 0)
  }

  @Test("given the account does not answer within its time budget, reports that Mail timed out")
  func reportsATimeout() {
    let store = aMailStore().holding(personalMail).notAnswering(within: 8)

    #expect(helperReading(store).respond(to: asking).contains(#""code":"mail_timed_out""#))
  }
}
