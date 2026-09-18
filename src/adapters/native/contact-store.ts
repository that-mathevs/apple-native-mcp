import type { ContactStore } from "../../application/contacts/contact-store.js";
import type { Contact } from "../../domain/contacts/contact.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { Helper } from "./helper.js";

/**
 * The contact store as the helper answers it.
 *
 * Nothing here decides anything: it asks the helper for every contact and turns the records it
 * sends back into the domain's words. Which of them a query finds, and how a label is said,
 * live above it.
 */

type LabelledText = { readonly label: string; readonly text: string };

type ContactRecord = {
  readonly identifier: string;
  readonly namePrefix: string;
  readonly givenName: string;
  readonly middleName: string;
  readonly familyName: string;
  readonly nameSuffix: string;
  readonly nickname: string;
  readonly organisation: string;
  readonly jobTitle: string;
  readonly phoneNumbers: readonly LabelledText[];
  readonly emailAddresses: readonly LabelledText[];
  readonly postalAddresses: Contact["postalAddresses"];
  readonly urls: readonly LabelledText[];
};

const asContact = (record: ContactRecord): Contact => ({
  identifier: record.identifier,
  namePrefix: record.namePrefix,
  givenName: record.givenName,
  middleName: record.middleName,
  familyName: record.familyName,
  nameSuffix: record.nameSuffix,
  nickname: record.nickname,
  organisation: record.organisation,
  jobTitle: record.jobTitle,
  phoneNumbers: record.phoneNumbers.map(({ label, text }) => ({ label, written: text })),
  emailAddresses: record.emailAddresses.map(({ label, text }) => ({ label, address: text })),
  postalAddresses: record.postalAddresses,
  urls: record.urls.map(({ label, text }) => ({ label, url: text })),
});

export const helperContactStore = (helper: Helper): ContactStore => ({
  contacts: async (): Promise<Outcome<readonly Contact[]>> => {
    const answered = await helper.ask({ request: "contacts" });

    if (!answered.ok) return failed(answered.failure);

    const { contacts } = answered.value as { contacts?: ContactRecord[] };

    return succeeded((contacts ?? []).map(asContact));
  },
});
