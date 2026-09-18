import { describe, expect, it } from "vitest";

import {
  codesignCodeRequirement,
  pinnedCodeRequirement,
} from "../../src/adapters/native/codesign-code-requirement.js";
import { codeRequirementContract } from "./code-requirement.contract.js";

// codesign answers the contract on any Mac, with no permission and no built helper: ls is signed
// by Apple as com.apple.ls, so a requirement naming that identity is one ls meets and cat, signed
// as com.apple.cat, does not.
codeRequirementContract({
  name: "codesign",
  build: () =>
    Promise.resolve({
      codeRequirement: codesignCodeRequirement('identifier "com.apple.ls" and anchor apple'),
      meeting: { path: "/bin/ls" },
      signedAsSomeoneElse: { path: "/bin/cat" },
      missing: { path: "/nonexistent/apple-native-mcp" },
    }),
});

describe("the pinned code requirement", () => {
  it("given a file Apple signed, refuses it: only this project's team signs a helper", async () => {
    const pinned = codesignCodeRequirement(pinnedCodeRequirement);

    const verified = await pinned.verify({ path: "/bin/ls" });

    expect(verified).toMatchObject({
      ok: false,
      failure: {
        code: "helper-fails-code-requirement",
        evidence: expect.stringContaining("failed to satisfy") as string,
      },
    });
  });
});
