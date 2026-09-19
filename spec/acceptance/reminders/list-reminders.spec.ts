import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import type { Reminder, ReminderList } from "../../../src/domain/reminders/reminder.js";
import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeReminderStore, remindersRefused } from "../../support/fake-reminder-store.js";
import { exchange, iCloud } from "../../support/calendar-accounts.js";

// What an agent sees of the user's reminders, with a fake reminder store behind the tool.

const timeZone = "America/New_York";

const shopping: ReminderList = {
  identifier: "list-shopping",
  title: "Shopping",
  account: iCloud,
};
const errands: ReminderList = { identifier: "list-errands", title: "Errands", account: iCloud };

const aReminder = (
  title: string,
  reminderList: ReminderList,
  detail: Partial<Reminder> = {},
): Reminder => ({
  identifier: `reminder-${title}`,
  title,
  isCompleted: false,
  reminderList,
  ...detail,
});

/** The due field of the one reminder a result holds, as an agent reads it. */
const dueOfTheOnlyReminder = (result: Awaited<ReturnType<Client["callTool"]>>): unknown => {
  const { reminders } = result.structuredContent as { reminders: [{ due?: unknown }] };
  expect(reminders).toHaveLength(1);
  return reminders[0].due;
};

describe("listing reminders", () => {
  let reminderStore: FakeReminderStore;
  let client: Client;

  const listReminders = async (
    args: Record<string, unknown> = {},
  ): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "list_reminders", arguments: args });

  beforeEach(async () => {
    reminderStore = new FakeReminderStore();
    reminderStore.holdsReminderLists(shopping, errands);
    client = await connectedTo(aServer({ reminderStore, timeZone }));
  });

  // Upstream #53: years of completed reminders flooded every answer and timed it out.
  it("given open and completed reminders, returns only the open ones, each naming its reminder list and account", async () => {
    reminderStore.holds(
      aReminder("Oat milk", shopping),
      aReminder("Bread", shopping, { isCompleted: true }),
    );

    const result = await listReminders();

    expect(result.structuredContent).toStrictEqual({
      reminders: [
        {
          identifier: "reminder-Oat milk",
          title: "Oat milk",
          isCompleted: false,
          reminderList: { identifier: "list-shopping", title: "Shopping", account: iCloud },
        },
      ],
      coverage: {
        reminderLists: 2,
        reminderListsUnread: [],
        includesCompleted: false,
        truncated: false,
      },
    });
  });

  // faces-sh 94149a2: completed reminders mixed in among open ones read as things still to do.
  it("given completed reminders are asked for, returns the open ones first and then the completed ones, each marked", async () => {
    reminderStore.holds(
      aReminder("Bread", shopping, { isCompleted: true }),
      aReminder("Oat milk", shopping),
    );

    const result = await listReminders({ includeCompleted: true });

    expect(result.structuredContent).toMatchObject({
      reminders: [
        { title: "Oat milk", isCompleted: false },
        { title: "Bread", isCompleted: true },
      ],
      coverage: { includesCompleted: true },
    });
  });

  it("given a reminder list's identifier, returns only its reminders and says it read one reminder list", async () => {
    reminderStore.holds(aReminder("Oat milk", shopping), aReminder("Post office", errands));

    const result = await listReminders({ reminderList: "list-errands" });

    expect(result.structuredContent).toMatchObject({
      reminders: [{ title: "Post office" }],
      coverage: { reminderLists: 1 },
    });
  });

  it("given a reminder list's title, returns only its reminders", async () => {
    reminderStore.holds(aReminder("Oat milk", shopping), aReminder("Post office", errands));

    const result = await listReminders({ reminderList: "Errands" });

    expect(result.structuredContent).toMatchObject({ reminders: [{ title: "Post office" }] });
  });

  // mjmcg 5ca5e55 read whichever reminder list with that title came first.
  it("given a title two accounts share, refuses and names both reminder lists by account rather than picking one", async () => {
    const sharedShopping = { identifier: "list-shared", title: "Shopping", account: exchange };
    reminderStore.holdsReminderLists(shopping, sharedShopping);

    const result = await listReminders({ reminderList: "Shopping" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "reminder-list-ambiguous",
        evidence: expect.stringMatching(/list-shopping.*iCloud.*list-shared.*Exchange/su) as string,
      },
    });
  });

  // Exchange sources are often all titled "Exchange", so an account's title alone can't tell them.
  it("given a title two accounts with one title share, refuses and still tells the lists apart by account", async () => {
    const work = { identifier: "account-work", title: "Exchange" };
    const club = { identifier: "account-club", title: "Exchange" };
    reminderStore.holdsReminderLists(
      { identifier: "list-work-tasks", title: "Tasks", account: work },
      { identifier: "list-club-tasks", title: "Tasks", account: club },
    );

    const result = await listReminders({ reminderList: "Tasks" });

    const { failure } = result.structuredContent as { failure: { evidence: string } };
    expect(JSON.parse(failure.evidence)).toMatchObject({
      reminderLists: [
        { identifier: "list-work-tasks", account: work },
        { identifier: "list-club-tasks", account: club },
      ],
    });
  });

  // Upstream #26: every fork that fell back to another reminder list reported the one asked for.
  it("given a reminder list that does not exist, refuses and names the ones there are rather than reading another", async () => {
    reminderStore.holds(aReminder("Oat milk", shopping));

    const result = await listReminders({ reminderList: "Groceries" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "reminder-list-unknown",
        evidence: expect.stringMatching(/Shopping.*Errands/su) as string,
      },
    });
  });

  // mjmcg d4ec06d: a reminder list's name was handed to a command-line tool, which read "--all"
  // as a flag.
  it("given a reminder list title that looks like a command-line flag, treats it as a title", async () => {
    const flagLike = { identifier: "list-flag", title: "--all", account: iCloud };
    reminderStore.holdsReminderLists(shopping, flagLike);
    reminderStore.holds(aReminder("Oat milk", shopping), aReminder("Tax return", flagLike));

    const result = await listReminders({ reminderList: "--all" });

    expect(result.structuredContent).toMatchObject({
      reminders: [{ title: "Tax return", reminderList: { title: "--all" } }],
      coverage: { reminderLists: 1 },
    });
  });

  // Upstream #34 and #64: a date with no time was stored and read back as midnight UTC, which is
  // the evening before anywhere west of Greenwich.
  it("given a due date with no time, reports that date and no time of day", async () => {
    reminderStore.holds(
      aReminder("Bins out", errands, { due: { day: { year: 2026, month: 9, day: 25 } } }),
    );

    const result = await listReminders();

    expect(result.structuredContent).toMatchObject({ reminders: [{ title: "Bins out" }] });
    expect(dueOfTheOnlyReminder(result)).toStrictEqual({ date: "2026-09-25" });
  });

  // Upstream #34: a due time came back in UTC, and read as a time an hour or a day away.
  it("given a due time, reports it in the user's time zone with its offset, on the day it falls there", async () => {
    reminderStore.holds(
      aReminder("Call the plumber", errands, {
        due: { at: new Date("2026-09-26T01:30:00Z") },
      }),
    );

    const result = await listReminders();

    expect(dueOfTheOnlyReminder(result)).toStrictEqual({
      date: "2026-09-25",
      time: "2026-09-25T21:30:00-04:00",
    });
  });

  // Upstream #53: a denied permission read as having no reminders at all.
  it("given reminders access was refused, refuses and names the setting to enable rather than reporting no reminders", async () => {
    reminderStore.refuses(remindersRefused);

    const result = await listReminders();

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "reminders_permission_missing" },
    });
  });
});

