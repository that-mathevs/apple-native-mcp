import type { MailAccount } from "./mail-account.js";

/**
 * The job Mail knows a role mailbox by. It is Mail's own answer, never read from a name: names
 * vary by provider and by language (findings MAIL-C3).
 */
export const mailboxRoles = ["inbox", "drafts", "sent", "junk", "trash"] as const;

export type MailboxRole = (typeof mailboxRoles)[number];

/**
 * A folder of emails inside one mail account, identified by its account and its path.
 *
 * The path is a list of names, outermost first. Forks joined it into one string, which is
 * ambiguous as soon as a name contains the separator (findings MAIL-C14).
 */
export type Mailbox = {
  readonly mailAccount: Pick<MailAccount, "identifier" | "name">;
  readonly path: readonly string[];
  /** Absent for a mailbox Mail knows no role for. */
  readonly role?: MailboxRole;
};
