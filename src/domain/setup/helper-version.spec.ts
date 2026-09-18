import { describe, expect, it } from "vitest";

import { isNewer } from "./helper-version.js";

// The newer helper wins wherever it came from, so every install channel on the Mac converges on
// one helper and one grant (ADR-0003). Which one is newer is the whole rule.

describe("which helper version is newer", () => {
  it("given a later patch, it is newer", () => {
    expect(isNewer("1.2.1", "1.2.0")).toBe(true);
  });

  it("given the same version, it is not newer", () => {
    expect(isNewer("1.2.0", "1.2.0")).toBe(false);
  });

  it("given an earlier minor version with a later patch, it is not newer", () => {
    expect(isNewer("1.1.9", "1.2.0")).toBe(false);
  });

  it("given a part of ten or more, compares it as a number, not as text", () => {
    expect(isNewer("1.10.0", "1.9.0")).toBe(true);
  });
});
