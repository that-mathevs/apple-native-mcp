import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import { defaultChatLimit } from "../../domain/messages/chat.js";
import {
  type ContactNames,
  type ContactNamesFound,
  contactNamesFor,
} from "./contact-names.js";
import type { ChatsRead, MessageStore } from "./message-store.js";

export type ListChatsDependencies = {
  readonly messageStore: MessageStore;
  readonly contactNames: ContactNames;
};

/** The newest chats, and the names the user's contacts give their participants. */
export type ChatsListed = ChatsRead & {
  readonly contactNames: Outcome<ContactNamesFound>;
};

export type ListChatsRequest = {
  readonly limit?: number | undefined;
};

export const listChats = async (
  dependencies: ListChatsDependencies,
  { limit }: ListChatsRequest,
): Promise<Outcome<ChatsListed>> => {
  const read = await dependencies.messageStore.chats(limit ?? defaultChatLimit);
  if (!read.ok) return read;

  const participants = read.value.chats.flatMap((chat) => chat.participants);
  return succeeded({
    ...read.value,
    contactNames: await contactNamesFor(dependencies, participants),
  });
};
