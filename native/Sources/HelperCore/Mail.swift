import Foundation

/// A configured account in Mail. Names repeat, so the identifier Mail gives it addresses it.
public struct MailAccount: Equatable, Sendable {
  public let identifier: String
  public let name: String
  public let emailAddresses: [String]

  public init(identifier: String, name: String, emailAddresses: [String]) {
    self.identifier = identifier
    self.name = name
    self.emailAddresses = emailAddresses
  }
}

/// The job Mail knows a role mailbox by. It is Mail's own answer, never read from a name: names
/// vary by provider and by language (findings MAIL-C3).
public enum MailboxRole: String, Equatable, Sendable, CaseIterable {
  case inbox, drafts, sent, junk, trash
}

/// A folder of emails inside one mail account, identified by that account and its path: every
/// name from the outermost in. A joined path is ambiguous once a name holds the separator.
public struct Mailbox: Equatable, Sendable {
  public let path: [String]
  public let role: MailboxRole?

  public init(path: [String], role: MailboxRole?) {
    self.path = path
    self.role = role
  }
}

/// One item in Mail, as an index lists it: never its body, which is someone else's text and is
/// read only when it is asked for by name.
public struct Email: Equatable, Sendable {
  /// The number Mail knows the email by inside its mailbox while it runs: how the store is asked
  /// about this email again, and nothing a person or an agent ever sees.
  public let storeIdentifier: Int
  public let subject: String
  public let sender: String
  public let receivedAt: Date
  public let isRead: Bool

  public init(
    storeIdentifier: Int, subject: String, sender: String, receivedAt: Date, isRead: Bool
  ) {
    self.storeIdentifier = storeIdentifier
    self.subject = subject
    self.sender = sender
    self.receivedAt = receivedAt
    self.isRead = isRead
  }
}

/// A mailbox's emails, newest first, whether there were more than were asked for, and how many
/// the mailbox holds that Mail gives no received date: those cannot be placed in a range or among
/// the latest, so they are counted rather than left out unmentioned.
public struct EmailsRead: Equatable, Sendable {
  public let emails: [Email]
  public let truncated: Bool
  public let undated: Int

  public init(emails: [Email], truncated: Bool, undated: Int) {
    self.emails = emails
    self.truncated = truncated
    self.undated = undated
  }
}

/// Someone an email is from or to: an address, and the name written with it when there is one.
public struct Correspondent: Equatable, Sendable {
  public let name: String?
  public let address: String

  public init(name: String?, address: String) {
    self.name = name
    self.address = address
  }
}

/// A part of an email with a file name, a content type and a size in bytes. What Mail does not say
/// about one is nil, never filled in: on macOS 26, Mail fails every read of a content type.
public struct EmailAttachment: Equatable, Sendable {
  public let name: String?
  public let contentType: String?
  public let size: Int?

  public init(name: String?, contentType: String?, size: Int?) {
    self.name = name
    self.contentType = contentType
    self.size = size
  }
}

/// One email in full: what a detail read returns. Its body is Mail's own plain-text rendering,
/// cut at the length asked for, with how long the whole of it is.
public struct EmailInFull: Equatable, Sendable {
  public let email: Email
  public let mailAccountName: String
  public let to: [Correspondent]
  public let cc: [Correspondent]
  public let bcc: [Correspondent]
  /// Nil when the email does not say when it was sent. It is never made up.
  public let sentAt: Date?
  public let body: String
  public let bodyCharacters: Int
  public let attachments: [EmailAttachment]

  public init(
    email: Email, mailAccountName: String, to: [Correspondent], cc: [Correspondent],
    bcc: [Correspondent], sentAt: Date?, body: String, bodyCharacters: Int,
    attachments: [EmailAttachment]
  ) {
    self.email = email
    self.mailAccountName = mailAccountName
    self.to = to
    self.cc = cc
    self.bcc = bcc
    self.sentAt = sentAt
    self.body = body
    self.bodyCharacters = bodyCharacters
    self.attachments = attachments
  }
}

/// Which email to read in full: the mailbox it is in, its Message-ID, which alone says which email
/// it is, the store identifier to look under first, and the most of its body to return.
public struct EmailWanted: Equatable, Sendable {
  public let mailbox: MailboxAddress
  public let messageId: String
  public let storeIdentifier: Int
  public let longestBody: Int

