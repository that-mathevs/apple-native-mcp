import { z } from "zod";

import type { Occurrence } from "../../domain/calendar/event.js";

const calendar = z.object({
  identifier: z.string(),
  title: z.string(),
  account: z.string(),
});

/** One event as an index reports it, which a detail read adds to. */
export const eventRecord = z.object({
  identifier: z.string(),
  title: z.string(),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  isAllDay: z.boolean(),
  originalStart: z.iso
    .datetime()
    .optional()
    .describe("Set on an occurrence of a series: with the identifier, it addresses this one."),
  calendar,
});

export const asEventRecord = (occurrence: Occurrence): Record<string, unknown> => ({
  identifier: occurrence.identifier,
  title: occurrence.title,
  start: occurrence.start.toISOString(),
  end: occurrence.end.toISOString(),
  isAllDay: occurrence.isAllDay,
  ...(occurrence.originalStart === undefined
    ? {}
    : { originalStart: occurrence.originalStart.toISOString() }),
  calendar: {
    identifier: occurrence.calendar.identifier,
    title: occurrence.calendar.title,
    account: occurrence.calendar.account,
  },
});
