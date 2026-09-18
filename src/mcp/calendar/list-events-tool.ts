import type { ListEventsDependencies } from "../../application/calendar/list-events.js";
import { listEvents } from "../../application/calendar/list-events.js";
import { tool, type Tool } from "../tool.js";
import { asRequest, eventIndexInput, eventIndexOutput, reportingEvents } from "./event-index.js";

export const listEventsTool = (dependencies: ListEventsDependencies): Tool =>
  tool({
    name: "list_events",
    title: "List calendar events",
    description:
      "The events in a range, each occurrence of a series separately, earliest first, " +
      "each naming the calendar and account it belongs to.",
    input: eventIndexInput,
    output: eventIndexOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async (request) =>
      reportingEvents(await listEvents(dependencies, asRequest(request)), dependencies.timeZone),
  });
