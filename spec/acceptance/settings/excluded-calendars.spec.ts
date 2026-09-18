import { describe, expect, it } from "vitest";

import { settingsFrom } from "../../../src/domain/settings.js";
import { buildServer } from "../../../src/mcp/server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeEventStore } from "../../support/fake-event-store.js";

// What an agent sees of the calendars the user keeps from it. Calendars are addressed by
// identifier and never by title: Bendix-ai 6e5ff6c hard-coded holiday titles in one language
// and ANierbeck 3005df4 matched display names, which repeat across accounts and change.

const noon = new Date("2026-09-18T16:00:00Z");

const work = { identifier: "cal-work", title: "Work", account: "iCloud" } as const;
const therapy = { identifier: "cal-therapy", title: "Therapy", account: "iCloud" } as const;

const standUp = {
  identifier: "event-1",
  title: "Stand-up",
  start: new Date("2026-09-18T13:00:00Z"),
  end: new Date("2026-09-18T13:15:00Z"),
  isAllDay: false,
  calendar: work,
} as const;

const session = {
  ...standUp,
  identifier: "event-2",
  title: "Dr Okafor",
  start: new Date("2026-09-18T18:00:00Z"),
  end: new Date("2026-09-18T19:00:00Z"),
  calendar: therapy,
} as const;

/** What `list_events` answers when the client's configuration holds these settings. */
const listingEventsWith = async (
  configuration: Record<string, string>,
  { unreadable = [], sending = {} }: { unreadable?: string[]; sending?: object } = {},
): Promise<{ structuredContent?: unknown; text: string }> => {
  const eventStore = new FakeEventStore();
  eventStore.holds(standUp, session);
  eventStore.cannotRead(...unreadable);

  const client = await connectedTo(
    buildServer({
      eventStore,
      now: () => noon,
      timeZone: "America/New_York",
      settings: settingsFrom(configuration),
    }),
  );

  const result = await client.callTool({ name: "list_events", arguments: { ...sending } });

  return { structuredContent: result.structuredContent, text: JSON.stringify(result) };
};

describe("keeping calendars from the agent", () => {
  // The count is of calendars and never of events: a count of events would tell an agent
  // asking hour by hour exactly when an excluded calendar is busy.
  it("given a calendar the settings exclude, never returns its events, and says how many calendars were left out but never which", async () => {
    const result = await listingEventsWith({ APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "cal-therapy" });

    expect(result.structuredContent).toMatchObject({
      events: [{ identifier: "event-1" }],
      coverage: { calendarsExcluded: 1 },
    });
    expect(result.text).not.toContain("Okafor");
    expect(result.text).not.toContain("Therapy");
    expect(result.text).not.toContain("cal-therapy");
  });

  it("given a calendar allowlist, returns only the events of the calendars on it, and counts the rest as left out", async () => {
    const result = await listingEventsWith({ APPLE_NATIVE_MCP_CALENDAR_ALLOWLIST: "cal-work" });

    expect(result.structuredContent).toMatchObject({
      events: [{ identifier: "event-1" }],
      coverage: { calendarsExcluded: 1 },
    });
    expect(result.text).not.toContain("Okafor");
  });

  // ANierbeck 3005df4 treated an allowlist that matched nothing as no allowlist at all.
  it("given a calendar allowlist that matches no calendar, reports no events rather than all of them", async () => {
    const result = await listingEventsWith({ APPLE_NATIVE_MCP_CALENDAR_ALLOWLIST: "cal-gone" });

    expect(result.structuredContent).toMatchObject({
      events: [],
      coverage: { calendarsExcluded: 2 },
    });
  });

  it("given a calendar that is both on the allowlist and excluded, leaves it out: excluding wins", async () => {
    const result = await listingEventsWith({
      APPLE_NATIVE_MCP_CALENDAR_ALLOWLIST: "cal-work, cal-therapy",
      APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "cal-therapy",
    });

    expect(result.structuredContent).toMatchObject({
      events: [{ identifier: "event-1" }],
      coverage: { calendarsExcluded: 1 },
    });
  });

  it("given no settings about calendars, leaves none out and says so", async () => {
    const result = await listingEventsWith({});

    expect(result.structuredContent).toMatchObject({
      events: [{ identifier: "event-1" }, { identifier: "event-2" }],
      coverage: { calendarsExcluded: 0 },
    });
  });

  it("given an excluded calendar that could not be read, counts it as left out and not as unread: nothing about it is reported twice", async () => {
    const result = await listingEventsWith(
      { APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "cal-therapy" },
      { unreadable: ["cal-therapy"] },
    );

    expect(result.structuredContent).toMatchObject({
      coverage: { calendarsExcluded: 1, calendarsUnread: 0 },
    });
  });

  it("given arguments naming an allowlist or an excluded calendar, changes nothing about what is kept from the agent", async () => {
    const result = await listingEventsWith(
      { APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "cal-therapy" },
      {
        sending: {
          APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "",
          APPLE_NATIVE_MCP_CALENDAR_ALLOWLIST: "cal-therapy",
          excludedCalendars: [],
        },
      },
    );

    expect(result.structuredContent).toMatchObject({
      events: [{ identifier: "event-1" }],
      coverage: { calendarsExcluded: 1 },
    });
  });
});
