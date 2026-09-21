import type {
  CreatedEvent,
  EventStore,
  EventsInRange,
} from "../../src/application/calendar/event-store.js";
import type {
  Calendar,
  EventReference,
  Occurrence,
} from "../../src/domain/calendar/event.js";
import { rangeOf, type NewEvent } from "../../src/domain/calendar/new-event.js";
import type { Range } from "../../src/domain/calendar/range.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";

/** What the helper answers when the user refused calendar access, word for word. */
const failures: Record<string, NamedFailure> = {
  "calendar-permission-missing": {
    code: "calendar-permission-missing",
    sentence:
      "apple-native-mcp cannot read your calendar until it is allowed to, in System Settings > " +
      "Privacy & Security > Calendars > apple-native-mcp.",
    evidence: "refused",
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
  #ownCalendars: readonly Calendar[] = [];
  #default: Calendar | undefined;
  #confirms = true;
  #answers = true;

  /** Every event the store was asked to create, as it was asked. */
  readonly created: NewEvent[] = [];
  #unreadCalendars: readonly string[] = [];
  #failure: NamedFailure | undefined;

  holds(...occurrences: readonly Occurrence[]): void {
    this.#occurrences = occurrences;
  }

  /** Calendars the store has whether or not anything is held in them. */
  hasCalendars(...calendars: readonly Calendar[]): void {
    this.#ownCalendars = calendars;
  }

  /** The store takes what it is given and then cannot find it again: a sync that has not landed. */
  losesSightOfWhatItSaves(): void {
    this.#confirms = false;
  }

  /** The store is given the event and never says what became of it: a helper that died. */
  neverSaysWhatBecameOfAnEvent(): void {
    this.#answers = false;
  }

  /** The calendar the user set in Calendar for new events. */
  defaultsTo(calendar: Calendar): void {
    this.#default = calendar;
  }

  /** A calendar that won't answer: a subscribed calendar whose server is unreachable. */
  cannotRead(...calendarIdentifiers: readonly string[]): void {
    this.#unreadCalendars = calendarIdentifiers;
  }

  refuses(code: keyof typeof failures): void {
    this.#failure = failures[code];
  }

  defaultCalendar(): Promise<Outcome<Calendar | undefined>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    return Promise.resolve(succeeded(this.#default));
  }

  create(event: NewEvent): Promise<Outcome<CreatedEvent>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    this.created.push(event);

    if (!this.#answers) return Promise.resolve(succeeded({ confirmed: false }));

    const calendar = this.#calendars().find(
      ({ identifier }) => identifier === event.calendarIdentifier,
    );
    if (calendar === undefined) {
      return Promise.resolve(
        failed({ code: "calendar-not-found", sentence: "The store has no such calendar." }),
      );
    }

    // A real store holds an all-day event from the user's own midnight, and this user is in
    // New York, as every calendar scenario's is.
    const { from: start, to: end } = rangeOf(event.time, "America/New_York");

    const saved: Occurrence = {
      identifier: `event-${String(this.created.length)}`,
      title: event.title,
      start,
      end,
      isAllDay: event.time.kind === "allDay",
      calendar,
      ...(event.location === undefined ? {} : { location: event.location }),
      ...(event.notes === undefined ? {} : { notes: event.notes }),
    };
    this.#occurrences = [...this.#occurrences, saved];

    return Promise.resolve(succeeded({ event: saved, confirmed: this.#confirms }));
  }

  calendars(): Promise<Outcome<readonly Calendar[]>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    return Promise.resolve(succeeded(this.#calendars()));
  }

  event({ identifier, originalStart }: EventReference): Promise<Outcome<Occurrence | undefined>> {
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    const found = this.#occurrences
      .filter((occurrence) => occurrence.identifier === identifier)
      .filter(
        (occurrence) =>
          originalStart === undefined ||
          occurrence.originalStart?.getTime() === originalStart.getTime(),
      )
      .sort((left, right) => left.start.getTime() - right.start.getTime())[0];

    return Promise.resolve(succeeded(found));
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
      [...this.#ownCalendars, ...this.#occurrences.map(({ calendar }) => calendar)].map(
        (calendar) => [calendar.identifier, calendar] as const,
      ),
    );
    return [...byIdentifier.values()];
  }
}
