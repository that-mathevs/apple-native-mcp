import Foundation

/// Reading the messages: the rules that sit between the protocol and the message store.
struct MessagesReading: Sendable {
  let store: MessageStore

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

/// A message's text, from what the store keeps of it.
///
/// The archived rich text comes first, because it is what Messages shows: the plain text can be
/// nothing but the placeholder for an attachment or a link (MSG-75), and is left empty for many
/// messages. The plain text stands in only when there is no archive or it cannot be read. When
/// neither gives text, a broken archive is named rather than read as a message with nothing in it.
struct MessageText: Equatable {
  let text: String?
  let unreadable: NamedFailure?

  static let placeholder = "\u{FFFC}"

  init(plain: String?, archive: Data?) {
    let usablePlain = plain.flatMap { $0.isEmpty || $0 == Self.placeholder ? nil : $0 }

    guard let archive else {
      self.init(text: usablePlain, unreadable: nil)
      return
    }

    switch ArchivedText.text(of: archive) {
    case .success(let text):
      self.init(text: text, unreadable: nil)
    case .failure(let unreadable):
      if let usablePlain {
        self.init(text: usablePlain, unreadable: nil)
      } else {
        self.init(text: nil, unreadable: .messageTextUnreadable(reason: unreadable.reason))
      }
    }
  }

  private init(text: String?, unreadable: NamedFailure?) {
    self.text = text
    self.unreadable = unreadable
  }
}
