import { describe, expect, it } from "vitest";

import { mentions } from "./fake-reminder-store.js";

// The helper folds case for a search, and the fake has to fold it the same way, or a scenario the
// fake passes would promise what the helper does not do. These are the helper's own examples.
describe("the fake reminder store's search", () => {
  it.each([
    ["ΟΔΟΣ", "οδος", true, "Greek's final sigma"],
    ["Straße", "STRASSE", true, "ß"],
    ["cafe\u0301", "cafe", true, "an accent written as its own mark"],
    ["caf\u00e9", "cafe\u0301", false, "one accent written two ways"],
  ])("folds case as the helper does: %s and %s (%s)", (title, text, found) => {
    expect(mentions([title], text)).toBe(found);
  });
});
