import { z } from "zod";

/** A calendar account as every calendar and reminders tool reports it: one shape for both. */
export const calendarAccountRecord = z.object({
  identifier: z.string(),
  title: z.string(),
});
