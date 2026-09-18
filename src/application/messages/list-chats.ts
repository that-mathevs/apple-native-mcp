import type { Outcome } from "../../domain/failure.js";
import { defaultChatLimit } from "../../domain/messages/chat.js";
import type { ChatsRead, MessageStore } from "./message-store.js";

export type ListChatsDependencies = {
  readonly messageStore: MessageStore;
};

export type ListChatsRequest = {
  readonly limit?: number | undefined;
};

export const listChats = async (
  { messageStore }: ListChatsDependencies,
  { limit }: ListChatsRequest,
): Promise<Outcome<ChatsRead>> => await messageStore.chats(limit ?? defaultChatLimit);
