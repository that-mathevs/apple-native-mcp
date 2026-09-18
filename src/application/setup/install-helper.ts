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

/** What the shipped helper, at this version, does to the installed one, and whether it copies. */
type Decision = { readonly installation: HelperInstallation; readonly copies: boolean };

const decide = async (
  { helperFiles, codeRequirement }: InstallHelperDependencies,
  shippedVersion: string,
  installed: HelperFile | undefined,
): Promise<Outcome<Decision>> => {
  const copying = (change: Change): Outcome<Decision> =>
    succeeded({ installation: { change, version: shippedVersion }, copies: true });

  if (installed === undefined) return copying("installed");
  if (!(await codeRequirement.verify(installed)).ok) return copying("replaced");

  const installedVersion = await helperFiles.versionOf(installed);
  if (!installedVersion.ok) return installedVersion;

  if (isNewer(shippedVersion, installedVersion.value)) return copying("updated");

  const change = isNewer(installedVersion.value, shippedVersion) ? "kept" : "unchanged";
  return succeeded({ installation: { change, version: installedVersion.value }, copies: false });
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

  const decided = await decide(dependencies, shippedVersion.value, installed.value);
  if (!decided.ok) return decided;

  const { installation, copies } = decided.value;
  if (copies) {
    const copied = await helperFiles.install(verified.value);
    if (!copied.ok) return copied;
  }

  return succeeded(installation);
};
