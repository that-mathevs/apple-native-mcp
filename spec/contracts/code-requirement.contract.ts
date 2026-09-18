import { describe, expect, it } from "vitest";

import type { CodeRequirement } from "../../src/application/setup/code-requirement.js";
import type { HelperFile } from "../../src/application/setup/helper-files.js";

/**
 * What every check against the code requirement promises, however it is made.
 *
 * The fake behind the setup scenarios is only worth trusting while it answers the same contract
 * as codesign, so this suite runs against both.
 */
export type CodeRequirementUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{
    readonly codeRequirement: CodeRequirement;
    /** A helper file signed as the requirement asks. */
    readonly meeting: HelperFile;
    /** A helper file signed, but as someone else. */
    readonly signedAsSomeoneElse: HelperFile;
    /** A path with nothing at it. */
    readonly missing: HelperFile;
  }>;
};

export const codeRequirementContract = ({ name, build }: CodeRequirementUnderTest): void => {
  describe(`${name}, as the code requirement`, () => {
    it("given a helper file signed as it asks, answers with that helper file", async () => {
      const { codeRequirement, meeting } = await build();

      expect(await codeRequirement.verify(meeting)).toStrictEqual({ ok: true, value: meeting });
    });

    it("given a helper file signed as someone else, refuses it and carries what the check said", async () => {
      const { codeRequirement, signedAsSomeoneElse } = await build();

      expect(await codeRequirement.verify(signedAsSomeoneElse)).toMatchObject({
        ok: false,
        failure: {
          code: "helper-fails-code-requirement",
          evidence: expect.stringContaining("code requirement") as string,
        },
      });
    });

    it("given a path with nothing at it, refuses it: a check that could not be made never passes", async () => {
      const { codeRequirement, missing } = await build();

      expect(await codeRequirement.verify(missing)).toMatchObject({
        ok: false,
        failure: { code: "helper-fails-code-requirement" },
      });
    });
  });
};
