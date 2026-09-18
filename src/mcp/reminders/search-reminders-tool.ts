import { z } from "zod";

import { searchReminders } from "../../application/reminders/search-reminders.js";
import { tool, type Tool } from "../tool.js";
import type { ListRemindersToolDependencies } from "./list-reminders-tool.js";
import {
  asRequest,
  reminderIndexInput,
  reminderIndexOutput,
  reportingReminders,
} from "./reminder-index.js";

export const searchRemindersTool = (dependencies: ListRemindersToolDependencies): Tool =>
  tool({
    name: "search_reminders",
    title: "Search reminders",
    description:
      "The reminders whose title or notes mention some text, ignoring case, open and completed " +
      "alike, the open ones first and the completed ones marked. The text is matched as it is " +
      "written: it is not a pattern. Notes are searched but never reported.",
    input: {
      text: z
        .string()
        .refine((text) => text.trim() !== "", "Search text has to say something.")
        .describe("The text to look for, matched exactly as written."),
      ...reminderIndexInput,
    },
    output: reminderIndexOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async ({ text, ...index }) =>
      reportingReminders(
        await searchReminders(dependencies, { text, ...asRequest(index) }),
        dependencies.timeZone,
      ),
  });
