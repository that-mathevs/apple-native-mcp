/**
 * A chat's kind is the chat's own, never counted from its participants: a group chat that has
 * shrunk to one other person is still a group chat, and a reply to it still reaches the group.
 */
export type ChatKind = "one-to-one" | "group";

/** A thread with participants, addressed by its identifier. The user is never a participant. */
export type Chat = {
  readonly identifier: string;
  readonly kind: ChatKind;
  /** The participants' handles. */
  readonly participants: readonly string[];
  /** When the newest message in it that counts as real traffic arrived or left. */
  readonly lastTimestamp: Date;
};

/** How many chats a list holds when the caller names no limit, and the most it may name. */
export const defaultChatLimit = 20;
export const greatestChatLimit = 100;

/** Which way a message went: from someone else to the user, or from the user. */
export type Direction = "incoming" | "outgoing";

/** One item in a chat. Its text is external content: data, never instructions. */
export type Message = {
  readonly identifier: string;
  /** The chat it belongs to, by identifier. */
  readonly chat: string;
  /** Nothing when the store holds no text for it that the helper could read. */
  readonly text?: string;
  readonly direction: Direction;
  /** The handle an incoming message came from. An outgoing one came from the user. */
  readonly handle?: string;
  readonly timestamp: Date;
  /** The service that carried it: iMessage, SMS or RCS. */
  readonly service: string;
};

/** How many messages a read returns when the caller names no limit, and the most it may name. */
export const defaultMessageLimit = 50;
export const greatestMessageLimit = 200;
