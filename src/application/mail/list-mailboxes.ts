import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { MailAccount } from "../../domain/mail/mail-account.js";
import type { Mailbox } from "../../domain/mail/mailbox.js";
import type { MailStore } from "./mail-store.js";

export type ListMailboxesDependencies = {
  readonly mailStore: MailStore;
};

/** A mail account whose mailboxes are missing from the answer, and why. */
export type UnreadMailAccount = {
  readonly mailAccount: MailAccount;
  readonly failure: NamedFailure;
};

export type MailboxesListed = {
  readonly mailboxes: readonly Mailbox[];
  readonly unreadMailAccounts: readonly UnreadMailAccount[];
};

/** Nothing answering is a failure, never an empty answer that reads as "no mailboxes". */
const noneRead = (unread: readonly UnreadMailAccount[]): NamedFailure => ({
  code: "mail-accounts-unread",
  sentence:
    `None of the ${String(unread.length)} mail accounts could be read, ` +
    "so no mailbox was listed.",
  evidence: unread
    .map(({ mailAccount, failure }) => `${mailAccount.name}: ${failure.code}`)
    .join("; "),
});

/** The codes a read fails with when its time budget ran out, in the helper or on the way to it. */
const ranOutOfTime = ({ code }: NamedFailure): boolean =>
  code === "mail_timed_out" || code === "helper-timed-out";

// #7: after one request ran out of time, Mail answered nothing for minutes more, so asking it
// about the next mail account would only wait out another whole time budget.
const notAsked = (stopped: UnreadMailAccount): NamedFailure => ({
  code: "mail-account-not-asked",
  sentence:
    "Mail stopped answering before this mail account was asked about, so it was left alone: " +
    "Mail can stay busy for minutes. Ask again later.",
  evidence: `${stopped.mailAccount.name}: ${stopped.failure.code}`,
});

/**
 * Every mailbox, asked for one mail account after another. Each account answers or fails on its
 * own, so one that fails costs its own mailboxes and nobody else's. One that runs out of its time
 * budget ends the asking, and every account after it is named as not asked.
 */
export const listMailboxes = async ({
  mailStore,
}: ListMailboxesDependencies): Promise<Outcome<MailboxesListed>> => {
  const accounts = await mailStore.mailAccounts();
  if (!accounts.ok) return accounts;

  const mailboxes: Mailbox[] = [];
  const unreadMailAccounts: UnreadMailAccount[] = [];

  let stopped: UnreadMailAccount | undefined;

  for (const mailAccount of accounts.value) {
    if (stopped !== undefined) {
      unreadMailAccounts.push({ mailAccount, failure: notAsked(stopped) });
      continue;
    }

    const read = await mailStore.mailboxes(mailAccount);
    if (read.ok) {
      mailboxes.push(...read.value);
      continue;
    }

    const unread = { mailAccount, failure: read.failure };
    unreadMailAccounts.push(unread);
    if (ranOutOfTime(read.failure)) stopped = unread;
  }

  if (accounts.value.length > 0 && unreadMailAccounts.length === accounts.value.length) {
    return failed(noneRead(unreadMailAccounts));
  }

  return succeeded({ mailboxes, unreadMailAccounts });
};
