import { z } from "zod";

import {
  listMailAccounts,
  type ListMailAccountsDependencies,
} from "../../application/mail/list-mail-accounts.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import { mailAccountRecord } from "./records.js";

const listMailAccountsOutput = {
  mailAccounts: z.array(mailAccountRecord),
};

export const listMailAccountsTool = (dependencies: ListMailAccountsDependencies): Tool =>
  tool({
    name: "list_mail_accounts",
    title: "List mail accounts",
    description:
      "Every account set up in Mail, each with the identifier that addresses it, the name Mail " +
      "shows for it and its email addresses. Names repeat; identifiers don't.",
    input: {},
    output: listMailAccountsOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async () => {
      const listed = await listMailAccounts(dependencies);
      if (!listed.ok) return refusing(listed.failure);

      const mailAccounts = listed.value.map(({ identifier, name, emailAddresses }) => ({
        identifier,
        name,
        emailAddresses: [...emailAddresses],
      }));
      return reporting({ mailAccounts });
    },
  });
