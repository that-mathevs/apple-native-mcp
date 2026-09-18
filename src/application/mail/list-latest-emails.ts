import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import { defaultLatest, newestFirst, type ReferencedEmail } from "../../domain/mail/email.js";
import { askingEachMailAccount, type UnreadMailAccount } from "./each-mail-account.js";
import { samePath } from "../../domain/mail/mailbox.js";
import type { LatestEmails as LatestEmailsRead, MailStore } from "./mail-store.js";
import {
  type MailboxNamedByCaller,
  mailboxNeedsItsMailAccount,
  mailboxUnknown,
} from "./naming-a-mailbox.js";
import { referencing } from "./referencing-emails.js";

export type ListLatestEmailsDependencies = {
  readonly mailStore: MailStore;
};

export type ListLatestEmailsRequest = MailboxNamedByCaller & {
  readonly limit?: number | undefined;
};

export type LatestEmails = {
  readonly emails: readonly ReferencedEmail[];
  /** Emails Mail gives no received date, which cannot be placed among the latest. */
  readonly undated: number;
  readonly unreadMailAccounts: readonly UnreadMailAccount[];
};

// An inbox is the mailbox Mail gives that role. Guessing one from a name is what MAIL-C3 rules
// out, so an account with none is named, and the caller can name a mailbox instead.
const noInbox: NamedFailure = {
  code: "mail-account-has-no-inbox",
  sentence:
    "Mail gives none of this mail account's mailboxes the inbox role, so its latest mail was " +
    "not read. Name a mailbox to read it from.",
};

/**
 * The latest mail: the most recently received emails of each mail account's inbox, newest first.
 * Latest looks nowhere else, because walking every mailbox is what timed out and what let junk
 * fill the answer, and a mailbox a caller names takes the inbox's place (findings MAIL-C2).
 */
export const listLatestEmails = async (
  { mailStore }: ListLatestEmailsDependencies,
  { limit = defaultLatest, mailAccount: only, mailboxPath }: ListLatestEmailsRequest,
): Promise<Outcome<LatestEmails>> => {
  if (mailboxPath !== undefined && only === undefined) return failed(mailboxNeedsItsMailAccount);

  const asked = await askingEachMailAccount(
    mailStore,
    { nothing: "no email was listed", only },
    async (mailAccount): Promise<Outcome<LatestEmailsRead>> => {
      const mailboxes = await mailStore.mailboxes(mailAccount);
      if (!mailboxes.ok) return mailboxes;

      const mailbox =
        mailboxPath === undefined
          ? mailboxes.value.find(({ role }) => role === "inbox")
          : mailboxes.value.find(({ path }) => samePath(path, mailboxPath));
      if (mailbox === undefined) {
        return failed(
          mailboxPath === undefined ? noInbox : mailboxUnknown(mailAccount, mailboxPath),
        );
      }

      return await mailStore.latestEmails({ mailbox, newest: limit });
    },
  );
  if (!asked.ok) return asked;

  const { read, unreadMailAccounts } = asked.value;
  const latest = read
    .flatMap(({ emails }) => emails)
    .sort(newestFirst)
    .slice(0, limit);

  const referenced = await referencing(mailStore, latest);

  return succeeded({
    emails: referenced.emails,
    undated: read.reduce((sum, { undated }) => sum + undated, 0),
    unreadMailAccounts: [
      ...unreadMailAccounts,
      ...referenced.unreferencedMailboxes.map(({ mailbox, failure }) => ({
        mailAccount: mailbox.mailAccount,
        failure,
      })),
    ],
  });
};
