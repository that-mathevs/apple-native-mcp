import type { ContactStore } from "../application/contacts/contact-store.js";
import type { ContactNames } from "../application/messages/contact-names.js";
import { nameOf } from "../domain/contacts/contact.js";
import { contactReachedAt } from "../domain/contacts/reached-at.js";
import type { Outcome } from "../domain/failure.js";
import { failed, succeeded } from "../domain/failure.js";

/**
 * The names Messages asks for, answered from the contact store. Two contexts meet here, at their
 * ports: Messages says what it needs, and Contacts says which contact holds a handle.
 */
export const contactNamesFrom = (contactStore: ContactStore): ContactNames => ({
  namesOf: async (handles: readonly string[]): Promise<Outcome<ReadonlyMap<string, string>>> => {
    const contacts = await contactStore.contacts();
    if (!contacts.ok) return failed(contacts.failure);

    const named = handles.flatMap((handle) => {
      const contact = contactReachedAt(handle, contacts.value);
      return contact === undefined ? [] : [[handle, nameOf(contact)] as const];
    });
    return succeeded(new Map(named));
  },
});
