import type { CalendarAccount } from "../calendar-account.js";
import type { NamedFailure, Outcome } from "../failure.js";
import { failed, succeeded } from "../failure.js";
import type { LocalDay } from "../time-zone.js";

/**
 * A container of reminders in one calendar account. Titles repeat across accounts; the
 * identifier doesn't.
 */
export type ReminderList = {
  readonly identifier: string;
  readonly title: string;
  readonly account: CalendarAccount;
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
 * done reads as still to do, then by title. Reminders with one title fall back to their
 * identifier, so the same reminders always read the same way and a page never repeats or skips
 * one.
 */
export const openBeforeCompleted = (reminders: readonly Reminder[]): readonly Reminder[] =>
  [...reminders].sort(
    (left, right) =>
      Number(left.isCompleted) - Number(right.isCompleted) ||
      left.title.localeCompare(right.title) ||
      left.identifier.localeCompare(right.identifier),
  );

/** How many reminders a page holds when the caller names no limit, and the most it may name. */
export const defaultLimit = 100;
export const greatestLimit = 500;

/** One page of reminders, and the offset of the next when there is one. */
export type Page = {
  readonly reminders: readonly Reminder[];
  readonly nextOffset?: number;
};

/** The reminders from an offset, up to a limit. They must already be in reading order. */
export const pageOf = (reminders: readonly Reminder[], offset: number, limit: number): Page => {
  const end = offset + limit;
  return {
    reminders: reminders.slice(offset, end),
    ...(reminders.length > end ? { nextOffset: end } : {}),
  };
};

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

/**
 * What was asked for and the lists that answer to it, as a record: a title is text the user
 * wrote, so it is a field and never part of a sentence (ADR-0006).
 */
const evidence = (name: string, reminderLists: readonly ReminderList[]): string =>
  JSON.stringify({ asked: name, reminderLists });

/**
 * The one reminder list a name means, or the refusal saying why there isn't one, which begins
 * with what did not happen: nothing is ever read from, or created in, a list it guessed at.
 */
export const theReminderListNamed = (
  reminderLists: readonly ReminderList[],
  name: string,
  whatDidNotHappen: string,
): Outcome<ReminderList> => {
  const named = reminderListNamed(reminderLists, name);
  const refusal = (
    code: string,
    sentence: string,
    lists: readonly ReminderList[],
  ): NamedFailure => ({
    code,
    sentence: `${whatDidNotHappen} ${sentence}`,
    evidence: evidence(name, lists),
  });

  switch (named.kind) {
    case "one":
      return succeeded(named.list);
    case "none":
      return failed(
        refusal(
          "reminder-list-unknown",
          "No reminder list has that identifier or title.",
          reminderLists,
        ),
      );
    case "several":
      return failed(
        refusal(
          "reminder-list-ambiguous",
          "Reminder lists in more than one account have that title, so ask by identifier.",
          named.lists,
        ),
      );
  }
};
