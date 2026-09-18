import type { Contact } from "./contact.js";
import { e164, looksLikeANumber, sameNumber } from "./phone-number.js";

/**
 * Whether a number on a card is the handle's. A number that states its country is compared in
 * full. A bare national number says nothing about its country, so it is the handle's only while
 * no other stored handle has its digits too: that one, in another country, would fit it as well
 * (#17, MSG-55).
 */
const isTheHandlesNumber = (
  written: string,
  handle: string,
  storedHandles: readonly string[],
): boolean => {
  if (!sameNumber(written, handle)) return false;
  if (e164(written) !== undefined) return true;
  return !storedHandles.some((other) => other !== handle && sameNumber(written, other));
};

/** Whether this contact holds the handle: one of its numbers, or the same email address. */
const holds = (contact: Contact, handle: string, storedHandles: readonly string[]): boolean => {
  if (handle.includes("@")) {
    const address = handle.toLowerCase();
    return contact.emailAddresses.some((email) => email.address.toLowerCase() === address);
  }
  return (
    looksLikeANumber(handle) &&
    contact.phoneNumbers.some(({ written }) => isTheHandlesNumber(written, handle, storedHandles))
  );
};

/**
 * The contact a handle in Messages belongs to, when exactly one does, judged against the handles
 * the message store holds. Two that could be it name neither: a name beside the wrong handle
 * tells an agent that a stranger is someone the user knows.
 */
export const contactReachedAt = (
  handle: string,
  contacts: readonly Contact[],
  storedHandles: readonly string[],
): Contact | undefined => {
  const holding = contacts.filter((contact) => holds(contact, handle, storedHandles));
  return holding.length === 1 ? holding[0] : undefined;
};
