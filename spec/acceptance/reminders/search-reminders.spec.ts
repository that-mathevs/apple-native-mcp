import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import type { Reminder, ReminderList } from "../../../src/domain/reminders/reminder.js";
import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeReminderStore } from "../../support/fake-reminder-store.js";
import { iCloud } from "../../support/calendar-accounts.js";

// What an agent finds when it searches the user's reminders, with a fake reminder store behind
// the tool. A search looks at titles and notes, open and completed reminders alike (REM-C5).

const shopping: ReminderList = {
  identifier: "list-shopping",
  title: "Shopping",
  account: iCloud,
};
const errands: ReminderList = { identifier: "list-errands", title: "Errands", account: iCloud };

const aReminder = (title: string, detail: Partial<Reminder> = {}): Reminder => ({
  identifier: `reminder-${title}`,
  title,
  isCompleted: false,
  reminderList: shopping,
  ...detail,
});

type Found = { structuredContent?: unknown; isError?: boolean };

const titlesIn = (result: Found): string[] =>
  (result.structuredContent as { reminders: { title: string }[] }).reminders.map(
    ({ title }) => title,
  );

describe("searching reminders", () => {
  let reminderStore: FakeReminderStore;
  let client: Client;

  const searching = async (args: Record<string, unknown>): Promise<Found> =>
    (await client.callTool({ name: "search_reminders", arguments: args })) as Found;

  beforeEach(async () => {
    reminderStore = new FakeReminderStore();
    reminderStore.holdsReminderLists(shopping, errands);
    client = await connectedTo(aServer({ reminderStore }));
  });

  // gene-jelly c5a0edd read titles only, so a reminder whose detail was in its notes was not found.
  it("given text found only in a reminder's notes, finds it, and still reports no notes", async () => {
    reminderStore.holds(aReminder("Call Sam"), aReminder("Milk"));
    reminderStore.notes("reminder-Call Sam", "ask about the plumber");

    const result = await searching({ text: "plumber" });

    expect(titlesIn(result)).toStrictEqual(["Call Sam"]);
    expect(JSON.stringify(result)).not.toContain("ask about");
  });

  // boutquin 8a5d2e0: a search for "milk" missed "Oat Milk".
  it("given text that differs from a title only in letter case, finds it", async () => {
    reminderStore.holds(aReminder("Oat Milk"));

    expect(titlesIn(await searching({ text: "oat milk" }))).toStrictEqual(["Oat Milk"]);
  });

  // sicdigital 791f5f2: a search that saw completed reminders reported them as still to do.
  it("given text matching open and completed reminders, finds both, the open ones first, the completed ones marked", async () => {
    reminderStore.holds(
      aReminder("Renew passport", { isCompleted: true }),
      aReminder("Passport photos"),
    );

    const result = await searching({ text: "passport" });

    expect(result.structuredContent).toMatchObject({
      reminders: [
        { title: "Passport photos", isCompleted: false },
        { title: "Renew passport", isCompleted: true },
      ],
      coverage: { includesCompleted: true },
    });
  });

  it("given a reminder list, searches only that one", async () => {
    reminderStore.holds(
      aReminder("Post the parcel", { reminderList: errands }),
      aReminder("Parcel tape"),
    );

    const result = await searching({ text: "parcel", reminderList: "Errands" });

    expect(titlesIn(result)).toStrictEqual(["Post the parcel"]);
  });

  // mjmcg bde3e31: matches past a silent cap of 50 were dropped with nothing to say so.
  it("given more matches than the limit, returns the first and says where the next page starts", async () => {
    reminderStore.holds(aReminder("Tea one"), aReminder("Tea two"), aReminder("Tea three"));

    const result = await searching({ text: "tea", limit: 2 });

    expect(titlesIn(result)).toStrictEqual(["Tea one", "Tea three"]);
    expect(result.structuredContent).toMatchObject({
      coverage: { truncated: true, nextOffset: 2 },
    });
  });

  // faces-sh 8ac7cb9: a search that could not reach every list still read as a full answer.
  it("given a reminder list that did not answer in time, names it as unread beside what was found", async () => {
    reminderStore.holds(aReminder("Tea"));
    reminderStore.cannotReadInTime(errands);

    const result = await searching({ text: "tea" });

    expect(result.structuredContent).toMatchObject({
      reminders: [{ title: "Tea" }],
      coverage: { reminderLists: 2, reminderListsUnread: [{ identifier: "list-errands" }] },
    });
  });

  // boutquin 2894ab6: search text was spliced into AppleScript, so a quote ended the string.
  it("given text that closes a string and runs a command, matches it literally and nothing else", async () => {
    const hostile = '"); do shell script "open -a Calculator';
    reminderStore.holds(aReminder(`Note ${hostile}`), aReminder("Calculator batteries"));

    expect(titlesIn(await searching({ text: hostile }))).toStrictEqual([`Note ${hostile}`]);
  });

  // felkru 12ad33f: a percent sign in a SQL LIKE pattern matched anything at all.
  it("given a percent sign in the text, matches it literally", async () => {
    reminderStore.holds(aReminder("50% off voucher"), aReminder("500 grams flour"));

    expect(titlesIn(await searching({ text: "50%" }))).toStrictEqual(["50% off voucher"]);
  });

  it("given text that says nothing, refuses rather than finding every reminder", async () => {
    const result = await searching({ text: "   " });

    expect(result.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
  });
});
