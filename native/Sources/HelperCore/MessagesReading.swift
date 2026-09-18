import Foundation

/// Reading the messages: the rules that sit between the protocol and the message store.
struct MessagesReading: Sendable {
  let store: MessageStore

  func handles() -> Result<[String], NamedFailure> {
    store.handles().mapError(NamedFailure.init(refusal:))
  }

  func chats(limit: Int) -> Result<ChatsRead, NamedFailure> {
    store.chats(limit: limit).mapError(NamedFailure.init(refusal:))
  }

  /// A chat's messages. A chat the store does not have is refused, never answered with none.
  func messages(inChat identifier: String, within range: MessageRange, limit: Int) -> Result<
    MessagesRead, NamedFailure
  > {
    store.messages(inChat: identifier, within: range, limit: limit)
      .mapError(NamedFailure.init(refusal:))
      .flatMap { read in
        read.map { .success($0) } ?? .failure(.chatUnknown(identifier: identifier))
      }
  }

  /// Messages to search, of one chat or of every chat. A chat the store does not have is refused.
  func messagesToSearch(within range: MessageRange, inChat identifier: String?, ceiling: Int)
    -> Result<MessagesScanned, NamedFailure>
  {
    store.messagesToSearch(within: range, inChat: identifier, ceiling: ceiling)
      .mapError(NamedFailure.init(refusal:))
      .flatMap { scanned in
        // Only a named chat can be unknown; every chat always answers.
        guard let scanned else { return .failure(.chatUnknown(identifier: identifier ?? "")) }
        return .success(scanned)
      }
  }
}

extension NamedFailure {
  init(refusal: MessageStoreRefusal) {
    switch refusal {
    case .permissionMissing(let evidence):
      self = .messageStorePermissionMissing(evidence: evidence)
    case .notFound(let evidence): self = .messageStoreNotFound(evidence: evidence)
    case .unreadable(let evidence): self = .messageStoreUnreadable(evidence: evidence)
    }
  }
}
