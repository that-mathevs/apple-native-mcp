import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import { type MailAccount, theMailAccountNamed } from "../../domain/mail/mail-account.js";
import { mailIsBusyAfter, notAskedOfABusyMail } from "./a-busy-mail.js";
import type { MailStore } from "./mail-store.js";

/** A mail account that is missing from an answer, and why. */
export type UnreadMailAccount = {
  readonly mailAccount: Pick<MailAccount, "identifier" | "name">;
  readonly failure: NamedFailure;
};

/** What each mail account answered, and the ones that did not. */
export type MailAccountsAsked<Read> = {
  readonly read: readonly Read[];
  readonly unreadMailAccounts: readonly UnreadMailAccount[];
  /** The mail account at which Mail stopped answering, when it did: nothing more is asked of it. */
  readonly mailStoppedAnsweringAt?: UnreadMailAccount;
};

/** A mail account left alone because Mail had stopped answering, named after what showed it. */
export const mailAccountNotAsked = (stoppedAt: string, failure: NamedFailure): NamedFailure =>
  notAskedOfABusyMail(
    { code: "mail-account-not-asked", what: "this mail account was asked about", again: "Ask" },
    stoppedAt,
    failure,
  );

/** Nothing answering is a failure, never an empty answer that reads as "there is none". */
export const noneRead = (unread: readonly UnreadMailAccount[], nothing: string): NamedFailure => ({
  code: "mail-accounts-unread",
  sentence: `None of the ${String(unread.length)} mail accounts could be read, so ${nothing}.`,
  evidence: unread
    .map(({ mailAccount, failure }) => `${mailAccount.name}: ${failure.code}`)
    .join("; "),
});

/**
 * Every mail account, or the one a caller named: by its identifier, its exact name or one of its
 * email addresses. A name that means none, or more than one, is refused and nothing is read.
 */
export const mailAccountsToAsk = async (
  mailStore: MailStore,
  only: string | undefined,
): Promise<Outcome<readonly MailAccount[]>> => {
  const every = await mailStore.mailAccounts();
  if (!every.ok || only === undefined) return every;

  const named = theMailAccountNamed(every.value, only, "Nothing was read.");
  return named.ok ? succeeded([named.value]) : named;
};

/**
 * Ask every mail account the same thing, one after another: Mail answers one request at a time,
 * and one covering every account is what hung it (brightline 304f384). Each account answers or
 * fails on its own, so one that fails costs its own answer and nobody else's. A Mail that has
 * stopped answering ends the asking, and every account after that is named as not asked.
 *
 * `nothing` says what is missing when no mail account answered: "no mailbox was listed". `only`
 * names one mail account to ask alone, and then its failure is the whole answer's. A caller with
 * more to report than the mail accounts hold leaves `nothing` out, and decides that for itself.
 */
export const askingEachMailAccount = async <Read>(
  mailStore: MailStore,
  { nothing, only }: { readonly nothing?: string | undefined; readonly only?: string | undefined },
  ask: (mailAccount: MailAccount) => Promise<Outcome<Read>>,
): Promise<Outcome<MailAccountsAsked<Read>>> => {
  const accounts = await mailAccountsToAsk(mailStore, only);
  if (!accounts.ok) return accounts;

  const read: Read[] = [];
  const unreadMailAccounts: UnreadMailAccount[] = [];
  let stopped: UnreadMailAccount | undefined;

  for (const mailAccount of accounts.value) {
    if (stopped !== undefined) {
      const failure = mailAccountNotAsked(stopped.mailAccount.name, stopped.failure);
      unreadMailAccounts.push({ mailAccount, failure });
      continue;
    }

    const answered = await ask(mailAccount);
    if (answered.ok) {
      read.push(answered.value);
      continue;
    }

    const unread = { mailAccount, failure: answered.failure };
    unreadMailAccounts.push(unread);
    if (await mailIsBusyAfter(mailStore, answered.failure)) stopped = unread;
  }

  const [alone] = unreadMailAccounts;
  if (only !== undefined && alone !== undefined) return failed(alone.failure);

  const noneAnswered =
    accounts.value.length > 0 && unreadMailAccounts.length === accounts.value.length;
  if (noneAnswered && nothing !== undefined) return failed(noneRead(unreadMailAccounts, nothing));

  return succeeded({
    read,
    unreadMailAccounts,
    ...(stopped === undefined ? {} : { mailStoppedAnsweringAt: stopped }),
  });
};
