import { find, tooLittleToFind, type FoundContact } from "../../domain/contacts/find.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { ContactStore } from "./contact-store.js";

/** How many contacts a page holds when the caller names no limit, and the most it may name. */
export const defaultContactLimit = 25;
export const greatestContactLimit = 50;

export type FindContactsRequest = {
  /** A name, a phone number, or part of an email address. */
  readonly text: string;
  readonly limit?: number;
  /** Where the page starts: the next offset a truncated answer stated. */
  readonly offset?: number;
};

export type FoundContacts = {
  readonly found: readonly FoundContact[];
  /** Where the next page starts, when the limit left contacts behind. */
  readonly nextOffset?: number;
};

export type FindContactsDependencies = { readonly contactStore: ContactStore };

/**
 * The contacts some text finds, a page at a time. The contacts are read afresh for every
 * answer: a cache kept an old number alive upstream (PR #49, faces-sh 0216d96).
 */
export const findContacts = async (
  { contactStore }: FindContactsDependencies,
  { text, limit = defaultContactLimit, offset = 0 }: FindContactsRequest,
): Promise<Outcome<FoundContacts>> => {
  const tooLittle = tooLittleToFind(text);
  if (tooLittle !== undefined) return failed(tooLittle);

  const read = await contactStore.contacts();
  if (!read.ok) return read;

  const found = find(text, read.value);
  const end = offset + limit;

  return succeeded({
    found: found.slice(offset, end),
    ...(found.length > end ? { nextOffset: end } : {}),
  });
};
