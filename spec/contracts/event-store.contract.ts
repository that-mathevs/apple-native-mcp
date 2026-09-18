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
  calendar: { identifier: "cal-1", title: "Work", account: "iCloud" },
});

export const anEventStore = ({ name, build }: EventStoreUnderTest): void => {
  describe(`${name}, as an event store`, () => {
    it("given a range, answers with occurrences rather than a failure: a readable calendar always answers", async () => {
      const { eventStore } = await build();

      const read = await eventStore.occurrencesIn(dayAround(noon));

      expect(read).toMatchObject({ ok: true, value: { occurrences: expect.any(Array) as unknown[] } });
    });

    it("always says how many calendars it could not read, so a short answer is never mistaken for an empty diary", async () => {
      const { eventStore } = await build();

      const read = await eventStore.occurrencesIn(dayAround(noon));

      expect(read).toMatchObject({ ok: true, value: { calendarsUnread: expect.any(Number) as number } });
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

  });
};
