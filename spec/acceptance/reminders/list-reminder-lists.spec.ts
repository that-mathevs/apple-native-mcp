import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeReminderStore, remindersRefused } from "../../support/fake-reminder-store.js";

const shopping = { identifier: "list-shopping", title: "Shopping", account: "iCloud" } as const;
const sharedShopping = {
  identifier: "list-shared",
  title: "Shopping",
  account: "Exchange",
} as const;

describe("listing reminder lists", () => {
  let reminderStore: FakeReminderStore;
  let client: Client;

  const listReminderLists = async (): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "list_reminder_lists", arguments: {} });

  beforeEach(async () => {
    reminderStore = new FakeReminderStore();
    client = await connectedTo(aServer({ reminderStore }));
  });

  // morquis d76f3ec and upstream #53: listing the reminder lists fetched every reminder in them
  // first, which is what timed out on a large library.
  it("returns every reminder list with its identifier, title and account, and none of its reminders", async () => {
    reminderStore.holdsReminderLists(shopping);
    reminderStore.holds({
      identifier: "reminder-1",
      title: "Oat milk",
      isCompleted: false,
      reminderList: shopping,
    });

    const result = await listReminderLists();

    expect(result.structuredContent).toStrictEqual({
      reminderLists: [{ identifier: "list-shopping", title: "Shopping", account: "iCloud" }],
    });
  });

  // sicdigital 791f5f2: reminder lists were keyed by title, so two called "Shopping" became one.
  it("given two reminder lists with the same title in different accounts, returns both, each with its own identifier and account", async () => {
    reminderStore.holdsReminderLists(shopping, sharedShopping);

    const result = await listReminderLists();

    expect(result.structuredContent).toStrictEqual({
      reminderLists: [
        { identifier: "list-shopping", title: "Shopping", account: "iCloud" },
        { identifier: "list-shared", title: "Shopping", account: "Exchange" },
      ],
    });
  });

  // Upstream #53: a denied permission read as an empty set of reminder lists.
  it("given reminders access was refused, refuses and names the setting to enable rather than reporting no reminder lists", async () => {
    reminderStore.refuses(remindersRefused);

    const result = await listReminderLists();

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "reminders_permission_missing",
        sentence: expect.stringContaining("Privacy & Security > Reminders") as string,
      },
    });
  });
});
