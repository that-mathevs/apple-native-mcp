import { z } from "zod";

import {
  listReminders,
  type ListRemindersDependencies,
} from "../../application/reminders/list-reminders.js";
import { tool, type Tool } from "../tool.js";
import {
  asRequest,
  reminderIndexInput,
  reminderIndexOutput,
  reportingReminders,
} from "./reminder-index.js";

export type ListRemindersToolDependencies = ListRemindersDependencies & {
  readonly timeZone: string;
};

export const listRemindersTool = (dependencies: ListRemindersToolDependencies): Tool =>
  tool({
    name: "list_reminders",
    title: "List reminders",
    description:
      "Open reminders, in every reminder list or in one, each naming its reminder list and " +
      "account. Completed reminders only when asked for, after the open ones. A due date has " +
      "no time of day; a due time is given in the user's time zone with its offset. A " +
      "truncated answer says where the next page starts, and a reminder list that did not " +
      "answer in time is named as unread.",
    input: {
      ...reminderIndexInput,
      includeCompleted: z
        .boolean()
        .default(false)
        .describe("Whether completed reminders are wanted too. They come after the open ones."),
    },
    output: reminderIndexOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async ({ includeCompleted, ...index }) =>
      reportingReminders(
        await listReminders(dependencies, { includeCompleted, ...asRequest(index) }),
        dependencies.timeZone,
      ),
  });
