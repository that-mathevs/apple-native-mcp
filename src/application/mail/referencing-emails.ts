import type { NamedFailure } from "../../domain/failure.js";
import type { Email, ReferencedEmail } from "../../domain/mail/email.js";
import { type MailboxAddress, writtenAddress } from "../../domain/mail/mailbox.js";
import type { MailStore } from "./mail-store.js";

/** A mailbox whose emails could not be given references, and why. */
export type UnreferencedMailbox = {
  readonly mailbox: MailboxAddress;
  readonly failure: NamedFailure;
};

export type EmailsReferenced = {
  readonly emails: readonly ReferencedEmail[];
  readonly unreferencedMailboxes: readonly UnreferencedMailbox[];
};

const mailboxKey = ({ mailAccount, path }: MailboxAddress): string =>
  JSON.stringify([mailAccount.identifier, path]);

// An email with no reference is a dead end: nothing later could act on it, and picking it out
// again by its subject is what acted on the wrong email (findings MAIL-C7). So it is left out,
// and its mailbox is named, rather than the whole answer being thrown away (#24).
const unreferenced = (mailbox: MailboxAddress, failure: NamedFailure): NamedFailure => ({
  code: "mailbox-matches-unreferenced",
  sentence:
    "This mailbox's matches could not be given a reference a later read can act on, so they " +
    "were left out. Search again.",
  evidence: `${writtenAddress(mailbox)}: ${failure.code}`,
});

/**
 * These emails, each with its email reference, in the order given. Message-IDs are read one
 * mailbox to a request, and only for these emails. One that has gone since it was listed has no
 * Message-ID to read, and is left out rather than reported as still there (felkru 22aa354).
 */
export const referencing = async (
  mailStore: MailStore,
  emails: readonly Email[],
): Promise<EmailsReferenced> => {
  const messageIds = new Map<string, ReadonlyMap<number, string>>();
  const unreferencedMailboxes: UnreferencedMailbox[] = [];

  for (const [key, inMailbox] of Map.groupBy(emails, ({ mailbox }) => mailboxKey(mailbox))) {
    const [first] = inMailbox;
    if (first === undefined) continue;

    const read = await mailStore.messageIds({
      mailbox: first.mailbox,
      storeIdentifiers: inMailbox.map(({ storeIdentifier }) => storeIdentifier),
    });
    if (read.ok) messageIds.set(key, read.value);
    else {
      const failure = unreferenced(first.mailbox, read.failure);
      unreferencedMailboxes.push({ mailbox: first.mailbox, failure });
    }
  }

  return {
    emails: emails.flatMap((email) => {
      const messageId = messageIds.get(mailboxKey(email.mailbox))?.get(email.storeIdentifier);
      if (messageId === undefined) return [];

      const { mailAccount, path } = email.mailbox;
      const reference = { mailAccount: mailAccount.identifier, mailboxPath: path, messageId };
      return [{ ...email, reference }];
    }),
    unreferencedMailboxes,
  };
};