  public init(mailbox: MailboxAddress, messageId: String, storeIdentifier: Int, longestBody: Int) {
    self.mailbox = mailbox
    self.messageId = messageId
    self.storeIdentifier = storeIdentifier
    self.longestBody = longestBody
  }
}

/// Which mailbox: its mail account's identifier, and its path from the outermost name in.
public struct MailboxAddress: Hashable, Sendable {
  public let mailAccount: String
  public let path: [String]

  public init(mailAccount: String, path: [String]) {
    self.mailAccount = mailAccount
    self.path = path
  }
}

/// Mail as the helper reaches it.
public protocol MailStore: Sendable {
  /// What macOS currently allows. macOS can only say for an app that is running, so this may
  /// have to start Mail, and fails when Mail will not start.
  func permission() throws(MailUnreadable) -> Permission

  /// Ask macOS for Mail, which prompts the user, and report what they chose.
  /// Only ever called while the permission is undecided: macOS prompts once and no more.
  func requestPermission() throws(MailUnreadable) -> Permission

  /// Every mail account, read afresh.
  func mailAccounts() throws(MailUnreadable) -> [MailAccount]

  /// The mailboxes of one mail account. There is no reading every account at once: Mail answers
  /// one request at a time, and one covering every account is what hung it (brightline 304f384).
  func mailboxes(inMailAccount identifier: String) throws(MailUnreadable) -> [Mailbox]

  /// One mailbox's emails received in a range, or all of them, newest first by when each was
  /// received, whatever order the mailbox keeps, and no more than `most` of them.
  func emails(
    in mailbox: MailboxAddress, receivedIn range: Range?, most: Int
  ) throws(MailUnreadable) -> EmailsRead

  /// One email in full, or nil when no email with that Message-ID is in that mailbox now. The
  /// store identifier is where to look first, and what is found there counts only when its
  /// Message-ID is the one wanted: nothing says a store identifier outlives a restart or a move.
  func email(_ wanted: EmailWanted) throws(MailUnreadable) -> EmailInFull?

  /// The Message-ID of each of these emails, by store identifier. It costs ten times what any
  /// other column does, so it is read apart, for the few emails that make an answer. An email
  /// that has gone since it was listed is absent.
  func messageIds(
    ofEmails storeIdentifiers: [Int], in mailbox: MailboxAddress
  ) throws(MailUnreadable) -> [Int: String]

  /// The bodies of these emails that could be read in time, in the order given, by store
  /// identifier. One the store did not reach is absent: not read, which is not empty.
  func bodies(
    ofEmails storeIdentifiers: [Int], in mailbox: MailboxAddress
  ) throws(MailUnreadable) -> [Int: String]
}

/// Why Mail could not be read.
public enum MailUnreadable: Error, Equatable, Sendable {
  /// Mail did not answer within its time budget.
  case timedOut(seconds: Int)
  /// Mail did not start, so not even its permission could be asked about.
  case didNotStart(evidence: String)
  /// No mail account has the identifier that was asked about.
  case mailAccountUnknown(identifier: String)
  /// The mail account has no mailbox with the path that was asked about.
  case mailboxUnknown(path: [String])
  /// The mailbox holds too many emails to read within the time budget, so none was read.
  case mailboxTooLarge(emails: Int, seconds: Int)
  /// An email was not under its store identifier, and its mailbox holds too many emails to look
  /// through for its Message-ID within the time budget.
  case emailReferenceStale(emails: Int, seconds: Int)
  /// Mail answered with a failure. It carries what Mail said, verbatim.
  case failed(evidence: String)
}

/// Reading Mail: the rules that sit between the protocol and the app.
struct MailReading: Sendable {
  let store: MailStore

  func permission() -> Result<Permission, NamedFailure> {
    asking(store.permission)
  }

  /// Asks only while nobody has been asked: macOS prompts once, so after that the answer is the
  /// setting to change, not another prompt.
  func requestPermission() -> Result<Permission, NamedFailure> {
    permission().flatMap { held in
      held == .undecided ? asking(store.requestPermission) : .success(held)
    }
  }

  private func asking(
    _ ask: () throws(MailUnreadable) -> Permission
  ) -> Result<Permission, NamedFailure> {
    do {
      return .success(try ask())
    } catch {
      return .failure(error.named)
    }
  }

  func mailAccounts() -> Result<[MailAccount], NamedFailure> {
    reading { () throws(MailUnreadable) in try store.mailAccounts() }
  }

