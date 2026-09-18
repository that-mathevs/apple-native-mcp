import type { Outcome } from "../../domain/failure.js";
import type { Chat } from "../../domain/messages/chat.js";
import type { Message } from "../../domain/messages/message.js";

/** The newest chats, and whether there were more than were asked for. */
export type ChatsRead = {
  readonly chats: readonly Chat[];
  readonly truncated: boolean;
};

/** Which messages of one chat to read: the newest, up to a limit, within bounds when given. */
export type MessagesWanted = {
  /** The chat's identifier. */
  readonly chat: string;
  readonly limit: number;
  /** The first instant inside the range. */
  readonly from?: Date;
  /** The first instant after it. */
  readonly to?: Date;
};

/** A chat's newest messages in time order, oldest first, and whether older ones were left. */
export type MessagesRead = {
  readonly messages: readonly Message[];
  readonly truncated: boolean;
};

/**
 * The store messages are read from. The helper implements it over the message store, read-only;
 * a fake stands in for specs.
 *
 * Chats come newest first, and only those with real traffic: a chat holding nothing but the
 * user's own failed sends is a ghost chat, and is left out by the store itself.
 */
export type MessageStore = {
  chats: (limit: number) => Promise<Outcome<ChatsRead>>;
  /** Reactions are not messages, and are left out by the store itself. */
  messages: (wanted: MessagesWanted) => Promise<Outcome<MessagesRead>>;
};
