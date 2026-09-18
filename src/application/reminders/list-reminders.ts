import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import {
  defaultLimit,
  openBeforeCompleted,
  pageOf,
  theReminderListNamed,
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

/** The reminder lists a request covers: the one it names, or all of them. */
const reminderListsWanted = (
  reminderLists: readonly ReminderList[],
  name: string | undefined,
): Outcome<readonly ReminderList[]> => {
  if (name === undefined) return succeeded(reminderLists);

  const named = theReminderListNamed(reminderLists, name, "Nothing was read.");
  return named.ok ? succeeded([named.value]) : named;
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
