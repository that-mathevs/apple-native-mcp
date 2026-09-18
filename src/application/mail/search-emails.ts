import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { ReferencedEmail } from "../../domain/mail/email.js";
import { writtenAddress } from "../../domain/mail/mailbox.js";
import { defaultMatches, searchDays } from "../../domain/mail/search.js";
import { rankingBy, searchQueryFrom } from "../../domain/search-query.js";
import {
  type Bound,
  rangeNotForwards,
  searchRangeOf,
  type SearchRange,
} from "../../domain/search-range.js";
import { mailAccountsToAsk, type UnreadMailAccount } from "./each-mail-account.js";
import type { MailStore } from "./mail-store.js";
import { type MailboxNamedByCaller, mailboxNeedsItsMailAccount } from "./naming-a-mailbox.js";
import { referencing } from "./referencing-emails.js";
import {
  type MailboxFailure,
  type TruncatedMailbox,
  walkingMailboxes,
} from "./walking-mailboxes.js";

export type SearchEmailsDependencies = {
  readonly mailStore: MailStore;
  readonly now: () => Date;
  readonly timeZone: string;
};

export type SearchEmailsRequest = MailboxNamedByCaller & {
  readonly query: string;
  readonly from?: Bound | undefined;
  readonly to?: Bound | undefined;
  /** Whether bodies are read and searched too. They never are unless this says so (#24). */
  readonly searchBodies?: boolean | undefined;
  readonly limit?: number | undefined;
};

/** How far a search reached, all of it stated, so "no match" is never read as "not there". */
export type MailSearchCoverage = {
  /** The parts of an email the search query was matched against (findings MAIL-30). */
  readonly searched: readonly ("subject" | "sender" | "body")[];
  readonly mailboxesSearched: number;
  /** Emails received in the range that the search looked at. */
  readonly scanned: number;
  /** Every email that matched, of which the best are returned. */
  readonly matched: number;
  /** Emails Mail gives no received date, which no range can hold, so none was looked at. */
  readonly undated: number;
  readonly truncatedMailboxes: readonly TruncatedMailbox[];
  /** Bodies read and searched, and the emails in the range whose bodies were not. */
  readonly bodiesRead: number;
  readonly bodiesNotRead: number;
};

export type EmailsFound = {
  readonly range: SearchRange;
  readonly emails: readonly ReferencedEmail[];
  readonly coverage: MailSearchCoverage;
  readonly unsearchedMailboxes: readonly MailboxFailure[];
  readonly partlySearchedMailboxes: readonly MailboxFailure[];
  readonly unreadMailAccounts: readonly UnreadMailAccount[];
};

// chrischall 25d47cc said "no such email" of mail nobody had read.
const reachedNothing = (
  unsearched: readonly MailboxFailure[],
  unread: readonly UnreadMailAccount[],
): NamedFailure => ({
  code: "mail-search-reached-nothing",
  sentence: "No mailbox could be searched, so nothing was found or ruled out.",
  evidence: [
    ...unread.map(({ mailAccount, failure }) => `${mailAccount.name}: ${failure.code}`),
    ...unsearched.map(({ mailbox, failure }) => `${writtenAddress(mailbox)}: ${failure.code}`),
  ].join("; "),
});

/**
 * Emails a search query matches, the best first and the newest first among equals, with the
 * range it covered and how far it reached. The grammar is the one Messages uses, and with no
 * range it covers the last thirty days (#24).
 */
export const searchEmails = async (
  { mailStore, now, timeZone }: SearchEmailsDependencies,
  request: SearchEmailsRequest,
): Promise<Outcome<EmailsFound>> => {
  const range = searchRangeOf(request, now(), timeZone, searchDays);
  if (range.to <= range.from) return failed(rangeNotForwards);
  if (request.mailboxPath !== undefined && request.mailAccount === undefined) {
    return failed(mailboxNeedsItsMailAccount);
  }

  const readBodies = request.searchBodies === true;
  const searched = readBodies
    ? (["subject", "sender", "body"] as const)
    : (["subject", "sender"] as const);

  // A query with nothing to find matches nothing (MSG-84), so nothing is read to find it.
  const query = searchQueryFrom(request.query);
  if (query.words.length === 0 && query.phrases.length === 0) {
    return succeeded({
      range,
      emails: [],
      coverage: {
        searched,
        mailboxesSearched: 0,
        scanned: 0,
        matched: 0,
        undated: 0,
        truncatedMailboxes: [],
        bodiesRead: 0,
        bodiesNotRead: 0,
      },
      unsearchedMailboxes: [],
      partlySearchedMailboxes: [],
      unreadMailAccounts: [],
    });
  }

  const mailAccounts = await mailAccountsToAsk(mailStore, request.mailAccount);
  if (!mailAccounts.ok) return mailAccounts;

  const walk = await walkingMailboxes(
    { mailStore, now },
    { mailAccounts: mailAccounts.value, mailboxPath: request.mailboxPath, range, readBodies },
  );
  if (!walk.ok) return walk;

  const walked = walk.value;
  const reachedNone = walked.unsearchedMailboxes.length + walked.unreadMailAccounts.length > 0;
  if (walked.mailboxesSearched === 0 && reachedNone) {
    return failed(reachedNothing(walked.unsearchedMailboxes, walked.unreadMailAccounts));
  }

  const ranking = rankingBy(query);
  const ranked = walked.emails
    .flatMap((email) => {
      const text = [email.subject, email.sender, walked.bodies.get(email) ?? ""].join("\n");
      const score = ranking(text);
      return score === undefined ? [] : [{ email, score }];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.email.receivedAt.getTime() - left.email.receivedAt.getTime(),
    );

  const best = ranked.slice(0, request.limit ?? defaultMatches).map(({ email }) => email);
  const referenced = await referencing(mailStore, best);

  return succeeded({
    range,
    emails: referenced.emails,
    coverage: {
      searched,
      mailboxesSearched: walked.mailboxesSearched,
      scanned: walked.emails.length,
      matched: ranked.length,
      undated: walked.undated,
      truncatedMailboxes: walked.truncatedMailboxes,
      bodiesRead: walked.bodies.size,
      bodiesNotRead: readBodies ? walked.emails.length - walked.bodies.size : 0,
    },
    unsearchedMailboxes: [...walked.unsearchedMailboxes, ...referenced.unreferencedMailboxes],
    partlySearchedMailboxes: walked.partlySearchedMailboxes,
    unreadMailAccounts: walked.unreadMailAccounts,
  });
};
