/**
 * A search query as the grammar reads it (#24), and nothing else: plain data, so it can travel to
 * wherever the text it searches is read.
 *
 * Words and "quoted phrases" are what to find; a leading minus makes either something to leave
 * out. Words are optional and rank the results. Case and accents are folded, and every other
 * character is literal: there is no OR, no wildcard and no pattern (MSG-83 is rejected).
 */
export type SearchQuery = {
  /** Words and phrases to find, folded. A phrase is its words in order, one space apart. */
  readonly terms: readonly string[];
  /** Words and phrases whose presence leaves a text out, folded the same way. */
  readonly excluded: readonly string[];
};

/** Text as a search compares it: accents and case folded, and runs of space made one space. */
const folded = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();

const isWordCharacter = (character: string | undefined): boolean =>
  character !== undefined && /[\p{L}\p{N}]/u.test(character);

/**
 * Whether the folded text holds the term as whole words: where the term begins or ends with a
 * letter or a digit, the text may not run on into another one there.
 */
const holds = (text: string, term: string): boolean => {
  for (let at = text.indexOf(term); at !== -1; at = text.indexOf(term, at + 1)) {
    const before = text[at - 1];
    const after = text[at + term.length];
    const startsClean = !isWordCharacter(term[0]) || !isWordCharacter(before);
    const endsClean = !isWordCharacter(term[term.length - 1]) || !isWordCharacter(after);
    if (startsClean && endsClean) return true;
  }
  return false;
};

/** One piece of a query as it was written: a word or a phrase, to find or to leave out. */
type Piece = { readonly text: string; readonly excluded: boolean };

const piecesOf = (query: string): Piece[] => {
  const pieces: Piece[] = [];
  let at = 0;

  while (at < query.length) {
    if (/\s/u.test(query.charAt(at))) {
      at += 1;
      continue;
    }

    // A minus leaves out what follows it; a minus on its own is a word like any other.
    const next = query.charAt(at + 1);
    const excluded = query.charAt(at) === "-" && next !== "" && !/\s/u.test(next);
    const start = excluded ? at + 1 : at;

    if (query.charAt(start) === '"') {
      const close = query.indexOf('"', start + 1);
      const end = close === -1 ? query.length : close;
      pieces.push({ text: query.slice(start + 1, end), excluded });
      at = end + 1;
    } else {
      const space = query.slice(start).search(/\s/u);
      const end = space === -1 ? query.length : start + space;
      pieces.push({ text: query.slice(start, end), excluded });
      at = end;
    }
  }

  return pieces;
};

export const searchQueryFrom = (query: string): SearchQuery => {
  const pieces = piecesOf(query)
    .map(({ text, excluded }) => ({ text: folded(text), excluded }))
    .filter(({ text }) => text !== "");

  return {
    terms: [...new Set(pieces.filter(({ excluded }) => !excluded).map(({ text }) => text))],
    excluded: [...new Set(pieces.filter(({ excluded }) => excluded).map(({ text }) => text))],
  };
};

/**
 * How well a text matches: how many of the query's terms it holds, or nothing when it holds none
 * or holds something the query leaves out. A query with nothing to find matches nothing (MSG-84).
 */
export const relevance = (query: SearchQuery, text: string): number | undefined => {
  const searched = folded(text);
  if (query.excluded.some((term) => holds(searched, term))) return undefined;

  const found = query.terms.filter((term) => holds(searched, term)).length;
  return found === 0 ? undefined : found;
};
