import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { aClientOfTheCalendar, therapy, work } from "../../support/calendar-server.js";
import { FakeEventStore } from "../../support/fake-event-store.js";

// What an agent finds when it searches the calendar. Upstream built its search into an
// AppleScript string, so a quote in the search text ended the script and the rest of it ran
// (upstream #74, #25; Bendix-ai 6e5ff6c). Here the text never leaves the server: the store
// is asked for a range, and the matching is the domain's.

const standUp = {
  identifier: "event-1",
  title: "Stand-up",
  start: new Date("2026-09-18T13:00:00Z"),
  end: new Date("2026-09-18T13:15:00Z"),
  isAllDay: false,
  calendar: work,
};

const review = {
  ...standUp,
  identifier: "event-2",
  title: "Quarterly review",
  start: new Date("2026-09-19T15:00:00Z"),
  end: new Date("2026-09-19T16:00:00Z"),
  location: "Budget Room, 4th floor",
  notes: "Bring the FORECAST spreadsheet",
};

describe("searching events", () => {
  let eventStore: FakeEventStore;
  let client: Client;

  const searchingWith = async (configuration: Record<string, string>): Promise<void> => {
    client = await aClientOfTheCalendar(eventStore, configuration);
  };

  const searchEvents = async (args: Record<string, unknown>): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "search_events", arguments: args });

  beforeEach(async () => {
    eventStore = new FakeEventStore();
    eventStore.holds(standUp, review);
    await searchingWith({});
  });

  // Upstream matched titles only, so "where is the budget meeting" found nothing (#74, #25).
  it("given text that appears only in an event's location or notes, finds the event, ignoring case", async () => {
    const byLocation = await searchEvents({ text: "budget room" });
    const byNotes = await searchEvents({ text: "forecast" });

    expect(byLocation.structuredContent).toMatchObject({ events: [{ identifier: "event-2" }] });
    expect(byNotes.structuredContent).toMatchObject({ events: [{ identifier: "event-2" }] });
  });

  it("given no range, covers the start of today for seven days, and states the range and the coverage beside what it found", async () => {
    const result = await searchEvents({ text: "stand-up" });

    expect(result.structuredContent).toMatchObject({
      range: { from: "2026-09-18T04:00:00.000Z", to: "2026-09-25T04:00:00.000Z" },
      events: [{ identifier: "event-1" }],
      coverage: { calendarsUnread: 0, calendarsExcluded: 0 },
    });
  });

  // Upstream replaced a date it could not read with today, and answered about the wrong week
  // without saying so.
  it("given a range bound that is not a readable date, refuses and names the bound rather than replacing it", async () => {
    const result = await searchEvents({ text: "review", from: "next tuesday" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "arguments-invalid", evidence: expect.stringContaining("from") as string },
    });
    expect(eventStore.asked).toStrictEqual([]);
  });

  it("given search text containing script and shell syntax, matches it literally, and the text never reaches the store", async () => {
    const hostile = '"; do shell script "rm -rf ~" -- $(whoami) `id` .*';
    eventStore.holds(standUp, { ...review, identifier: "event-3", notes: `Agenda: ${hostile}` });

    const result = await searchEvents({ text: hostile });

    expect(result.structuredContent).toMatchObject({ events: [{ identifier: "event-3" }] });
    expect(JSON.stringify(eventStore.asked)).not.toContain("shell");
  });

  it("given text that is a pattern to other tools, matches only events that contain those very characters", async () => {
    const result = await searchEvents({ text: ".*" });

    expect(result.structuredContent).toMatchObject({ events: [] });
  });

  // faces-sh 42c2fd7: empty search text answered "no results", which an agent read as an
  // empty calendar.
  it("given empty search text, refuses rather than reporting that nothing was found", async () => {
    const result = await searchEvents({ text: "   " });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
  });

  it("given a calendar the settings exclude, never finds its events, whatever the text", async () => {
    eventStore.holds(standUp, { ...review, calendar: therapy });
    await searchingWith({ APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "cal-therapy" });

    const result = await searchEvents({ text: "forecast" });

    expect(result.structuredContent).toMatchObject({
      events: [],
      coverage: { calendarsExcluded: 1 },
    });
  });

  it("given a subscribed calendar that cannot be reached, still searches the others and counts it as unread", async () => {
    eventStore.cannotRead("cal-holidays");

    const result = await searchEvents({ text: "review" });

    expect(result.isError ?? false).toBe(false);
    expect(result.structuredContent).toMatchObject({
      events: [{ identifier: "event-2" }],
      coverage: { calendarsUnread: 1 },
    });
  });

  it("given calendar access was never granted, refuses with a permission failure rather than finding nothing", async () => {
    eventStore.refuses("calendar-access-not-granted");

    const result = await searchEvents({ text: "review" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: { code: "calendar-access-not-granted" },
    });
  });

  // fpjnijweide 42c9e11: upstream cut a long answer wherever the store happened to stop, so
  // next week's match could push out tomorrow's.
  it("given more matching events than the limit, reports the earliest of them and says the result is truncated", async () => {
    const result = await searchEvents({
      text: "u",
      limit: 1,
      from: "2026-09-18T00:00:00Z",
      to: "2026-09-25T00:00:00Z",
    });

    expect(result.structuredContent).toMatchObject({
      events: [{ identifier: "event-1" }],
      coverage: { truncated: true },
    });
  });

  it("given fewer matching events than the limit, says the result is not truncated", async () => {
    const result = await searchEvents({ text: "review", limit: 5 });

    expect(result.structuredContent).toMatchObject({
      events: [{ identifier: "event-2" }],
      coverage: { truncated: false },
    });
  });

  it("given search text with a space at its end, matches that space too: the text is never tidied before it is compared", async () => {
    const result = await searchEvents({ text: "Budget Room " });

    expect(result.structuredContent).toMatchObject({ events: [] });
  });
});
