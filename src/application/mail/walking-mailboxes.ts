import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { Email } from "../../domain/mail/email.js";
import type { MailAccount } from "../../domain/mail/mail-account.js";
import {
  type Mailbox,
  type MailboxAddress,
  samePath,
  writtenAddress,
} from "../../domain/mail/mailbox.js";
import { searchCeiling, searchTimeBudgetSeconds } from "../../domain/mail/search.js";
import type { SearchRange } from "../../domain/search-range.js";
import { mailIsBusyAfter } from "./a-busy-mail.js";
import { mailAccountNotAsked, type UnreadMailAccount } from "./each-mail-account.js";
import type { MailStore } from "./mail-store.js";
import { mailboxUnknown } from "./naming-a-mailbox.js";

/** A mailbox the ceiling stopped short of the range's start, and the oldest email looked at. */
export type TruncatedMailbox = {
  readonly mailbox: MailboxAddress;
  readonly reachedBack: Date;
};

/** A mailbox that is missing from a search, or only partly in it, and why. */
export type MailboxFailure = {
  readonly mailbox: MailboxAddress;
  readonly failure: NamedFailure;
};

/** Everything a walk over the mailboxes read, and everything it could not. */
export type MailboxesWalked = {
  readonly emails: readonly Email[];
  /** The bodies that were read, by email. An email absent here was not searched by its body. */
  readonly bodies: ReadonlyMap<Email, string>;
  readonly mailboxesSearched: number;
  readonly undated: number;
  readonly truncatedMailboxes: readonly TruncatedMailbox[];
  readonly unsearchedMailboxes: readonly MailboxFailure[];
  readonly partlySearchedMailboxes: readonly MailboxFailure[];
  readonly unreadMailAccounts: readonly UnreadMailAccount[];
};

export type MailboxesToWalk = {
  readonly mailAccounts: readonly MailAccount[];
  /** One mailbox's path, to walk it alone. Every other walk leaves junk and trash out. */
  readonly mailboxPath: readonly string[] | undefined;
  readonly range: SearchRange;
  readonly readBodies: boolean;
};

/** Junk and trash are searched only when a caller names them (findings MAIL-C2). */
const searchedByDefault = ({ role }: Mailbox): boolean => role !== "junk" && role !== "trash";

/** What ended a walk early, as the failures whatever it never reached is named with. */
type Stopped = { readonly mailbox: NamedFailure; readonly mailAccount: NamedFailure };

// A Mail that has stopped answering (#7) ends the walk, rather than every mailbox after it
// waiting out a whole time budget of its own.
const mailStoppedAnswering = (stoppedAt: string, failure: NamedFailure): Stopped => ({
  mailbox: {
    code: "mailbox-not-asked",
    sentence:
      "Mail stopped answering before this mailbox was searched, so it was left alone: Mail " +
      "can stay busy for minutes. Search again later.",
    evidence: `${stoppedAt}: ${failure.code}`,
  },
  mailAccount: mailAccountNotAsked(stoppedAt, failure),
});

// A client waits sixty seconds for a tool at the least (#25), and dozens of mailboxes can each
// answer slowly without any one of them running out of time.
const outOfTime = (mailboxesSearched: number, seconds: number): Stopped => {
  const failure = (what: string): NamedFailure => ({
    code: "mail-search-out-of-time",
    sentence:
      `The search reached its time budget of ${String(searchTimeBudgetSeconds)} seconds ` +
      `before this ${what}. Search one mail account or one mailbox to reach it.`,
    evidence: `${String(mailboxesSearched)} mailboxes searched in ${String(seconds)} seconds`,
  });
  return { mailbox: failure("mailbox"), mailAccount: failure("mail account") };
};

// #24: a body search always states its coverage, and stops at its time budget with a named
// failure. An email whose body was not read is still matched by subject and sender.
const bodiesOutOfTime = (read: number, wanted: number): NamedFailure => ({
  code: "mailbox-bodies-out-of-time",
  sentence:
    "Not every body in this mailbox could be read within the time budget. The emails whose " +
    "bodies were not read were matched by subject and sender alone: none of them has been " +
    "ruled out. Search a shorter range to read them all.",
  evidence: `${String(read)} of ${String(wanted)} bodies read`,
});

const bodiesUnread = (mailbox: MailboxAddress, failure: NamedFailure): NamedFailure => ({
  code: "mailbox-bodies-unread",
  sentence:
    "The bodies in this mailbox could not be read, so its emails were matched by subject and " +
    "sender alone: none of them has been ruled out.",
  evidence: `${writtenAddress(mailbox)}: ${failure.code}`,
});

