import { z } from "zod";

import {
  listCalendars,
  type ListCalendarsDependencies,
} from "../../application/calendar/list-calendars.js";
import { calendarAccountRecord } from "../calendar-account-record.js";
import { refusing, reporting } from "../result.js";
import { tool, type Tool } from "../tool.js";

const listCalendarsOutput = {
  calendars: z.array(
    z.object({
      identifier: z.string(),
      title: z.string(),
      account: calendarAccountRecord,
      acceptsNewEvents: z.boolean(),
    }),
  ),
  coverage: z.object({ calendarsExcluded: z.number().int() }),
};

export const listCalendarsTool = (dependencies: ListCalendarsDependencies): Tool =>
  tool({
    name: "list_calendars",
    title: "List calendars",
    description:
      "Every calendar, with the identifier that addresses it, its title, its calendar account " +
      "and whether it accepts new events. Titles repeat across accounts.",
    input: {},
    output: listCalendarsOutput,
    annotations: { readOnlyHint: true, openWorldHint: false },
    capability: undefined,
    call: async () => {
      const listed = await listCalendars(dependencies);

      if (!listed.ok) return refusing(listed.failure);

      return reporting({
        calendars: listed.value.calendars.map((calendar) => ({ ...calendar })),
        coverage: { calendarsExcluded: listed.value.calendarsExcluded },
      });
    },
  });
