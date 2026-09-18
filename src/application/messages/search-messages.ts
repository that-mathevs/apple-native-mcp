import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import type { Message } from "../../domain/messages/message.js";
import { greatestMatches, searchCeiling, searchDays } from "../../domain/messages/message.js";
import { relevance, searchQueryFrom } from "../../domain/search-query.js";
import { dayIn, startOfDay } from "../../domain/time-zone.js";
import type { MessageStore } from "./message-store.js";

export type SearchMessagesDependencies = {
  readonly messageStore: MessageStore;
  readonly now: () => Date;
  readonly timeZone: string;
};

export type SearchMessagesRequest = {
  readonly query: string;
  readonly from?: Date | undefined;
  readonly to?: Date | undefined;
  readonly chat?: string | undefined;
};

/** How far a search reached, all of it stated, so "no match" is never read as "not there". */
export type SearchCoverage = {
  readonly scanned: number;
  /** The ceiling stopped the scan before the start of the range. */
  readonly truncated: boolean;
  /** The oldest message scanned, when the scan stopped short. */
  readonly reachedBack?: Date;
  /** Messages whose text could not be read, which were not searched. */
  readonly textsUnread: number;
};

export type MessagesFound = {
  readonly range: { readonly from: Date; readonly to: Date };
  readonly matches: readonly Message[];
  readonly coverage: SearchCoverage;
};

/** The last `searchDays` whole days in the user's time zone, today included. */
const defaultRange = (now: Date, timeZone: string): { from: Date; to: Date } => {
  const today = dayIn(timeZone, now);
  return {
    from: startOfDay(timeZone, { ...today, day: today.day - (searchDays - 1) }),
    to: startOfDay(timeZone, { ...today, day: today.day + 1 }),
  };
};

export const searchMessages = async (
  { messageStore, now, timeZone }: SearchMessagesDependencies,
  request: SearchMessagesRequest,
): Promise<Outcome<MessagesFound>> => {
  const fallback = defaultRange(now(), timeZone);
  const range = { from: request.from ?? fallback.from, to: request.to ?? fallback.to };

  const scanned = await messageStore.messagesToSearch({
    ...range,
    ...(request.chat === undefined ? {} : { chat: request.chat }),
    ceiling: searchCeiling,
  });
  if (!scanned.ok) return scanned;

  const { messages, truncated } = scanned.value;
  const query = searchQueryFrom(request.query);

  const matches = messages
    .flatMap((message) => {
      const found = message.text === undefined ? undefined : relevance(query, message.text);
      return found === undefined ? [] : [{ message, found }];
    })
    .sort(
      (left, right) =>
        right.found - left.found ||
        right.message.timestamp.getTime() - left.message.timestamp.getTime(),
    )
    .slice(0, greatestMatches)
    .map(({ message }) => message);

  const oldest = messages.at(-1);
  return succeeded({
    range,
    matches,
    coverage: {
      scanned: messages.length,
      truncated,
      ...(truncated && oldest !== undefined ? { reachedBack: oldest.timestamp } : {}),
      textsUnread: messages.filter(({ textUnreadable }) => textUnreadable !== undefined).length,
    },
  });
};
