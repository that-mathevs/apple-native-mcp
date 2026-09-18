import { z } from "zod";

import type { UnreadMailAccount } from "../../application/mail/each-mail-account.js";
import type { ReferencedEmail } from "../../domain/mail/email.js";
import type { MailboxAddress } from "../../domain/mail/mailbox.js";

export const mailAccountRecord = z.object({
  identifier: z.string(),
  name: z.string(),
  emailAddresses: z.array(z.string()),
});

export const namedFailureRecord = z.object({
  code: z.string(),
  sentence: z.string(),
  setting: z.string().optional(),
  evidence: z.string().optional(),
});

export const mailAccountNamed = z.object({ identifier: z.string(), name: z.string() });

type MailAccountNamed = z.infer<typeof mailAccountNamed>;

export const mailAccountNamedOf = ({ identifier, name }: MailAccountNamed): MailAccountNamed => ({
  identifier,
  name,
});

export const unreadMailAccountsRecord = z
  .array(
    z.object({
      mailAccount: mailAccountNamed,
      failure: namedFailureRecord,
    }),
  )
  .describe("Mail accounts that are missing from this answer, each with why.");

export const unreadMailAccountsRecordOf = (
  unread: readonly UnreadMailAccount[],
): z.infer<typeof unreadMailAccountsRecord> =>
  unread.map(({ mailAccount, failure }) => ({
    mailAccount: mailAccountNamedOf(mailAccount),
    failure: { ...failure },
  }));

export const mailboxNamed = z.object({ mailAccount: mailAccountNamed, path: z.array(z.string()) });

export const mailboxNamedOf = ({
  mailAccount,
  path,
}: MailboxAddress): z.infer<typeof mailboxNamed> => ({
  mailAccount: mailAccountNamedOf(mailAccount),
  path: [...path],
});

export const emailRecord = z.object({
  reference: z
    .object({
      mailAccount: z.string(),
      mailboxPath: z.array(z.string()),
      messageId: z.string(),
    })
    .describe("What addresses exactly this email in a later call. Pass it back unchanged."),
  mailbox: mailboxNamed,
  subject: z.string(),
  sender: z.string(),
  receivedAt: z.iso.datetime(),
  isRead: z.boolean(),
});

export const emailRecordOf = (email: ReferencedEmail): z.infer<typeof emailRecord> => ({
  reference: {
    mailAccount: email.reference.mailAccount,
    mailboxPath: [...email.reference.mailboxPath],
    messageId: email.reference.messageId,
  },
  mailbox: mailboxNamedOf(email.mailbox),
  subject: email.subject,
  sender: email.sender,
  receivedAt: email.receivedAt.toISOString(),
  isRead: email.isRead,
});
