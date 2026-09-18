import { z } from "zod";

import {
  listReminders,
  type ListRemindersDependencies,
} from "../../application/reminders/list-reminders.js";
import {
  defaultLimit,
  greatestLimit,
  type Due,
  type Reminder,
} from "../../domain/reminders/reminder.js";
import { dayIn, writtenDay, writtenWallClock } from "../../domain/time-zone.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import { reminderListRecord } from "./records.js";

const listRemindersInput = {
  reminderList: z
    .string()
    .optional()
    .describe(
      "One reminder list, by its identifier or its exact title. Defaults to every one. A " +
        "title that reminder lists in two accounts share is refused: ask again by identifier.",
    ),
  includeCompleted: z
    .boolean()
    .default(false)
    .describe("Whether completed reminders are wanted too. They come after the open ones."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(greatestLimit)
    .optional()
    .describe(`The most reminders to report. Defaults to ${String(defaultLimit)}.`),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Where the page starts: the nextOffset a truncated answer stated. Defaults to 0."),
};

const listRemindersOutput = {
  reminders: z
    .array(
      z.object({
        identifier: z.string(),
        title: z.string(),
        isCompleted: z.boolean(),
        due: z
          .object({
            date: z.iso.date(),
            time: z.iso.datetime({ offset: true }).optional(),
          })
          .optional(),
        reminderList: reminderListRecord,
      }),
    ),
  coverage: z.object({
    reminderLists: z.number().int(),
    reminderListsUnread: z.array(reminderListRecord),
    includesCompleted: z.boolean(),
    truncated: z.boolean(),
    nextOffset: z.number().int().optional(),
  }),
};

/**
 * A due date reads back as a date alone. A due time reads back as the user's clock shows it,
 * with its offset, and with the day it falls on there (upstream #34).
 */
const dueRecord = (due: Due, timeZone: string): Record<string, string> =>
  "day" in due
    ? { date: writtenDay(due.day) }
    : { date: writtenDay(dayIn(timeZone, due.at)), time: writtenWallClock(timeZone, due.at) };

const reminderRecord = (reminder: Reminder, timeZone: string): Record<string, unknown> => ({
  identifier: reminder.identifier,
  title: reminder.title,
  isCompleted: reminder.isCompleted,
  ...(reminder.due === undefined ? {} : { due: dueRecord(reminder.due, timeZone) }),
  reminderList: { ...reminder.reminderList },
});

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
    input: listRemindersInput,
    output: listRemindersOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async (request) => {
      const listed = await listReminders(dependencies, {
        ...(request.reminderList === undefined ? {} : { reminderList: request.reminderList }),
        includeCompleted: request.includeCompleted,
        ...(request.limit === undefined ? {} : { limit: request.limit }),
        ...(request.offset === undefined ? {} : { offset: request.offset }),
      });
      if (!listed.ok) return refusing(listed.failure);

      const { reminders, reminderLists, reminderListsUnread, includesCompleted, nextOffset } =
        listed.value;
      return reporting({
        reminders: reminders.map((reminder) => reminderRecord(reminder, dependencies.timeZone)),
        coverage: {
          reminderLists,
          reminderListsUnread: reminderListsUnread.map((reminderList) => ({ ...reminderList })),
          includesCompleted,
          truncated: nextOffset !== undefined,
          ...(nextOffset === undefined ? {} : { nextOffset }),
        },
      });
    },
  });
