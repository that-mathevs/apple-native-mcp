import type { NamedFailure } from "../../domain/failure.js";
import type { MailAccount } from "../../domain/mail/mail-account.js";

/** How a caller names where to look: one mail account, and one mailbox inside it. */
export type MailboxNamedByCaller = {
  /** One mail account, by its identifier, its exact name or one of its email addresses. */
  readonly mailAccount?: string | undefined;
  /** One mailbox's path inside that mail account, to look in it alone. */
  readonly mailboxPath?: readonly string[] | undefined;
};

// A path alone names a mailbox in every account that has one, INBOX for a start.
export const mailboxNeedsItsMailAccount: NamedFailure = {
  code: "mailbox-needs-its-mail-account",
  sentence:
    "Nothing was read: a mailbox is named by its mail account and its path together. Name the " +
    "mail account too. A local mailbox, which has no mail account, cannot be looked in yet.",
};

export const mailboxUnknown = (
  mailAccount: MailAccount,
  path: readonly string[],
): NamedFailure => ({
  code: "mailbox-unknown",
  sentence:
    `Nothing was read: the mail account ${mailAccount.name} has no mailbox with that path. ` +
    "List the mailboxes to find it. A local mailbox, which belongs to no mail account, cannot " +
    "be looked in yet.",
  evidence: path.join("/"),
});
