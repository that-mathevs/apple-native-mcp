import { describe, expect, it } from "vitest";

import type { EventStore } from "../../src/application/calendar/event-store.js";
import type { Occurrence } from "../../src/domain/calendar/event.js";
import type { Range } from "../../src/domain/calendar/range.js";

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
