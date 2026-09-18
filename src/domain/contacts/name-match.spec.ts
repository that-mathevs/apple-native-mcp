import { describe, expect, it } from "vitest";

import { nameMatch } from "./name-match.js";

const sam = ["Sam Okafor"];

describe("a contact name match", () => {
  // long-tail/tomsr73 35e211d, KassebaumEngineering 1d47e74: substring matching put "Sam" in
  // front of the agent for "Samantha", and "Al" for every Alan, Alice and Valerie.
  it("given a query that appears only as letters inside a word of the name, does not match: names match at word boundaries", () => {
    expect(nameMatch("am", sam)).toBeUndefined();
    expect(nameMatch("kafor", sam)).toBeUndefined();
  });

  it("given the start of a word of the name, matches it as a word prefix", () => {
    expect(nameMatch("oka", sam)).toBe("word prefix");
  });

  it("given a whole word of the name, matches it as a whole word", () => {
    expect(nameMatch("okafor", sam)).toBe("whole word");
  });

  it("given the whole name, matches it as exact, whichever order its words come in", () => {
    expect(nameMatch("Sam Okafor", sam)).toBe("exact");
    expect(nameMatch("okafor sam", sam)).toBe("exact");
  });

  // upstream PR #49
  it("given text in another case, or with or without diacritics, matches the same name", () => {
    expect(nameMatch("zoe", ["Zoë Müller"])).toBe("whole word");
    expect(nameMatch("MÜLLER", ["Zoe Muller"])).toBe("whole word");
  });

  it("given several words, needs every one of them to match a word of the name", () => {
    expect(nameMatch("sam smith", sam)).toBeUndefined();
    expect(nameMatch("sam oka", sam)).toBe("word prefix");
  });

  it("given a contact with several names, takes the best match among them", () => {
    expect(nameMatch("sammy", ["Samuel Okafor", "Sammy", "Okafor Ltd"])).toBe("exact");
  });

  it("given a query with no letters or digits in it, matches nothing rather than everything", () => {
    expect(nameMatch(" - ", sam)).toBeUndefined();
  });

  it("given the same word twice, is not an exact match for a name of two different words", () => {
    expect(nameMatch("sam sam", sam)).toBe("whole word");
  });

  it("given letters that a keyboard without them would type, matches the name written with them", () => {
    expect(nameMatch("lukasz", ["Łukasz Wójcik"])).toBe("whole word");
    expect(nameMatch("soren", ["Søren Ødegård"])).toBe("whole word");
    expect(nameMatch("strasse", ["Café Straße"])).toBe("whole word");
  });

  it("given a name with an apostrophe in it, matches it written with the apostrophe or without", () => {
    expect(nameMatch("obrien", ["Niamh O'Brien"])).toBe("whole word");
    expect(nameMatch("o’brien", ["Niamh O'Brien"])).toBe("whole word");
  });

  // One letter is the start of a great many names, and an agent trying each letter in turn
  // would read the whole of somebody's contacts a page at a time.
  it("given a single letter, matches it only as a whole word, never as the start of one", () => {
    expect(nameMatch("s", sam)).toBeUndefined();
    expect(nameMatch("j", ["J Alvarez"])).toBe("whole word");
  });
});
