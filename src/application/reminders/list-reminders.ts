import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import {
  defaultLimit,
  openBeforeCompleted,
  pageOf,
  reminderListNamed,
  type Reminder,
  type ReminderList,
} from "../../domain/reminders/reminder.js";
import type { ReminderStore } from "./reminder-store.js";

/** What the caller asked for: one reminder list by identifier or title, or every one when none. */
export type ListRemindersRequest = {
  readonly reminderList?: string;
  readonly includeCompleted: boolean;
  /** Text a reminder's title or notes has to mention; every reminder when there is none. */
  readonly matching?: string;
  readonly limit?: number;
  /** How many reminders earlier pages already returned. */
  readonly offset?: number;
};

export type ListedReminders = {
  readonly reminders: readonly Reminder[];
  /** How many reminder lists were asked, so an empty answer says what it covered. */
  readonly reminderLists: number;
  /** The reminder lists asked that did not answer within the time budget. */
  readonly reminderListsUnread: readonly ReminderList[];
  readonly includesCompleted: boolean;
  /** Where the next page starts, when this one left reminders behind. */
  readonly nextOffset?: number;
};

export type ListRemindersDependencies = {
  readonly reminderStore: ReminderStore;
};

/**
 * What was asked for and the lists that answer to it, as a record: a title is text the user
 * wrote, so it is a field and never part of a sentence (ADR-0006).
 */
const evidence = (name: string, reminderLists: readonly ReminderList[]): string =>
  JSON.stringify({ asked: name, reminderLists });

const unknownList = (name: string, reminderLists: readonly ReminderList[]): NamedFailure => ({
  code: "reminder-list-unknown",
  sentence: "Nothing was read: no reminder list has that identifier or title.",
  evidence: evidence(name, reminderLists),
});

const ambiguousList = (name: string, reminderLists: readonly ReminderList[]): NamedFailure => ({
  code: "reminder-list-ambiguous",
  sentence:
    "Nothing was read: reminder lists in more than one account have that title, so ask by " +
    "identifier.",
  evidence: evidence(name, reminderLists),
});

/** The reminder lists a request covers: the one it names, or all of them. */
const reminderListsWanted = (
  reminderLists: readonly ReminderList[],
  name: string | undefined,
): Outcome<readonly ReminderList[]> => {
  if (name === undefined) return succeeded(reminderLists);

  const named = reminderListNamed(reminderLists, name);
  switch (named.kind) {
    case "one":
      return succeeded([named.list]);
    case "none":
      return failed(unknownList(name, reminderLists));
    case "several":
      return failed(ambiguousList(name, named.lists));
  }
};

export const listReminders = async (
  { reminderStore }: ListRemindersDependencies,
  request: ListRemindersRequest,
): Promise<Outcome<ListedReminders>> => {
  const reminderLists = await reminderStore.reminderLists();
  if (!reminderLists.ok) return reminderLists;

  const wanted = reminderListsWanted(reminderLists.value, request.reminderList);
  if (!wanted.ok) return wanted;

  const read = await reminderStore.reminders({
    reminderLists: wanted.value.map(({ identifier }) => identifier),
    includeCompleted: request.includeCompleted,
    ...(request.matching === undefined ? {} : { matching: request.matching }),
  });
  if (!read.ok) return read;

  const { unreadReminderLists } = read.value;
  const page = pageOf(
    openBeforeCompleted(read.value.reminders),
    request.offset ?? 0,
    request.limit ?? defaultLimit,
  );

  return succeeded({
    ...page,
    reminderLists: wanted.value.length,
    reminderListsUnread: wanted.value.filter(({ identifier }) =>
      unreadReminderLists.includes(identifier),
    ),
    includesCompleted: request.includeCompleted,
  });
};
