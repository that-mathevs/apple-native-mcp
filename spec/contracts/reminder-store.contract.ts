import { describe, expect, it } from "vitest";

import type { ReminderStore } from "../../src/application/reminders/reminder-store.js";
import type { Reminder, ReminderList } from "../../src/domain/reminders/reminder.js";

/**
 * What every reminder store promises, whichever way it reaches macOS.
 *
 * The scenarios hold for whatever reminders a store has, so the suite runs unchanged against the
 * fake everywhere and against this Mac's own reminders under `npm run spec:mac`.
 */
export type ReminderStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{ readonly reminderStore: ReminderStore }>;
};

const listsOf = async (reminderStore: ReminderStore): Promise<readonly ReminderList[]> => {
  const lists = await reminderStore.reminderLists();
  if (!lists.ok) throw new Error(`the reminder lists could not be read: ${lists.failure.code}`);
  return lists.value;
};

const remindersIn = async (
  reminderStore: ReminderStore,
  lists: readonly ReminderList[],
  includeCompleted: boolean,
): Promise<readonly Reminder[]> => {
  const read = await reminderStore.reminders({
    reminderLists: lists.map(({ identifier }) => identifier),
    includeCompleted,
  });
  if (!read.ok) throw new Error(`the reminders could not be read: ${read.failure.code}`);
  return read.value.reminders;
};

export const aReminderStore = ({ name, build }: ReminderStoreUnderTest): void => {
  describe(`${name}, as a reminder store`, () => {
    it("names every reminder list with an identifier, a title and an account", async () => {
      const { reminderStore } = await build();

      const lists = await listsOf(reminderStore);

      expect(lists.length).toBeGreaterThan(0);
      for (const list of lists) {
        expect(list).toStrictEqual({
          identifier: expect.any(String) as string,
          title: expect.any(String) as string,
          account: expect.any(String) as string,
        });
      }
    });

    // Upstream #53: completed history is what flooded every answer, so the store leaves it out.
    it("given completed reminders are not wanted, answers with open reminders only", async () => {
      const { reminderStore } = await build();

      const reminders = await remindersIn(reminderStore, await listsOf(reminderStore), false);

      expect(reminders.filter(({ isCompleted }) => isCompleted)).toStrictEqual([]);
    });

    it("given one reminder list, answers only with reminders in that one", async () => {
      const { reminderStore } = await build();
      const [first] = await listsOf(reminderStore);
      if (!first) throw new Error("the store holds no reminder list");

      const reminders = await remindersIn(reminderStore, [first], true);
      const elsewhere = reminders.filter(
        ({ reminderList }) => reminderList.identifier !== first.identifier,
      );

      expect(elsewhere).toStrictEqual([]);
    });

    it("always says which reminder lists did not answer in time, so a short answer is never read as the whole", async () => {
      const { reminderStore } = await build();
      const lists = await listsOf(reminderStore);

      const read = await reminderStore.reminders({
        reminderLists: lists.map(({ identifier }) => identifier),
        includeCompleted: false,
      });

      expect(read).toMatchObject({
        ok: true,
        value: { unreadReminderLists: expect.any(Array) as unknown[] },
      });
    });

    // EventKit reads "no calendars" as "every calendar", so asking for none has to mean none.
    it("given no reminder lists, answers with no reminders rather than those of every one", async () => {
      const { reminderStore } = await build();

      expect(await remindersIn(reminderStore, [], true)).toStrictEqual([]);
    });

    it("gives every due reminder either a due date with no time of day or a due time that is one instant", async () => {
      const { reminderStore } = await build();

      const reminders = await remindersIn(reminderStore, await listsOf(reminderStore), false);

      for (const { due } of reminders) {
        if (due === undefined) continue;
        if ("day" in due) {
          const aNumber = expect.any(Number) as number;
          expect(due).toStrictEqual({ day: { year: aNumber, month: aNumber, day: aNumber } });
        } else {
          expect(due).toStrictEqual({ at: expect.any(Date) as Date });
          expect(Number.isNaN(due.at.getTime())).toBe(false);
        }
      }
    });
  });
};
