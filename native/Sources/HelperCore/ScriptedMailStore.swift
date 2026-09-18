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

  public func emails(
    in mailbox: MailboxAddress, receivedIn range: Range?, most: Int
  ) throws(MailUnreadable) -> EmailsRead {
    var arguments = addressing(mailbox)
    arguments["from"] = range.map { $0.start.timeIntervalSince1970 * 1000 as Any } ?? NSNull()
    arguments["to"] = range.map { $0.end.timeIntervalSince1970 * 1000 as Any } ?? NSNull()
    arguments["most"] = most
    arguments["withinMilliseconds"] = Int(scriptTimeBudget * 1000)

    let answer: EmailsAnswer = try asking(MailScripts.emails, arguments)
    try refusing(answer.mailAccountUnknown, answer.mailboxUnknown, asked: mailbox)
    if let tooLarge = answer.mailboxTooLarge {
      throw .mailboxTooLarge(emails: tooLarge.emails, seconds: Int(scriptTimeBudget))
    }

    guard
      let emails = answer.emails, let truncated = answer.truncated, let undated = answer.undated
    else {
      throw .failed(evidence: unreadable(MailScripts.emails))
    }
    return EmailsRead(
      emails: emails.map {
        Email(
          storeIdentifier: $0.storeIdentifier, subject: $0.subject, sender: $0.sender,
          receivedAt: Date(timeIntervalSince1970: $0.receivedAt / 1000), isRead: $0.isRead)
      }, truncated: truncated, undated: undated)
  }

  public func email(_ wanted: EmailWanted) throws(MailUnreadable) -> EmailInFull? {
    var arguments = addressing(wanted.mailbox)
    arguments["messageId"] = wanted.messageId
    arguments["storeIdentifier"] = wanted.storeIdentifier
    arguments["longestBody"] = wanted.longestBody
    arguments["withinMilliseconds"] = Int(scriptTimeBudget * 1000)

    let answer: EmailAnswer = try asking(MailScripts.email, arguments)
    try refusing(answer.mailAccountUnknown, answer.mailboxUnknown, asked: wanted.mailbox)
    if let stale = answer.referenceStale {
      throw .emailReferenceStale(emails: stale.emails, seconds: Int(scriptTimeBudget))
    }
    // "No email" is an answer the script gives in so many words. One that says nothing about the
    // email is a script that broke, and is never read as an email that has gone.
    guard answer.saidWhetherThereIsAnEmail else {
      throw .failed(evidence: unreadable(MailScripts.email))
    }

    return answer.email.map { read in
      EmailInFull(
        email: Email(
          storeIdentifier: read.storeIdentifier, subject: read.subject, sender: read.sender,
          receivedAt: Date(timeIntervalSince1970: read.receivedAt / 1000), isRead: read.isRead),
        mailAccountName: read.mailAccountName,
        to: read.to.map(\.correspondent), cc: read.cc.map(\.correspondent),
        bcc: read.bcc.map(\.correspondent),
        sentAt: read.sentAt.map { Date(timeIntervalSince1970: $0 / 1000) },
        body: read.body, bodyCharacters: read.bodyCharacters,
        attachments: read.attachments.map {
          EmailAttachment(name: $0.name, contentType: $0.contentType, size: $0.size)
        })
    }
  }

  public func messageIds(
    ofEmails storeIdentifiers: [Int], in mailbox: MailboxAddress
  ) throws(MailUnreadable) -> [Int: String] {
    var arguments = addressing(mailbox)
    arguments["emails"] = storeIdentifiers

    let answer: MessageIdsAnswer = try asking(MailScripts.emailMessageIds, arguments)
    try refusing(answer.mailAccountUnknown, answer.mailboxUnknown, asked: mailbox)
    return byStoreIdentifier(answer.messageIds)
  }

  public func bodies(
    ofEmails storeIdentifiers: [Int], in mailbox: MailboxAddress
  ) throws(MailUnreadable) -> [Int: String] {
    var arguments = addressing(mailbox)
    arguments["emails"] = storeIdentifiers
    // A body read cannot be stopped once asked for, so the script stops itself short of the time
    // budget, with room for the read it is in the middle of.
    arguments["withinMilliseconds"] = Int((scriptTimeBudget - Self.roomForOneBody) * 1000)
    arguments["longestBody"] = Self.longestBody

    let answer: BodiesAnswer = try asking(MailScripts.emailBodies, arguments)
    try refusing(answer.mailAccountUnknown, answer.mailboxUnknown, asked: mailbox)
    return byStoreIdentifier(answer.bodies)
  }

  /// How long one body may take to arrive after the script has decided to read it.
  private static let roomForOneBody: TimeInterval = 2

  /// The most of one body that is searched: a body is matched against a few words, not kept.
  private static let longestBody = 200_000

  /// Mail addresses a mailbox by its path joined with a slash, and a path always joins back to
  /// exactly that (`mailboxPath`), so a mailbox is read without being looked up again.
  private func addressing(_ mailbox: MailboxAddress) -> [String: Any] {
    ["mailAccount": mailbox.mailAccount, "mailbox": mailbox.path.joined(separator: "/")]
  }

  private func refusing(
    _ mailAccountUnknown: Bool?, _ mailboxUnknown: Bool?, asked mailbox: MailboxAddress
  ) throws(MailUnreadable) {
    if mailAccountUnknown == true { throw .mailAccountUnknown(identifier: mailbox.mailAccount) }
    if mailboxUnknown == true { throw .mailboxUnknown(path: mailbox.path) }
  }

  /// A JSON object is keyed by text, so a store identifier arrives as its digits.
  private func byStoreIdentifier(_ answered: [String: String]?) -> [Int: String] {
    var read: [Int: String] = [:]
    for (digits, text) in answered ?? [:] {
      if let storeIdentifier = Int(digits) { read[storeIdentifier] = text }
    }
    return read
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

private struct EmailsAnswer: Decodable {
  struct Record: Decodable {
    let storeIdentifier: Int
    let receivedAt: Double
    let subject: String
    let sender: String
    let isRead: Bool
  }

  let mailAccountUnknown: Bool?
  let mailboxUnknown: Bool?
  let mailboxTooLarge: HoldingRecord?
  let emails: [Record]?
  let truncated: Bool?
  let undated: Int?
}

/// How many emails a mailbox holds, when that is why it was not read.
private struct HoldingRecord: Decodable {
  let emails: Int
}

/// `email` is null when no email with that Message-ID is in the mailbox, which is an answer, and
/// is told apart from an answer with no `email` in it at all, which is not. A field that is
/// missing or of the wrong kind inside the email fails the whole decode.
private struct EmailAnswer: Decodable {
  struct CorrespondentRecord: Decodable {
    let name: String?
    let address: String

    var correspondent: Correspondent { Correspondent(name: name, address: address) }
  }

  struct AttachmentRecord: Decodable {
    let name: String?
    let contentType: String?
    let size: Int?
  }

  struct Record: Decodable {
    let storeIdentifier: Int
    let mailAccountName: String
    let subject: String
    let sender: String
    let to: [CorrespondentRecord]
    let cc: [CorrespondentRecord]
    let bcc: [CorrespondentRecord]
    let receivedAt: Double
    let sentAt: Double?
    let isRead: Bool
    let body: String
    let bodyCharacters: Int
    let attachments: [AttachmentRecord]
  }

  let mailAccountUnknown: Bool?
  let mailboxUnknown: Bool?
  let referenceStale: HoldingRecord?
  let saidWhetherThereIsAnEmail: Bool
  let email: Record?

  private enum Key: String, CodingKey {
    case mailAccountUnknown, mailboxUnknown, referenceStale, email
  }

  init(from decoder: Decoder) throws {
    let answer = try decoder.container(keyedBy: Key.self)
    mailAccountUnknown = try answer.decodeIfPresent(Bool.self, forKey: .mailAccountUnknown)
    mailboxUnknown = try answer.decodeIfPresent(Bool.self, forKey: .mailboxUnknown)
    referenceStale = try answer.decodeIfPresent(HoldingRecord.self, forKey: .referenceStale)
    saidWhetherThereIsAnEmail = answer.contains(.email)
    email = try answer.decodeIfPresent(Record.self, forKey: .email)
  }
}

private struct MessageIdsAnswer: Decodable {
  let mailAccountUnknown: Bool?
  let mailboxUnknown: Bool?
  let messageIds: [String: String]?
}

private struct BodiesAnswer: Decodable {
  let mailAccountUnknown: Bool?
  let mailboxUnknown: Bool?
  let bodies: [String: String]?
}
