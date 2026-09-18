import type { ContactStore } from "../../src/application/contacts/contact-store.js";
import type { Contact } from "../../src/domain/contacts/contact.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";

/** What the helper answers when the user refused contacts access, word for word. */
export const contactsRefused: NamedFailure = {
  code: "contacts_permission_missing",
  sentence:
    "apple-native-mcp cannot read your contacts until it is allowed to, in System Settings > " +
    "Privacy & Security > Contacts > apple-native-mcp.",
  evidence: "refused",
};

/** A contact with nothing on it but a name, for a scenario to add what its behaviour reads. */
export const aContact = (
  identifier: string,
  givenName: string,
  familyName: string,
  details: Partial<Contact> = {},
): Contact => ({
  identifier,
  namePrefix: "",
  givenName,
  middleName: "",
  familyName,
  nameSuffix: "",
  nickname: "",
  organisation: "",
  jobTitle: "",
  phoneNumbers: [],
  emailAddresses: [],
  postalAddresses: [],
  urls: [],
  ...details,
});

/**
 * A contact store held in memory.
 *
 * It answers the same contract as the helper-backed one, so the scenarios that use it are
 * worth trusting only for as long as it passes that contract (spec/contracts).
 */
export class FakeContactStore implements ContactStore {
  /** How many times the contacts were read, so a scenario can say nothing was cached. */
  reads = 0;

  #contacts: readonly Contact[] = [];
  #failure: NamedFailure | undefined;

  holds(...contacts: readonly Contact[]): void {
    this.#contacts = contacts;
  }

  refuses(failure: NamedFailure): void {
    this.#failure = failure;
  }

  contacts(): Promise<Outcome<readonly Contact[]>> {
    this.reads += 1;

    return Promise.resolve(this.#failure ? failed(this.#failure) : succeeded(this.#contacts));
  }
}
