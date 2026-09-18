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
   * The number Mail knows the email by inside its mailbox while it runs: how the store is asked
   * about this email again. An email reference carries it as a hint, and never as what says
   * which email it is.
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
  /**
   * Where to look first. Finding an email by its Message-ID scans its mailbox, at a millisecond
   * and a half an email: 7.5 seconds in one of five thousand. By store identifier it takes ten
   * milliseconds in any. The hint is never trusted: what it finds is that email only if its
   * Message-ID is this one, and otherwise the mailbox is scanned.
   */
  readonly storeIdentifier: number;
};

/** An email as an index reports it: with the reference that addresses it, which holds its hint. */
export type ReferencedEmail = Omit<Email, "storeIdentifier"> & {
  readonly reference: EmailReference;
};

/** Someone an email is from or to: an address, and the name written with it when there is one. */
export type Correspondent = {
  readonly name?: string;
  readonly address: string;
};

/**
 * A part of an email with a file name, a content type and a size in bytes. It is never opened,
 * and it is kept apart from something attached to a note. What Mail does not say about one is
 * absent, never filled in: on macOS 26, Mail fails every read of an attachment's content type
 * (-10000), and one taken from the name would be a guess.
 */
export type EmailAttachment = {
  readonly name?: string;
  readonly contentType?: string;
  readonly size?: number;
};

/** The most of a body a read returns, in characters. The record says when it cut, and the whole. */
export const greatestBody = 100_000;

/**
 * An email's body as Mail renders it in plain text, which it does for an HTML-only email too. It
 * is external content: text someone else wrote, carried as data in this one field.
 */
export type EmailBody = {
  readonly text: string;
  /** How long the whole body is, which is more than `text` when it was cut. */
  readonly characters: number;
  readonly truncated: boolean;
};

/** A body as a record carries it: the text returned, and whether that is the whole of it. */
export const emailBody = (text: string, characters: number): EmailBody => ({
  text,
  characters,
  truncated: characters > text.length,
});

/**
 * The start of a body, no longer than this many characters. A character outside the basic plane
 * is two units long, and the cut never falls inside one: half a character is not text, and a
 * record holding it cannot be written as JSON.
 */
export const cutAt = (whole: string, longest: number): string => {
  const cut = whole.slice(0, longest);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
};

/** One email in full: what a detail read returns. */
export type EmailInFull = Omit<Email, "storeIdentifier"> & {
  readonly reference: EmailReference;
  readonly to: readonly Correspondent[];
  readonly cc: readonly Correspondent[];
  readonly bcc: readonly Correspondent[];
  /** Absent when the email says nothing about when it was sent: it is never made up. */
  readonly sentAt?: Date;
  readonly body: EmailBody;
  readonly attachments: readonly EmailAttachment[];
};
