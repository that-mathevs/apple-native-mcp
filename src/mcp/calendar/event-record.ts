import { z } from "zod";

import type { Occurrence } from "../../domain/calendar/event.js";
import { dayIn, writtenDay } from "../../domain/time-zone.js";
import { calendarAccountRecord } from "../calendar-account-record.js";

const calendar = z.object({
  identifier: z.string(),
  title: z.string(),
  account: calendarAccountRecord,
});

/** One event as an index reports it, which a detail read adds to. */
export const eventRecord = z.object({
  identifier: z.string(),
  title: z.string(),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  isAllDay: z.boolean(),
  firstDay: z.iso
    .date()
    .optional()
    .describe("Set on an all-day event: its day, or its first, in the user's time zone."),
  lastDay: z.iso.date().optional().describe("Set on an all-day event: its last day."),
  originalStart: z.iso
    .datetime()
    .optional()
    .describe("Set on an occurrence of a series: with the identifier, it addresses this one."),
  calendar,
});

/**
 * An all-day event occupies days, not instants, and its instants read as the wrong day to
 * anyone east or west of where they were written. So its days are said outright.
 */
const daysOf = ({ start, end }: Occurrence, timeZone: string): Record<string, string> => ({
  firstDay: writtenDay(dayIn(timeZone, start)),
  lastDay: writtenDay(dayIn(timeZone, new Date(end.getTime() - 1))),
});

export const asEventRecord = (
  occurrence: Occurrence,
  timeZone: string,
): Record<string, unknown> => ({
  identifier: occurrence.identifier,
  title: occurrence.title,
  start: occurrence.start.toISOString(),
  end: occurrence.end.toISOString(),
  isAllDay: occurrence.isAllDay,
  ...(occurrence.isAllDay ? daysOf(occurrence, timeZone) : {}),
  ...(occurrence.originalStart === undefined
    ? {}
    : { originalStart: occurrence.originalStart.toISOString() }),
  calendar: {
    identifier: occurrence.calendar.identifier,
    title: occurrence.calendar.title,
    account: {
      identifier: occurrence.calendar.account.identifier,
      title: occurrence.calendar.account.title,
    },
  },
});
