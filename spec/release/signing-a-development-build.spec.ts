import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// A build from `swift build` is signed ad hoc, which makes it a new program to macOS every time
// it is rebuilt: every permission the developer granted it is gone. Signed with an identity of
// the developer's own it stays the same program across rebuilds (#4 found the same for
// Developer ID). The identity is theirs and lives in their keychain, so the build only uses one
// they name, and says which way it went.

const signing = fileURLToPath(new URL("../../native/sign-development-build.sh", import.meta.url));

const aBuild = (): string => {
  const path = join(mkdtempSync(join(tmpdir(), "apple-native-mcp-")), "apple-native-mcp");
  writeFileSync(path, "not really a binary");
  return path;
};

const withoutAnIdentity = (): NodeJS.ProcessEnv => {
  const environment = { ...process.env };
  delete environment.HELPER_SIGNING_IDENTITY;
  return environment;
};

describe("signing a development build of the helper", () => {
  it("given no signing identity is named, leaves the build exactly as it was and says it is still ad-hoc signed", () => {
    const build = aBuild();

    const said = execFileSync("sh", [signing, build], {
      env: withoutAnIdentity(),
      encoding: "utf8",
    });

    expect(readFileSync(build, "utf8")).toBe("not really a binary");
    expect(said).toContain("ad-hoc");
    expect(said).toContain("HELPER_SIGNING_IDENTITY");
  });

  it("given no build at that path, fails rather than reporting a build as signed", () => {
    expect(() =>
      execFileSync("sh", [signing, join(tmpdir(), "no-such-helper-build")], {
        env: { ...withoutAnIdentity(), HELPER_SIGNING_IDENTITY: "Nobody" },
        stdio: "pipe",
      }),
    ).toThrow();
  });
});
