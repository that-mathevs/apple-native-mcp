import type {
  ChatsRead,
  MessagesRead,
  MessageStore,
  MessagesWanted,
} from "../../application/messages/message-store.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { Chat } from "../../domain/messages/chat.js";
import type { Delivery, Message } from "../../domain/messages/message.js";
import type { Helper } from "./helper.js";

/**
 * The message store as the helper answers it.
 *
 * Nothing here decides anything: the helper reads the store read-only, with prepared statements,
 * and leaves out ghost chats; this turns what it sends back into the domain's words.
 */

type ChatRecord = {
  readonly identifier: string;
  readonly kind: Chat["kind"];
  readonly participants: readonly string[];
  readonly lastTimestamp: string;
};

const asChat = (record: ChatRecord): Chat => ({
  identifier: record.identifier,
  kind: record.kind,
  participants: record.participants,
  lastTimestamp: new Date(record.lastTimestamp),
});

type MessageRecord = {
  readonly identifier: string;
  readonly chat: string;
  readonly text: string | null;
  readonly direction: Message["direction"];
  readonly handle: string | null;
  readonly timestamp: string;
  readonly service: string;
  readonly delivery: {
    readonly sent: boolean;
    readonly delivered: boolean;
    readonly error: number | null;
  } | null;
};

const asDelivery = (record: NonNullable<MessageRecord["delivery"]>): Delivery => ({
  sent: record.sent,
  delivered: record.delivered,
  ...(record.error === null ? {} : { error: record.error }),
});

const asMessage = (record: MessageRecord): Message => ({
  identifier: record.identifier,
  chat: record.chat,
  ...(record.text === null ? {} : { text: record.text }),
  direction: record.direction,
  ...(record.handle === null ? {} : { handle: record.handle }),
  timestamp: new Date(record.timestamp),
  service: record.service,
  ...(record.delivery === null ? {} : { delivery: asDelivery(record.delivery) }),
});

export const helperMessageStore = (helper: Helper): MessageStore => ({
  chats: async (limit: number): Promise<Outcome<ChatsRead>> => {
    const answered = await helper.ask({ request: "chats", limit });
    if (!answered.ok) return failed(answered.failure);

    const { chats, truncated } = answered.value as { chats?: ChatRecord[]; truncated?: boolean };
    return succeeded({ chats: (chats ?? []).map(asChat), truncated: truncated === true });
  },

  messages: async ({ chat, limit, from, to }: MessagesWanted): Promise<Outcome<MessagesRead>> => {
    const answered = await helper.ask({
      request: "chat_messages",
      chat,
      limit,
      range: { start: from?.toISOString() ?? null, end: to?.toISOString() ?? null },
    });
    if (!answered.ok) return failed(answered.failure);

    const { messages, truncated } = answered.value as {
      messages?: MessageRecord[];
      truncated?: boolean;
    };
    return succeeded({ messages: (messages ?? []).map(asMessage), truncated: truncated === true });
  },
});