  func mailboxes(inMailAccount identifier: String) -> Result<[Mailbox], NamedFailure> {
    reading { () throws(MailUnreadable) in try store.mailboxes(inMailAccount: identifier) }
  }

  func emails(
    in mailbox: MailboxAddress, receivedIn range: Range?, most: Int
  ) -> Result<EmailsRead, NamedFailure> {
    reading { () throws(MailUnreadable) in
      try store.emails(in: mailbox, receivedIn: range, most: most)
    }
  }

  func email(_ wanted: EmailWanted) -> Result<EmailInFull?, NamedFailure> {
    reading { () throws(MailUnreadable) in try store.email(wanted) }
  }

  func messageIds(
    ofEmails storeIdentifiers: [Int], in mailbox: MailboxAddress
  ) -> Result<[Int: String], NamedFailure> {
    reading { () throws(MailUnreadable) in
      try store.messageIds(ofEmails: storeIdentifiers, in: mailbox)
    }
  }

  func bodies(
    ofEmails storeIdentifiers: [Int], in mailbox: MailboxAddress
  ) -> Result<[Int: String], NamedFailure> {
    reading { () throws(MailUnreadable) in
      try store.bodies(ofEmails: storeIdentifiers, in: mailbox)
    }
  }

  /// Mail is read only under a granted permission. Reading it while nobody has been asked is what
  /// makes macOS ask, and a tool never asks.
  private func reading<Read>(
    _ read: () throws(MailUnreadable) -> Read
  ) -> Result<Read, NamedFailure> {
    do {
      let permission = try store.permission()
      guard permission.allowsReading else {
        return .failure(.mailPermissionMissing(permission: permission))
      }
      return .success(try read())
    } catch {
      return .failure(error.named)
    }
  }
}

extension MailUnreadable {
  /// A Mail that did not answer and a Mail that failed are two failures, and neither is a
  /// missing permission.
  var named: NamedFailure {
    switch self {
    case .timedOut(let seconds): .mailTimedOut(seconds: seconds)
    case .didNotStart(let evidence): .mailDidNotStart(evidence: evidence)
    case .mailAccountUnknown(let identifier): .mailAccountUnknown(identifier: identifier)
    case .mailboxUnknown(let path): .mailboxUnknown(path: path)
    case .mailboxTooLarge(let emails, let seconds):
      .mailboxTooLarge(emails: emails, seconds: seconds)
    case .emailReferenceStale(let emails, let seconds):
      .emailReferenceStale(emails: emails, seconds: seconds)
    case .failed(let evidence): .mailUnreadable(evidence: evidence)
    }
  }
}

extension MailAccount {
  var asFields: [String: Any] {
    ["identifier": identifier, "name": name, "emailAddresses": emailAddresses]
  }
}

extension Mailbox {
  var asFields: [String: Any] {
    ["path": path, "role": role?.rawValue ?? NSNull()]
  }
}

extension Email {
  var asFields: [String: Any] {
    [
      "storeIdentifier": storeIdentifier, "subject": subject, "sender": sender,
      "receivedAt": Instant.written(receivedAt), "isRead": isRead,
    ]
  }
}

extension Correspondent {
  var asFields: [String: Any] { ["name": name ?? NSNull(), "address": address] }
}

extension EmailAttachment {
  var asFields: [String: Any] {
    ["name": name ?? NSNull(), "contentType": contentType ?? NSNull(), "size": size ?? NSNull()]
  }
}

extension EmailInFull {
  var asFields: [String: Any] {
    email.asFields.merging([
      "mailAccountName": mailAccountName,
      "to": to.map(\.asFields), "cc": cc.map(\.asFields), "bcc": bcc.map(\.asFields),
      "sentAt": sentAt.map(Instant.written) ?? NSNull(),
      "body": body, "bodyCharacters": bodyCharacters,
      "attachments": attachments.map(\.asFields),
    ]) { index, _ in index }
  }
}

extension EmailsRead {
  var asFields: [String: Any] {
    ["emails": emails.map(\.asFields), "truncated": truncated, "undated": undated]
  }
}

/// A JSON object is keyed by text, so a store identifier is written as its digits.
func keyedByDigits(_ byStoreIdentifier: [Int: String]) -> [String: String] {
  Dictionary(uniqueKeysWithValues: byStoreIdentifier.map { (String($0.key), $0.value) })
}
