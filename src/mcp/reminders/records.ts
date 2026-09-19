import { z } from "zod";

import { calendarAccountRecord } from "../calendar-account-record.js";

/** A reminder list as both reminders tools report it, on its own and beside each reminder. */
export const reminderListRecord = z.object({
  identifier: z.string(),
  title: z.string(),
  account: calendarAccountRecord,
});
