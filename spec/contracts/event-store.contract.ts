import { describe, expect, it } from "vitest";

import type { EventStore } from "../../src/application/calendar/event-store.js";
import type { Occurrence } from "../../src/domain/calendar/event.js";
import type { Range } from "../../src/domain/calendar/range.js";
import { dayIn, writtenDay } from "../../src/domain/time-zone.js";

/**
 * What every event store promises, whichever way it reaches macOS.
 *
 * The fake behind the acceptance scenarios is only worth trusting while it answers the same
 * contract as the helper-backed one, so this suite runs against both: against the fake
 * everywhere, and against the real store on a Mac with calendar access.
 */
export type EventStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{ readonly eventStore: EventStore }>;
};

/**
 * A store a scenario can load with occurrences.
 *
 * Only the fake can be loaded today: putting an event into a real calendar needs `create_event`,
 * which v1 builds later, so the real store answers the suite above and takes this one then.
 */
export type LoadableEventStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{
    readonly eventStore: EventStore;
    readonly holding: (...occurrences: readonly Occurrence[]) => Promise<void>;
  }>;
};

const noon = new Date("2026-09-18T16:00:00Z");

const dayAround = (instant: Date): Range => ({
  from: new Date(instant.getTime() - 60 * 60 * 1000),
  to: new Date(instant.getTime() + 60 * 60 * 1000),
});

const occurrence = (start: Date, title: string): Occurrence => ({
  identifier: `event-${title}`,
  title,
  start,
  end: new Date(start.getTime() + 30 * 60 * 1000),
  isAllDay: false,
  calendar: { identifier: "cal-1", title: "Work", account: "iCloud", acceptsNewEvents: true },
});

export const anEventStore = ({ name, build }: EventStoreUnderTest): void => {
  describe(`${name}, as an event store`, () => {
    it("given a range, answers with occurrences rather than a failure: a readable calendar always answers", async () => {
      const { eventStore } = await build();

      const read = await eventStore.occurrencesIn(dayAround(noon));

      expect(read).toMatchObject({ ok: true, value: { occurrences: expect.any(Array) as unknown[] } });
    });

    it("always says which calendars it could not read, so a short answer is never mistaken for an empty diary", async () => {
      const { eventStore } = await build();

      const read = await eventStore.occurrencesIn(dayAround(noon));

      expect(read).toMatchObject({ ok: true, value: { unreadCalendars: expect.any(Array) as unknown[] } });
    });

    // chrischall c1bf44b: upstream scanned every event for an identifier and timed out when
    // there was no match.
    it("given a reference that matches no event, answers with nothing rather than a failure", async () => {
      const { eventStore } = await build();

      const read = await eventStore.event({ identifier: "no-event-has-this-identifier" });

      expect(read).toStrictEqual({ ok: true, value: undefined });
    });

    it("always names the calendars it asked, so the calendars the settings leave out can be counted without counting their events", async () => {
      const { eventStore } = await build();

      const read = await eventStore.occurrencesIn(dayAround(noon));

      expect(read).toMatchObject({
        ok: true,
        value: { calendars: expect.any(Array) as unknown[] },
      });
    });

  });
};

export const anEventStoreThatListsCalendars = ({ name, build }: EventStoreUnderTest): void => {
  describe(`${name}, asked for its calendars`, () => {
    it("names every calendar with its identifier, its title, its calendar account and whether it accepts new events", async () => {
      const { eventStore } = await build();

      const read = await eventStore.calendars();

      expect(read.ok).toBe(true);
      for (const calendar of read.ok ? read.value : []) {
        expect(calendar).toStrictEqual({
          identifier: expect.any(String) as string,
          title: expect.any(String) as string,
          account: expect.any(String) as string,
          acceptsNewEvents: expect.any(Boolean) as boolean,
        });
      }
    });
  });
};

/**
 * A store a scenario may create events in, and the one calendar it may create them in.
 *
 * Against the real store that calendar is the one titled "scratch" and no other: v1 cannot
 * delete an event, so whatever this suite creates stays where it was put. Every title begins
 * "Contract check" so that it can be told from anything a person wrote.
 */
export type WritableEventStoreUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{
    readonly eventStore: EventStore;
    readonly calendar: string;
    /** The time zone the store's user is in, which an all-day event's days are counted in. */
    readonly timeZone: string;
  }>;
};

