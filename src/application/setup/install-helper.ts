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

/** What the shipped helper, at this version, does to the installed one. */
const changeTo = async (
  { helperFiles, codeRequirement }: InstallHelperDependencies,
  shippedVersion: string,
  installed: HelperFile | undefined,
): Promise<Outcome<HelperInstallation>> => {
  if (installed === undefined) return succeeded({ change: "installed", version: shippedVersion });

  if (!(await codeRequirement.verify(installed)).ok) {
    return succeeded({ change: "replaced", version: shippedVersion });
  }

  const installedVersion = await helperFiles.versionOf(installed);
  if (!installedVersion.ok) return installedVersion;

  if (isNewer(installedVersion.value, shippedVersion)) {
    return succeeded({ change: "kept", version: installedVersion.value });
  }
  if (isNewer(shippedVersion, installedVersion.value)) {
    return succeeded({ change: "updated", version: shippedVersion });
  }
  return succeeded({ change: "unchanged", version: installedVersion.value });
};

/**
 * Put the shipped helper at the fixed path, unless a newer one of ours is already there.
 *
 * Nothing that fails the code requirement is ever copied, and no version is believed before
 * the helper file carrying it has met the code requirement.
 */
export const installHelper = async (
  dependencies: InstallHelperDependencies,
): Promise<Outcome<HelperInstallation>> => {
  const { helperFiles, codeRequirement } = dependencies;

  const shipped = await helperFiles.shipped();
  if (!shipped.ok) return shipped;

  const verified = await codeRequirement.verify(shipped.value);
  if (!verified.ok) return failed(shippedFailsCodeRequirement(verified.failure));

  const shippedVersion = await helperFiles.versionOf(verified.value);
  if (!shippedVersion.ok) return shippedVersion;

  const installed = await helperFiles.installed();
  if (!installed.ok) return installed;

  const installation = await changeTo(dependencies, shippedVersion.value, installed.value);
  if (!installation.ok) return installation;

  const { change } = installation.value;
  if (change === "kept" || change === "unchanged") return installation;

  const copied = await helperFiles.install(verified.value);
  if (!copied.ok) return copied;

  return installation;
};
