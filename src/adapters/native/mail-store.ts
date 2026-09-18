import type { MailStore } from "../../application/mail/mail-store.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { MailAccount } from "../../domain/mail/mail-account.js";
import type { Mailbox, MailboxRole } from "../../domain/mail/mailbox.js";
import type { Helper } from "./helper.js";

/**
 * The mail store as the helper answers it.
 *
 * Nothing here decides anything: it asks the helper, one mail account to a request, and turns the
 * records it sends back into the domain's words. Each request has the helper's own time budget,
 * so a mail account that does not answer fails alone.
 */

type MailAccountRecord = {
  readonly identifier: string;
  readonly name: string;
  readonly emailAddresses: readonly string[];
};

type MailboxRecord = {
  readonly path: readonly string[];
  readonly role: MailboxRole | null;
};

export const helperMailStore = (helper: Helper): MailStore => ({
  mailAccounts: async (): Promise<Outcome<readonly MailAccount[]>> => {
    const answered = await helper.ask({ request: "mail_accounts" });
    if (!answered.ok) return failed(answered.failure);

    const { mailAccounts } = answered.value as { mailAccounts?: MailAccountRecord[] };
    return succeeded(
      (mailAccounts ?? []).map(({ identifier, name, emailAddresses }) => ({
        identifier,
        name,
        emailAddresses,
      })),
    );
  },

  mailboxes: async ({ identifier, name }: MailAccount): Promise<Outcome<readonly Mailbox[]>> => {
    const answered = await helper.ask({ request: "mailboxes", mailAccount: identifier });
    if (!answered.ok) return failed(answered.failure);

    const { mailboxes } = answered.value as { mailboxes?: MailboxRecord[] };
    return succeeded(
      (mailboxes ?? []).map(({ path, role }) => ({
        mailAccount: { identifier, name },
        path,
        ...(role === null ? {} : { role }),
      })),
    );
  },
});
