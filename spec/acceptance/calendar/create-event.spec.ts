import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { beforeEach, describe, expect, it } from "vitest";

import { aClientOfTheCalendar, therapy, work } from "../../support/calendar-server.js";
import { FakeEventStore } from "../../support/fake-event-store.js";

// What happens when an agent asks for a new event. Upstream wrote to the first calendar it
// found, which could be a subscription or somebody's shared calendar (upstream
// utils/calendar.ts:274; morquis d76f3ec), and built the event out of AppleScript strings.

const on = { APPLE_NATIVE_MCP_CAPABILITIES: "create_event" };

const lunch = {
  title: "Lunch with Sam",
  start: "2026-09-22T12:30:00-04:00",
  end: "2026-09-22T13:30:00-04:00",
};

const holidays = {
  identifier: "cal-holidays",
  title: "UK Holidays",
  account: "Subscriptions",
  acceptsNewEvents: false,
} as const;

describe("creating an event", () => {
  let eventStore: FakeEventStore;
  let client: Client;

  const createEvent = async (args: Record<string, unknown>): ReturnType<Client["callTool"]> =>
    await client.callTool({ name: "create_event", arguments: args });

  beforeEach(async () => {
    eventStore = new FakeEventStore();
    eventStore.hasCalendars(work, therapy, holidays);
    eventStore.defaultsTo(work);
    client = await aClientOfTheCalendar(eventStore, on);
  });

  // therealap d50bfae: the user already answered "which calendar" in Calendar's own settings.
  it("given no calendar identifier, creates the event in the user's default calendar and reports the calendar it used", async () => {
    const result = await createEvent(lunch);

    expect(result.isError ?? false).toBe(false);
    expect(result.structuredContent).toMatchObject({
      outcome: "created",
      event: {
        title: "Lunch with Sam",
        start: "2026-09-22T16:30:00.000Z",
        end: "2026-09-22T17:30:00.000Z",
        calendar: { identifier: "cal-work", title: "Work", account: "iCloud" },
      },
    });
  });

  it("given the capability is off, offers no such tool and refuses a call to it, creating nothing", async () => {
    client = await aClientOfTheCalendar(eventStore, {});

    const offered = (await client.listTools()).tools.map((tool) => tool.name);
    const result = await createEvent(lunch);

    expect(offered).not.toContain("create_event");
    expect(result.structuredContent).toMatchObject({ failure: { code: "capability-off" } });
    expect(eventStore.created).toStrictEqual([]);
  });

  it("given a calendar identifier, creates the event in that calendar rather than in the default calendar", async () => {
    const result = await createEvent({ ...lunch, calendarIdentifier: "cal-therapy" });

    expect(result.structuredContent).toMatchObject({
      event: { calendar: { identifier: "cal-therapy" } },
    });
  });

  // arr2036 9097294 fell back to the default calendar for a name it did not know, so an event
  // meant for one calendar turned up, without a word, in another.
  it("given a calendar that does not exist, refuses and creates nothing: an event never lands somewhere it was not sent", async () => {
    const result = await createEvent({ ...lunch, calendarIdentifier: "cal-gone" });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ failure: { code: "calendar-not-found" } });
    expect(eventStore.created).toStrictEqual([]);
  });

  it("given a calendar that does not accept new events, refuses rather than writing somewhere else", async () => {
    const result = await createEvent({ ...lunch, calendarIdentifier: "cal-holidays" });

    expect(result.structuredContent).toMatchObject({
      failure: { code: "calendar-not-writable" },
    });
    expect(eventStore.created).toStrictEqual([]);
  });

  it("given a calendar the settings exclude, answers exactly as for a calendar that does not exist", async () => {
    client = await aClientOfTheCalendar(eventStore, {
      ...on,
      APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "cal-therapy",
    });

    const excluded = await createEvent({ ...lunch, calendarIdentifier: "cal-therapy" });
    const missing = await createEvent({ ...lunch, calendarIdentifier: "cal-gone" });

    expect(excluded.structuredContent).toStrictEqual(missing.structuredContent);
    expect(eventStore.created).toStrictEqual([]);
  });

  it("given no calendar identifier and a default calendar the settings exclude, refuses and asks for a calendar identifier rather than writing to it", async () => {
    client = await aClientOfTheCalendar(eventStore, {
      ...on,
      APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "cal-work",
    });

    const result = await createEvent(lunch);

    expect(result.structuredContent).toMatchObject({
      failure: { code: "calendar-identifier-needed" },
    });
    expect(eventStore.created).toStrictEqual([]);
  });

  // Upstream spliced these into an AppleScript string, where a quote ended the string and the
  // rest of the title ran (chrischall 18660e4, ANierbeck 3005df4). Here they are JSON fields
  // all the way to the store.
  it("given a title, location and notes full of quotes, backslashes, line breaks and script text, hands each to the store exactly as given", async () => {
    const hostile = {
      title: 'Lunch" & do shell script "rm -rf ~" & "',
      location: "C:\\Temp\\new `whoami` $(id)",
      notes: "line one\nline two\r\n\ttabbed 'single' \"double\" \\",
    };

    const result = await createEvent({ ...lunch, ...hostile });

    expect(eventStore.created).toMatchObject([hostile]);
    expect(result.structuredContent).toMatchObject({ event: { title: hostile.title } });
  });

  // faces-sh bcdc856, upstream #27: an agent that retried a slow create left the same event
  // in the calendar three times.
  it("given an event with the same title already overlapping that time, refuses and names it so it can be read or changed instead", async () => {
    await createEvent(lunch);

    const again = await createEvent({ ...lunch, title: "lunch with sam " });

    expect(again.isError).toBe(true);
    expect(again.structuredContent).toMatchObject({
      failure: { code: "event-duplicate", evidence: expect.stringContaining("event-1") as string },
    });
    expect(eventStore.created).toHaveLength(1);
  });

  it("given the caller says a duplicate is wanted, creates the event despite the one already there", async () => {
    await createEvent(lunch);

    const again = await createEvent({ ...lunch, evenIfDuplicate: true });

    expect(again.structuredContent).toMatchObject({ outcome: "created" });
    expect(eventStore.created).toHaveLength(2);
  });

  it("given an event with the same title at another time, creates it: only an overlapping one is a duplicate", async () => {
    await createEvent(lunch);

    const nextDay = await createEvent({
      ...lunch,
      start: "2026-09-23T12:30:00-04:00",
      end: "2026-09-23T13:30:00-04:00",
    });

    expect(nextDay.structuredContent).toMatchObject({ outcome: "created" });
  });

  // Upstream #34, arr2036 3a26c9a: an all-day event made from a midnight instant slid to the
  // day before for everyone west of UTC.
  it("given an all-day event, hands the store its days as days, never as instants, so it stays on its day in the user's time zone", async () => {
    const result = await createEvent({
      title: "Conference",
      firstDay: "2026-09-22",
      lastDay: "2026-09-24",
    });

    expect(eventStore.created).toMatchObject([
      {
        time: {
          kind: "allDay",
          firstDay: { year: 2026, month: 9, day: 22 },
          lastDay: { year: 2026, month: 9, day: 24 },
        },
      },
    ]);
    expect(result.structuredContent).toMatchObject({
      event: { isAllDay: true, firstDay: "2026-09-22", lastDay: "2026-09-24" },
    });
  });

  it("given an all-day event with no last day, makes it that one day", async () => {
    await createEvent({ title: "Birthday", firstDay: "2026-09-22" });

    const the22nd = { year: 2026, month: 9, day: 22 };
    expect(eventStore.created).toMatchObject([
      { time: { kind: "allDay", firstDay: the22nd, lastDay: the22nd } },
    ]);
  });

  it("given both a start and a first day, or neither, refuses and says how an event's time is given", async () => {
    const both = await createEvent({ ...lunch, firstDay: "2026-09-22" });
    const neither = await createEvent({ title: "Lunch" });

    expect(both.structuredContent).toMatchObject({ failure: { code: "event-time-invalid" } });
    expect(neither.structuredContent).toMatchObject({ failure: { code: "event-time-invalid" } });
    expect(eventStore.created).toStrictEqual([]);
  });

  it("given an end that is not after the start, refuses rather than guessing a length", async () => {
    const result = await createEvent({ ...lunch, end: lunch.start });

    expect(result.structuredContent).toMatchObject({ failure: { code: "event-time-invalid" } });
  });

  // therealap 1a09e54 reported success as soon as the script returned, whatever the calendar
  // then held. A retry after a false failure is how duplicates are made, so this is not an error.
  it("given the store took the event but could not show it afterwards, reports an unconfirmed outcome and not a failure", async () => {
    eventStore.losesSightOfWhatItSaves();

    const result = await createEvent(lunch);

    expect(result.isError ?? false).toBe(false);
    expect(result.structuredContent).toMatchObject({ outcome: "unconfirmed" });
  });

  it("given the store never said what became of the event, reports an unconfirmed outcome with no event to show, and still not a failure", async () => {
    eventStore.neverSaysWhatBecameOfAnEvent();

    const result = await createEvent(lunch);

    expect(result.isError ?? false).toBe(false);
    expect(result.structuredContent).toStrictEqual({ outcome: "unconfirmed" });
  });

  it("given a title that says nothing, refuses rather than creating an event nobody could find again", async () => {
    const result = await createEvent({ ...lunch, title: "   " });

    expect(result.structuredContent).toMatchObject({ failure: { code: "arguments-invalid" } });
    expect(eventStore.created).toStrictEqual([]);
  });

  // upstream PR #76: a client can ask before a tool that changes something runs, but only if
  // the tool says that it does. The hints follow MCP's meanings: it adds, it destroys nothing,
  // and an event with no invitees reaches nobody.
  it("says of itself that it changes a store, destroys nothing and reaches nobody else", async () => {
    const { tools } = await client.listTools();

    expect(tools.find((tool) => tool.name === "create_event")?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    });
  });
});
