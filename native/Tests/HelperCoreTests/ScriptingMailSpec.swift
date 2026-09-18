import Foundation
import Testing

@testable import HelperCore

// What Mail's scripts answer with is read here, against a runner that runs nothing, so what a
// path or a role is read from is specified without Mail, a permission or a single real mailbox.
@Suite("scripting Mail")
struct ScriptingMailSpec {
  let personal = "0F1E2D3C-0000-4000-8000-00000000A001"

  @Test("reads the mail accounts the script answers with, each with its identifier, name and email addresses")
  func readsTheMailAccounts() throws {
    let runner = FakeScriptRunner().answering(
      "mail_accounts",
      with: #"{"mailAccounts":[{"identifier":"A1","name":"Personal","emailAddresses":["ada@example.test"]}]}"#)

    #expect(
      try ScriptedMailStore(runner: runner).mailAccounts() == [
        MailAccount(identifier: "A1", name: "Personal", emailAddresses: ["ada@example.test"])
      ])
  }

  // brightline 304f384: one script covering every account is what hung Mail.
  @Test("asks about the one mail account it was asked about, handing its identifier over as an argument")
  func asksAboutOneMailAccount() throws {
    let runner = FakeScriptRunner().answering("mailboxes", with: #"{"mailboxes":[],"roles":{}}"#)

    _ = try ScriptedMailStore(runner: runner).mailboxes(inMailAccount: personal)

    #expect(runner.runs.map(\.script) == ["mailboxes"])
    #expect(runner.runs.first?.arguments as? [String: String] == ["mailAccount": personal])
  }

  // morquis d76f3ec found the inbox in a list of names. Mail's role mailboxes say which mailbox
  // of an account has each job, by the full name Mail addresses it by.
  @Test("gives a mailbox the role Mail's role mailboxes name it under, whatever it is called, and no role to any other")
  func readsARoleFromMailsRoleMailboxes() throws {
    let runner = FakeScriptRunner().answering(
      "mailboxes",
      with: #"""
        {"mailboxes":[
          {"fullName":"Posteingang","name":"Posteingang","containers":[]},
          {"fullName":"[Provider]/Sent Mail","name":"Sent Mail","containers":[]},
          {"fullName":"Inbox","name":"Inbox","containers":[]}],
         "roles":{"inbox":["Posteingang"],"drafts":[],"sent":["[Provider]/Sent Mail"],"junk":[],"trash":[]}}
        """#)

    #expect(
      try ScriptedMailStore(runner: runner).mailboxes(inMailAccount: personal) == [
        Mailbox(path: ["Posteingang"], role: .inbox),
        Mailbox(path: ["[Provider]", "Sent Mail"], role: .sent),
        Mailbox(path: ["Inbox"], role: nil),
      ])
  }

  @Test("given the script says no mail account has that identifier, says the mail account is unknown")
  func reportsAnUnknownMailAccount() {
    let runner = FakeScriptRunner().answering("mailboxes", with: #"{"mailAccountUnknown":true}"#)

    #expect(throws: MailUnreadable.mailAccountUnknown(identifier: personal)) {
      try ScriptedMailStore(runner: runner).mailboxes(inMailAccount: personal)
    }
  }

  // #7: Mail failed a wide read after 120 s and stayed busy for minutes more.
  @Test("given the script outlived its time budget, says Mail timed out and after how long")
  func reportsATimeout() {
    let runner = FakeScriptRunner().failing("mail_accounts", with: .timedOut(after: 8))

    #expect(throws: MailUnreadable.timedOut(seconds: 8)) {
      try ScriptedMailStore(runner: runner).mailAccounts()
    }
  }

  @Test("given the script failed any other way, carries the number and the words it failed with, verbatim")
  func carriesAFailureVerbatim() {
    let failure = ScriptFailed(number: -10000, message: "Mail got an error: AppleEvent handler failed.")
    let runner = FakeScriptRunner().failing("mail_accounts", with: failure)

    #expect(throws: MailUnreadable.failed(evidence: failure.evidence)) {
      try ScriptedMailStore(runner: runner).mailAccounts()
    }
  }

  // danielk-am 9d9122c invented an untitled item out of an answer it could not read.
  @Test("given an answer with a field missing, refuses the whole answer rather than inventing a mailbox")
  func refusesAnAnswerItCannotRead() {
    let runner = FakeScriptRunner().answering(
      "mailboxes", with: #"{"mailboxes":[{"name":"INBOX","containers":[]}],"roles":{}}"#)

    #expect(throws: MailUnreadable.self) {
      try ScriptedMailStore(runner: runner).mailboxes(inMailAccount: personal)
    }
  }

  // macOS answers "not running" for an app that is not there to be asked about, which is no
  // refusal: calling it one would send the user to a setting that is already on.
  @Test("given Mail will not start, says so, told by the failure's number rather than its words")
  func reportsAMailThatWillNotStart() {
    let runner = FakeScriptRunner()
    runner.failsToStart = .didNotStart(mailApp, within: 8)

    #expect(throws: MailUnreadable.didNotStart(evidence: "Mail did not start within 8 seconds. (-600)")) {
      try ScriptedMailStore(runner: runner).permission()
    }
  }

  @Test("reports whether the helper may control Mail without asking, and asks only when setup does")
  func asksOnlyWhenTold() {
    let runner = FakeScriptRunner()
    let store = ScriptedMailStore(runner: runner)

    _ = try? store.permission()
    _ = try? store.requestPermission()

    #expect(runner.asked.map(\.app) == [mailApp, mailApp])
    #expect(runner.asked.map(\.asking) == [false, true])
  }

  // Setup names this setting after the helper has been removed, from the server's own copy,
  // which a release spec holds equal to the literal here.
  @Test("names the setting for controlling Mail exactly as the scripted app does")
  func namesTheSettingOnce() {
    #expect(mailPermissionSetting == mailApp.permissionSetting)
  }

  @Test("gives each script the whole of the time budget a request has")
  func givesAScriptTheTimeBudget() throws {
    let runner = FakeScriptRunner().answering("mail_accounts", with: #"{"mailAccounts":[]}"#)

    _ = try ScriptedMailStore(runner: runner).mailAccounts()

    #expect(runner.budgets == [scriptTimeBudget])
  }
}
