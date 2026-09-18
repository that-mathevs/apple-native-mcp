import { z } from "zod";

import type { ListedReminders } from "../../application/reminders/list-reminders.js";
import type { Outcome } from "../../domain/failure.js";
import {
  defaultLimit,
  greatestLimit,
  type Due,
  type Reminder,
} from "../../domain/reminders/reminder.js";
import { dayIn, writtenDay, writtenWallClock } from "../../domain/time-zone.js";
import { refusing, reporting, type ToolResult } from "../result.js";
import { reminderListRecord } from "./records.js";

/** What every index of reminders accepts: which reminder list, and which page. */
export const reminderIndexInput = {
  reminderList: z
    .string()
    .optional()
    .describe(
      "One reminder list, by its identifier or its exact title. Defaults to every one. A " +
        "title that reminder lists in two accounts share is refused: ask again by identifier.",
    ),
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

type ReminderIndexArguments = {
  reminderList?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

/** The arguments as a request, leaving out what was not given. */
export const asRequest = ({
  reminderList,
  limit,
  offset,
}: ReminderIndexArguments): { reminderList?: string; limit?: number; offset?: number } => ({
  ...(reminderList === undefined ? {} : { reminderList }),
  ...(limit === undefined ? {} : { limit }),
  ...(offset === undefined ? {} : { offset }),
});

/** A reminder as every reminders tool reports it: never its notes (ADR-0006). */
export const reminderRecordOutput = z.object({
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
});

export const reminderIndexOutput = {
  reminders: z.array(reminderRecordOutput),
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

export const reminderRecord = (reminder: Reminder, timeZone: string): Record<string, unknown> => ({
  identifier: reminder.identifier,
  title: reminder.title,
  isCompleted: reminder.isCompleted,
  ...(reminder.due === undefined ? {} : { due: dueRecord(reminder.due, timeZone) }),
  reminderList: { ...reminder.reminderList },
});

/** An index of reminders as a record, or the failure that stopped it. */
export const reportingReminders = (
  listed: Outcome<ListedReminders>,
  timeZone: string,
): ToolResult => {
  if (!listed.ok) return refusing(listed.failure);

  const { reminders, reminderLists, reminderListsUnread, includesCompleted, nextOffset } =
    listed.value;
  return reporting({
    reminders: reminders.map((reminder) => reminderRecord(reminder, timeZone)),
    coverage: {
      reminderLists,
      reminderListsUnread: reminderListsUnread.map((reminderList) => ({ ...reminderList })),
      includesCompleted,
      truncated: nextOffset !== undefined,
      ...(nextOffset === undefined ? {} : { nextOffset }),
    },
  });
};
