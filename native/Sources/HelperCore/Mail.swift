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
}

/// Why Mail could not be read.
public enum MailUnreadable: Error, Equatable, Sendable {
  /// Mail did not answer within its time budget.
  case timedOut(seconds: Int)
  /// Mail did not start, so not even its permission could be asked about.
  case didNotStart(evidence: String)
  /// No mail account has the identifier that was asked about.
  case mailAccountUnknown(identifier: String)
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
