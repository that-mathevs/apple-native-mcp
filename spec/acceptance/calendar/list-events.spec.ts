import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { settingsFrom } from "../../../src/domain/settings.js";
import { aServer } from "../../support/a-server.js";
import { connectedTo } from "../../support/connected-client.js";
import { FakeEventStore } from "../../support/fake-event-store.js";
import { iCloud } from "../../support/calendar-accounts.js";

// What an agent sees through the tool, with a fake event store behind it. Upstream
// reported "today to next 7 days" in its description and then searched from now, so a
// morning meeting was missing with nothing to say it had been (upstream index.ts); every
// scenario here reads the range back out of the result for that reason.

const timeZone = "America/New_York";

/** 2026-09-18 12:00 in New York. */
const noon = new Date("2026-09-18T16:00:00Z");

const anEvent = {
  identifier: "event-1",
  title: "Stand-up",
  start: new Date("2026-09-18T13:00:00Z"),
  end: new Date("2026-09-18T13:15:00Z"),
  isAllDay: false,
  calendar: { identifier: "cal-1", title: "Work", account: iCloud, acceptsNewEvents: true },
} as const;

const earlier = {
  ...anEvent,
  identifier: "event-0",
  title: "Breakfast",
  start: new Date("2026-09-18T11:00:00Z"),
  end: new Date("2026-09-18T11:30:00Z"),
} as const;

describe("listing events", () => {
  let eventStore: FakeEventStore;
  let client: Client;

  /** What an agent gets back: a record, and whether the call is a refusal. */
  const listEvents = async (
    args: Record<string, unknown> = {},
  ): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "list_events", arguments: args });

  beforeEach(async () => {
    eventStore = new FakeEventStore();
    client = await connectedTo(
      aServer({ eventStore, now: () => noon, timeZone, settings: settingsFrom({}) }),
    );
  });

  it("given a range, returns the events in it in order, each naming its calendar and account", async () => {
    eventStore.holds(anEvent, earlier);

    const result = await listEvents({
      from: "2026-09-18T00:00:00-04:00",
      to: "2026-09-19T00:00:00-04:00",
    });

    expect(result.structuredContent).toMatchObject({
      events: [
        { identifier: "event-0", title: "Breakfast", calendar: { title: "Work", account: iCloud } },
        { identifier: "event-1", title: "Stand-up", calendar: { title: "Work", account: iCloud } },
      ],
    });
    expect(result.isError ?? false).toBe(false);
  });

  it("given no range, covers the start of today in the user's time zone for seven days, and says so", async () => {
    eventStore.holds(anEvent);

    const result = await listEvents();

    expect(result.structuredContent).toMatchObject({
      range: { from: "2026-09-18T04:00:00.000Z", to: "2026-09-25T04:00:00.000Z" },
    });
    expect(eventStore.asked).toStrictEqual([
      { from: new Date("2026-09-18T04:00:00Z"), to: new Date("2026-09-25T04:00:00Z") },
    ]);
  });

  it("given a series, returns every occurrence inside the range, not the series once", async () => {
    eventStore.holds(anEvent, { ...anEvent, start: new Date("2026-09-19T13:00:00Z"), end: new Date("2026-09-19T13:15:00Z") });

    const result = await listEvents();

    expect(result.structuredContent).toMatchObject({
      events: [
        { identifier: "event-1", start: "2026-09-18T13:00:00.000Z" },
        { identifier: "event-1", start: "2026-09-19T13:00:00.000Z" },
      ],
    });
  });

  it("given calendar access was never granted, refuses and names the setting to enable", async () => {
    eventStore.refuses("calendar-access-not-granted");

    const result = await listEvents();

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      failure: {
        code: "calendar-access-not-granted",
        setting: "Privacy & Security > Calendars",
      },
    });
  });

  it("given a calendar it could not read, returns the rest and says which it could not reach", async () => {
    eventStore.holds(anEvent);
    eventStore.cannotRead("cal-2");

    const result = await listEvents();

    expect(result.structuredContent).toMatchObject({
      events: [{ identifier: "event-1" }],
      coverage: { calendarsUnread: 1 },
    });
    expect(result.isError ?? false).toBe(false);
  });

  // Every occurrence of a series shares one event identifier (arr2036 9097294), so the index
  // has to hand back what tells them apart or no occurrence could be read on its own.
  it("given a series, reports each occurrence with the original start that addresses it within the series", async () => {
    const tomorrow = new Date("2026-09-19T13:00:00Z");
    eventStore.holds(
      { ...anEvent, originalStart: anEvent.start },
      { ...anEvent, start: tomorrow, end: new Date("2026-09-19T13:15:00Z"), originalStart: tomorrow },
    );

    const result = await listEvents();

    expect(result.structuredContent).toMatchObject({
      events: [
        { identifier: "event-1", originalStart: "2026-09-18T13:00:00.000Z" },
        { identifier: "event-1", originalStart: "2026-09-19T13:00:00.000Z" },
      ],
    });
  });
});
