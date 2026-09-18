import { FakeReminderStore } from "../support/fake-reminder-store.js";
import { aReminderStore, aReminderStoreThatCreatesReminders } from "./reminder-store.contract.js";

// The fake stands in for the real store in every acceptance scenario, so it answers the same
// contract here, loaded the way a Mac's reminders often are: open and completed ones, some due.
// The helper-backed store answers it on a Mac.
const inbox = { identifier: "list-inbox", title: "Reminders", account: "iCloud" } as const;
const errands = { identifier: "list-errands", title: "Errands", account: "On My Mac" } as const;

aReminderStore({
  name: "the fake reminder store",
  build: () => {
    const reminderStore = new FakeReminderStore();
    reminderStore.holdsReminderLists(inbox, errands);
    reminderStore.holds(
      { identifier: "r-1", title: "Oat milk", isCompleted: false, reminderList: inbox },
      { identifier: "r-2", title: "Bread", isCompleted: true, reminderList: inbox },
      {
        identifier: "r-3",
        title: "Bins out",
        isCompleted: false,
        due: { day: { year: 2026, month: 9, day: 25 } },
        reminderList: errands,
      },
      {
        identifier: "r-4",
        title: "Call the plumber",
        isCompleted: false,
        due: { at: new Date("2026-09-25T21:00:00Z") },
        reminderList: errands,
      },
    );
    return Promise.resolve({ reminderStore });
  },
});

const scratch = { identifier: "list-scratch", title: "scratch", account: "iCloud" } as const;

aReminderStoreThatCreatesReminders({
  name: "the fake reminder store",
  build: () => {
    const reminderStore = new FakeReminderStore();
    reminderStore.holdsReminderLists(scratch);
    return Promise.resolve({ reminderStore, reminderList: scratch.identifier });
  },
});
