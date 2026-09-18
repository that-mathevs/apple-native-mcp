import { z } from "zod";

import {
  listMailboxes,
  type ListMailboxesDependencies,
} from "../../application/mail/list-mailboxes.js";
import { mailboxRoles } from "../../domain/mail/mailbox.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import {
  mailAccountNamed,
  mailAccountNamedOf,
  namedFailureRecord,
  unreadMailAccountsRecord,
  unreadMailAccountsRecordOf,
} from "./records.js";

const listMailboxesOutput = {
  mailboxes: z.array(
    z.object({
      mailAccount: mailAccountNamed,
      path: z.array(z.string()),
      role: z.enum(mailboxRoles).optional(),
    }),
  ),
  localMailboxes: z
    .array(z.object({ path: z.array(z.string()), role: z.enum(mailboxRoles).optional() }))
    .describe("Mailboxes kept on this Mac under no mail account, each by its path alone."),
  unreadMailAccounts: unreadMailAccountsRecord,
  localMailboxesUnread: namedFailureRecord
    .optional()
    .describe("Why the local mailboxes are missing from this answer, when they are."),
};

export const listMailboxesTool = (dependencies: ListMailboxesDependencies): Tool =>
  tool({
    name: "list_mailboxes",
    title: "List mailboxes",
    description:
      "Every mailbox in every mail account, each with its account and its path inside that " +
      "account, outermost name first. Names repeat across accounts; an account and a path " +
      "together don't. A role (inbox, drafts, sent, junk, trash) is Mail's own answer and is " +
      "absent otherwise: never infer one from a name. Mailboxes kept on this Mac under no mail " +
      "account are local mailboxes, listed apart, each by its path alone: Mail's own Outbox " +
      "is one, and has no role here. The other Mail tools cannot look inside a local mailbox.",
    input: {},
    output: listMailboxesOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async () => {
      const listed = await listMailboxes(dependencies);
      if (!listed.ok) return refusing(listed.failure);

      const mailboxes = listed.value.mailboxes.map(({ mailAccount, path, role }) => ({
        mailAccount: mailAccountNamedOf(mailAccount),
        path: [...path],
        ...(role === undefined ? {} : { role }),
      }));
      const { localMailboxes, localMailboxesUnread } = listed.value;
      return reporting({
        mailboxes,
        localMailboxes: localMailboxes.map(({ path, role }) => ({
          path: [...path],
          ...(role === undefined ? {} : { role }),
        })),
        unreadMailAccounts: unreadMailAccountsRecordOf(listed.value.unreadMailAccounts),
        ...(localMailboxesUnread === undefined
          ? {}
          : { localMailboxesUnread: { ...localMailboxesUnread } }),
      });
    },
  });
