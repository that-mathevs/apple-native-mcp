/**
 * A search query as the grammar reads it (#24): plain data, so it can travel to wherever the text
 * it searches is read.
 *
 * Words and "quoted phrases" are what to find, and a leading minus makes either an exclusion.
 * Words are optional and rank the results. Case, accents and compatibility forms are folded, and
 * every other character is literal: there is no OR, no wildcard and no pattern (MSG-83 is
 * rejected).
 */
export type SearchQuery = {
  readonly words: readonly string[];
  /** Each phrase's words in order, one space apart. */
  readonly phrases: readonly string[];
  /** Words and phrases whose presence leaves a text out. */
  readonly exclusions: readonly string[];
};

/** Scripts written without spaces between words, where a word stands wherever it is found. */
const unspaced =
  "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Thai}" +
  "\\p{Script=Lao}\\p{Script=Khmer}\\p{Script=Myanmar}";

/** What a word is made of in a script that spaces its words, an apostrophe within it included. */
const spacedWordCharacter = `[[\\p{L}\\p{N}\\p{M}']--[${unspaced}]]`;
const isSpacedWordCharacter = new RegExp(`^${spacedWordCharacter}$`, "v");

/** Accents: the marks that sit on a Latin, Greek or Cyrillic letter, and only those. */
const accents = /([\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}])\p{M}+/gu;

/**
 * Text as a search compares it: compatibility forms and accents folded, a curly apostrophe read
 * as the straight one a query is typed with, case folded, and runs of space made one space.
 */
const folded = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(accents, "$1")
    .replace(/[‘’ʼ]/gu, "'")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();

/** Every character literal, as a regular expression reads it. */
const literally = (text: string): string => text.replace(/[\\^$.*+?()[\]{}|/]/gu, "\\$&");

/**
 * The whole of a word or phrase in folded text. Where it begins or ends with a letter of a
 * spaced script, the text may not run on into another there; elsewhere it may stand anywhere.
 */
const wholly = (term: string): RegExp => {
  const [first = "", last = ""] = [term.at(0), term.at(-1)];
  const before = isSpacedWordCharacter.test(first) ? `(?<!${spacedWordCharacter})` : "";
  const after = isSpacedWordCharacter.test(last) ? `(?!${spacedWordCharacter})` : "";
  return new RegExp(`${before}${literally(term)}${after}`, "v");
};

/** One word or phrase as the query wrote it, and whether it is an exclusion. */
type Written = { readonly text: string; readonly excluded: boolean };

const writtenIn = (query: string): Written[] => {
  const written: Written[] = [];
  let at = 0;

  while (at < query.length) {
    if (/\s/u.test(query.charAt(at))) {
      at += 1;
      continue;
    }

    // A minus leaves out what follows it; a minus on its own is a mark like any other.
    const next = query.charAt(at + 1);
    const excluded = query.charAt(at) === "-" && next !== "" && !/\s/u.test(next);
    const start = excluded ? at + 1 : at;

    if (query.charAt(start) === '"') {
      const close = query.indexOf('"', start + 1);
      const end = close === -1 ? query.length : close;
      written.push({ text: query.slice(start + 1, end), excluded });
      at = end + 1;
    } else {
      const space = query.slice(start).search(/\s/u);
      const end = space === -1 ? query.length : start + space;
      written.push({ text: query.slice(start, end), excluded });
      at = end;
    }
  }

  return written;
};

export const searchQueryFrom = (query: string): SearchQuery => {
  // A word or phrase with no letter or digit, such as a lone dash, would find only punctuation.
  const read = writtenIn(query)
    .map(({ text, excluded }) => ({ text: folded(text), excluded }))
    .filter(({ text }) => /[\p{L}\p{N}]/u.test(text));

  const found = read.filter(({ excluded }) => !excluded).map(({ text }) => text);
  return {
    words: [...new Set(found.filter((text) => !text.includes(" ")))],
    phrases: [...new Set(found.filter((text) => text.includes(" ")))],
    exclusions: [...new Set(read.filter(({ excluded }) => excluded).map(({ text }) => text))],
  };
};

/**
 * How a query ranks a text: how many of its words and phrases the text holds, or nothing when it
 * holds none of them or holds an exclusion. A query with nothing to find matches nothing
 * (MSG-84). The query is read once, so one search ranks thousands of texts at the cost of one.
 */
export const rankingBy = (query: SearchQuery): ((text: string) => number | undefined) => {
  const found = [...query.words, ...query.phrases].map(findingOf);
  const excluded = query.exclusions.map(findingOf);

  return (text) => {
    const searched = searchable(text);
    if (excluded.some((exclusion) => exclusion(searched))) return undefined;

    const held = found.filter((finding) => finding(searched)).length;
    return held === 0 ? undefined : held;
  };
};

/** Folded text, and the whole words it holds in scripts that space their words. */
type Searchable = { readonly text: string; readonly words: ReadonlySet<string> };

const spacedWords = new RegExp(`${spacedWordCharacter}+`, "gv");

const searchable = (text: string): Searchable => {
  const searched = folded(text);
  return { text: searched, words: new Set(searched.match(spacedWords)) };
};

/**
 * How one word or phrase is found. A word made only of a spaced script's letters is looked up
 * among the text's words, which costs the same however the text is written. Anything else is
 * looked for as a substring first, and only where it occurs is it checked for its edges: a text
 * can hold a word everywhere and never whole, and each check must stay cheap.
 */
const findingOf = (term: string): ((searched: Searchable) => boolean) => {
  if (new RegExp(`^${spacedWordCharacter}+$`, "v").test(term)) {
    return ({ words }) => words.has(term);
  }
  const whole = wholly(term);
  return ({ text }) => text.includes(term) && whole.test(text);
};

/** How a query ranks one text. */
export const rank = (query: SearchQuery, text: string): number | undefined =>
  rankingBy(query)(text);
