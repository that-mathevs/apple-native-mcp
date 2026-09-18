import Foundation

/// A chat's kind, which is the chat's own and never counted from its participants: a group chat
/// that has shrunk to one other person is still a group chat.
public enum ChatKind: String, Equatable, Sendable {
  case oneToOne = "one-to-one"
  case group
}

/// A thread with participants, addressed by its identifier. The user is never a participant.
public struct Chat: Equatable, Sendable {
  public let identifier: String
  public let kind: ChatKind
  /// The participants' handles, in the order the store gives them.
  public let participants: [String]
  /// When its newest message that counts as real traffic arrived or left.
  public let lastTimestamp: Date
}

/// The newest chats, and whether there were more than were asked for.
public struct ChatsRead: Equatable, Sendable {
  public let chats: [Chat]
  public let truncated: Bool
}

/// Which way a message went: from someone else to the user, or from the user.
public enum Direction: String, Equatable, Sendable {
  case incoming
  case outgoing
}

/// One item in a chat. Its text is external content, carried as data.
public struct Message: Equatable, Sendable {
  public let identifier: String
  /// The chat it belongs to, by identifier.
  public let chat: String
  /// Nothing when the store holds no text for it the helper could read.
  public let text: String?
  public let direction: Direction
  /// The handle an incoming message came from. An outgoing one came from the user.
  public let handle: String?
  public let timestamp: Date
  /// The service that carried it: iMessage, SMS or RCS.
  public let service: String
}

/// A chat's newest messages in time order, oldest first, and whether older ones were left.
public struct MessagesRead: Equatable, Sendable {
  public let messages: [Message]
  public let truncated: Bool
}

/// The instants a read of messages covers, either bound left open: the first instant inside it,
/// and the first after it.
public struct MessageRange: Equatable, Sendable {
  public let start: Date?
  public let end: Date?

  public static let unbounded = MessageRange(start: nil, end: nil)
}
