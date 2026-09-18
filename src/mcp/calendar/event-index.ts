import { z } from "zod";

import type { EventIndex, ListEventsRequest } from "../../application/calendar/list-events.js";
import { defaultLimit, greatestLimit } from "../../domain/calendar/event.js";
import { defaultRangeDays } from "../../domain/calendar/range.js";
import type { Outcome } from "../../domain/failure.js";
import { refusing, reporting, type ToolResult } from "../result.js";
import { asEventRecord, eventRecord } from "./event-record.js";

/** What listing and searching share: how an index of events is asked for, and how it is reported. */

const instant = z.iso.datetime({ offset: true });

export const eventIndexInput = {
  from: instant
    .optional()
    .describe("The instant the range starts. Defaults to the start of today."),
  to: instant
    .optional()
    .describe(`The instant the range ends. Defaults to ${String(defaultRangeDays)} days on.`),
  limit: z
    .number()
    .int()
    .min(1)
    .max(greatestLimit)
    .optional()
    .describe(`The most events to report, earliest first. Defaults to ${String(defaultLimit)}.`),
};

type EventIndexArguments = {
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
};

export const asRequest = ({ from, to, limit }: EventIndexArguments): ListEventsRequest => ({
  ...(from === undefined ? {} : { from: new Date(from) }),
  ...(to === undefined ? {} : { to: new Date(to) }),
  ...(limit === undefined ? {} : { limit }),
});

/** An index of events: small fixed fields, so its size never depends on someone's notes. */
export const eventIndexOutput = {
  range: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }),
  events: z.array(eventRecord),
  coverage: z.object({
    calendarsUnread: z.number().int(),
    calendarsExcluded: z.number().int(),
    truncated: z.boolean(),
  }),
};

export const reportingEvents = (index: Outcome<EventIndex>): ToolResult => {
  if (!index.ok) return refusing(index.failure);

  const { range, occurrences, calendarsUnread, calendarsExcluded, truncated } = index.value;

  return reporting({
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    events: occurrences.map(asEventRecord),
    coverage: { calendarsUnread, calendarsExcluded, truncated },
  });
};
