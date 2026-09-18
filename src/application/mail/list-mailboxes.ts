import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import type { Mailbox } from "../../domain/mail/mailbox.js";
import { askingEachMailAccount, type UnreadMailAccount } from "./each-mail-account.js";
import type { MailStore } from "./mail-store.js";

export type ListMailboxesDependencies = {
  readonly mailStore: MailStore;
};

export type MailboxesListed = {
  readonly mailboxes: readonly Mailbox[];
  readonly unreadMailAccounts: readonly UnreadMailAccount[];
};

/** Every mailbox, asked for one mail account after another. */
export const listMailboxes = async ({
  mailStore,
}: ListMailboxesDependencies): Promise<Outcome<MailboxesListed>> => {
  const asked = await askingEachMailAccount(
    mailStore,
    { nothing: "no mailbox was listed" },
    async (mailAccount) => await mailStore.mailboxes(mailAccount),
  );
  if (!asked.ok) return asked;

  const { read, unreadMailAccounts } = asked.value;
  return succeeded({ mailboxes: read.flat(), unreadMailAccounts });
};
