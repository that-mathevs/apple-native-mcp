import type { Mailbox } from "./mailbox.js";

/** How many of the latest emails are reported when no limit is given, and the most that can be. */
export const defaultLatest = 20;
export const greatestLatest = 100;

/**
 * One item in Mail, as an index lists it: never its body, which is someone else's text and is
 * only read when a caller asks for it.
 */
export type Email = {
  readonly mailbox: Pick<Mailbox, "mailAccount" | "path">;
  /**
   * The number Mail knows the email by inside its mailbox while it runs. It is how the store is
   * asked about this email again, and it never leaves the server: it is not an email reference.
   */
  readonly storeIdentifier: number;
  readonly subject: string;
  /** The sender as Mail shows it: a name and an address, or an address alone. */
  readonly sender: string;
  readonly receivedAt: Date;
  readonly isRead: boolean;
};

/** Newest first, which is what "latest" means whatever order a mailbox keeps. */
export const newestFirst = (left: Email, right: Email): number =>
  right.receivedAt.getTime() - left.receivedAt.getTime();

/**
 * What a read returns so a later operation can act on exactly that email, never on another with a
 * similar subject (findings MAIL-C7): its Message-ID, its mail account and its mailbox path.
 */
export type EmailReference = {
  readonly mailAccount: string;
  readonly mailboxPath: readonly string[];
  readonly messageId: string;
};

/** An email with the reference that addresses it. */
export type ReferencedEmail = Email & { readonly reference: EmailReference };
