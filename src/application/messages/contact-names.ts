import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import type { MessageStore } from "./message-store.js";

/** Each handle a contact name was found for, with that name. */
export type ContactNamesFound = ReadonlyMap<string, string>;

/**
 * The contact names the user's contacts give handles. Messages asks through this port and never
 * reaches into Contacts itself: which contact a handle belongs to is the Contacts context's rule,
 * judged against every handle the message store holds.
 */
export type ContactNames = {
  namesOf: (
    handles: readonly string[],
    storedHandles: readonly string[],
  ) => Promise<Outcome<ContactNamesFound>>;
};

export type ContactNamesDependencies = {
  readonly messageStore: MessageStore;
  readonly contactNames: ContactNames;
};

/**
 * The contact names for every handle a read found, reading the contacts once for all of them
 * (MSG-15) and keeping nothing for the next read (MSG-C12). A read that found no handle asks for
 * nothing. Contacts that cannot be read cost the names, never the read (MSG-16).
 */
export const contactNamesFor = async (
  { messageStore, contactNames }: ContactNamesDependencies,
  handles: Iterable<string>,
): Promise<Outcome<ContactNamesFound>> => {
  const wanted = [...new Set(handles)];
  if (wanted.length === 0) return succeeded(new Map());

  const stored = await messageStore.handles();
  if (!stored.ok) return stored;

  return await contactNames.namesOf(wanted, stored.value);
};

/** The handles a read's messages came from. */
export const sendersOf = (messages: readonly { readonly handle?: string }[]): string[] =>
  messages.flatMap(({ handle }) => (handle === undefined ? [] : [handle]));
