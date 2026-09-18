import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import { defaultMessageLimit } from "../../domain/messages/message.js";
import {
  type ContactNames,
  type ContactNamesFound,
  contactNamesFor,
  sendersOf,
} from "./contact-names.js";
import type { MessagesRead, MessageStore } from "./message-store.js";

export type ReadChatDependencies = {
  readonly messageStore: MessageStore;
  readonly contactNames: ContactNames;
};

/** A chat's messages, and the names the user's contacts give their senders. */
export type ChatRead = MessagesRead & { readonly contactNames: Outcome<ContactNamesFound> };

export type ReadChatRequest = {
  readonly chat: string;
  readonly limit?: number | undefined;
  readonly from?: Date | undefined;
  readonly to?: Date | undefined;
};

export const readChat = async (
  dependencies: ReadChatDependencies,
  { chat, limit, from, to }: ReadChatRequest,
): Promise<Outcome<ChatRead>> => {
  const read = await dependencies.messageStore.messages({
    chat,
    limit: limit ?? defaultMessageLimit,
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  });
  if (!read.ok) return read;

  return succeeded({
    ...read.value,
    contactNames: await contactNamesFor(dependencies, sendersOf(read.value.messages)),
  });
};
