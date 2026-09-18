import { z } from "zod";

import type { ListEventsDependencies } from "../../application/calendar/list-events.js";
import { searchEvents } from "../../application/calendar/search-events.js";
import { tool, type Tool } from "../tool.js";
import { asRequest, eventIndexInput, eventIndexOutput, reportingEvents } from "./event-index.js";

export const searchEventsTool = (dependencies: ListEventsDependencies): Tool =>
  tool({
    name: "search_events",
    title: "Search calendar events",
    description:
      "The events in a range whose title, location or notes mention some text, ignoring case. " +
      "The text is matched as it is written: it is not a pattern.",
    input: {
      text: z
        .string()
        .refine((text) => text.trim() !== "", "Search text has to say something.")
        .describe("The text to look for, matched exactly as written."),
      ...eventIndexInput,
    },
    output: eventIndexOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async ({ text, ...index }) =>
      reportingEvents(
        await searchEvents(dependencies, { text, ...asRequest(index) }),
        dependencies.timeZone,
      ),
  });
