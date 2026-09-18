import type { NamedFailure } from "../../domain/failure.js";
import type { MailAccount } from "../../domain/mail/mail-account.js";

/** How a caller names where to look: one mail account, and one mailbox inside it. */
export type MailboxNamedByCaller = {
  /** One mail account's identifier, to look in it alone. */
  readonly mailAccount?: string | undefined;
  /** One mailbox's path inside that mail account, to look in it alone. */
  readonly mailboxPath?: readonly string[] | undefined;
};

// A path alone names a mailbox in every account that has one, INBOX for a start.
export const mailboxNeedsItsMailAccount: NamedFailure = {
  code: "mailbox-needs-its-mail-account",
  sentence:
    "Nothing was read: a mailbox is named by its mail account and its path together. Name the " +
    "mail account too.",
};

export const mailAccountUnknown = (identifier: string): NamedFailure => ({
  code: "mail-account-unknown",
  sentence:
    "Nothing was read: no mail account has that identifier. List the mail accounts to find it.",
  evidence: identifier,
});

export const mailboxUnknown = (
  mailAccount: MailAccount,
  path: readonly string[],
): NamedFailure => ({
  code: "mailbox-unknown",
  sentence:
    `Nothing was read: the mail account ${mailAccount.name} has no mailbox with that path. ` +
    "List the mailboxes to find it.",
  evidence: path.join("/"),
});
