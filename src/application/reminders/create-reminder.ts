import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import {
  dueFrom,
  duplicate,
  duplicateOf,
  reminderListNeeded,
  type GivenDue,
} from "../../domain/reminders/new-reminder.js";
import { theReminderListNamed, type ReminderList } from "../../domain/reminders/reminder.js";
import type { CreatedReminder, ReminderStore } from "./reminder-store.js";

export type CreateReminderRequest = GivenDue & {
  readonly title: string;
  /** The reminder list, by identifier or exact title. The default reminder list when left out. */
  readonly reminderList?: string;
  readonly notes?: string;
  /** Create it even though an open reminder in that list already has the same title. */
  readonly evenIfDuplicate?: boolean;
};

export type CreateReminderDependencies = {
  readonly reminderStore: ReminderStore;
};

const reminderListFor = async (
  { reminderStore }: CreateReminderDependencies,
  name: string | undefined,
): Promise<Outcome<ReminderList>> => {
  if (name === undefined) {
    const read = await reminderStore.defaultReminderList();
    if (!read.ok) return read;
    return read.value === undefined ? failed(reminderListNeeded) : succeeded(read.value);
  }

  const read = await reminderStore.reminderLists();
  return read.ok ? theReminderListNamed(read.value, name, "Nothing was created.") : read;
};

/**
 * A new reminder, in the reminder list named or else the user's default one.
 *
 * Everything that could refuse it is asked first, so a refusal always means nothing was created:
 * when it is due, which list, and whether it would be a duplicate. No alert is ever added: a due
 * time says when a reminder is due (#20). Whether macOS notifies at one anyway is REM-V4.
 */
export const createReminder = async (
  dependencies: CreateReminderDependencies,
  { title, reminderList, notes, evenIfDuplicate, ...given }: CreateReminderRequest,
): Promise<Outcome<CreatedReminder>> => {
  const { reminderStore } = dependencies;

  const due = dueFrom(given);
  if (!due.ok) return due;

  const list = await reminderListFor(dependencies, reminderList);
  if (!list.ok) return list;

  if (evenIfDuplicate !== true) {
    const there = await reminderStore.reminders({
      reminderLists: [list.value.identifier],
      includeCompleted: false,
    });
    // One reminder list that does not answer in time is a failure, not an empty list to trust.
    if (!there.ok) return there;

    const already = duplicateOf(title, there.value.reminders);
    if (already !== undefined) return failed(duplicate(already));
  }

  return await reminderStore.create({
    title,
    reminderListIdentifier: list.value.identifier,
    ...(due.value === undefined ? {} : { due: due.value }),
    ...(notes === undefined ? {} : { notes }),
  });
};
