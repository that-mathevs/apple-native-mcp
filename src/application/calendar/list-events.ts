import { inStartOrder, type Occurrence } from "../../domain/calendar/event.js";
import { defaultRange, type Range } from "../../domain/calendar/range.js";
import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
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
};

export type ListEventsDependencies = {
  readonly eventStore: EventStore;
  readonly now: () => Date;
  readonly timeZone: string;
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

  return succeeded({
    range,
    occurrences: inStartOrder(read.value.occurrences),
    calendarsUnread: read.value.calendarsUnread,
  });
};
