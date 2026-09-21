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
          account: {
            identifier: expect.any(String) as string,
            title: expect.any(String) as string,
          },
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

    // Case folding is the helper's to specify, with examples chosen for it; a real title could be
    // anything, so this one is searched for exactly as written.
    it("given text from a reminder's title, finds that reminder", async () => {
      const { reminderStore } = await build();
      const lists = await listsOf(reminderStore);
      const reminders = await remindersIn(reminderStore, lists, true);
      const known = reminders.find(({ title }) => title.trim() !== "");
      if (!known) throw new Error("the store holds no titled reminder to search for");

      const found = await reminderStore.reminders({
        reminderLists: lists.map(({ identifier }) => identifier),
        includeCompleted: true,
        matching: known.title,
      });

      expect(found).toMatchObject({ ok: true });
      expect(found.ok && found.value.reminders.map(({ identifier }) => identifier)).toContain(
        known.identifier,
      );
    });

    it("given text no reminder mentions, finds none rather than every reminder", async () => {
      const { reminderStore } = await build();
      const lists = await listsOf(reminderStore);

      const found = await reminderStore.reminders({
        reminderLists: lists.map(({ identifier }) => identifier),
        includeCompleted: true,
        matching: "no reminder says zq-7f3a-%-\\\"",
      });

      expect(found).toMatchObject({ ok: true, value: { reminders: [] } });
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

/**
 * A store a scenario may create reminders in, and the one reminder list it may create them in.
 *
 * Against the real store that list is the one titled "scratch" and no other: v1 cannot delete a
 * reminder, so whatever this suite creates stays where it was put. Every title begins "Contract
 * check" so that it can be told from anything a person wrote.
 */
export type WritableReminderStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{
    readonly reminderStore: ReminderStore;
    readonly reminderList: string;
  }>;
};

export const aReminderStoreThatCreatesReminders = ({
  name,
  build,
}: WritableReminderStoreUnderTest): void => {
  describe(`${name}, asked to create a reminder`, () => {
    it("answers with the reminder as it now holds it, open, in the reminder list it was sent to", async () => {
      const { reminderStore, reminderList } = await build();

      const created = await reminderStore.create({
        title: "Contract check: buy stamps",
        reminderListIdentifier: reminderList,
      });

      expect(created).toMatchObject({
        ok: true,
        value: {
          confirmed: true,
          reminder: {
            title: "Contract check: buy stamps",
            isCompleted: false,
            reminderList: { identifier: reminderList },
          },
        },
      });
    });

    // Upstream #34 and #64: a due date was stored as a midnight, and came back a day early.
    it("given a due date, holds it as that day with no time of day", async () => {
      const { reminderStore, reminderList } = await build();

      const created = await reminderStore.create({
        title: "Contract check: bins out",
        reminderListIdentifier: reminderList,
        due: { day: { year: 2026, month: 9, day: 25 } },
      });

      expect(created).toMatchObject({
        ok: true,
        value: { reminder: { due: { day: { year: 2026, month: 9, day: 25 } } } },
      });
    });

    // #20: a due time says when a reminder is due, not that the user wants to be interrupted.
    it("given a due time, holds exactly that instant and adds no alert", async () => {
      const { reminderStore, reminderList } = await build();
      const at = new Date("2026-09-25T21:00:00Z");

      const created = await reminderStore.create({
        title: "Contract check: call Sam",
        reminderListIdentifier: reminderList,
        due: { at },
      });

      expect(created).toMatchObject({ ok: true, value: { reminder: { due: { at } }, alerts: 0 } });
    });

    // boutquin 8a5d2e0: notes were built into a command line and lost at the first quote. They
    // never come back in a record, so a search for their own text is what shows they were kept.
    it("given notes, holds them as given: a search for their text finds that reminder", async () => {
      const { reminderStore, reminderList } = await build();
      const marker = `zq7f3a${String(Date.now())}${String(Math.random()).slice(2, 8)}`;
      const notes = `Contract check: "${marker}" \\ £40\nsecond line`;

      const created = await reminderStore.create({
        title: "Contract check: notes",
        reminderListIdentifier: reminderList,
        notes,
      });

      expect(created).toMatchObject({ ok: true, value: { hasNotes: true } });

      const found = await reminderStore.reminders({
        reminderLists: [reminderList],
        includeCompleted: true,
        matching: `"${marker}" \\ £40`,
      });

      expect(found.ok && found.value.reminders.map(({ title }) => title)).toStrictEqual([
        "Contract check: notes",
      ]);
    });

    // mjmcg d4ec06d: a reminder built out of a command line lost everything after a quote.
    it("given a title full of quotes, backslashes, line breaks and script text, holds it exactly as given", async () => {
      const { reminderStore, reminderList } = await build();
      const hostile = 'Contract check: "; do shell script "true" \\ `id` $(id)\nsecond line';

      const created = await reminderStore.create({
        title: hostile,
        reminderListIdentifier: reminderList,
      });

      expect(created).toMatchObject({ ok: true, value: { reminder: { title: hostile } } });
    });
  });
};
