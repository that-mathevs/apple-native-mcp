import Foundation

@testable import HelperCore

// The words a mail scenario uses to set a Mac's Mail up without having one.

let personalMail = MailAccount(
  identifier: "account-personal", name: "Personal",
  emailAddresses: ["ada@example.test", "ada.lovelace@example.test"])

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
