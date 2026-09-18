import { z } from "zod";

import {
  createEvent,
  type CreateEventDependencies,
} from "../../application/calendar/create-event.js";
import { dayWritten } from "../../domain/time-zone.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";
import { asEventRecord, eventRecord } from "./event-record.js";

const instant = z.iso.datetime({ offset: true });

const notBlank = z.string().refine((text) => text.trim() !== "", "A title has to say something.");

const createEventInput = {
  title: notBlank,
  start: instant.optional().describe("The instant a timed event starts, with its offset."),
  end: instant.optional().describe("The instant a timed event ends, with its offset."),
  firstDay: z.iso
    .date()
    .optional()
    .describe("An all-day event's day, or its first, as YYYY-MM-DD, in place of a start and end."),
  lastDay: z.iso
    .date()
    .optional()
    .describe("The last day of an all-day event that covers several. Defaults to the first."),
  calendarIdentifier: z
    .string()
    .min(1)
    .optional()
    .describe("The identifier of the calendar to create it in. Defaults to the default calendar."),
  location: z.string().optional(),
  notes: z.string().optional(),
  evenIfDuplicate: z
    .boolean()
    .optional()
    .describe("Create it even though an event with the same title already overlaps that time."),
};

export const createEventTool = (dependencies: CreateEventDependencies): Tool =>
  tool({
    name: "create_event",
    title: "Create a calendar event",
    description:
      "A new event, in the user's default calendar unless a calendar identifier is given, " +
      "reporting the calendar used and the times the store saved. Refused when an event with " +
      "the same title already overlaps that time, unless a duplicate is asked for.",
    input: createEventInput,
    output: {
      outcome: z
        .enum(["created", "unconfirmed"])
        .describe(
          "Unconfirmed: the event may have been created, but the store could not show it. " +
            "Look for it before creating it again.",
        ),
      event: eventRecord.optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    capability: "create_event",
    call: async (request) => {
      const { start, end, firstDay, lastDay, calendarIdentifier, location, notes } = request;

      const created = await createEvent(dependencies, {
        title: request.title,
        ...(start === undefined ? {} : { start: new Date(start) }),
        ...(end === undefined ? {} : { end: new Date(end) }),
        ...(firstDay === undefined ? {} : { firstDay: dayWritten(firstDay) }),
        ...(lastDay === undefined ? {} : { lastDay: dayWritten(lastDay) }),
        ...(calendarIdentifier === undefined ? {} : { calendarIdentifier }),
        ...(location === undefined ? {} : { location }),
        ...(notes === undefined ? {} : { notes }),
        ...(request.evenIfDuplicate === undefined
          ? {}
          : { evenIfDuplicate: request.evenIfDuplicate }),
      });

      if (!created.ok) return refusing(created.failure);

      const { event, confirmed } = created.value;

      return reporting({
        outcome: confirmed ? "created" : "unconfirmed",
        ...(event === undefined ? {} : { event: asEventRecord(event, dependencies.timeZone) }),
      });
    },
  });
