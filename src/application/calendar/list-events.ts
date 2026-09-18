import { inStartOrder, type Occurrence } from "../../domain/calendar/event.js";
import { defaultRange, type Range } from "../../domain/calendar/range.js";
import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import { excludes, type Settings } from "../../domain/settings.js";
import type { EventStore } from "./event-store.js";

/** What the caller asked for. Either bound may be left out, and then the default range applies. */
export type ListEventsRequest = {
  readonly from?: Date;
  readonly to?: Date;
};

export type ListedEvents = {
  /** The range actually read, always reported: a caller can't otherwise tell what "no events" covers. */
  readonly range: Range;
  readonly occurrences: readonly Occurrence[];
  readonly calendarsUnread: number;
  /**
   * How many calendars the settings kept back. Calendars and not events: a count of events
   * would tell an agent asking hour by hour exactly when an excluded calendar is busy.
   */
  readonly calendarsExcluded: number;
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

export const listEvents = async (
  dependencies: ListEventsDependencies,
  request: ListEventsRequest,
): Promise<Outcome<ListedEvents>> => {
  const range = rangeFor(request, dependencies);
  const read = await dependencies.eventStore.occurrencesIn(range);

  if (!read.ok) return read;

  const isExcluded = (identifier: string): boolean =>
    excludes(dependencies.settings.calendars, identifier);

  return succeeded({
    range,
    occurrences: inStartOrder(
      read.value.occurrences.filter(({ calendar }) => !isExcluded(calendar.identifier)),
    ),
    calendarsUnread: read.value.unreadCalendars.filter((unread) => !isExcluded(unread)).length,
    calendarsExcluded: read.value.calendars.filter(({ identifier }) => isExcluded(identifier))
      .length,
  });
};
