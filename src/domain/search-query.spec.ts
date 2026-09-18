import { describe, expect, it } from "vitest";

import { rank, rankingBy, searchQueryFrom } from "./search-query.js";

// One grammar for every search that takes a search query (#24). Forks each invented their own:
// substring matches that found "plumbing" when asked for "plumber", AND-only matching that found
// nothing for a longer question, and characters that meant something to a regular expression.

const matching = (query: string, text: string): number | undefined =>
  rank(searchQueryFrom(query), text);

describe("a search query", () => {
  it("given bare words, matches a text holding any of them, ranking one holding more higher", () => {
    expect(matching("rope wall", "bring the rope")).toBe(1);
    expect(matching("rope wall", "rope at the wall")).toBe(2);
    expect(matching("rope wall", "see you there")).toBeUndefined();
  });

  // User story 26: the one about the plumber, not the one about plumbing.
  it("matches whole words only: plumber does not find plumbing", () => {
    expect(matching("plumber", "the plumbing is fixed")).toBeUndefined();
    expect(matching("plumber", "the plumber is coming")).toBe(1);
  });

  it("given a quoted phrase, matches it only as consecutive words", () => {
    expect(matching('"wall at 6"', "meet at the wall at 6 tonight")).toBe(1);
    expect(matching('"wall at 6"', "at 6, not the wall")).toBeUndefined();
  });

  it("given a word prefixed with a minus, leaves out any text holding it", () => {
    expect(matching("plumber -invoice", "the plumber sent an invoice")).toBeUndefined();
    expect(matching("plumber -invoice", "the plumber is here")).toBe(1);
  });

  it("given a phrase prefixed with a minus, leaves out any text holding the phrase", () => {
    expect(matching('climbing -"next week"', "climbing next week")).toBeUndefined();
    expect(matching('climbing -"next week"', "climbing this week, next time")).toBe(1);
  });

  it("ignores case and accents, both ways", () => {
    expect(matching("CAFE", "À demain au café")).toBe(1);
    expect(matching("café", "cafe at nine")).toBe(1);
  });

  // MSG-84: a search for nothing that found everything handed an agent the whole store.
  it("given an empty query, matches nothing rather than everything", () => {
    expect(matching("", "anything at all")).toBeUndefined();
    expect(matching("   ", "anything at all")).toBeUndefined();
  });

  it("given only exclusions, matches nothing: there is nothing it was asked to find", () => {
    expect(matching("-invoice", "see you there")).toBeUndefined();
  });

  // MSG-83 is rejected: OR is a word like any other, and nothing in a query is an operator but the
  // quote and the leading minus.
  it("reads every other character literally, OR and wildcards included", () => {
    expect(matching("rope OR wall", "rope")).toBe(1);
    expect(matching("wall*", "the wall")).toBeUndefined();
    expect(matching("c++", "learning c++ today")).toBe(1);
  });

  it("is plain data, so it can travel to wherever the text is read", () => {
    const query = searchQueryFrom('rope "wall at 6" -invoice');

    expect(JSON.parse(JSON.stringify(query))).toStrictEqual(query);
  });

  // Words are whole words only where a script spaces its words. Chinese, Japanese and Thai don't,
  // so there a word is found wherever it stands.
  it("given a script written without spaces, finds a word inside a sentence", () => {
    expect(matching("东京", "我在东京工作")).toBe(1);
    expect(matching("東京", "東京に行く")).toBe(1);
    expect(matching("ข้าว", "กินข้าว")).toBe(1);
  });

  // Only accents are folded: a vowel sign in Devanagari is part of the word, not a mark on it.
  it("folds accents only, and keeps the vowel signs other scripts write with", () => {
    expect(matching("कम", "मुझे काम है")).toBeUndefined();
    expect(matching("नमस्ते", "नमस्ते दोस्त")).toBe(1);
  });

  // iOS types a curly apostrophe; a query is typed with a straight one.
  it("reads a curly apostrophe as a straight one, and keeps it inside the word", () => {
    expect(matching("don't", "I don’t know")).toBe(1);
    expect(matching("don", "I don’t know")).toBeUndefined();
  });

  it("folds compatibility forms, such as a ligature or a full-width letter", () => {
    expect(matching("file", "the ﬁle is here")).toBe(1);
    expect(matching("abc", "ＡＢＣ")).toBe(1);
  });

  it("given a mark with no letter or digit in it, such as a lone dash, ignores it", () => {
    expect(matching("plumber - invoice", "an e-mail")).toBeUndefined();
    expect(matching("plumber - invoice", "the plumber")).toBe(1);
  });

  // A query an agent writes can be chosen to make matching slow: many terms that occur again and
  // again but never as whole words.
  it("given terms that occur everywhere but never as whole words, answers a large search quickly", () => {
    const query = Array.from({ length: 20 }, (_, index) => "ha".repeat(index + 1)).join(" ");
    const ranking = rankingBy(searchQueryFrom(query));
    const texts = Array.from({ length: 20_000 }, () => "ha".repeat(500));

    const started = performance.now();
    for (const text of texts) ranking(text);

    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("given many one-letter words, each in every text but never whole, answers a large search quickly", () => {
    const everyLetter = "a b c d e f g h i j k l m n o p q r s t u v w x y z";
    const ranking = rankingBy(searchQueryFrom(everyLetter));
    const texts = Array.from({ length: 20_000 }, () => "abcdefghijklmnopqrstuvwxyz".repeat(40));

    const started = performance.now();
    for (const text of texts) ranking(text);

    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
