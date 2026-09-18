import type { Outcome } from "../../domain/failure.js";
import type { ReminderList } from "../../domain/reminders/reminder.js";
import type { ReminderStore } from "./reminder-store.js";

export type ListReminderListsDependencies = {
  readonly reminderStore: ReminderStore;
};

export const listReminderLists = async ({
  reminderStore,
}: ListReminderListsDependencies): Promise<Outcome<readonly ReminderList[]>> =>
  await reminderStore.reminderLists();
