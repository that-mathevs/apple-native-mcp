import { z } from "zod";

import {
  listReminderLists,
  type ListReminderListsDependencies,
} from "../../application/reminders/list-reminder-lists.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import { reminderListRecord } from "./records.js";

const listReminderListsOutput = {
  reminderLists: z.array(reminderListRecord),
};

export const listReminderListsTool = (dependencies: ListReminderListsDependencies): Tool =>
  tool({
    name: "list_reminder_lists",
    title: "List reminder lists",
    description:
      "Every reminder list, each with the identifier that addresses it, its title and the " +
      "account it belongs to. Titles repeat across accounts; identifiers don't.",
    input: {},
    output: listReminderListsOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async () => {
      const listed = await listReminderLists(dependencies);
      if (!listed.ok) return refusing(listed.failure);

      const reminderLists = listed.value.map((reminderList) => ({ ...reminderList }));
      return reporting({ reminderLists });
    },
  });
