import type { NamedFailure, Outcome } from "../failure.js";
import { failed, nothingCreated, succeeded } from "../failure.js";
import type { LocalDay } from "../time-zone.js";
import type { Due, Reminder } from "./reminder.js";

/** A reminder that does not exist yet, and the reminder list it is to be created in. */
export type NewReminder = {
  readonly title: string;
  readonly reminderListIdentifier: string;
  readonly due?: Due;
  /** Stored as given, and never reported back in full: an index holds no notes (ADR-0006). */
  readonly notes?: string;
};

/** How a caller says when a reminder is due: a day, or an instant, or neither. */
export type GivenDue = {
  readonly dueDate?: LocalDay;
  readonly dueTime?: Date;
};

/** When a new reminder is due, or why that can't be told: given both ways it could mean either. */
export const dueFrom = ({ dueDate, dueTime }: GivenDue): Outcome<Due | undefined> => {
  if (dueDate !== undefined && dueTime !== undefined) {
    return failed(
      nothingCreated(
        "reminder-due-invalid",
        "Give a due date or a due time, not both: a due time already says its day.",
      ),
    );
  }

  if (dueDate !== undefined) return succeeded({ day: dueDate });
  if (dueTime !== undefined) return succeeded({ at: dueTime });
  return succeeded(undefined);
};

const sameTitle = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

/**
 * The reminder, among a list's open ones, that a new one would duplicate: one with the same
 * title. How the title is capitalised or padded is not a difference a person would see in their
 * list. Only open reminders are given, since a completed one is done with and asking again is not
 * a copy of it.
 */
export const duplicateOf = (
  title: string,
  openReminders: readonly Reminder[],
): Reminder | undefined => openReminders.find((reminder) => sameTitle(reminder.title, title));

export const duplicate = (already: Reminder): NamedFailure =>
  nothingCreated(
    "reminder-duplicate",
    "An open reminder in that list already has that title. Use that one, or say that a " +
      "duplicate is wanted.",
    JSON.stringify({
      identifier: already.identifier,
      title: already.title,
      reminderList: already.reminderList,
    }),
  );

export const reminderListNeeded: NamedFailure = nothingCreated(
  "reminder-list-needed",
  "There is no default reminder list, so name the reminder list to use.",
);
