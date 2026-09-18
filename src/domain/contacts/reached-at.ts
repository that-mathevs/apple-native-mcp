import type { Contact } from "./contact.js";
import { looksLikeANumber, sameNumber } from "./phone-number.js";

/** Whether this contact holds the handle: the same number in full, or the same email address. */
const holds = (contact: Contact, handle: string): boolean => {
  if (handle.includes("@")) {
    const address = handle.toLowerCase();
    return contact.emailAddresses.some((email) => email.address.toLowerCase() === address);
  }
  return (
    looksLikeANumber(handle) &&
    contact.phoneNumbers.some(({ written }) => sameNumber(written, handle))
  );
};

/**
 * The contact a handle in Messages belongs to, when exactly one does. Two that could be it name
 * neither: a bare national number on a card can fit handles in two countries (#17), and a name
 * beside the wrong handle tells an agent a stranger is someone the user knows.
 */
export const contactReachedAt = (
  handle: string,
  contacts: readonly Contact[],
): Contact | undefined => {
  const holding = contacts.filter((contact) => holds(contact, handle));
  return holding.length === 1 ? holding[0] : undefined;
};
