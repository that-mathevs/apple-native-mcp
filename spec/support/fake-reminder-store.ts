import type {
  CreatedReminder,
  ReminderStore,
  RemindersRead,
  RemindersWanted,
} from "../../src/application/reminders/reminder-store.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";
import type { NewReminder } from "../../src/domain/reminders/new-reminder.js";
import type { Reminder, ReminderList } from "../../src/domain/reminders/reminder.js";

/** What the helper answers when the user refused reminders access, word for word. */
export const remindersRefused: NamedFailure = {
  code: "reminders-permission-missing",
  sentence:
    "apple-native-mcp cannot read your reminders until it is allowed to, in System Settings > " +
    "Privacy & Security > Reminders > apple-native-mcp.",
  evidence: "refused",
};

/** What the helper answers when no reminder list answered within its time budget. */
export const remindersTimedOut: NamedFailure = {
  code: "reminders-timed-out",
  sentence: "No reminder list answered within 2 seconds, so nothing was read.",
  evidence: "2 reminder lists",
};

/**
 * Whether any of these fields mentions the text, ignoring case, as the helper matches it: both
 * upper-cased, then compared code unit by code unit (native/Sources/HelperCore/Reminder.swift).
 */
export const mentions = (fields: readonly (string | undefined)[], text: string): boolean =>
  fields.some((field) => field?.toUpperCase().includes(text.toUpperCase()) === true);

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
  readonly #notes = new Map<string, string>();
  readonly created: NewReminder[] = [];
  #defaultReminderList: ReminderList | undefined;
  #answers = true;
  #confirms = true;

  holdsReminderLists(...reminderLists: readonly ReminderList[]): void {
    this.#reminderLists = reminderLists;
  }

  /** The reminder list the user set in Reminders for new reminders. */
  defaultsTo(reminderList: ReminderList): void {
    this.#defaultReminderList = reminderList;
  }

  hasNoDefaultReminderList(): void {
    this.#defaultReminderList = undefined;
  }

  /** It saves what it is given, and then cannot find it again. */
  losesSightOfWhatItSaves(): void {
    this.#confirms = false;
  }

  /** It takes the reminder and never says what became of it: a helper that died holding it. */
  neverSaysWhatBecameOfAReminder(): void {
    this.#answers = false;
  }

  holds(...reminders: readonly Reminder[]): void {
    this.#reminders = reminders;
  }

  /** A reminder's notes, which the store searches and never hands over. */
  notes(reminderIdentifier: string, notes: string): void {
    this.#notes.set(reminderIdentifier, notes);
  }

  refuses(failure: NamedFailure): void {
    this.#failure = failure;
  }

  /** Reminder lists too large, or too far away, to read within the time budget. */
  cannotReadInTime(...reminderLists: readonly ReminderList[]): void {
    this.#slow = reminderLists;
  }

  defaultReminderList(): Promise<Outcome<ReminderList | undefined>> {
    return Promise.resolve(
      this.#failure ? failed(this.#failure) : succeeded(this.#defaultReminderList),
    );
  }

  create(reminder: NewReminder): Promise<Outcome<CreatedReminder>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    this.created.push(reminder);
    if (!this.#answers) return Promise.resolve(succeeded({ confirmed: false }));

    const reminderList = this.#reminderLists.find(
      ({ identifier }) => identifier === reminder.reminderListIdentifier,
    );
    if (reminderList === undefined) {
      return Promise.resolve(
        failed({ code: "reminder-list-unknown", sentence: "The store has no such reminder list." }),
      );
    }

    const saved: Reminder = {
      identifier: `reminder-new-${String(this.created.length)}`,
      title: reminder.title,
      isCompleted: false,
      reminderList,
      ...(reminder.due === undefined ? {} : { due: reminder.due }),
    };
    this.#reminders = [...this.#reminders, saved];

    if (reminder.notes !== undefined) this.#notes.set(saved.identifier, reminder.notes);

    return Promise.resolve(
      succeeded(
        this.#confirms
          ? {
              reminder: saved,
              confirmed: true,
              alerts: 0,
              // As the helper answers it: notes that say nothing are no notes.
              hasNotes: (reminder.notes ?? "") !== "",
            }
          : { confirmed: false },
      ),
    );
  }

  reminderLists(): Promise<Outcome<readonly ReminderList[]>> {
    return Promise.resolve(this.#failure ? failed(this.#failure) : succeeded(this.#reminderLists));
  }

  reminders({
    reminderLists,
    includeCompleted,
    matching,
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
          ({ identifier, title, reminderList, isCompleted }) =>
            reminderLists.includes(reminderList.identifier) &&
            !slow.includes(reminderList.identifier) &&
            (includeCompleted || !isCompleted) &&
            (matching === undefined || mentions([title, this.#notes.get(identifier)], matching)),
        ),
        unreadReminderLists: slow,
      }),
    );
  }
}
