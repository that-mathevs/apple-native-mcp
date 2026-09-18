import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import {
  type EmailInFull,
  type EmailReference,
  greatestBody,
} from "../../domain/mail/email.js";
import type { MailStore } from "./mail-store.js";

export type ReadEmailDependencies = {
  readonly mailStore: MailStore;
};

// An email that was deleted, or moved to another mailbox, since it was listed is not read from
// somewhere else, and no other email is read in its place (findings MAIL-93).
const emailNotFound = (reference: EmailReference): NamedFailure => ({
  code: "email-not-found",
  sentence:
    "No email with that reference is in that mailbox now: it was deleted or moved since it " +
    "was listed. Nothing was read. Search again to find it.",
  evidence: reference.messageId,
});

/** One email in full, addressed by the email reference an earlier read returned. */
export const readEmail = async (
  { mailStore }: ReadEmailDependencies,
  reference: EmailReference,
): Promise<Outcome<EmailInFull>> => {
  const read = await mailStore.email({ reference, longestBody: greatestBody });
  if (!read.ok) return read;

  return read.value === undefined ? failed(emailNotFound(reference)) : succeeded(read.value);
};
