import type { Outcome } from "../../domain/failure.js";
import type { MailAccount } from "../../domain/mail/mail-account.js";
import type { Email } from "../../domain/mail/email.js";
import type { Mailbox, MailboxAddress } from "../../domain/mail/mailbox.js";
import type { SearchRange } from "../../domain/search-range.js";

/** Which emails of one mailbox to read: its newest ones, up to this many. */
export type LatestEmailsWanted = {
  readonly mailbox: MailboxAddress;
  readonly newest: number;
};

/** A mailbox's newest emails, and how many it holds that Mail gives no received date. */
export type LatestEmails = {
  readonly emails: readonly Email[];
  /** Emails with no received date cannot be placed among the latest, so they are counted. */
  readonly undated: number;
};

/** Which emails of one mailbox to read: those received in a range, newest first, to a ceiling. */
export type EmailsInRangeWanted = {
  readonly mailbox: MailboxAddress;
  readonly range: SearchRange;
  readonly ceiling: number;
};

/** The emails a range held, and whether the ceiling stopped the read before the range's start. */
export type EmailsInRange = {
  readonly emails: readonly Email[];
  readonly truncated: boolean;
  /** Emails of the mailbox Mail gives no received date, which no range can hold. */
  readonly undated: number;
};

/** Some emails of one mailbox, by their store identifiers. */
export type EmailsAskedAbout = {
  readonly mailbox: MailboxAddress;
  readonly storeIdentifiers: readonly number[];
};

/**
 * The bodies the store read of the emails it was asked about, newest first, by store identifier.
 * A body costs up to a second to read, so the store stops at its time budget, and an email that
 * is absent here was not read: it has not been searched, which is not the same as not matching.
 */
export type EmailBodies = ReadonlyMap<number, string>;

/**
 * The store mail is read from. The helper implements it; a fake stands in for specs.
 *
 * Mailboxes are asked for one mail account at a time: Mail answers one request at a time, and
 * one that covers every account is what hung it (brightline 304f384).
 */
export type MailStore = {
  mailAccounts: () => Promise<Outcome<readonly MailAccount[]>>;
  mailboxes: (mailAccount: MailAccount) => Promise<Outcome<readonly Mailbox[]>>;
  /** One mailbox to a request, for the reason one mail account is: Mail answers one at a time. */
  latestEmails: (wanted: LatestEmailsWanted) => Promise<Outcome<LatestEmails>>;
  emailsInRange: (wanted: EmailsInRangeWanted) => Promise<Outcome<EmailsInRange>>;
  /** Asked for only when a caller wants bodies searched. A body is never part of an answer. */
  emailBodies: (wanted: EmailsAskedAbout) => Promise<Outcome<EmailBodies>>;
  /**
   * The Message-ID of each of these emails, by store identifier. It is asked for apart from the
   * emails because it costs ten times what any other column does, and is wanted only for the few
   * that make an answer. An email that has gone since is simply absent from the answer.
   */
  messageIds: (wanted: EmailsAskedAbout) => Promise<Outcome<ReadonlyMap<number, string>>>;
};
