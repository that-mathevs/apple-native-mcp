import type { Outcome } from "../../domain/failure.js";
import { defaultMessageLimit } from "../../domain/messages/message.js";
import type { MessagesRead, MessageStore } from "./message-store.js";

export type ReadChatDependencies = {
  readonly messageStore: MessageStore;
};

export type ReadChatRequest = {
  readonly chat: string;
  readonly limit?: number | undefined;
  readonly from?: Date | undefined;
  readonly to?: Date | undefined;
};

export const readChat = async (
  { messageStore }: ReadChatDependencies,
  { chat, limit, from, to }: ReadChatRequest,
): Promise<Outcome<MessagesRead>> =>
  await messageStore.messages({
    chat,
    limit: limit ?? defaultMessageLimit,
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  });
