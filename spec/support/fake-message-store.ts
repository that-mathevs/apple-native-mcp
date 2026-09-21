import type {
  ChatsRead,
  MessagesRead,
  MessagesScanned,
  MessageStore,
  MessagesToSearch,
  MessagesWanted,
} from "../../src/application/messages/message-store.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";
import type { Chat } from "../../src/domain/messages/chat.js";
import type { Message } from "../../src/domain/messages/message.js";

/** What the helper answers when it may not read the message store, word for word. */
export const messageStorePermissionMissing: NamedFailure = {
  code: "message-store-permission-missing",
  sentence:
    "apple-native-mcp cannot read your messages until it is allowed to, in System Settings > " +
    "Privacy & Security > Full Disk Access > apple-native-mcp.",
  evidence: "Operation not permitted",
};

/** What the helper answers when this Mac has no message store at all. */
export const messageStoreNotFound: NamedFailure = {
  code: "message-store-not-found",
  sentence: "This Mac has no message store, so there are no messages to read.",
  evidence: "No such file or directory",
};

/** What the helper answers when the store is there but will not open as one. */
export const messageStoreUnreadable: NamedFailure = {
  code: "message-store-unreadable",
  sentence: "The message store is there but could not be read, so nothing was read.",
  evidence: "file is not a database",
};

/** What the helper answers for a chat identifier no chat in the store has. */
export const chatUnknown: NamedFailure = {
  code: "chat-unknown",
  sentence: "No chat has that identifier, so nothing was read.",
  evidence: "iMessage;-;nobody",
};

/**
 * A message store held in memory.
 *
 * It answers the same contract as the helper-backed one, so the scenarios that use it are worth
 * trusting only for as long as it passes that contract (spec/contracts).
 */
export class FakeMessageStore implements MessageStore {
  #chats: readonly Chat[] = [];
  #messages: readonly Message[] = [];
  #failure: NamedFailure | undefined;
  #ceiling: number | undefined;
  #handles: readonly string[] | undefined;

  holdsChats(...chats: readonly Chat[]): void {
    this.#chats = chats;
  }

  holdsMessages(...messages: readonly Message[]): void {
    this.#messages = messages;
  }

  /** Every handle the store holds, beyond those its chats and messages already name. */
  holdsHandles(...handles: readonly string[]): void {
    this.#handles = handles;
  }

  /** Scan no more than this many, whatever ceiling a search asks for. */
  scansAtMost(ceiling: number): void {
    this.#ceiling = ceiling;
  }

  refuses(failure: NamedFailure): void {
    this.#failure = failure;
  }

  chats(limit: number): Promise<Outcome<ChatsRead>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    const newestFirst = [...this.#chats].sort(
      (left, right) => right.lastTimestamp.getTime() - left.lastTimestamp.getTime(),
    );
    return Promise.resolve(
      succeeded({ chats: newestFirst.slice(0, limit), truncated: newestFirst.length > limit }),
    );
  }

  messages({ chat, limit, from, to }: MessagesWanted): Promise<Outcome<MessagesRead>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));
    if (!this.#knows(chat)) return Promise.resolve(failed({ ...chatUnknown, evidence: chat }));

    const inTimeOrder = this.#messages
      .filter((message) => message.chat === chat)
      .filter((message) => from === undefined || message.timestamp >= from)
      .filter((message) => to === undefined || message.timestamp < to)
      .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    return Promise.resolve(
      succeeded({
        messages: inTimeOrder.slice(Math.max(0, inTimeOrder.length - limit)),
        truncated: inTimeOrder.length > limit,
      }),
    );
  }

  messagesToSearch({
    from,
    to,
    chat,
    ceiling,
  }: MessagesToSearch): Promise<Outcome<MessagesScanned>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));
    if (chat !== undefined && !this.#knows(chat)) {
      return Promise.resolve(failed({ ...chatUnknown, evidence: chat }));
    }

    const scanning = Math.min(ceiling, this.#ceiling ?? ceiling);
    const newestFirst = this.#messages
      .filter((message) => chat === undefined || message.chat === chat)
      .filter((message) => message.timestamp >= from && message.timestamp < to)
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
    return Promise.resolve(
      succeeded({
        messages: newestFirst.slice(0, scanning),
        truncated: newestFirst.length > scanning,
      }),
    );
  }

  handles(): Promise<Outcome<readonly string[]>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    const named = [
      ...(this.#handles ?? []),
      ...this.#chats.flatMap(({ participants }) => participants),
      ...this.#messages.flatMap(({ handle }) => (handle === undefined ? [] : [handle])),
    ];
    return Promise.resolve(succeeded([...new Set(named)]));
  }

  #knows(chat: string): boolean {
    return (
      this.#chats.some(({ identifier }) => identifier === chat) ||
      this.#messages.some((message) => message.chat === chat)
    );
  }
}
