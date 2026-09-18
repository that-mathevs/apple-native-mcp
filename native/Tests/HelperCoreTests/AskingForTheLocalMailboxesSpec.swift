import Testing

@testable import HelperCore

@Suite("asking for the local mailboxes")
struct AskingForTheLocalMailboxesSpec {
  let asking = #"{"protocolVersion":1,"id":"17","request":"local_mailboxes"}"#

  // felkru c769cc0 filed these under an account called "On My Mac", which is no account, and
  // whose name is whatever language the Mac speaks.
  @Test("returns the mailboxes Mail keeps under no mail account, each by its path and with the role Mail gives it or none")
  func returnsTheLocalMailboxes() {
    let store = aMailStore().holdingLocally(
      Mailbox(path: ["Tax returns"], role: nil), Mailbox(path: ["Tax returns", "2025"], role: nil))

    #expect(
      helperReading(store).respond(to: asking)
        == #"""
        {"id":"17","protocolVersion":1,"result":{"localMailboxes":[{"path":["Tax returns"],"role":null},{"path":["Tax returns","2025"],"role":null}]}}
        """#)
  }

  @Test("given the mail permission was refused, reports the permission failure and leaves Mail alone")
  func reportsThePermissionFailure() {
    let store = aMailStore().permission(.refused)

    #expect(helperReading(store).respond(to: asking).contains(#""code":"mail_permission_missing""#))
    #expect(store.record.timesRead == 0)
  }

  @Test("given Mail does not answer within its time budget, reports that it timed out rather than that there are none")
  func reportsATimeout() {
    #expect(
      helperReading(aMailStore().notAnswering(within: 8)).respond(to: asking)
        .contains(#""code":"mail_timed_out""#))
  }
}
