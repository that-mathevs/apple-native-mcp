import { z } from "zod";

import type { ListEventsDependencies } from "../../application/calendar/list-events.js";
import { listEvents } from "../../application/calendar/list-events.js";
import type { Occurrence } from "../../domain/calendar/event.js";
import { defaultRangeDays } from "../../domain/calendar/range.js";
import { refusing, reporting, type ToolResult } from "../result.js";

const instant = z.iso.datetime({ offset: true });

export const listEventsInput = {
  from: instant.optional().describe("The instant the range starts. Defaults to the start of today."),
  to: instant
    .optional()
    .describe(`The instant the range ends. Defaults to ${String(defaultRangeDays)} days on.`),
};

const calendar = z.object({
  identifier: z.string(),
  title: z.string(),
  account: z.string(),
});

/**
 * Both shapes a call can answer with. A refusal is a result carrying a named failure, not a
 * protocol error, so a caller reads the code and knows what to do next.
 */
export const listEventsOutput = {
  range: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }).optional(),
  events: z
    .array(
      z.object({
        identifier: z.string(),
        title: z.string(),
        start: z.iso.datetime(),
        end: z.iso.datetime(),
        isAllDay: z.boolean(),
        calendar,
      }),
    )
    .optional(),
  coverage: z.object({ calendarsUnread: z.number().int() }).optional(),
  failure: z
    .object({
      code: z.string(),
      sentence: z.string(),
      setting: z.string().optional(),
      evidence: z.string().optional(),
    })
    .optional(),
};

const asRecord = (occurrence: Occurrence): Record<string, unknown> => ({
  identifier: occurrence.identifier,
  title: occurrence.title,
  start: occurrence.start.toISOString(),
  end: occurrence.end.toISOString(),
  isAllDay: occurrence.isAllDay,
  calendar: { ...occurrence.calendar },
});

export const callListEvents = async (
  dependencies: ListEventsDependencies,
  request: { from?: string | undefined; to?: string | undefined },
): Promise<ToolResult> => {
  const listed = await listEvents(dependencies, {
    ...(request.from === undefined ? {} : { from: new Date(request.from) }),
    ...(request.to === undefined ? {} : { to: new Date(request.to) }),
  });

  if (!listed.ok) return refusing(listed.failure);

  const { range, occurrences, calendarsUnread } = listed.value;

  return reporting({
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    events: occurrences.map(asRecord),
    coverage: { calendarsUnread },
  });
};
