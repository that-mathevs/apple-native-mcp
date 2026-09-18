import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { settingsFrom } from "../../../src/domain/settings.js";
import type { ReminderList } from "../../../src/domain/reminders/reminder.js";
import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeReminderStore } from "../../support/fake-reminder-store.js";

// What happens when an agent asks for a new reminder. Forks put it in a list that did not exist
// by creating one, or in whichever list came first, and still reported the list asked for
// (upstream #26, REM-C1). The user in these scenarios is in New York.

const on = { APPLE_NATIVE_MCP_CAPABILITIES: "create_reminder" };

const inbox: ReminderList = { identifier: "list-inbox", title: "Reminders", account: "iCloud" };
const errands: ReminderList = { identifier: "list-errands", title: "Errands", account: "iCloud" };

describe("creating a reminder", () => {
  let reminderStore: FakeReminderStore;
  let client: Client;

  const createReminder = async (args: Record<string, unknown>): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "create_reminder", arguments: args });

  const connectedWith = async (configuration: Record<string, string>): Promise<Client> =>
    await connectedTo(aServer({ reminderStore, settings: settingsFrom(configuration) }));

  beforeEach(async () => {
    reminderStore = new FakeReminderStore();
    reminderStore.holdsReminderLists(inbox, errands);
    reminderStore.defaultsTo(inbox);
    client = await connectedWith(on);
  });

  // mjmcg bde3e31: the user already chose a default list in Reminders' own settings.
  it("given no reminder list, creates the reminder in the user's default reminder list and reports the list it used", async () => {
    const result = await createReminder({ title: "Buy stamps" });

    expect(result.isError ?? false).toBe(false);
    expect(result.structuredContent).toMatchObject({
      outcome: "created",
      reminder: {
        title: "Buy stamps",
        isCompleted: false,
        reminderList: { identifier: "list-inbox", title: "Reminders", account: "iCloud" },
      },
    });
  });

  it("given the capability is off, offers no such tool and refuses a call to it, creating nothing", async () => {
    client = await connectedWith({});

    const offered = (await client.listTools()).tools.map((tool) => tool.name);
    const result = await createReminder({ title: "Buy stamps" });

    expect(offered).not.toContain("create_reminder");
    expect(result.structuredContent).toMatchObject({ failure: { code: "capability-off" } });
    expect(reminderStore.created).toStrictEqual([]);
  });

  it("given a reminder list's title, creates the reminder there rather than in the default list", async () => {
    const result = await createReminder({ title: "Post the parcel", reminderList: "Errands" });

    expect(result.structuredContent).toMatchObject({
      reminder: { reminderList: { identifier: "list-errands" } },
    });
  });

  // KassebaumEngineering 1d47e74 created a list by that name; boutquin 8a5d2e0 used the first.
  it("given a reminder list that does not exist, refuses, creates nothing, and names the reminder lists there are", async () => {
    const result = await createReminder({ title: "Post the parcel", reminderList: "Chores" });

    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "reminder-list-unknown",
        evidence: expect.stringMatching(/Reminders.*Errands/su) as string,
      },
    });
    expect(reminderStore.created).toStrictEqual([]);
  });

  it("given no reminder list and no default reminder list, refuses and asks which list to use", async () => {
    reminderStore.hasNoDefaultReminderList();

    const result = await createReminder({ title: "Buy stamps" });

    expect(result.structuredContent).toMatchObject({
      failure: { code: "reminder-list-needed" },
    });
    expect(reminderStore.created).toStrictEqual([]);
  });

  // Upstream #34 and #64: "remind me on Friday" was stored as midnight UTC, Thursday evening here.
  it("given a due date with no time, hands the store the day alone and reports it back with no time", async () => {
    const result = await createReminder({ title: "Bins out", dueDate: "2026-09-25" });

    expect(reminderStore.created).toMatchObject([
      { due: { day: { year: 2026, month: 9, day: 25 } } },
    ]);
    expect(result.structuredContent).toMatchObject({ reminder: { due: { date: "2026-09-25" } } });
  });

  // chrischall 6831a90: "remind me at 5" was read in UTC and landed an hour or more off.
  it("given a due time with no offset, reads it on the user's own clock", async () => {
    const result = await createReminder({ title: "Call Sam", dueTime: "2026-09-25T17:00:00" });

    expect(reminderStore.created).toMatchObject([
      { due: { at: new Date("2026-09-25T21:00:00Z") } },
    ]);
    expect(result.structuredContent).toMatchObject({
      reminder: { due: { date: "2026-09-25", time: "2026-09-25T17:00:00-04:00" } },
    });
  });

  // mjmcg bde3e31 read the digits and dropped the offset, so a time given for Berlin moved.
  it("given a due time with an offset, keeps that instant rather than its wall-clock digits", async () => {
    await createReminder({ title: "Call Berlin", dueTime: "2026-09-25T17:00:00+02:00" });

    expect(reminderStore.created).toMatchObject([
      { due: { at: new Date("2026-09-25T15:00:00Z") } },
    ]);
  });

  // Upstream #34: text that was neither a date nor a time made an undated reminder.
  it("given both a due date and a due time, or a due date that is not a date, refuses rather than guessing", async () => {
    const both = await createReminder({
      title: "Call Sam",
      dueDate: "2026-09-25",
      dueTime: "2026-09-25T17:00:00",
    });
    const notADate = await createReminder({ title: "Call Sam", dueDate: "next friday" });

    expect(both.structuredContent).toMatchObject({ failure: { code: "reminder-due-invalid" } });
    expect(notADate.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
    expect(reminderStore.created).toStrictEqual([]);
  });

  // faces-sh bcdc856 and upstream #27: asking twice made two, and the list filled with copies.
  it("given an open reminder with the same title in that list, refuses and names it so it can be used instead", async () => {
    reminderStore.holds({
      identifier: "reminder-stamps",
      title: "buy stamps ",
      isCompleted: false,
      reminderList: inbox,
    });

    const result = await createReminder({ title: "Buy stamps" });

    const { failure } = result.structuredContent as { failure: { code: string; evidence: string } };
    expect(failure.code).toBe("reminder-duplicate");
    expect(JSON.parse(failure.evidence)).toMatchObject({
      identifier: "reminder-stamps",
      reminderList: { identifier: "list-inbox" },
    });
    expect(reminderStore.created).toStrictEqual([]);
  });

  // faces-sh bcdc856: a list that could not be read looked empty, so a copy was made anyway.
  it("given the reminder list did not answer in time to be checked for a duplicate, refuses with the timeout rather than risk a copy", async () => {
    reminderStore.cannotReadInTime(inbox);

    const result = await createReminder({ title: "Buy stamps" });

    expect(result.structuredContent).toMatchObject({ failure: { code: "reminders_timed_out" } });
    expect(reminderStore.created).toStrictEqual([]);
  });

  it("given the caller says a duplicate is wanted, creates the reminder despite the one already there", async () => {
    reminderStore.holds({
      identifier: "r-1",
      title: "Buy stamps",
      isCompleted: false,
      reminderList: inbox,
    });

    const result = await createReminder({ title: "Buy stamps", evenIfDuplicate: true });

    expect(result.structuredContent).toMatchObject({ outcome: "created" });
  });

  it("given the same title only on a completed reminder or in another list, creates it: only an open one in the same list is a duplicate", async () => {
    reminderStore.holds(
      { identifier: "r-1", title: "Buy stamps", isCompleted: true, reminderList: inbox },
      { identifier: "r-2", title: "Buy stamps", isCompleted: false, reminderList: errands },
    );

    const result = await createReminder({ title: "Buy stamps" });

    expect(result.structuredContent).toMatchObject({ outcome: "created" });
  });

  // mjmcg d4ec06d built the reminder out of a command line; these must arrive exactly as given.
  it("given a title full of quotes, backslashes, line breaks and script text, hands it to the store exactly as given", async () => {
    const title = 'Say "hi" \\ to Sam\n"); do shell script "open -a Calculator';

    await createReminder({ title });

    expect(reminderStore.created).toMatchObject([{ title }]);
  });

  // therealap 1a09e54 reported success before looking. A retry after a false failure makes two.
  it("given the store took the reminder but could not show it afterwards, reports an unconfirmed outcome and not a failure", async () => {
    reminderStore.losesSightOfWhatItSaves();

    const result = await createReminder({ title: "Buy stamps" });

    expect(result.isError ?? false).toBe(false);
    expect(result.structuredContent).toMatchObject({ outcome: "unconfirmed" });
  });

  it("given the store never said what became of the reminder, reports an unconfirmed outcome with no reminder to show", async () => {
    reminderStore.neverSaysWhatBecameOfAReminder();

    const result = await createReminder({ title: "Buy stamps" });

    expect(result.structuredContent).toStrictEqual({ outcome: "unconfirmed" });
  });

  it("given a title that says nothing, refuses rather than creating a reminder nobody could find again", async () => {
    const result = await createReminder({ title: "   " });

    expect(result.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
    expect(reminderStore.created).toStrictEqual([]);
  });

  // upstream PR #76: a client can ask before a tool that changes something runs, if it says so.
  it("says of itself that it changes a store, destroys nothing and reaches nobody else", async () => {
    const { tools } = await client.listTools();

    expect(tools.find((tool) => tool.name === "create_reminder")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    });
  });
});