/**
 * Read the emails a range holds in each mailbox, one mailbox to a request and one mail account
 * after another, until they are all read, Mail stops answering, or the search's own time budget
 * is reached. Whatever was read is kept whichever way the walk ends, and everything it could not
 * read is named: a walk reports what it has (#24).
 *
 * It refuses outright only when a caller named a mailbox its mail account does not have.
 */
export const walkingMailboxes = async (
  { mailStore, now }: { readonly mailStore: MailStore; readonly now: () => Date },
  { mailAccounts, mailboxPath, range, readBodies }: MailboxesToWalk,
): Promise<Outcome<MailboxesWalked>> => {
  const emails: Email[] = [];
  const bodies = new Map<Email, string>();
  const truncatedMailboxes: TruncatedMailbox[] = [];
  const unsearchedMailboxes: MailboxFailure[] = [];
  const partlySearchedMailboxes: MailboxFailure[] = [];
  const unreadMailAccounts: UnreadMailAccount[] = [];
  let mailboxesSearched = 0;
  let undated = 0;

  const started = now().getTime();
  let stopped: Stopped | undefined;

  const stoppedByNow = (): Stopped | undefined => {
    const seconds = Math.floor((now().getTime() - started) / 1000);
    if (stopped === undefined && seconds >= searchTimeBudgetSeconds) {
      stopped = outOfTime(mailboxesSearched, seconds);
    }
    return stopped;
  };

  const readingBodies = async (mailbox: Mailbox, inRange: readonly Email[]): Promise<void> => {
    const read = await mailStore.emailBodies({
      mailbox,
      storeIdentifiers: inRange.map(({ storeIdentifier }) => storeIdentifier),
    });
    if (!read.ok) {
      partlySearchedMailboxes.push({ mailbox, failure: bodiesUnread(mailbox, read.failure) });
      if (await mailIsBusyAfter(mailStore, read.failure)) {
        stopped = mailStoppedAnswering(writtenAddress(mailbox), read.failure);
      }
      return;
    }

    for (const email of inRange) {
      const body = read.value.get(email.storeIdentifier);
      if (body !== undefined) bodies.set(email, body);
    }
    if (read.value.size < inRange.length) {
      const failure = bodiesOutOfTime(read.value.size, inRange.length);
      partlySearchedMailboxes.push({ mailbox, failure });
    }
  };

  for (const mailAccount of mailAccounts) {
    const stoppedBefore = stoppedByNow();
    if (stoppedBefore !== undefined) {
      unreadMailAccounts.push({ mailAccount, failure: stoppedBefore.mailAccount });
      continue;
    }

    const mailboxes = await mailStore.mailboxes(mailAccount);
    if (!mailboxes.ok) {
      unreadMailAccounts.push({ mailAccount, failure: mailboxes.failure });
      if (await mailIsBusyAfter(mailStore, mailboxes.failure)) {
        stopped = mailStoppedAnswering(mailAccount.name, mailboxes.failure);
      }
      continue;
    }

    const walked =
      mailboxPath === undefined
        ? mailboxes.value.filter(searchedByDefault)
        : mailboxes.value.filter(({ path }) => samePath(path, mailboxPath));
    if (mailboxPath !== undefined && walked.length === 0) {
      return failed(mailboxUnknown(mailAccount, mailboxPath));
    }

    for (const mailbox of walked) {
      const stoppedAtMailbox = stoppedByNow();
      if (stoppedAtMailbox !== undefined) {
        unsearchedMailboxes.push({ mailbox, failure: stoppedAtMailbox.mailbox });
        continue;
      }

      const read = await mailStore.emailsInRange({ mailbox, range, ceiling: searchCeiling });
      if (!read.ok) {
        unsearchedMailboxes.push({ mailbox, failure: read.failure });
        if (await mailIsBusyAfter(mailStore, read.failure)) {
          stopped = mailStoppedAnswering(writtenAddress(mailbox), read.failure);
        }
        continue;
      }

      mailboxesSearched += 1;
      undated += read.value.undated;
      emails.push(...read.value.emails);

      const oldest = read.value.emails.at(-1);
      if (read.value.truncated && oldest !== undefined) {
        truncatedMailboxes.push({ mailbox, reachedBack: oldest.receivedAt });
      }

      // A body read is asked for only while there is still time to start one.
      if (readBodies && read.value.emails.length > 0 && stoppedByNow() === undefined) {
        await readingBodies(mailbox, read.value.emails);
      }
    }
  }

  return succeeded({
    emails,
    bodies,
    mailboxesSearched,
    undated,
    truncatedMailboxes,
    unsearchedMailboxes,
    partlySearchedMailboxes,
    unreadMailAccounts,
  });
};
