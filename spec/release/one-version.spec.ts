import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

// The helper and the server ship as one version, and the server refuses to launch a helper of
// any other (#8, ADR-0003), so a release that bumped only one of them would ship a server that
// can't start its own helper.

const read = async (path: string): Promise<string> =>
  await readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("the release", () => {
  it("carries one version in the server's package and in the helper's Info.plist", async () => {
    const { version } = JSON.parse(await read("package.json")) as { version: string };
    const infoPlist = await read("native/Info.plist");

    expect(infoPlist).toContain(
      `<key>CFBundleShortVersionString</key><string>${version}</string>`,
    );
  });
});
