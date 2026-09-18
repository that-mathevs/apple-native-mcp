/**
 * How well some text matches a name, best first. Anything looser than a word prefix is no match
 * at all: matching letters inside a word put the wrong person's number in front of an agent
 * (long-tail/tomsr73 35e211d, KassebaumEngineering 1d47e74).
 */
export const nameMatches = ["exact", "whole word", "word prefix"] as const;

export type NameMatch = (typeof nameMatches)[number];

/** Letters that Unicode does not take apart into a plain letter and a mark. */
const plainLetters: Readonly<Record<string, string>> = {
  ł: "l",
  ø: "o",
  đ: "d",
  ð: "d",
  ı: "i",
  ß: "ss",
  æ: "ae",
  œ: "oe",
  þ: "th",
};

/** The words of some text, as a keyboard with no accents would type them. */
const wordsOf = (text: string): readonly string[] =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[łøđðıßæœþ]/gu, (letter) => plainLetters[letter] ?? letter)
    // An apostrophe is part of the word it sits in: O'Brien is one word, typed with it or not.
    .replace(/['’ʼ]/gu, "")
    .split(/[^\p{Letter}\p{Number}]+/u)
    .filter((word) => word !== "");

const sameWords = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && [...left].sort().join(" ") === [...right].sort().join(" ");

/**
 * One letter is the start of a great many names, so it matches only as a whole word: an agent
 * trying each letter in turn would otherwise read every contact a page at a time.
 */
const startsWord = (word: string, sought: string): boolean =>
  sought.length > 1 && word.startsWith(sought);

const matchAgainst = (sought: readonly string[], name: string): NameMatch | undefined => {
  const words = wordsOf(name);

  if (sameWords(sought, words)) return "exact";
  if (sought.every((word) => words.includes(word))) return "whole word";

  return sought.every((word) => words.some((candidate) => startsWord(candidate, word)))
    ? "word prefix"
    : undefined;
};

/**
 * The best match some text makes against any of a contact's names, or nothing. Every word of
 * the text has to match a word of the one name, in any order.
 */
export const nameMatch = (text: string, names: readonly string[]): NameMatch | undefined => {
  const sought = wordsOf(text);

  if (sought.length === 0) return undefined;

  return names
    .map((name) => matchAgainst(sought, name))
    .filter((match) => match !== undefined)
    .sort((left, right) => nameMatches.indexOf(left) - nameMatches.indexOf(right))[0];
};
