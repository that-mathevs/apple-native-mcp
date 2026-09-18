import { describe, expect, it } from "vitest";

import { relevance, searchQueryFrom } from "./search-query.js";

// One grammar for every search that takes a search query (#24). Forks each invented their own:
// substring matches that found "plumbing" when asked for "plumber", AND-only matching that found
// nothing for a longer question, and characters that meant something to a regular expression.

const matching = (query: string, text: string): number | undefined =>
  relevance(searchQueryFrom(query), text);

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
});
