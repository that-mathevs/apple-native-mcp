import {
  defaultLimit,
  earliest,
  inStartOrder,
  type Occurrence,
} from "../../domain/calendar/event.js";
import { defaultRange, type Range } from "../../domain/calendar/range.js";
import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import { excludes, type Settings } from "../../domain/settings.js";
import type { EventStore } from "./event-store.js";

/** What the caller asked for. Either bound may be left out, and then the default range applies. */
export type ListEventsRequest = {
  readonly from?: Date;
  readonly to?: Date;
  /** The most events to report. The earliest are kept. */
  readonly limit?: number;
};

export type EventIndex = {
  /** The range actually read, always reported: a caller can't otherwise tell what "no events" covers. */
  readonly range: Range;
  readonly occurrences: readonly Occurrence[];
  readonly calendarsUnread: number;
  /**
   * How many calendars the settings kept back. Calendars and not events: a count of events
   * would tell an agent asking hour by hour exactly when an excluded calendar is busy.
   */
  readonly calendarsExcluded: number;
  /** Whether the limit left events behind, so a full page is never read as the whole range. */
  readonly truncated: boolean;
};

export type ListEventsDependencies = {
  readonly eventStore: EventStore;
  readonly now: () => Date;
  readonly timeZone: string;
  readonly settings: Settings;
};

const rangeFor = (
  request: ListEventsRequest,
  { now, timeZone }: ListEventsDependencies,
): Range => {
  const fallback = defaultRange(timeZone, now());
  return { from: request.from ?? fallback.from, to: request.to ?? fallback.to };
};

/**
 * The events in a range that pass a test, earliest first and no more than the limit. Listing
 * keeps them all and searching keeps the ones that mention some text; the limit applies to what
 * was kept, so a match is never pushed out by events that didn't match.
 */
export const indexOfEvents = async (
  dependencies: ListEventsDependencies,
  request: ListEventsRequest,
  keeping: (occurrence: Occurrence) => boolean,
): Promise<Outcome<EventIndex>> => {
  const range = rangeFor(request, dependencies);
  const read = await dependencies.eventStore.occurrencesIn(range);

  if (!read.ok) return read;

  const isExcluded = (identifier: string): boolean =>
    excludes(dependencies.settings.calendars, identifier);

  const kept = inStartOrder(
    read.value.occurrences.filter(
      (occurrence) => !isExcluded(occurrence.calendar.identifier) && keeping(occurrence),
    ),
  );

  return succeeded({
    range,
    ...earliest(kept, request.limit ?? defaultLimit),
    calendarsUnread: read.value.unreadCalendars.filter((unread) => !isExcluded(unread)).length,
    calendarsExcluded: read.value.calendars.filter(({ identifier }) => isExcluded(identifier))
      .length,
  });
};

export const listEvents = async (
  dependencies: ListEventsDependencies,
  request: ListEventsRequest,
): Promise<Outcome<EventIndex>> => await indexOfEvents(dependencies, request, () => true);
