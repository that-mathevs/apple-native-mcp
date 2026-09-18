import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { LocalMailbox, Mailbox } from "../../domain/mail/mailbox.js";
import { notAskedOfABusyMail } from "./a-busy-mail.js";
import { askingEachMailAccount, noneRead, type UnreadMailAccount } from "./each-mail-account.js";
import type { MailStore } from "./mail-store.js";

export type ListMailboxesDependencies = {
  readonly mailStore: MailStore;
};

export type MailboxesListed = {
  readonly mailboxes: readonly Mailbox[];
  readonly localMailboxes: readonly LocalMailbox[];
  readonly unreadMailAccounts: readonly UnreadMailAccount[];
  /** Why the local mailboxes are missing from the answer, when they are. */
  readonly localMailboxesUnread?: NamedFailure;
};

// #7: a Mail that has stopped answering stays busy for minutes, so nothing more is asked of it.
const localMailboxesNotAsked = ({ mailAccount, failure }: UnreadMailAccount): NamedFailure =>
  notAskedOfABusyMail(
    {
      code: "local-mailboxes-not-asked",
      what: "the local mailboxes were asked for",
      again: "Ask",
    },
    mailAccount.name,
    failure,
  );

/**
 * Every mailbox: each mail account's, asked for one mail account after another, and then the
 * local mailboxes, which belong to no mail account, in a request of their own. So a failure to
 * read those costs no mail account's mailboxes, no mail account failing costs them, and they are
 * never filed under an account that is not one.
 *
 * Nothing answering is a failure, never an empty answer that reads as "there are none": the call
 * is refused when no mail account answered and there is no local mailbox to report either.
 */
export const listMailboxes = async ({
  mailStore,
}: ListMailboxesDependencies): Promise<Outcome<MailboxesListed>> => {
  const asked = await askingEachMailAccount(
    mailStore,
    {},
    async (mailAccount) => await mailStore.mailboxes(mailAccount),
  );
  if (!asked.ok) return asked;

  const { read, unreadMailAccounts, mailStoppedAnsweringAt } = asked.value;
  const local =
    mailStoppedAnsweringAt === undefined
      ? await mailStore.localMailboxes()
      : failed<never>(localMailboxesNotAsked(mailStoppedAnsweringAt));
  const localMailboxes = local.ok ? local.value : [];

  const noMailAccountAnswered = read.length === 0 && unreadMailAccounts.length > 0;
  if (noMailAccountAnswered && localMailboxes.length === 0) {
    return failed(noneRead(unreadMailAccounts, "no mailbox was listed"));
  }

  return succeeded({
    mailboxes: read.flat(),
    localMailboxes,
    unreadMailAccounts,
    ...(local.ok ? {} : { localMailboxesUnread: local.failure }),
  });
};
