import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { Message } from "../../domain/messages/message.js";
import { greatestMatches, searchCeiling, searchDays } from "../../domain/messages/search.js";
import { rankingBy, searchQueryFrom } from "../../domain/search-query.js";
import { dayIn, type LocalDay, startOfDay } from "../../domain/time-zone.js";
import type { MessageStore } from "./message-store.js";

export type SearchMessagesDependencies = {
  readonly messageStore: MessageStore;
  readonly now: () => Date;
  readonly timeZone: string;
};

/** One end of a range as written: an instant, or a whole day in the user's time zone. */
export type Bound = { readonly at: Date } | { readonly day: LocalDay };

export type SearchMessagesRequest = {
  readonly query: string;
  readonly from?: Bound | undefined;
  readonly to?: Bound | undefined;
  readonly chat?: string | undefined;
};

/** How far a search reached, all of it stated, so "no match" is never read as "not there". */
export type SearchCoverage = {
  readonly scanned: number;
  /** The ceiling stopped the scan before the start of the range. */
  readonly truncated: boolean;
  /** The oldest message scanned, when the scan stopped short. */
  readonly reachedBack?: Date;
  /** Every message that matched, of which the best are returned. */
  readonly matched: number;
  /** Messages whose text could not be read, and so were not searched. */
  readonly unsearched: number;
};

export type MessagesFound = {
  readonly range: { readonly from: Date; readonly to: Date };
  readonly matches: readonly Message[];
  readonly coverage: SearchCoverage;
};

const rangeNotForwards: NamedFailure = {
  code: "range-not-forwards",
  sentence: "Nothing was searched: the range ends at or before it starts.",
};

const dayAfter = (day: LocalDay): LocalDay => ({ ...day, day: day.day + 1 });

const daysBefore = (instant: Date, days: number): Date =>
  new Date(instant.getTime() - days * 24 * 60 * 60 * 1000);

/**
 * The range a search covers. A day alone is the whole of that day (MSG-77), from its local
 * midnight (MSG-78). With neither end, it is the last `searchDays` whole days, today included;
 * with only an end, the `searchDays` before it; with only a start, from it until tomorrow.
 */
const rangeOf = (
  { from, to }: SearchMessagesRequest,
  now: Date,
  timeZone: string,
): { from: Date; to: Date } => {
  const today = dayIn(timeZone, now);
  const end =
    to === undefined
      ? startOfDay(timeZone, dayAfter(today))
      : "at" in to
        ? to.at
        : startOfDay(timeZone, dayAfter(to.day));
  const start =
    from === undefined
      ? to === undefined
        ? startOfDay(timeZone, { ...today, day: today.day - (searchDays - 1) })
        : daysBefore(end, searchDays)
      : "at" in from
        ? from.at
        : startOfDay(timeZone, from.day);
  return { from: start, to: end };
};

const nothingScanned = (range: { from: Date; to: Date }): MessagesFound => ({
  range,
  matches: [],
  coverage: { scanned: 0, truncated: false, matched: 0, unsearched: 0 },
});

export const searchMessages = async (
  { messageStore, now, timeZone }: SearchMessagesDependencies,
  request: SearchMessagesRequest,
): Promise<Outcome<MessagesFound>> => {
  const range = rangeOf(request, now(), timeZone);
  if (range.to <= range.from) return failed(rangeNotForwards);

  // A query with nothing to find matches nothing (MSG-84), so nothing is read to find it.
  const query = searchQueryFrom(request.query);
  if (query.words.length === 0 && query.phrases.length === 0) {
    return succeeded(nothingScanned(range));
  }

  const scanned = await messageStore.messagesToSearch({
    ...range,
    ...(request.chat === undefined ? {} : { chat: request.chat }),
    ceiling: searchCeiling,
  });
  if (!scanned.ok) return scanned;

  const { messages, truncated } = scanned.value;
  const ranking = rankingBy(query);

  const ranked = messages
    .flatMap((message) => {
      const score = message.text === undefined ? undefined : ranking(message.text);
      return score === undefined ? [] : [{ message, score }];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.message.timestamp.getTime() - left.message.timestamp.getTime(),
    );

  const oldest = messages.at(-1);
  return succeeded({
    range,
    matches: ranked.slice(0, greatestMatches).map(({ message }) => message),
    coverage: {
      scanned: messages.length,
      truncated,
      ...(truncated && oldest !== undefined ? { reachedBack: oldest.timestamp } : {}),
      matched: ranked.length,
      unsearched: messages.filter(({ textUnreadable }) => textUnreadable !== undefined).length,
    },
  });
};
