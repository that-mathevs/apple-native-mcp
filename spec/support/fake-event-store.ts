import type { EventStore, EventsInRange } from "../../src/application/calendar/event-store.js";
import type { Calendar, Occurrence } from "../../src/domain/calendar/event.js";
import type { Range } from "../../src/domain/calendar/range.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";

const failures: Record<string, NamedFailure> = {
  "calendar-access-not-granted": {
    code: "calendar-access-not-granted",
    sentence: "Calendar access has not been granted to apple-native-mcp.",
    setting: "Privacy & Security > Calendars",
  },
};

/**
 * An event store held in memory.
 *
 * It answers the same contract as the helper-backed one, so the scenarios that use it are
 * worth trusting only for as long as it passes that contract (spec/contracts).
 */
export class FakeEventStore implements EventStore {
  readonly asked: Range[] = [];

  #occurrences: readonly Occurrence[] = [];
  #unreadCalendars: readonly string[] = [];
  #failure: NamedFailure | undefined;

  holds(...occurrences: readonly Occurrence[]): void {
    this.#occurrences = occurrences;
  }

  /** A calendar that won't answer: a subscribed calendar whose server is unreachable. */
  cannotRead(...calendarIdentifiers: readonly string[]): void {
    this.#unreadCalendars = calendarIdentifiers;
  }

  refuses(code: keyof typeof failures): void {
    this.#failure = failures[code];
  }

  occurrencesIn(range: Range): Promise<Outcome<EventsInRange>> {
    this.asked.push(range);

    if (this.#failure) return Promise.resolve(failed(this.#failure));

    const inRange = this.#occurrences.filter(
      (occurrence) => occurrence.start >= range.from && occurrence.start < range.to,
    );

    return Promise.resolve(
      succeeded({
        occurrences: inRange,
        calendars: this.#calendars(),
        unreadCalendars: this.#unreadCalendars,
      }),
    );
  }

  /** The calendars of everything held, in or out of the range: a store asks them all. */
  #calendars(): readonly Calendar[] {
    const byIdentifier = new Map(
      this.#occurrences.map(({ calendar }) => [calendar.identifier, calendar] as const),
    );
    return [...byIdentifier.values()];
  }
}
