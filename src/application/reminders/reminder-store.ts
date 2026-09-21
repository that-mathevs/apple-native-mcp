import type { Outcome } from "../../domain/failure.js";
import type { NewReminder } from "../../domain/reminders/new-reminder.js";
import type { Reminder, ReminderList } from "../../domain/reminders/reminder.js";

/** Which reminders to read: those in these reminder lists, open ones only unless completed too. */
export type RemindersWanted = {
  /** The identifiers of the reminder lists to read. */
  readonly reminderLists: readonly string[];
  readonly includeCompleted: boolean;
  /**
   * Text a reminder's title or notes has to mention, ignoring case. The store matches it, since
   * notes never leave it, and compares it only: it is never a pattern, a query or a script.
   */
  readonly matching?: string;
};

/** What a read found, and the reminder lists that did not answer within the time budget. */
export type RemindersRead = {
  readonly reminders: readonly Reminder[];
  /** Identifiers of the reminder lists asked that did not answer in time. */
  readonly unreadReminderLists: readonly string[];
};

/**
 * What became of a new reminder. Confirmed means the store showed it afterwards; unconfirmed
 * means it may exist, and is never a failure, since a retry after one is how copies are made.
 */
export type CreatedReminder = {
  readonly reminder?: Reminder;
  readonly confirmed: boolean;
  /** How many alerts the store holds on it, when it could be read back: a due time adds none. */
  readonly alerts?: number;
  /** Whether the store holds notes on it, when it could be read back. */
  readonly hasNotes?: boolean;
};

/**
 * The store reminders are read from and created in. The helper implements it; a fake stands in
 * for specs.
 *
 * Completed reminders are left out by the store itself, not after it answers: years of them
 * are what made upstream's reads time out (upstream #53).
 */
export type ReminderStore = {
  reminderLists: () => Promise<Outcome<readonly ReminderList[]>>;
  reminders: (wanted: RemindersWanted) => Promise<Outcome<RemindersRead>>;
  /** The reminder list the user set for new reminders, or nothing when there is none. */
  defaultReminderList: () => Promise<Outcome<ReminderList | undefined>>;
  create: (reminder: NewReminder) => Promise<Outcome<CreatedReminder>>;
};
