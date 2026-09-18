import type {
  ReminderStore,
  RemindersWanted,
} from "../../src/application/reminders/reminder-store.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";
import type { Reminder, ReminderList } from "../../src/domain/reminders/reminder.js";

/** What the helper answers when the user refused reminders access, word for word. */
export const remindersRefused: NamedFailure = {
  code: "reminders_permission_missing",
  sentence:
    "apple-native-mcp cannot read your reminders until it is allowed to, in System Settings > " +
    "Privacy & Security > Reminders > apple-native-mcp.",
  evidence: "refused",
};

/**
 * A reminder store held in memory.
 *
 * It answers the same contract as the helper-backed one, so the scenarios that use it are
 * worth trusting only for as long as it passes that contract (spec/contracts).
 */
export class FakeReminderStore implements ReminderStore {
  #reminderLists: readonly ReminderList[] = [];
  #reminders: readonly Reminder[] = [];
  #failure: NamedFailure | undefined;

  holdsReminderLists(...reminderLists: readonly ReminderList[]): void {
    this.#reminderLists = reminderLists;
  }

  holds(...reminders: readonly Reminder[]): void {
    this.#reminders = reminders;
  }

  refuses(failure: NamedFailure): void {
    this.#failure = failure;
  }

  reminderLists(): Promise<Outcome<readonly ReminderList[]>> {
    return Promise.resolve(this.#failure ? failed(this.#failure) : succeeded(this.#reminderLists));
  }

  reminders({
    reminderLists,
    includeCompleted,
  }: RemindersWanted): Promise<Outcome<readonly Reminder[]>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    return Promise.resolve(
      succeeded(
        this.#reminders.filter(
          (reminder) =>
            reminderLists.includes(reminder.reminderList.identifier) &&
            (includeCompleted || !reminder.isCompleted),
        ),
      ),
    );
  }
}
