import { z } from "zod";

import {
  createReminder,
  type CreateReminderDependencies,
} from "../../application/reminders/create-reminder.js";
import { dayWritten, instantWritten } from "../../domain/time-zone.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import { reminderRecord, reminderRecordOutput } from "./reminder-index.js";

const notBlank = z.string().refine((text) => text.trim() !== "", "A title has to say something.");

const createReminderInput = {
  title: notBlank,
  reminderList: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The reminder list, by its identifier or its exact title. Defaults to the default " +
        "reminder list. A title that lists in two accounts share is refused.",
    ),
  dueDate: z.iso
    .date()
    .optional()
    .describe("The day it is due, as YYYY-MM-DD, with no time of day."),
  dueTime: z.iso
    .datetime({ local: true, offset: true })
    .optional()
    .describe(
      "The time it is due. With an offset it is that instant; without one it is the time on " +
        "the user's own clock.",
    ),
  evenIfDuplicate: z
    .boolean()
    .optional()
    .describe("Create it even though an open reminder in that list already has the same title."),
};

export type CreateReminderToolDependencies = CreateReminderDependencies & {
  readonly timeZone: string;
};

export const createReminderTool = (dependencies: CreateReminderToolDependencies): Tool =>
  tool({
    name: "create_reminder",
    title: "Create a reminder",
    description:
      "A new reminder, in the default reminder list unless one is named, reporting the list " +
      "used and when it is due as the store saved it. A due date has no time of day; a due " +
      "time sets no alert. Refused when an open reminder in that list has the same title, " +
      "unless a duplicate is asked for.",
    input: createReminderInput,
    output: {
      outcome: z
        .enum(["created", "unconfirmed"])
        .describe(
          "Unconfirmed: the reminder may have been created, but the store could not show it. " +
            "Look for it before creating it again.",
        ),
      reminder: reminderRecordOutput.optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    capability: "create_reminder",
    call: async ({ title, reminderList, dueDate, dueTime, evenIfDuplicate }) => {
      const { timeZone } = dependencies;
      const created = await createReminder(dependencies, {
        title,
        ...(reminderList === undefined ? {} : { reminderList }),
        ...(dueDate === undefined ? {} : { dueDate: dayWritten(dueDate) }),
        ...(dueTime === undefined ? {} : { dueTime: instantWritten(timeZone, dueTime) }),
        ...(evenIfDuplicate === undefined ? {} : { evenIfDuplicate }),
      });

      if (!created.ok) return refusing(created.failure);

      const { reminder, confirmed } = created.value;
      return reporting({
        outcome: confirmed ? "created" : "unconfirmed",
        ...(reminder === undefined ? {} : { reminder: reminderRecord(reminder, timeZone) }),
      });
    },
  });
