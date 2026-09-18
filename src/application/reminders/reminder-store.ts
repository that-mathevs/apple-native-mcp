import type { Outcome } from "../../domain/failure.js";
import type { Reminder, ReminderList } from "../../domain/reminders/reminder.js";

/** Which reminders to read: those in these reminder lists, open ones only unless completed too. */
export type RemindersWanted = {
  /** The identifiers of the reminder lists to read. */
  readonly reminderLists: readonly string[];
  readonly includeCompleted: boolean;
};

/**
 * The store reminders are read from. The helper implements it; a fake stands in for specs.
 *
 * Completed reminders are left out by the store itself, not after it answers: years of them
 * are what made upstream's reads time out (upstream #53).
 */
export type ReminderStore = {
  reminderLists: () => Promise<Outcome<readonly ReminderList[]>>;
  reminders: (wanted: RemindersWanted) => Promise<Outcome<readonly Reminder[]>>;
};
