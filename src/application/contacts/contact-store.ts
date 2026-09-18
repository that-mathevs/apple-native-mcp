import type { Contact } from "../../domain/contacts/contact.js";
import type { Outcome } from "../../domain/failure.js";

/** The store contacts are read from. The helper implements it; a fake stands in for specs. */
export type ContactStore = {
  /** Every contact, read afresh each time: a contact edited a moment ago reads as edited. */
  contacts: () => Promise<Outcome<readonly Contact[]>>;
};
