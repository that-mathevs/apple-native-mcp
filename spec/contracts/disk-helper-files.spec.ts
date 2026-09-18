import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { diskHelperFiles } from "../../src/adapters/native/disk-helper-files.js";
import { aHelperFileCarrying } from "../support/a-helper-file.js";
import { helperFilesContract } from "./helper-files.contract.js";

// The real helper files answer the contract in a directory of their own, never the user's, with
// a shipped helper built on the spot so its version is one the scenario chose.

const directories: string[] = [];

const aDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "apple-native-mcp-"));
  directories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

/** Where setup would put the helper, inside a stand-in for the user's home. */
const fixedPathIn = (home: string): string =>
  join(home, "Library", "Application Support", "apple-native-mcp", "apple-native-mcp");

helperFilesContract({
  name: "the helper files on disk",
  build: async () => {
    const directory = await aDirectory();
    const shipped = await aHelperFileCarrying("1.2.3", directory);

    return { helperFiles: diskHelperFiles({ shipped, fixed: fixedPathIn(directory) }) };
  },
});

describe("the helper files on disk, reading a version", () => {
  it("given a helper built for one architecture, reads the version it carries", async () => {
    const directory = await aDirectory();
    const shipped = await aHelperFileCarrying("1.2.3", directory, ["arm64"]);
    const helperFiles = diskHelperFiles({ shipped, fixed: fixedPathIn(directory) });

    expect(await helperFiles.versionOf({ path: shipped })).toStrictEqual({
      ok: true,
      value: "1.2.3",
    });
  });

  it("given a universal helper, reads the version it carries", async () => {
    const directory = await aDirectory();
    const shipped = await aHelperFileCarrying("1.2.3", directory);
    const helperFiles = diskHelperFiles({ shipped, fixed: fixedPathIn(directory) });

    expect(await helperFiles.versionOf({ path: shipped })).toStrictEqual({
      ok: true,
      value: "1.2.3",
    });
  });

  it("given a program whose Info.plist names no version, says it carries none", async () => {
    const directory = await aDirectory();
    const shipped = await aHelperFileCarrying(undefined, directory);
    const helperFiles = diskHelperFiles({ shipped, fixed: fixedPathIn(directory) });

    expect(await helperFiles.versionOf({ path: shipped })).toMatchObject({
      ok: false,
      failure: { code: "helper-version-unreadable" },
    });
  });

  it("given a file that is not a program at all, says it carries no version rather than guessing", async () => {
    const directory = await aDirectory();
    const helperFiles = diskHelperFiles({ shipped: "/etc/hosts", fixed: fixedPathIn(directory) });

    expect(await helperFiles.versionOf({ path: "/etc/hosts" })).toMatchObject({
      ok: false,
      failure: { code: "helper-version-unreadable" },
    });
  });
});
