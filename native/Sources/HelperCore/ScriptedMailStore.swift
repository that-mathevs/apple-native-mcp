import Foundation

public let mailApp = ScriptedApp(bundleIdentifier: "com.apple.mail", name: "Mail")

/// Mail as its scripts reach it. Every script is a constant, every argument is JSON beside it, and
/// what comes back is decoded into the helper's own types or refused.
public struct ScriptedMailStore: MailStore {
  private let runner: ScriptRunner

  public init(runner: ScriptRunner) {
    self.runner = runner
  }

  public func permission() throws(MailUnreadable) -> Permission {
    try permission(asking: false)
  }

  public func requestPermission() throws(MailUnreadable) -> Permission {
    try permission(asking: true)
  }

  private func permission(asking: Bool) throws(MailUnreadable) -> Permission {
    do {
      return try runner.automationPermission(for: mailApp, asking: asking)
    } catch {
      throw error.asMailUnreadable
    }
  }

  public func mailAccounts() throws(MailUnreadable) -> [MailAccount] {
    let answer: MailAccountsAnswer = try asking(MailScripts.mailAccounts, [:])
    return answer.mailAccounts.map {
      MailAccount(identifier: $0.identifier, name: $0.name, emailAddresses: $0.emailAddresses)
    }
  }

  public func mailboxes(inMailAccount identifier: String) throws(MailUnreadable) -> [Mailbox] {
    let answer: MailboxesAnswer = try asking(MailScripts.mailboxes, ["mailAccount": identifier])
    if answer.mailAccountUnknown == true { throw .mailAccountUnknown(identifier: identifier) }

    guard let mailboxes = answer.mailboxes, let roles = answer.roles else {
      throw .failed(evidence: unreadable(MailScripts.mailboxes))
    }

    return mailboxes.map { mailbox in
      Mailbox(
        path: mailboxPath(
          fullName: mailbox.fullName, name: mailbox.name, containers: mailbox.containers),
        // A role is Mail's own answer: the role mailbox that names this one by its full name.
        role: MailboxRole.allCases.first { roles[$0.rawValue]?.contains(mailbox.fullName) == true })
    }
  }

  private func asking<Answer: Decodable>(
    _ script: StaticScript, _ arguments: [String: Any]
  ) throws(MailUnreadable) -> Answer {
    let json: Data
    do {
      json = try runner.run(script, arguments: arguments, within: scriptTimeBudget)
    } catch {
      throw error.asMailUnreadable
    }

    do {
      return try JSONDecoder().decode(Answer.self, from: json)
    } catch {
      throw .failed(evidence: unreadable(script))
    }
  }

  private func unreadable(_ script: StaticScript) -> String {
    "The \(script.name) script answered with a record this helper cannot read."
  }
}

extension ScriptFailed {
  /// Which failure of Mail's this is, told by its number and never by its words.
  fileprivate var asMailUnreadable: MailUnreadable {
    switch number {
    case AppleEventError.timedOut: .timedOut(seconds: Int(scriptTimeBudget))
    case AppleEventError.notRunning: .didNotStart(evidence: evidence)
    default: .failed(evidence: evidence)
    }
  }
}

// What the scripts answer with. A field that is missing or of the wrong kind fails the whole
// decode: a mailbox invented out of a malformed answer is worse than no answer.

private struct MailAccountsAnswer: Decodable {
  struct Record: Decodable {
    let identifier: String
    let name: String
    let emailAddresses: [String]
  }

  let mailAccounts: [Record]
}

private struct MailboxesAnswer: Decodable {
  struct Record: Decodable {
    let fullName: String
    let name: String
    let containers: [String]
  }

  let mailAccountUnknown: Bool?
  let mailboxes: [Record]?
  let roles: [String: [String]]?
}
