import type {
  ReminderStore,
  RemindersRead,
  RemindersWanted,
} from "../../application/reminders/reminder-store.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { Due, Reminder, ReminderList } from "../../domain/reminders/reminder.js";
import type { Helper } from "./helper.js";

/**
 * The reminder store as the helper answers it.
 *
 * Nothing here decides anything: it asks the helper, and turns the records it sends back into
 * the domain's words. Which reminder list a name means, and the order reminders come in, live
 * above it.
 */

type ListRecord = {
  readonly identifier: string;
  readonly title: string;
  readonly account: { readonly identifier: string; readonly title: string };
};

type ReminderRecord = {
  readonly identifier: string;
  readonly title: string;
  readonly completed: boolean;
  readonly due: { readonly date: string } | { readonly time: string } | null;
  readonly reminderList: ListRecord;
};

const asList = (record: ListRecord): ReminderList => ({
  identifier: record.identifier,
  title: record.title,
  account: record.account.title,
});

/** A due date arrives as `2026-09-25` and stays a day; a due time arrives as an instant. */
const asDue = (record: NonNullable<ReminderRecord["due"]>): Due => {
  if ("time" in record) return { at: new Date(record.time) };

  const [year, month, day] = record.date.split("-").map(Number) as [number, number, number];
  return { day: { year, month, day } };
};

const asReminder = (record: ReminderRecord): Reminder => ({
  identifier: record.identifier,
  title: record.title,
  isCompleted: record.completed,
  ...(record.due === null ? {} : { due: asDue(record.due) }),
  reminderList: asList(record.reminderList),
});

export const helperReminderStore = (helper: Helper): ReminderStore => ({
  reminderLists: async (): Promise<Outcome<readonly ReminderList[]>> => {
    const answered = await helper.ask({ request: "reminder_lists" });
    if (!answered.ok) return failed(answered.failure);

    const { reminderLists } = answered.value as { reminderLists?: ListRecord[] };
    return succeeded((reminderLists ?? []).map(asList));
  },

  reminders: async ({
    reminderLists,
    includeCompleted,
  }: RemindersWanted): Promise<Outcome<RemindersRead>> => {
    const answered = await helper.ask({ request: "reminders", reminderLists, includeCompleted });
    if (!answered.ok) return failed(answered.failure);

    const { reminders, unreadReminderLists } = answered.value as {
      reminders?: ReminderRecord[];
      unreadReminderLists?: ListRecord[];
    };
    return succeeded({
      reminders: (reminders ?? []).map(asReminder),
      unreadReminderLists: (unreadReminderLists ?? []).map(({ identifier }) => identifier),
    });
  },
});
