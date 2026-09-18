import { describe, expect, it } from "vitest";

import type { HelperFile, HelperFiles } from "../../src/application/setup/helper-files.js";
import type { Outcome } from "../../src/domain/failure.js";

/**
 * What every place the helper is kept promises, whichever filesystem it is on.
 *
 * The fake behind the setup scenarios is only worth trusting while it answers the same contract
 * as the real files, so this suite runs against both: the fake everywhere, and the real files
 * once setup has an adapter, against a directory of its own rather than the user's.
 */
export type HelperFilesUnderTest = {
  readonly name: string;
  readonly build: () => Promise<{ readonly helperFiles: HelperFiles }>;
};

const value = <Value>(outcome: Outcome<Value>): Value => {
  if (!outcome.ok) throw new Error(`expected an answer, got ${outcome.failure.code}`);
  return outcome.value;
};

const shippedFrom = async (helperFiles: HelperFiles): Promise<HelperFile> =>
  value(await helperFiles.shipped());

export const helperFilesContract = ({ name, build }: HelperFilesUnderTest): void => {
  describe(`${name}, as the place the helper is kept`, () => {
    it("before anything is installed, holds no installed helper", async () => {
      const { helperFiles } = await build();

      expect(await helperFiles.installed()).toStrictEqual({ ok: true, value: undefined });
    });

    it("given the shipped helper is installed, holds it at a path of its own with the same version", async () => {
      const { helperFiles } = await build();
      const shipped = await shippedFrom(helperFiles);

      const installed = value(await helperFiles.install(shipped));

      expect(installed.path).not.toBe(shipped.path);
      expect(await helperFiles.installed()).toStrictEqual({ ok: true, value: installed });
      expect(await helperFiles.versionOf(installed)).toStrictEqual(
        await helperFiles.versionOf(shipped),
      );
    });

    it("given the shipped helper, reads the version it carries", async () => {
      const { helperFiles } = await build();

      expect(await helperFiles.versionOf(await shippedFrom(helperFiles))).toMatchObject({
        ok: true,
        value: expect.stringMatching(/^\d+\.\d+\.\d+$/u) as string,
      });
    });

    it("given a helper is installed twice, keeps it at the same path, so a grant tied to the path survives", async () => {
      const { helperFiles } = await build();
      const shipped = await shippedFrom(helperFiles);

      const first = value(await helperFiles.install(shipped));
      const second = value(await helperFiles.install(shipped));

      expect(second.path).toBe(first.path);
    });

    it("given an installed helper is removed, holds no installed helper and says which it removed", async () => {
      const { helperFiles } = await build();
      const installed = value(await helperFiles.install(await shippedFrom(helperFiles)));

      expect(await helperFiles.remove()).toStrictEqual({ ok: true, value: installed });
      expect(await helperFiles.installed()).toStrictEqual({ ok: true, value: undefined });
    });

    it("given nothing is installed, removing answers that there was nothing rather than failing", async () => {
      const { helperFiles } = await build();

      expect(await helperFiles.remove()).toStrictEqual({ ok: true, value: undefined });
    });
  });
};
