import type { Outcome } from "../../domain/failure.js";
import {
  listReminders,
  type ListedReminders,
  type ListRemindersDependencies,
  type ListRemindersRequest,
} from "./list-reminders.js";

export type SearchRemindersRequest = Omit<
  ListRemindersRequest,
  "includeCompleted" | "matching"
> & { readonly text: string };

/**
 * The reminders whose title or notes mention some text, open and completed alike: a search that
 * skipped either would say "not found" of a reminder that exists (REM-C5). It is the index of the
 * same reminder lists with fewer reminders in it: the same order, pages and coverage.
 */
export const searchReminders = async (
  dependencies: ListRemindersDependencies,
  { text, ...request }: SearchRemindersRequest,
): Promise<Outcome<ListedReminders>> =>
  await listReminders(dependencies, { ...request, includeCompleted: true, matching: text });
