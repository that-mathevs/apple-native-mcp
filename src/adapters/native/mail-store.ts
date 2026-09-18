import type {
  EmailBodies,
  EmailsInRange,
  EmailsInRangeWanted,
  EmailWanted,
  LatestEmails,
  LatestEmailsWanted,
  MailStore,
  EmailsAskedAbout,
} from "../../application/mail/mail-store.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import {
  type Correspondent,
  type Email,
  emailBody,
  type EmailInFull,
  type EmailReference,
} from "../../domain/mail/email.js";
import type { MailAccount } from "../../domain/mail/mail-account.js";
import type { Mailbox, MailboxAddress, MailboxRole } from "../../domain/mail/mailbox.js";
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

type EmailRecord = {
  readonly storeIdentifier: number;
  readonly subject: string;
  readonly sender: string;
  readonly receivedAt: string;
  readonly isRead: boolean;
};

type EmailsRecord = {
  readonly emails?: readonly EmailRecord[];
  readonly truncated?: boolean;
  readonly undated?: number;
};

/** A mailbox as a request names it: its mail account's identifier and its path. */
const addressing = ({ mailAccount, path }: MailboxAddress): Record<string, unknown> => ({
  mailAccount: mailAccount.identifier,
  mailbox: path,
});

const asEmailsInRange = (mailbox: MailboxAddress, answered: EmailsRecord): EmailsInRange => ({
  emails: (answered.emails ?? []).map(
    ({ storeIdentifier, subject, sender, receivedAt, isRead }): Email => ({
      mailbox: { mailAccount: mailbox.mailAccount, path: mailbox.path },
      storeIdentifier,
      subject,
      sender,
      receivedAt: new Date(receivedAt),
      isRead,
    }),
  ),
  truncated: answered.truncated === true,
  undated: answered.undated ?? 0,
});

type CorrespondentRecord = { readonly name: string | null; readonly address: string };

type EmailInFullRecord = EmailRecord & {
  readonly mailAccountName: string;
  readonly to: readonly CorrespondentRecord[];
  readonly cc: readonly CorrespondentRecord[];
  readonly bcc: readonly CorrespondentRecord[];
  readonly sentAt: string | null;
  readonly body: string;
  readonly bodyCharacters: number;
  readonly attachments: readonly {
    readonly name: string | null;
    readonly contentType: string | null;
    readonly size: number | null;
  }[];
};

/** What the helper leaves null, a record leaves out. */
const asCorrespondent = ({ name, address }: CorrespondentRecord): Correspondent => ({
  ...(name === null ? {} : { name }),
  address,
});

/** What the helper leaves null, a record leaves out. It fills nothing in, and neither does this. */
const said = <Key extends string, Value>(
  key: Key,
  value: Value | null,
): Partial<Record<Key, Value>> => (value === null ? {} : ({ [key]: value } as Record<Key, Value>));

const asEmailInFull = (reference: EmailReference, email: EmailInFullRecord): EmailInFull => ({
  // The store identifier the email was found under, which is the hint's when the hint held.
  reference: { ...reference, storeIdentifier: email.storeIdentifier },
  mailbox: {
    mailAccount: { identifier: reference.mailAccount, name: email.mailAccountName },
    path: reference.mailboxPath,
  },
  subject: email.subject,
  sender: email.sender,
  to: email.to.map(asCorrespondent),
  cc: email.cc.map(asCorrespondent),
  bcc: email.bcc.map(asCorrespondent),
  receivedAt: new Date(email.receivedAt),
  ...(email.sentAt === null ? {} : { sentAt: new Date(email.sentAt) }),
  isRead: email.isRead,
  body: emailBody(email.body, email.bodyCharacters),
  attachments: email.attachments.map(({ name, contentType, size }) => ({
    ...said("name", name),
    ...said("contentType", contentType),
    ...said("size", size),
  })),
});

/** A JSON object is keyed by text, so a store identifier arrives as its digits. */
const byStoreIdentifier = (answered: Record<string, string> | undefined): Map<number, string> =>
  new Map(Object.entries(answered ?? {}).map(([digits, text]) => [Number(digits), text]));

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

  latestEmails: async ({ mailbox, newest }: LatestEmailsWanted): Promise<Outcome<LatestEmails>> => {
    const answered = await helper.ask({ request: "latest_emails", ...addressing(mailbox), newest });
    if (!answered.ok) return failed(answered.failure);

    const { emails, undated } = asEmailsInRange(mailbox, answered.value);
    return succeeded({ emails, undated });
  },

  emailsInRange: async ({
    mailbox,
    range,
    ceiling,
  }: EmailsInRangeWanted): Promise<Outcome<EmailsInRange>> => {
    const answered = await helper.ask({
      request: "emails_in_range",
      ...addressing(mailbox),
      range: { start: range.from.toISOString(), end: range.to.toISOString() },
      ceiling,
    });
    if (!answered.ok) return failed(answered.failure);

    return succeeded(asEmailsInRange(mailbox, answered.value as EmailsRecord));
  },

  email: async ({
    reference,
    longestBody,
  }: EmailWanted): Promise<Outcome<EmailInFull | undefined>> => {
    const { mailAccount, mailboxPath, messageId, storeIdentifier } = reference;
    const answered = await helper.ask({
      request: "email",
      mailAccount,
      mailbox: mailboxPath,
      messageId,
      storeIdentifier,
      longestBody,
    });
    if (!answered.ok) return failed(answered.failure);

    const { email } = answered.value as { email?: EmailInFullRecord | null };
    return succeeded(
      email === undefined || email === null ? undefined : asEmailInFull(reference, email),
    );
  },

  emailBodies: async ({
    mailbox,
    storeIdentifiers,
  }: EmailsAskedAbout): Promise<Outcome<EmailBodies>> => {
    const answered = await helper.ask({
      request: "email_bodies",
      ...addressing(mailbox),
      emails: storeIdentifiers,
    });
    if (!answered.ok) return failed(answered.failure);

    const { bodies } = answered.value as { bodies?: Record<string, string> };
    return succeeded(byStoreIdentifier(bodies));
  },

  messageIds: async ({
    mailbox,
    storeIdentifiers,
  }: EmailsAskedAbout): Promise<Outcome<ReadonlyMap<number, string>>> => {
    const answered = await helper.ask({
      request: "email_message_ids",
      ...addressing(mailbox),
      emails: storeIdentifiers,
    });
    if (!answered.ok) return failed(answered.failure);

    const { messageIds } = answered.value as { messageIds?: Record<string, string> };
    return succeeded(byStoreIdentifier(messageIds));
  },
});
