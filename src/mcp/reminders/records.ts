import { z } from "zod";

/** A reminder list as both reminders tools report it, on its own and beside each reminder. */
export const reminderListRecord = z.object({
  identifier: z.string(),
  title: z.string(),
  account: z.string(),
});
