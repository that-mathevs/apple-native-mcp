import { beforeEach, describe, expect, it } from "vitest";

import { installHelper } from "../../../src/application/setup/install-helper.js";
import { FakeCodeRequirement } from "../../support/fake-code-requirement.js";
import { FakeHelperFiles, fixedPath, shippedPath } from "../../support/fake-helper-files.js";

// Setup puts the shipped helper at one fixed per-user path, so every install channel and every
// update shares one path and one grant: a grant held by a bare executable survives only while
// its path and its signing identity stay the same (ADR-0003, #15).

/** What checking a helper that is not ours says. */
const unmet = "code failed to satisfy specified code requirement(s)";

describe("installing the helper", () => {
  let helperFiles: FakeHelperFiles;
  let codeRequirement: FakeCodeRequirement;

  const installing = async (): ReturnType<typeof installHelper> =>
    await installHelper({ helperFiles, codeRequirement });

  beforeEach(() => {
    helperFiles = new FakeHelperFiles();
    codeRequirement = new FakeCodeRequirement();
  });

  it("given no helper is installed, installs the shipped helper at the fixed path", async () => {
    helperFiles.ships("1.2.0");

    const installed = await installing();

    expect(installed).toStrictEqual({
      ok: true,
      value: { change: "installed", version: "1.2.0" },
    });
    expect(helperFiles.installedAt()).toStrictEqual({ path: fixedPath, version: "1.2.0" });
  });

  it("given a shipped helper that does not meet the code requirement, never copies it and says why", async () => {
    helperFiles.ships("1.2.0");
    codeRequirement.isNotMetBy(shippedPath, unmet);

    const installed = await installing();

    expect(installed).toMatchObject({
      ok: false,
      failure: {
        code: "helper-fails-code-requirement",
        evidence: unmet,
      },
    });
    expect(helperFiles.installedAt()).toBeUndefined();
  });

  it("given an older helper is installed, replaces it in place, so the path and the user's grants stay the same", async () => {
    helperFiles.hasInstalled("1.1.0");
    helperFiles.ships("1.2.0");

    const installed = await installing();

    expect(installed).toStrictEqual({ ok: true, value: { change: "updated", version: "1.2.0" } });
    expect(helperFiles.installedAt()).toStrictEqual({ path: fixedPath, version: "1.2.0" });
  });

  it("given a newer helper is installed, keeps it: an install that ships an older one never downgrades another's", async () => {
    helperFiles.hasInstalled("1.3.0");
    helperFiles.ships("1.2.0");

    const installed = await installing();

    expect(installed).toStrictEqual({ ok: true, value: { change: "kept", version: "1.3.0" } });
    expect(helperFiles.installedAt()).toStrictEqual({ path: fixedPath, version: "1.3.0" });
  });

  it("given a helper at the fixed path that does not meet the code requirement, replaces it whatever version it claims", async () => {
    // The fixed path is one the user can write, so what sits there may be anyone's (ADR-0003).
    helperFiles.hasInstalled("99.0.0");
    codeRequirement.isNotMetBy(fixedPath, unmet);
    helperFiles.ships("1.2.0");

    const installed = await installing();

    expect(installed).toStrictEqual({ ok: true, value: { change: "replaced", version: "1.2.0" } });
    expect(helperFiles.installedAt()).toStrictEqual({ path: fixedPath, version: "1.2.0" });
  });

  it("given the same version is installed, leaves it as it is and says nothing changed", async () => {
    helperFiles.hasInstalled("1.2.0");
    helperFiles.ships("1.2.0");

    const installed = await installing();

    expect(installed).toStrictEqual({
      ok: true,
      value: { change: "unchanged", version: "1.2.0" },
    });
  });
});
