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

/**
 * Whether two paths name the same mailbox. Names are compared in one Unicode form, because Mail
 * hands them over decomposed and a client may send them composed, and otherwise exactly.
 */
export const samePath = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length &&
  left.every((name, index) => name.normalize("NFC") === right[index]?.normalize("NFC"));

/** What addresses a mailbox: its mail account and its path, which together never repeat. */
export type MailboxAddress = Pick<Mailbox, "mailAccount" | "path">;

/** A mailbox address as a failure's evidence writes it: the account's name, then the path. */
export const writtenAddress = ({ mailAccount, path }: MailboxAddress): string =>
  `${mailAccount.name}/${path.join("/")}`;
