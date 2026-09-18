import type { Outcome } from "../../domain/failure.js";
import type { MailAccount } from "../../domain/mail/mail-account.js";
import type { MailStore } from "./mail-store.js";

export type ListMailAccountsDependencies = {
  readonly mailStore: MailStore;
};

export const listMailAccounts = async ({
  mailStore,
}: ListMailAccountsDependencies): Promise<Outcome<readonly MailAccount[]>> =>
  await mailStore.mailAccounts();