export const anEventStoreThatCreatesEvents = ({
  name,
  build,
}: WritableEventStoreUnderTest): void => {
  describe(`${name}, asked to create an event`, () => {
    it("answers with the event as it now holds it, in the calendar it was sent to, and can show it afterwards", async () => {
      const { eventStore, calendar } = await build();

      const created = await eventStore.create({
        title: "Contract check: lunch",
        calendarIdentifier: calendar,
        time: { kind: "timed", start: noon, end: new Date(noon.getTime() + 60 * 60 * 1000) },
      });

      expect(created).toMatchObject({
        ok: true,
        value: {
          confirmed: true,
          event: {
            title: "Contract check: lunch",
            start: noon,
            calendar: { identifier: calendar },
          },
        },
      });

      const identifier = (created.ok ? created.value.event?.identifier : undefined) ?? "";
      expect(await eventStore.event({ identifier })).toMatchObject({
        ok: true,
        value: { title: "Contract check: lunch" },
      });
    });

    // Upstream #34: made from instants, an all-day event slid onto the day before. This is the
    // one place that can show the real store keeps it on the days it was given.
    it("given an all-day event, holds it as an all-day event on exactly the days it was given, in the user's time zone", async () => {
      const { eventStore, calendar, timeZone } = await build();

      const created = await eventStore.create({
        title: "Contract check: conference",
        calendarIdentifier: calendar,
        time: {
          kind: "allDay",
          firstDay: { year: 2026, month: 9, day: 22 },
          lastDay: { year: 2026, month: 9, day: 24 },
        },
      });

      expect(created).toMatchObject({ ok: true, value: { event: { isAllDay: true } } });

      const held = created.ok ? created.value.event : undefined;
      const lastInstant = new Date((held?.end.getTime() ?? 0) - 1);
      expect(held && writtenDay(dayIn(timeZone, held.start))).toBe("2026-09-22");
      expect(held && writtenDay(dayIn(timeZone, lastInstant))).toBe("2026-09-24");
    });

    // chrischall 18660e4: a quote in a title ended upstream's AppleScript string and the rest ran.
    it("given a title, location and notes full of quotes, backslashes, line breaks and script text, holds each exactly as given", async () => {
      const { eventStore, calendar } = await build();
      const hostile = 'Contract check: "; do shell script "true" \\ `id` $(id)\nsecond line';

      const created = await eventStore.create({
        title: hostile,
        location: hostile,
        notes: hostile,
        calendarIdentifier: calendar,
        time: { kind: "timed", start: noon, end: new Date(noon.getTime() + 60 * 60 * 1000) },
      });

      const identifier = (created.ok ? created.value.event?.identifier : undefined) ?? "";
      expect(await eventStore.event({ identifier })).toMatchObject({
        ok: true,
        value: { title: hostile, location: hostile, notes: hostile },
      });
    });

    it("given a calendar it does not have, refuses rather than creating the event somewhere else", async () => {
      const { eventStore } = await build();

      const created = await eventStore.create({
        title: "Contract check: nowhere",
        calendarIdentifier: "no-calendar-has-this-identifier",
        time: { kind: "timed", start: noon, end: new Date(noon.getTime() + 60 * 60 * 1000) },
      });

      expect(created.ok).toBe(false);
    });

    it("names the default calendar, or says there is none, rather than failing", async () => {
      const { eventStore } = await build();

      expect(await eventStore.defaultCalendar()).toMatchObject({ ok: true });
    });
  });
};

export const anEventStoreThatCanBeLoaded = ({
  name,
  build,
}: LoadableEventStoreUnderTest): void => {
  describe(`${name}, loaded with occurrences`, () => {
    it("given a range holding nothing, answers with no occurrences rather than a failure", async () => {
      const { eventStore } = await build();

      const read = await eventStore.occurrencesIn(dayAround(noon));

      expect(read).toMatchObject({ ok: true, value: { occurrences: [] } });
    });

    it("given occurrences inside the range, returns them", async () => {
      const { eventStore, holding } = await build();
      await holding(occurrence(noon, "Stand-up"));

      const read = await eventStore.occurrencesIn(dayAround(noon));

      expect(read).toMatchObject({
        ok: true,
        value: { occurrences: [{ title: "Stand-up", calendar: { account: "iCloud" } }] },
      });
    });

    it("given an occurrence outside the range, leaves it out: a range means what it says", async () => {
      const { eventStore, holding } = await build();
      const nextWeek = new Date(noon.getTime() + 7 * 24 * 60 * 60 * 1000);
      await holding(occurrence(nextWeek, "Retro"));

      const read = await eventStore.occurrencesIn(dayAround(noon));

      expect(read).toMatchObject({ ok: true, value: { occurrences: [] } });
    });

    it("given a reference to one occurrence of a series, answers with that occurrence and its own times", async () => {
      const { eventStore, holding } = await build();
      const tomorrow = new Date(noon.getTime() + 24 * 60 * 60 * 1000);
      await holding(
        { ...occurrence(noon, "Stand-up"), originalStart: noon },
        { ...occurrence(tomorrow, "Stand-up"), originalStart: tomorrow },
      );

      const read = await eventStore.event({
        identifier: "event-Stand-up",
        originalStart: tomorrow,
      });

      expect(read).toMatchObject({
        ok: true,
        value: { start: tomorrow, originalStart: tomorrow },
      });
    });

    it("given a calendar holding nothing in the range, still names it among the calendars it asked", async () => {
      const { eventStore, holding } = await build();
      const nextWeek = new Date(noon.getTime() + 7 * 24 * 60 * 60 * 1000);
      await holding(occurrence(nextWeek, "Retro"));

      const read = await eventStore.occurrencesIn(dayAround(noon));

      expect(read).toMatchObject({ ok: true, value: { calendars: [{ identifier: "cal-1" }] } });
    });
  });
};
