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
