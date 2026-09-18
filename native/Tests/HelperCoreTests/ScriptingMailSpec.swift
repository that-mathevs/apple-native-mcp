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
  @Test("asks Mail about the one mail account it was asked about, whose identifier travels as data beside the script")
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

@Suite("scripting a mailbox's emails")
struct ScriptingAMailboxsEmailsSpec {
  let invoices = MailboxAddress(mailAccount: "A1", path: ["Clients", "Invoices 2026/27"])

  // Mail addresses a mailbox by its path joined with a slash, and #44 made a path join back to
  // exactly that, so nothing about a mailbox has to be looked up again to read it.
  @Test("asks about one mailbox by the full name Mail addresses it by, with the range as instants, how many emails are wanted and how long the script has")
  func asksAboutOneMailbox() throws {
    let runner = FakeScriptRunner().answering("emails", with: #"{"emails":[],"truncated":false,"undated":0}"#)
    let range = HelperCore.Range(from: at("2026-09-01T00:00:00Z"), to: at("2026-09-18T00:00:00Z"))

    _ = try ScriptedMailStore(runner: runner).emails(in: invoices, receivedIn: range, most: 50)

    let asked = try #require(runner.runs.first?.arguments)
    #expect(runner.runs.map(\.script) == ["emails"])
    #expect(asked["mailAccount"] as? String == "A1")
    #expect(asked["mailbox"] as? String == "Clients/Invoices 2026/27")
    #expect(asked["from"] as? Double == 1_788_220_800_000)
    #expect(asked["to"] as? Double == 1_789_689_600_000)
    #expect(asked["most"] as? Int == 50)
    #expect(asked["withinMilliseconds"] as? Int == 8000)
  }

  @Test("given no range, asks for the mailbox's newest emails whenever they were received")
  func asksForTheNewestWithNoRange() throws {
    let runner = FakeScriptRunner().answering("emails", with: #"{"emails":[],"truncated":false,"undated":0}"#)

    _ = try ScriptedMailStore(runner: runner).emails(in: invoices, receivedIn: nil, most: 20)

    let asked = try #require(runner.runs.first?.arguments)
    #expect(asked["from"] is NSNull && asked["to"] is NSNull)
  }

  @Test("reads each email the script answers with, and whether there were more than were asked for")
  func readsTheEmails() throws {
    let runner = FakeScriptRunner().answering(
      "emails",
      with: #"""
        {"emails":[{"storeIdentifier":41,"receivedAt":1789722000000,"subject":"Dinner","sender":"Grace Hopper <grace@example.test>","isRead":true}],"truncated":true,"undated":2}
        """#)

    #expect(
      try ScriptedMailStore(runner: runner).emails(in: invoices, receivedIn: nil, most: 1)
        == EmailsRead(
          emails: [
            Email(
              storeIdentifier: 41, subject: "Dinner", sender: "Grace Hopper <grace@example.test>",
              receivedAt: at("2026-09-18T09:00:00Z"), isRead: true)
          ], truncated: true, undated: 2))
  }

  // The script reads one column, sees what the rest would cost, and stops there: a mailbox of
  // 76,188 emails cannot be read by scripting within any time budget (#7).
  @Test("given the script says the mailbox is too large to read in time, says so with how many emails it holds")
  func reportsAMailboxTooLarge() {
    let runner = FakeScriptRunner().answering(
      "emails", with: #"{"mailboxTooLarge":{"emails":76188}}"#)

    #expect(throws: MailUnreadable.mailboxTooLarge(emails: 76188, seconds: 8)) {
      try ScriptedMailStore(runner: runner).emails(in: invoices, receivedIn: nil, most: 20)
    }
  }

  @Test("given the script says the mail account has no such mailbox, says the mailbox is unknown")
  func reportsAnUnknownMailbox() {
    let runner = FakeScriptRunner().answering("emails", with: #"{"mailboxUnknown":true}"#)

    #expect(throws: MailUnreadable.mailboxUnknown(path: ["Clients", "Invoices 2026/27"])) {
      try ScriptedMailStore(runner: runner).emails(in: invoices, receivedIn: nil, most: 20)
    }
  }

  @Test("reads the Message-IDs the script found, by store identifier, and no others")
  func readsMessageIds() throws {
    let runner = FakeScriptRunner().answering(
      "email_message_ids", with: #"{"messageIds":{"41":"dinner@example.test"}}"#)

    #expect(
      try ScriptedMailStore(runner: runner).messageIds(ofEmails: [41, 404], in: invoices)
        == [41: "dinner@example.test"])
    #expect(runner.runs.first?.arguments["emails"] as? [Int] == [41, 404])
  }

  // A body read cannot be stopped once asked for, so the script is told to stop itself short of
  // the time budget, with room for the read it is in the middle of.
  @Test("asks for bodies with less time than the script has, so it stops itself rather than being given up on, and reads the bodies it answers with")
  func readsBodies() throws {
    let runner = FakeScriptRunner().answering("email_bodies", with: #"{"bodies":{"41":"At eight."}}"#)

    #expect(
      try ScriptedMailStore(runner: runner).bodies(ofEmails: [41, 42], in: invoices)
        == [41: "At eight."])
    let asked = try #require(runner.runs.first?.arguments)
    #expect(asked["withinMilliseconds"] as? Int == 6000)
    #expect(asked["longestBody"] as? Int == 200_000)
  }

  // Asked about a mailbox that is not there, Mail fails each email the way it fails one that has
  // gone, which would make a whole answer vanish without a word.
  @Test("given the script says the mail account has no such mailbox while reading Message-IDs or bodies, says the mailbox is unknown rather than that every email has gone")
  func reportsAnUnknownMailboxForMoreOfSomeEmails() {
    let runner = FakeScriptRunner()
      .answering("email_message_ids", with: #"{"mailboxUnknown":true}"#)
      .answering("email_bodies", with: #"{"mailboxUnknown":true}"#)
    let store = ScriptedMailStore(runner: runner)

    #expect(throws: MailUnreadable.mailboxUnknown(path: ["Clients", "Invoices 2026/27"])) {
      try store.messageIds(ofEmails: [41], in: invoices)
    }
    #expect(throws: MailUnreadable.mailboxUnknown(path: ["Clients", "Invoices 2026/27"])) {
      try store.bodies(ofEmails: [41], in: invoices)
    }
  }
}

@Suite("scripting one email in full")
struct ScriptingOneEmailSpec {
  let wanted = EmailWanted(
    mailbox: MailboxAddress(mailAccount: "A1", path: ["Clients", "Invoices 2026/27"]),
    messageId: "dinner@example.test", storeIdentifier: 41, longestBody: 100_000)

  @Test("asks about one email by its mailbox's full name, its Message-ID, the store identifier to look under first, the most of its body wanted and how long the script has")
  func asksAboutOneEmail() throws {
    let runner = FakeScriptRunner().answering("email", with: #"{"email":null}"#)

    _ = try ScriptedMailStore(runner: runner).email(wanted)

    let asked = try #require(runner.runs.first?.arguments)
    #expect(runner.runs.map(\.script) == ["email"])
    #expect(asked["mailAccount"] as? String == "A1")
    #expect(asked["mailbox"] as? String == "Clients/Invoices 2026/27")
    #expect(asked["messageId"] as? String == "dinner@example.test")
    #expect(asked["storeIdentifier"] as? Int == 41)
    #expect(asked["longestBody"] as? Int == 100_000)
    #expect(asked["withinMilliseconds"] as? Int == 8000)
  }

  // Measured on macOS 26: Mail fails every read of an attachment's content type, and an email
  // need not say when it was sent, or give a name with an address. None of them is filled in.
  @Test("reads the email the script answers with, leaving out whatever Mail did not say: a name, a sent date, an attachment's content type or its size")
  func readsTheEmail() throws {
    let runner = FakeScriptRunner().answering(
      "email",
      with: #"""
        {"email":{"storeIdentifier":77,"mailAccountName":"Personal","subject":"Dinner","sender":"Grace Hopper <grace@example.test>","to":[{"name":null,"address":"ada@example.test"}],"cc":[],"bcc":[],"receivedAt":1789722000000,"sentAt":null,"isRead":true,"body":"At eight.","bodyCharacters":9,"attachments":[{"name":"menu.pdf","contentType":null,"size":48211}]}}
        """#)

    #expect(
      try ScriptedMailStore(runner: runner).email(wanted)
        == EmailInFull(
          email: Email(
            storeIdentifier: 77, subject: "Dinner", sender: "Grace Hopper <grace@example.test>",
            receivedAt: at("2026-09-18T09:00:00Z"), isRead: true),
          mailAccountName: "Personal",
          to: [Correspondent(name: nil, address: "ada@example.test")], cc: [], bcc: [],
          sentAt: nil, body: "At eight.", bodyCharacters: 9,
          attachments: [EmailAttachment(name: "menu.pdf", contentType: nil, size: 48_211)]))
  }

  @Test("given the script found no email with that Message-ID, answers with none")
  func answersWithNone() throws {
    let runner = FakeScriptRunner().answering("email", with: #"{"email":null}"#)

    #expect(try ScriptedMailStore(runner: runner).email(wanted) == nil)
  }

  // Found under its store identifier an email costs ten milliseconds. Looked for, it costs a
  // millisecond and a half for every email in the mailbox, and the look cannot be stopped. A
  // fresh reference finds it at once again, so that is what the failure tells the caller to get.
  @Test("given the script says the reference has gone stale in a mailbox too large to look through in time, says so with how many emails it holds")
  func reportsAStaleReference() {
    let runner = FakeScriptRunner().answering("email", with: #"{"referenceStale":{"emails":5045}}"#)

    #expect(throws: MailUnreadable.emailReferenceStale(emails: 5045, seconds: 8)) {
      try ScriptedMailStore(runner: runner).email(wanted)
    }
  }

  // "No email" is an answer the script has to give. One that says nothing about the email is
  // not that answer: read as it, a script that broke would say every email had gone.
  @Test("given an answer that says nothing about the email at all, refuses it rather than reading it as no email")
  func refusesAnAnswerThatSaysNothing() {
    let runner = FakeScriptRunner().answering("email", with: #"{}"#)

    #expect(throws: MailUnreadable.self) { try ScriptedMailStore(runner: runner).email(wanted) }
  }

  // danielk-am 9d9122c invented an untitled item out of an answer it could not read.
  @Test("given an email with a field missing, refuses the whole answer rather than inventing the rest")
  func refusesAnAnswerItCannotRead() {
    let runner = FakeScriptRunner().answering(
      "email", with: #"{"email":{"storeIdentifier":77,"subject":"Dinner"}}"#)

    #expect(throws: MailUnreadable.self) { try ScriptedMailStore(runner: runner).email(wanted) }
  }
}

@Suite("scripting the local mailboxes")
struct ScriptingTheLocalMailboxesSpec {
  // A local mailbox is addressed by its full name alone, and its path is read from that as any
  // mailbox's is: what Mail says each name is decides where the full name divides.
  @Test("reads each local mailbox's path from its full name, its own name and the mailboxes it sits inside, and its role from Mail's role mailboxes")
  func readsTheLocalMailboxes() throws {
    let runner = FakeScriptRunner().answering(
      "local_mailboxes",
      with: #"""
        {"mailboxes":[
          {"fullName":"Tax returns","name":"Tax returns","containers":[]},
          {"fullName":"Tax returns/2025 A/B","name":"2025 A/B","containers":["Tax returns"]},
          {"fullName":"Deleted","name":"Deleted","containers":[]}],
         "roles":{"inbox":[],"drafts":[],"sent":[],"junk":[],"trash":["Deleted"]}}
        """#)

    #expect(
      try ScriptedMailStore(runner: runner).localMailboxes() == [
        Mailbox(path: ["Tax returns"], role: nil),
        Mailbox(path: ["Tax returns", "2025 A/B"], role: nil),
        Mailbox(path: ["Deleted"], role: .trash),
      ])
    #expect(runner.runs.map(\.script) == ["local_mailboxes"])
  }

  // Mail gives its Outbox the job of one, and the glossary names five roles, none of them that.
  @Test("given a role the glossary does not name, such as Mail's own for its Outbox, gives the mailbox no role")
  func givesTheOutboxNoRole() throws {
    let runner = FakeScriptRunner().answering(
      "local_mailboxes",
      with: #"""
        {"mailboxes":[{"fullName":"Outbox","name":"Outbox","containers":[]}],
         "roles":{"inbox":[],"drafts":[],"sent":[],"junk":[],"trash":[],"outbox":["Outbox"]}}
        """#)

    #expect(
      try ScriptedMailStore(runner: runner).localMailboxes() == [Mailbox(path: ["Outbox"], role: nil)])
  }

  @Test("given an answer with a field missing, refuses the whole answer rather than inventing a mailbox")
  func refusesAnAnswerItCannotRead() {
    let runner = FakeScriptRunner().answering(
      "local_mailboxes", with: #"{"mailboxes":[{"name":"Tax returns"}],"roles":{}}"#)

    #expect(throws: MailUnreadable.self) { try ScriptedMailStore(runner: runner).localMailboxes() }
  }
}
