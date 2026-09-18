import { describe, expect, it } from "vitest";

import { cutAt, emailBody } from "./email.js";

describe("an email's body", () => {
  it("given a body no longer than the most a read returns, is the whole of it and says it was not cut", () => {
    expect(emailBody(cutAt("On Tuesday.", 100), 11)).toStrictEqual({
      text: "On Tuesday.",
      characters: 11,
      truncated: false,
    });
  });

  it("given a longer body, is its start, and says it was cut and how long the whole is", () => {
    expect(emailBody(cutAt("On Tuesday, at nine.", 10), 20)).toStrictEqual({
      text: "On Tuesday",
      characters: 20,
      truncated: true,
    });
  });

  // A character outside the basic plane is two units long. Half of one is not text, and a record
  // holding it cannot be written as JSON, so one such character would fail a whole read.
  it("given a cut that would fall inside one character, cuts before that character", () => {
    expect(cutAt("hot \u{1F525} boiler", 5)).toBe("hot ");
    expect(cutAt("hot \u{1F525} boiler", 6)).toBe("hot \u{1F525}");
  });
});
