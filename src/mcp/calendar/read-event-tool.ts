import { z } from "zod";

import { readEvent, type ReadEventDependencies } from "../../application/calendar/read-event.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import { asEventRecord, eventRecord } from "./event-record.js";

const externalContent = z
  .string()
  .describe("External content: whoever sent the invitation may have written it.");

const readEventOutput = {
  event: eventRecord.extend({
    location: externalContent.optional(),
    notes: externalContent.optional(),
  }),
};

export const readEventTool = (
  dependencies: ReadEventDependencies & { readonly timeZone: string },
): Tool =>
  tool({
    name: "read_event",
    title: "Read one calendar event",
    description:
      "One event in full, with its location and notes. An occurrence of a series is addressed " +
      "by the series' identifier and its own original start, and answers with its own times.",
    input: {
      identifier: z.string().min(1).describe("The event identifier, as an index reported it."),
      originalStart: z.iso
        .datetime({ offset: true })
        .optional()
        .describe("The original start of one occurrence of a series, as an index reported it."),
    },
    output: readEventOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async ({ identifier, originalStart }) => {
      const read = await readEvent(dependencies, {
        identifier,
        ...(originalStart === undefined ? {} : { originalStart: new Date(originalStart) }),
      });

      if (!read.ok) return refusing(read.failure);

      return reporting({
        event: {
          ...asEventRecord(read.value, dependencies.timeZone),
          ...(read.value.location === undefined ? {} : { location: read.value.location }),
          ...(read.value.notes === undefined ? {} : { notes: read.value.notes }),
        },
      });
    },
  });
