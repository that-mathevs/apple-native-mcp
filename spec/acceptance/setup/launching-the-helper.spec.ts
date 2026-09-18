import { beforeEach, describe, expect, it } from "vitest";

import { helperToLaunch } from "../../../src/application/setup/helper-to-launch.js";
import { FakeCodeRequirement } from "../../support/fake-code-requirement.js";
import { FakeHelperFiles, fixedPath } from "../../support/fake-helper-files.js";

// Before every launch the installed helper is checked again, not only when setup copied it: the
// fixed path is one the user can write, and whatever runs there is asked about under a trusted
// name (ADR-0003).

/** What checking a helper that is not ours says. */
const unmet = "code failed to satisfy specified code requirement(s)";

describe("choosing the helper to launch", () => {
  let helperFiles: FakeHelperFiles;
  let codeRequirement: FakeCodeRequirement;

  const choosing = async (
    settings: { developmentBuild?: string } = {},
  ): ReturnType<typeof helperToLaunch> =>
    await helperToLaunch({
      helperFiles,
      codeRequirement,
      serverVersion: "1.2.0",
      client: "Claude Desktop",
      ...settings,
    });

  beforeEach(() => {
    helperFiles = new FakeHelperFiles();
    codeRequirement = new FakeCodeRequirement();
  });

  it("given the installed helper meets the code requirement, launches it from the fixed path", async () => {
    helperFiles.hasInstalled("1.2.0");

    expect(await choosing()).toStrictEqual({ ok: true, value: fixedPath });
  });

  it("given no helper is installed, refuses and says to run setup", async () => {
    expect(await choosing()).toMatchObject({
      ok: false,
      failure: {
        code: "helper-not-installed",
        sentence: expect.stringContaining("npx apple-native-mcp setup") as string,
      },
    });
  });

  it("given a helper at the fixed path that does not meet the code requirement, such as a development build, never launches it and says to run setup", async () => {
    helperFiles.hasInstalled("1.2.0");
    codeRequirement.isNotMetBy(fixedPath, unmet);

    expect(await choosing()).toMatchObject({
      ok: false,
      failure: {
        code: "helper-fails-code-requirement",
        sentence: expect.stringContaining("npx apple-native-mcp setup") as string,
        evidence: unmet,
      },
    });
  });

  it("given a helper newer than this server, refuses and says which client's install to update", async () => {
    // The newer helper wins, so another install updated it; this server is the one left behind.
    helperFiles.hasInstalled("1.3.0");

    expect(await choosing()).toMatchObject({
      ok: false,
      failure: {
        code: "server-older-than-helper",
        sentence: expect.stringContaining("Claude Desktop") as string,
      },
    });
  });

  it("given a helper older than this server, refuses and says to run setup: the two ship as one version", async () => {
    helperFiles.hasInstalled("1.1.0");

    expect(await choosing()).toMatchObject({
      ok: false,
      failure: {
        code: "helper-older-than-server",
        sentence: expect.stringContaining("npx apple-native-mcp setup") as string,
      },
    });
  });

  it("given the developer setting names a development build, launches that build in place of the installed helper", async () => {
    // Only the client's configuration can name one, and nothing an agent sends reaches it (#19).
    const developmentBuild = "~/src/apple-native-mcp/native/.build/debug/apple-native-mcp";
    codeRequirement.isNotMetBy(developmentBuild, "code has no resources");

    expect(await choosing({ developmentBuild: developmentBuild })).toStrictEqual({
      ok: true,
      value: developmentBuild,
    });
  });
});
