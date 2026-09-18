import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import { defaultChatLimit } from "../../domain/messages/chat.js";
import { type ContactNames, type Naming, naming } from "./contact-names.js";
import type { ChatsRead, MessageStore } from "./message-store.js";

export type ListChatsDependencies = {
  readonly messageStore: MessageStore;
  readonly contactNames: ContactNames;
};

/** The newest chats, and the names the user's contacts give their participants. */
export type ChatsListed = ChatsRead & { readonly naming: Naming };

export type ListChatsRequest = {
  readonly limit?: number | undefined;
};

export const listChats = async (
  { messageStore, contactNames }: ListChatsDependencies,
  { limit }: ListChatsRequest,
): Promise<Outcome<ChatsListed>> => {
  const read = await messageStore.chats(limit ?? defaultChatLimit);
  if (!read.ok) return read;

  const participants = read.value.chats.flatMap((chat) => chat.participants);
  return succeeded({ ...read.value, naming: await naming(contactNames, participants) });
};
