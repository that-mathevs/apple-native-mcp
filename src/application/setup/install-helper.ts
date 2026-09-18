import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import { isNewer } from "../../domain/setup/helper-version.js";
import type { CodeRequirement } from "./code-requirement.js";
import type { HelperFile, HelperFiles } from "./helper-files.js";

export type InstallHelperDependencies = {
  readonly helperFiles: HelperFiles;
  readonly codeRequirement: CodeRequirement;
};

type Change = "installed" | "updated" | "unchanged" | "kept" | "replaced";

/**
 * What setup did to the installed helper, and the version left there. A helper that was
 * `replaced` did not meet the code requirement, whatever version it claimed.
 */
export type HelperInstallation = {
  readonly change: Change;
  readonly version: string;
};

const shippedFailsCodeRequirement = (refusal: NamedFailure): NamedFailure => ({
  code: "helper-fails-code-requirement",
  sentence: "The shipped helper is not signed as apple-native-mcp, so nothing was installed.",
  ...(refusal.evidence === undefined ? {} : { evidence: refusal.evidence }),
});

/** What the shipped helper does to the installed one, and which of the two stays. */
const changeTo = async (
  codeRequirement: CodeRequirement,
  shipped: HelperFile,
  installed: HelperFile | undefined,
): Promise<{ readonly change: Change; readonly staying: HelperFile }> => {
  if (installed === undefined) return { change: "installed", staying: shipped };
  if (!(await codeRequirement.verify(installed)).ok) {
    return { change: "replaced", staying: shipped };
  }
  if (isNewer(installed.version, shipped.version)) return { change: "kept", staying: installed };
  if (isNewer(shipped.version, installed.version)) return { change: "updated", staying: shipped };
  return { change: "unchanged", staying: installed };
};

/**
 * Put the shipped helper at the fixed path, unless a newer one of ours is already there.
 *
 * Nothing that fails the code requirement is ever copied.
 */
export const installHelper = async ({
  helperFiles,
  codeRequirement,
}: InstallHelperDependencies): Promise<Outcome<HelperInstallation>> => {
  const shipped = await helperFiles.shipped();
  if (!shipped.ok) return shipped;

  const verified = await codeRequirement.verify(shipped.value);
  if (!verified.ok) return failed(shippedFailsCodeRequirement(verified.failure));

  const installed = await helperFiles.installed();
  if (!installed.ok) return installed;

  const { change, staying } = await changeTo(codeRequirement, verified.value, installed.value);
  if (staying !== verified.value) return succeeded({ change, version: staying.version });

  const copied = await helperFiles.install(staying);
  if (!copied.ok) return copied;

  return succeeded({ change, version: copied.value.version });
};
