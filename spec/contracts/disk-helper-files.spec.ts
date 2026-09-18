import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

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

/**
 * A 64-bit Mach-O header with one __TEXT segment claiming more sections than the file could hold.
 */
const aProgramClaimingEverySection = (): Buffer => {
  const file = Buffer.alloc(32 + 72);
  file.writeUInt32LE(0xfeedfacf, 0);
  file.writeUInt32LE(1, 16);
  file.writeUInt32LE(72, 20);
  file.writeUInt32LE(0x19, 32);
  file.writeUInt32LE(72, 36);
  file.write("__TEXT", 40, "latin1");
  file.writeUInt32LE(0xffffffff, 32 + 64);
  return file;
};

describe("the helper files on disk, reading a hostile file", () => {
  it("given a program claiming more sections than it holds, answers at once that it carries no version", async () => {
    // Only a helper file that met the code requirement is read, but whatever is read is read as
    // if a stranger wrote it: a count taken on trust would loop four billion times.
    const directory = await aDirectory();
    const hostile = join(directory, "hostile");
    await writeFile(hostile, aProgramClaimingEverySection());
    const helperFiles = diskHelperFiles({ shipped: hostile, fixed: fixedPathIn(directory) });

    expect(await helperFiles.versionOf({ path: hostile })).toMatchObject({
      ok: false,
      failure: { code: "helper-version-unreadable" },
    });
  }, 1000);
});

describe("the helper files on disk, finding the shipped helper", () => {
  it("given an install that carries no helper, says so rather than blaming a signature", async () => {
    const directory = await aDirectory();
    const helperFiles = diskHelperFiles({
      shipped: join(directory, "native", "bin", "apple-native-mcp"),
      fixed: fixedPathIn(directory),
    });

    expect(await helperFiles.shipped()).toMatchObject({
      ok: false,
      failure: { code: "helper-not-shipped" },
    });
  });
});

describe("the helper files on disk, installing", () => {
  it("given the fixed path cannot take the helper, fails and leaves nothing half-written beside it", async () => {
    const directory = await aDirectory();
    const fixed = fixedPathIn(directory);
    await mkdir(join(fixed, "in-the-way"), { recursive: true });
    const shipped = await aHelperFileCarrying("1.2.3", directory);
    const helperFiles = diskHelperFiles({ shipped, fixed });

    const installed = await helperFiles.install({ path: shipped });

    expect(installed).toMatchObject({ ok: false, failure: { code: "helper-install-failed" } });
    expect(await readdir(dirname(fixed))).toStrictEqual(["apple-native-mcp"]);
  });
});
