import { mentions } from "../../domain/calendar/event.js";
import type { Outcome } from "../../domain/failure.js";
import {
  indexOfEvents,
  type EventIndex,
  type ListEventsDependencies,
  type ListEventsRequest,
} from "./list-events.js";

export type SearchEventsRequest = ListEventsRequest & { readonly text: string };

/**
 * The events in a range that mention some text.
 *
 * A search is the index of a range with fewer events in it: the same range rules, the same
 * calendars kept from the agent, the same coverage. The store is asked only for the range, so
 * the text never reaches anything that could run it.
 */
export const searchEvents = async (
  dependencies: ListEventsDependencies,
  { text, ...request }: SearchEventsRequest,
): Promise<Outcome<EventIndex>> =>
  await indexOfEvents(dependencies, request, (occurrence) => mentions(occurrence, text));
