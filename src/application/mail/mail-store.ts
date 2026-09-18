import type { Outcome } from "../../domain/failure.js";
import type { MailAccount } from "../../domain/mail/mail-account.js";
import type { Mailbox } from "../../domain/mail/mailbox.js";

/**
 * The store mail is read from. The helper implements it; a fake stands in for specs.
 *
 * Mailboxes are asked for one mail account at a time: Mail answers one request at a time, and
 * one that covers every account is what hung it (brightline 304f384).
 */
export type MailStore = {
  mailAccounts: () => Promise<Outcome<readonly MailAccount[]>>;
  mailboxes: (mailAccount: MailAccount) => Promise<Outcome<readonly Mailbox[]>>;
};
