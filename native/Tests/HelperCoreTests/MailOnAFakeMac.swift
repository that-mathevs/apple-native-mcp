import Foundation

@testable import HelperCore

// The words a mail scenario uses to set a Mac's Mail up without having one.

let personalMail = MailAccount(
  identifier: "account-personal", name: "Personal",
  emailAddresses: ["ada@example.test", "ada.lovelace@example.test"])

/// An email as a scenario holds it: what an index lists, and what is only read when asked for.
struct HeldEmail {
  let email: Email
  let messageId: String
  let body: String
}

func anEmail(
  _ storeIdentifier: Int, _ subject: String, received: String, read: Bool = false,
  messageId: String = "", body: String = ""
) -> HeldEmail {
  HeldEmail(
    email: Email(
      storeIdentifier: storeIdentifier, subject: subject,
      sender: "Sam Okafor <sam@example.test>", receivedAt: at(received), isRead: read),
    messageId: messageId, body: body)
}

/// A mail store that is not a Mac's: it holds whatever a scenario says it holds, so every rule
/// above Mail is specified without the app, a permission or a single real email.
struct FakeMailStore: MailStore {
  /// How many times macOS was asked and Mail was read, so a scenario can say what did not happen.
  final class Record: @unchecked Sendable {
    var timesAsked = 0
    var timesRead = 0
  }

  var permissionHeld: Permission = .granted
  var answersWhenAsked: Permission = .refused
  var held: [MailAccount] = []
  var heldMailboxes: [String: [Mailbox]] = [:]
  var heldEmails: [MailboxAddress: [HeldEmail]] = [:]
  var tooLargeMailboxes: [[String]: Int] = [:]
  var bodiesReadInTime = Int.max
  var undatedEmails: [[String]: Int] = [:]
  var fails: MailUnreadable?
  var doesNotStart: String?
  let record = Record()

  func permission() throws(MailUnreadable) -> Permission {
    if let said = doesNotStart { throw .didNotStart(evidence: said) }
    return permissionHeld
  }

  func requestPermission() throws(MailUnreadable) -> Permission {
    record.timesAsked += 1
    return answersWhenAsked
  }

  func notStarting(saying evidence: String) -> FakeMailStore {
    var store = self
    store.doesNotStart = evidence
    return store
  }

  func mailAccounts() throws(MailUnreadable) -> [MailAccount] {
    record.timesRead += 1
    if let fails { throw fails }
    return held
  }

  func mailboxes(inMailAccount identifier: String) throws(MailUnreadable) -> [Mailbox] {
    record.timesRead += 1
    if let fails { throw fails }
    guard held.contains(where: { $0.identifier == identifier }) else {
      throw .mailAccountUnknown(identifier: identifier)
    }
    return heldMailboxes[identifier] ?? []
  }

  func emails(
    in mailbox: MailboxAddress, receivedIn range: HelperCore.Range?, most: Int
  ) throws(MailUnreadable) -> EmailsRead {
    record.timesRead += 1
    if let fails { throw fails }
    if let emails = tooLargeMailboxes[mailbox.path] {
      throw .mailboxTooLarge(emails: emails, seconds: 8)
    }
    guard let held = heldEmails[mailbox] else { throw .mailboxUnknown(path: mailbox.path) }

    let inRange = held.map(\.email)
      .filter { email in
        range.map { email.receivedAt >= $0.start && email.receivedAt < $0.end } ?? true
      }
      .sorted { $0.receivedAt > $1.receivedAt }
    return EmailsRead(
      emails: Array(inRange.prefix(most)), truncated: inRange.count > most,
      undated: undatedEmails[mailbox.path] ?? 0)
  }

  func messageIds(
    ofEmails storeIdentifiers: [Int], in mailbox: MailboxAddress
  ) throws(MailUnreadable) -> [Int: String] {
    record.timesRead += 1
    if let fails { throw fails }
    let held = (heldEmails[mailbox] ?? []).filter {
      storeIdentifiers.contains($0.email.storeIdentifier)
    }
    return Dictionary(uniqueKeysWithValues: held.map { ($0.email.storeIdentifier, $0.messageId) })
  }

  func bodies(
    ofEmails storeIdentifiers: [Int], in mailbox: MailboxAddress
  ) throws(MailUnreadable) -> [Int: String] {
    record.timesRead += 1
    if let fails { throw fails }
    let held = storeIdentifiers.compactMap { wanted in
      (heldEmails[mailbox] ?? []).first { $0.email.storeIdentifier == wanted }
    }
    return Dictionary(
      uniqueKeysWithValues: held.prefix(bodiesReadInTime).map {
        ($0.email.storeIdentifier, $0.body)
      })
  }

  func holding(
    in mailAccount: MailAccount, mailbox path: [String], _ emails: HeldEmail...
  ) -> FakeMailStore {
    var store = self
    let address = MailboxAddress(mailAccount: mailAccount.identifier, path: path)
    store.heldEmails[address, default: []] += emails
    return store
  }

  func holdingUndated(_ emails: Int, inMailbox path: [String]) -> FakeMailStore {
    var store = self
    store.undatedEmails[path] = emails
    return store
  }

  func tooLarge(mailbox path: [String], holding emails: Int) -> FakeMailStore {
    var store = self
    store.tooLargeMailboxes[path] = emails
    return store
  }

  /// How many bodies one request reads before its time budget ends it.
  func readingBodiesInTime(_ bodies: Int) -> FakeMailStore {
    var store = self
    store.bodiesReadInTime = bodies
    return store
  }

  func holding(in mailAccount: MailAccount, _ mailboxes: Mailbox...) -> FakeMailStore {
    var store = self
    store.heldMailboxes[mailAccount.identifier, default: []] += mailboxes
    return store
  }

  func notAnswering(within seconds: Int) -> FakeMailStore {
    var store = self
    store.fails = .timedOut(seconds: seconds)
    return store
  }

  func failing(saying evidence: String) -> FakeMailStore {
    var store = self
    store.fails = .failed(evidence: evidence)
    return store
  }

  func permission(_ permission: Permission) -> FakeMailStore {
    var store = self
    store.permissionHeld = permission
    return store
  }

  /// What the user will choose when macOS asks them.
  func answering(_ permission: Permission) -> FakeMailStore {
    var store = self
    store.answersWhenAsked = permission
    return store
  }

  func holding(_ mailAccounts: MailAccount...) -> FakeMailStore {
    var store = self
    store.held += mailAccounts
    return store
  }
}

func aMailStore() -> FakeMailStore { FakeMailStore() }

func helperReading(_ store: FakeMailStore) -> Helper {
  aHelper(mailStore: store)
}
