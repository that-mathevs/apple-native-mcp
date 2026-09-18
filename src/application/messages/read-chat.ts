import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import { defaultMessageLimit } from "../../domain/messages/message.js";
import { type ContactNames, type Naming, naming } from "./contact-names.js";
import type { MessagesRead, MessageStore } from "./message-store.js";

export type ReadChatDependencies = {
  readonly messageStore: MessageStore;
  readonly contactNames: ContactNames;
};

/** A chat's messages, and the names the user's contacts give their senders. */
export type ChatRead = MessagesRead & { readonly naming: Naming };

export type ReadChatRequest = {
  readonly chat: string;
  readonly limit?: number | undefined;
  readonly from?: Date | undefined;
  readonly to?: Date | undefined;
};

export const readChat = async (
  { messageStore, contactNames }: ReadChatDependencies,
  { chat, limit, from, to }: ReadChatRequest,
): Promise<Outcome<ChatRead>> => {
  const read = await messageStore.messages({
    chat,
    limit: limit ?? defaultMessageLimit,
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  });
  if (!read.ok) return read;

  const senders = read.value.messages.flatMap(({ handle }) =>
    handle === undefined ? [] : [handle],
  );
  return succeeded({ ...read.value, naming: await naming(contactNames, senders) });
};
