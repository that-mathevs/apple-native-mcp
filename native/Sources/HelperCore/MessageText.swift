import Foundation

/// A message's text, from what the store keeps of it: its text, why it could not be read, or
/// neither, when the store keeps none.
///
/// The archived text comes first, because it is what Messages shows: the plain text can be
/// nothing but the placeholder for an attachment or a link (MSG-75), and is left empty for many
/// messages. The plain text stands in only when there is no archived text or it cannot be read.
/// When neither gives text, a broken archive is named rather than read as a message with nothing
/// in it.
enum MessageText: Equatable {
  case text(String)
  case unreadable(NamedFailure)
  case none

  /// What the plain text holds in place of an attachment or a link.
  static let placeholder = "\u{FFFC}"

  init(plain: String?, archived: Data?) {
    let usablePlain = plain.flatMap(Self.written)

    switch archived.map(ArchivedText.text(of:)) {
    case .success(let text)? where Self.written(text) != nil: self = .text(text)
    case .failure(let unreadable)? where usablePlain == nil:
      self = .unreadable(.messageTextUnreadable(reason: unreadable.reason))
    default: self = usablePlain.map(MessageText.text) ?? .none
    }
  }

  /// Text someone wrote, which neither nothing nor the placeholder alone is.
  private static func written(_ text: String) -> String? {
    text.isEmpty || text == placeholder ? nil : text
  }

  var text: String? {
    if case .text(let text) = self { return text }
    return nil
  }

  var unreadable: NamedFailure? {
    if case .unreadable(let failure) = self { return failure }
    return nil
  }
}
