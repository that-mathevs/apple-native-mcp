import { z } from "zod";

import {
  listMailboxes,
  type ListMailboxesDependencies,
} from "../../application/mail/list-mailboxes.js";
import { mailboxRoles } from "../../domain/mail/mailbox.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";

const mailAccountNamed = z.object({ identifier: z.string(), name: z.string() });

type MailAccountNamed = z.infer<typeof mailAccountNamed>;

const listMailboxesOutput = {
  mailboxes: z.array(
    z.object({
      mailAccount: mailAccountNamed,
      path: z.array(z.string()),
      role: z.enum(mailboxRoles).optional(),
    }),
  ),
  unreadMailAccounts: z
    .array(
      z.object({
        mailAccount: mailAccountNamed,
        failure: z.object({
          code: z.string(),
          sentence: z.string(),
          setting: z.string().optional(),
          evidence: z.string().optional(),
        }),
      }),
    )
    .describe("Mail accounts whose mailboxes are missing from this answer, each with why."),
};

export const listMailboxesTool = (dependencies: ListMailboxesDependencies): Tool =>
  tool({
    name: "list_mailboxes",
    title: "List mailboxes",
    description:
      "Every mailbox in every mail account, each with its account and its path inside that " +
      "account, outermost name first. Names repeat across accounts; an account and a path " +
      "together don't. A role (inbox, drafts, sent, junk, trash) is Mail's own answer and is " +
      "absent where Mail gives none: never infer one from a name. Mailboxes kept on this Mac " +
      "under no mail account are not listed.",
    input: {},
    output: listMailboxesOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async () => {
      const listed = await listMailboxes(dependencies);
      if (!listed.ok) return refusing(listed.failure);

      const named = ({ identifier, name }: MailAccountNamed): MailAccountNamed => ({
        identifier,
        name,
      });

      const mailboxes = listed.value.mailboxes.map(({ mailAccount, path, role }) => ({
        mailAccount: named(mailAccount),
        path: [...path],
        ...(role === undefined ? {} : { role }),
      }));
      const unreadMailAccounts = listed.value.unreadMailAccounts.map(
        ({ mailAccount, failure }) => ({
          mailAccount: named(mailAccount),
          failure: { ...failure },
        }),
      );
      return reporting({ mailboxes, unreadMailAccounts });
    },
  });