describe("listing reminders a page at a time", () => {
  let reminderStore: FakeReminderStore;
  let client: Client;

  const titles = (result: Awaited<ReturnType<Client["callTool"]>>): string[] =>
    (result.structuredContent as { reminders: { title: string }[] }).reminders.map(
      ({ title }) => title,
    );

  beforeEach(async () => {
    reminderStore = new FakeReminderStore();
    reminderStore.holdsReminderLists(shopping);
    reminderStore.holds(
      aReminder("Apples", shopping),
      aReminder("Bread", shopping),
      aReminder("Cheese", shopping),
    );
    client = await connectedTo(aServer({ reminderStore, timeZone }));
  });

  // boutquin 8a5d2e0, sicdigital 791f5f2: a silent cap of 50 read as every reminder there was.
  it("given more reminders than the limit, returns the first ones and says the answer is truncated and where the next page starts", async () => {
    const result = await client.callTool({ name: "list_reminders", arguments: { limit: 2 } });

    expect(titles(result)).toStrictEqual(["Apples", "Bread"]);
    expect(result.structuredContent).toMatchObject({
      coverage: { truncated: true, nextOffset: 2 },
    });
  });

  // mjmcg 2743d84: a reminder list too large for one response came back cut off, silently.
  it("given the offset a truncated answer stated, returns the next page, and says nothing is left", async () => {
    const result = await client.callTool({
      name: "list_reminders",
      arguments: { limit: 2, offset: 2 },
    });

    expect(titles(result)).toStrictEqual(["Cheese"]);
    expect(result.structuredContent).toMatchObject({ coverage: { truncated: false } });
    expect(result.structuredContent).not.toHaveProperty("coverage.nextOffset");
  });

  it("given two reminders with one title, always returns them in the same order, so a page never repeats or skips one", async () => {
    reminderStore.holds(
      { ...aReminder("Bread", shopping), identifier: "reminder-2" },
      { ...aReminder("Bread", shopping), identifier: "reminder-1" },
    );

    const first = await client.callTool({ name: "list_reminders", arguments: { limit: 1 } });
    const second = await client.callTool({
      name: "list_reminders",
      arguments: { limit: 1, offset: 1 },
    });

    expect(first.structuredContent).toMatchObject({ reminders: [{ identifier: "reminder-1" }] });
    expect(second.structuredContent).toMatchObject({ reminders: [{ identifier: "reminder-2" }] });
  });

  it("given a limit above the most a page may hold, refuses rather than reading a larger page", async () => {
    const result = await client.callTool({ name: "list_reminders", arguments: { limit: 501 } });

    expect(result.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
  });

  it("given an offset before the first reminder, refuses rather than guessing where the page starts", async () => {
    const result = await client.callTool({ name: "list_reminders", arguments: { offset: -1 } });

    expect(result.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
  });
});

describe("listing reminders within the time budget", () => {
  let reminderStore: FakeReminderStore;
  let client: Client;

  beforeEach(async () => {
    reminderStore = new FakeReminderStore();
    reminderStore.holdsReminderLists(shopping, errands);
    client = await connectedTo(aServer({ reminderStore, timeZone }));
  });

  // chrischall 6831a90: a list too large to read in time was skipped, and nothing said so.
  it("given a reminder list that did not answer in time, returns the rest and names that list as unread", async () => {
    reminderStore.holds(aReminder("Oat milk", shopping));
    reminderStore.cannotReadInTime(errands);

    const result = await client.callTool({ name: "list_reminders", arguments: {} });

    expect(result.structuredContent).toMatchObject({
      reminders: [{ title: "Oat milk" }],
      coverage: {
        reminderLists: 2,
        reminderListsUnread: [{ identifier: "list-errands", title: "Errands", account: iCloud }],
      },
    });
  });

  // danielk-am ad3e9e9: a store that never answered read as a Mac with no reminders at all.
  it("given no reminder list answered in time, refuses with the timeout rather than reporting no reminders", async () => {
    reminderStore.cannotReadInTime(shopping, errands);

    const result = await client.callTool({ name: "list_reminders", arguments: {} });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ failure: { code: "reminders_timed_out" } });
  });
});
