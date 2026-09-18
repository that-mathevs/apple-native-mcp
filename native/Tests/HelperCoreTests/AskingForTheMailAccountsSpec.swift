import Testing

@testable import HelperCore

@Suite("asking for the mail accounts")
struct AskingForTheMailAccountsSpec {
  let asking = #"{"protocolVersion":1,"id":"5","request":"mail_accounts"}"#

  // chrischall 0860cf8: an account known only by its name could not say which address it sends
  // from, and two accounts may share a name, so the identifier is what addresses one.
  @Test("returns every mail account with its identifier, its name and its email addresses")
  func returnsEveryMailAccount() {
    let helper = helperReading(aMailStore().holding(personalMail))

    #expect(
      helper.respond(to: asking)
        == #"""
        {"id":"5","protocolVersion":1,"result":{"mailAccounts":[{"emailAddresses":["ada@example.test","ada.lovelace@example.test"],"identifier":"account-personal","name":"Personal"}]}}
        """#)
  }

  // Upstream #69 and felkru c769cc0: a refused Mail read as a Mac with no mail accounts.
  @Test("given the mail permission was refused, reports the permission failure naming the setting, not an empty set of mail accounts")
  func reportsThePermissionFailure() {
    #expect(
      helperReading(aMailStore().permission(.refused).holding(personalMail)).respond(to: asking)
        == #"""
        {"failure":{"code":"mail_permission_missing","evidence":"refused","sentence":"apple-native-mcp cannot read Mail until it is allowed to, in System Settings > Privacy & Security > Automation > apple-native-mcp > Mail."},"id":"5","protocolVersion":1}
        """#)
  }

  // Reading Mail while nobody has been asked is what would make macOS ask, in the middle of an
  // agent's call. A tool never asks (#33), so the store is not touched at all.
  @Test("given nobody has been asked for the mail permission yet, says to run setup and leaves Mail alone")
  func pointsAtSetupWhileUndecided() {
    let store = aMailStore().permission(.undecided).holding(personalMail)

    #expect(
      helperReading(store).respond(to: asking)
        == #"""
        {"failure":{"code":"mail_permission_missing","evidence":"undecided","sentence":"apple-native-mcp has not been asked for Mail yet. Run `npx apple-native-mcp setup` to be asked."},"id":"5","protocolVersion":1}
        """#)
    #expect(store.record.timesRead == 0)
  }

  // felkru c769cc0 and nivra 0b616cd reported a Mail that did not answer as a missing permission,
  // which sent the user to a setting that was already on (#7: Mail can stay busy for minutes).
  @Test("given Mail does not answer within its time budget, reports that it timed out rather than blaming a permission")
  func reportsATimeout() {
    #expect(
      helperReading(aMailStore().holding(personalMail).notAnswering(within: 8)).respond(to: asking)
        == #"""
        {"failure":{"code":"mail_timed_out","evidence":"8 seconds","sentence":"Mail did not answer within 8 seconds, so nothing was read. Mail can stay busy for minutes: ask again later."},"id":"5","protocolVersion":1}
        """#)
  }

  // Upstream passed Mail's own words through as the whole answer, or hid them (findings X-C7).
  @Test("given Mail fails, reports that Mail could not be read and carries what it said, verbatim")
  func carriesWhatMailSaid() {
    let said = "-10000: Mail got an error: AppleEvent handler failed."

    #expect(
      helperReading(aMailStore().failing(saying: said)).respond(to: asking)
        == #"""
        {"failure":{"code":"mail_unreadable","evidence":"-10000: Mail got an error: AppleEvent handler failed.","sentence":"Mail could not be read, so nothing was listed or ruled out."},"id":"5","protocolVersion":1}
        """#)
  }

  // macOS can only say whether Mail may be controlled while Mail is running, so a Mail that will
  // not start leaves the permission unknown. That is not a refusal, and not an empty Mail.
  @Test("given Mail will not start, says so rather than blaming a permission, and reads nothing")
  func reportsAMailThatWillNotStart() {
    let store = aMailStore().holding(personalMail).notStarting(
      saying: "Mail did not start within 8 seconds. (-600)")

    #expect(
      helperReading(store).respond(to: asking)
        == #"""
        {"failure":{"code":"mail_did_not_start","evidence":"Mail did not start within 8 seconds. (-600)","sentence":"Mail did not start, so nothing was read. Open Mail, then ask again."},"id":"5","protocolVersion":1}
        """#)
    #expect(store.record.timesRead == 0)
  }
}
