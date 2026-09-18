import type {
  ReminderStore,
  RemindersRead,
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

/** What the helper answers when no reminder list answered within its time budget. */
export const remindersTimedOut: NamedFailure = {
  code: "reminders_timed_out",
  sentence: "No reminder list answered within 2 seconds, so nothing was read.",
  evidence: "2 reminder lists",
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
  #slow: readonly ReminderList[] = [];

  holdsReminderLists(...reminderLists: readonly ReminderList[]): void {
    this.#reminderLists = reminderLists;
  }

  holds(...reminders: readonly Reminder[]): void {
    this.#reminders = reminders;
  }

  refuses(failure: NamedFailure): void {
    this.#failure = failure;
  }

  /** Reminder lists too large, or too far away, to read within the time budget. */
  cannotReadInTime(...reminderLists: readonly ReminderList[]): void {
    this.#slow = reminderLists;
  }

  reminderLists(): Promise<Outcome<readonly ReminderList[]>> {
    return Promise.resolve(this.#failure ? failed(this.#failure) : succeeded(this.#reminderLists));
  }

  reminders({
    reminderLists,
    includeCompleted,
  }: RemindersWanted): Promise<Outcome<RemindersRead>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    const slow = this.#slow
      .map(({ identifier }) => identifier)
      .filter((identifier) => reminderLists.includes(identifier));

    // As the helper does: when nothing answered in time, that is a failure, never "no reminders".
    if (reminderLists.length > 0 && slow.length === reminderLists.length) {
      return Promise.resolve(failed(remindersTimedOut));
    }

    return Promise.resolve(
      succeeded({
        reminders: this.#reminders.filter(
          ({ reminderList, isCompleted }) =>
            reminderLists.includes(reminderList.identifier) &&
            !slow.includes(reminderList.identifier) &&
            (includeCompleted || !isCompleted),
        ),
        unreadReminderLists: slow,
      }),
    );
  }
}
