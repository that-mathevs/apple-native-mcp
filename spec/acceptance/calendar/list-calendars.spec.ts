import { describe, expect, it } from "vitest";

import { readingTheCalendar } from "../../support/calendar-server.js";
import { FakeEventStore } from "../../support/fake-event-store.js";

// What an agent learns about the calendars themselves. Upstream named a calendar by its
// title alone, and titles repeat across accounts: two calendars called "Home" were one to it
// (brightline 6bc977a, mjmcg 17cba98).

const home = { identifier: "cal-1", title: "Home", account: "iCloud", acceptsNewEvents: true };
const otherHome = { ...home, identifier: "cal-2", account: "Exchange" };
const holidays = {
  identifier: "cal-3",
  title: "UK Holidays",
  account: "Subscriptions",
  acceptsNewEvents: false,
};

/** What `list_calendars` answers when the store has these calendars and these settings. */
const listingCalendars = async (
  configuration: Record<string, string> = {},
  eventStore = new FakeEventStore(),
): Promise<{ structuredContent?: unknown; isError?: unknown; text: string }> => {
  eventStore.hasCalendars(home, otherHome, holidays);

  const client = await readingTheCalendar(eventStore, configuration);
  const result = await client.callTool({ name: "list_calendars", arguments: {} });

  return { ...result, text: JSON.stringify(result) };
};

describe("listing calendars", () => {
  it("lists each calendar with its identifier, its title and its calendar account: titles repeat across accounts, so the identifier addresses it", async () => {
    const result = await listingCalendars();

    expect(result.structuredContent).toMatchObject({
      calendars: [
        { identifier: "cal-1", title: "Home", account: "iCloud" },
        { identifier: "cal-2", title: "Home", account: "Exchange" },
        { identifier: "cal-3", title: "UK Holidays", account: "Subscriptions" },
      ],
    });
  });

  // chrischall 29af0a2 let an agent pick a subscribed calendar for a new event, which the
  // store then refused; saying which calendars are writable is what prevents the attempt.
  it("says which calendars accept new events, so nothing is ever created in a subscription", async () => {
    const result = await listingCalendars();

    expect(result.structuredContent).toMatchObject({
      calendars: [
        { identifier: "cal-1", acceptsNewEvents: true },
        { identifier: "cal-2", acceptsNewEvents: true },
        { identifier: "cal-3", acceptsNewEvents: false },
      ],
    });
  });

  it("given calendars the settings exclude, leaves them out and says how many, never which, so the user can see the setting took effect", async () => {
    const result = await listingCalendars({ APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "cal-2,cal-3" });

    expect(result.structuredContent).toMatchObject({
      calendars: [{ identifier: "cal-1" }],
      coverage: { calendarsExcluded: 2 },
    });
    expect(result.text).not.toContain("cal-2");
    expect(result.text).not.toContain("UK Holidays");
  });

  it("given calendar access was never granted, refuses and names the setting to enable rather than listing nothing", async () => {
    const eventStore = new FakeEventStore();
    eventStore.refuses("calendar-access-not-granted");

    const result = await listingCalendars({}, eventStore);

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "calendar-access-not-granted", setting: "Privacy & Security > Calendars" },
    });
  });
});
