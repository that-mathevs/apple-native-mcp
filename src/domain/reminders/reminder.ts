import type { LocalDay } from "../time-zone.js";

/**
 * A container of reminders in one calendar account. Titles repeat across accounts; the
 * identifier doesn't.
 */
export type ReminderList = {
  readonly identifier: string;
  readonly title: string;
  readonly account: string;
};

/**
 * When a reminder is due: a due date, which is a whole day with no time of day, or a due time,
 * which is an instant. A due date is never given a time, not even midnight (upstream #34).
 */
export type Due = { readonly day: LocalDay } | { readonly at: Date };

/** An item in a reminder list. It is open until it is completed. */
export type Reminder = {
  readonly identifier: string;
  readonly title: string;
  readonly isCompleted: boolean;
  readonly due?: Due;
  readonly reminderList: ReminderList;
};

/**
 * Reminders in the order a reader expects them: open ones before completed ones, so nothing
 * done reads as still to do, and by title within each so the same lists always read the same.
 */
export const openBeforeCompleted = (reminders: readonly Reminder[]): readonly Reminder[] =>
  [...reminders].sort(
    (left, right) =>
      Number(left.isCompleted) - Number(right.isCompleted) || left.title.localeCompare(right.title),
  );

/** What a reminder list's name comes to among the reminder lists there are. */
export type ReminderListNamed =
  | { readonly kind: "one"; readonly list: ReminderList }
  | { readonly kind: "none" }
  | { readonly kind: "several"; readonly lists: readonly ReminderList[] };

/**
 * The reminder list a caller means, by its identifier or else by its exact title. A title two
 * accounts share names several, and choosing between them is the caller's to do, never ours.
 */
export const reminderListNamed = (
  reminderLists: readonly ReminderList[],
  name: string,
): ReminderListNamed => {
  const byIdentifier = reminderLists.find(({ identifier }) => identifier === name);
  if (byIdentifier) return { kind: "one", list: byIdentifier };

  const byTitle = reminderLists.filter(({ title }) => title === name);
  const [only] = byTitle;
  if (byTitle.length === 1 && only) return { kind: "one", list: only };

  return byTitle.length === 0 ? { kind: "none" } : { kind: "several", lists: byTitle };
};
