import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { Message } from "../../domain/messages/message.js";
import { greatestMatches, searchCeiling, searchDays } from "../../domain/messages/search.js";
import { rankingBy, searchQueryFrom } from "../../domain/search-query.js";
import { type Bound, rangeNotForwards, searchRangeOf } from "../../domain/search-range.js";
import {
  type ContactNames,
  type ContactNamesFound,
  contactNamesFor,
  sendersOf,
} from "./contact-names.js";
import type { MessageStore } from "./message-store.js";

export type SearchMessagesDependencies = {
  readonly messageStore: MessageStore;
  readonly contactNames: ContactNames;
  readonly now: () => Date;
  readonly timeZone: string;
};

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
  /** The contact names of the matches' senders. */
  readonly contactNames: Outcome<ContactNamesFound>;
  readonly coverage: SearchCoverage;
};

const nothingScanned = (range: { from: Date; to: Date }): MessagesFound => ({
  range,
  matches: [],
  contactNames: succeeded(new Map()),
  coverage: { scanned: 0, truncated: false, matched: 0, unsearched: 0 },
});

export const searchMessages = async (
  dependencies: SearchMessagesDependencies,
  request: SearchMessagesRequest,
): Promise<Outcome<MessagesFound>> => {
  const { messageStore, now, timeZone } = dependencies;
  const range = searchRangeOf(request, now(), timeZone, searchDays);
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
  const matches = ranked.slice(0, greatestMatches).map(({ message }) => message);
  return succeeded({
    range,
    matches,
    contactNames: await contactNamesFor(dependencies, sendersOf(matches)),
    coverage: {
      scanned: messages.length,
      truncated,
      ...(truncated && oldest !== undefined ? { reachedBack: oldest.timestamp } : {}),
      matched: ranked.length,
      unsearched: messages.filter(({ textUnreadable }) => textUnreadable !== undefined).length,
    },
  });
};
