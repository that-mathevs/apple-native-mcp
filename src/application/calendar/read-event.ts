import type { EventReference, Occurrence } from "../../domain/calendar/event.js";
import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import { excludes, type Settings } from "../../domain/settings.js";
import type { EventStore } from "./event-store.js";

export type ReadEventDependencies = {
  readonly eventStore: EventStore;
  readonly settings: Settings;
};

const noSuchEvent = ({ originalStart }: EventReference): NamedFailure => ({
  code: "event-not-found",
  sentence:
    originalStart === undefined
      ? "No event has that identifier."
      : "No event has that identifier and original start.",
});

/**
 * One event in full.
 *
 * An event in a calendar the settings exclude answers exactly as one that doesn't exist, so
 * an identifier learnt elsewhere can't be used to find out that the calendar holds it.
 */
export const readEvent = async (
  { eventStore, settings }: ReadEventDependencies,
  reference: EventReference,
): Promise<Outcome<Occurrence>> => {
  const read = await eventStore.event(reference);

  if (!read.ok) return read;

  const found = read.value;

  if (found === undefined || excludes(settings.calendars, found.calendar.identifier)) {
    return failed(noSuchEvent(reference));
  }

  return succeeded(found);
};
