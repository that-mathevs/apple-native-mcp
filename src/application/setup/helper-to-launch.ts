import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import { isNewer } from "../../domain/setup/helper-version.js";
import type { CodeRequirement } from "./code-requirement.js";
import type { HelperFiles } from "./helper-files.js";

export type HelperToLaunchDependencies = {
  readonly helperFiles: HelperFiles;
  readonly codeRequirement: CodeRequirement;
  /** This server's own version, which the helper shares. */
  readonly serverVersion: string;
  /** The client that started this server, as it named itself when it connected. */
  readonly client: string;
  /**
   * The development build the developer setting names, launched as it is: an unsigned build
   * can't meet the code requirement, and only the client's configuration can name one
   * (ADR-0003).
   */
  readonly developmentBuild?: string;
};

const setupCommand = "npx apple-native-mcp setup";

const notInstalled: NamedFailure = {
  code: "helper-not-installed",
  sentence: `No helper is installed, so none was started. Run \`${setupCommand}\` to install it.`,
};

/** Setup replaces a helper that fails the code requirement with the shipped one. */
const failsCodeRequirement = (refusal: NamedFailure): NamedFailure => ({
  code: "helper-fails-code-requirement",
  sentence:
    "The helper at the fixed path is not signed as apple-native-mcp, so it was not started. " +
    `Run \`${setupCommand}\` to replace it.`,
  ...(refusal.evidence === undefined ? {} : { evidence: refusal.evidence }),
});

const helperOlderThanServer = (helperVersion: string, serverVersion: string): NamedFailure => ({
  code: "helper-older-than-server",
  sentence:
    `The installed helper is ${helperVersion}, older than this server's ${serverVersion}, so it ` +
    `was not started. Run \`${setupCommand}\` to update it.`,
});

/** The newer helper wins, so the install left behind is this client's. */
const serverOlderThanHelper = (
  helperVersion: string,
  serverVersion: string,
  client: string,
): NamedFailure => ({
  code: "server-older-than-helper",
  sentence:
    `The installed helper is ${helperVersion}, newer than this server's ${serverVersion}, so it ` +
    `was not started. Update apple-native-mcp in ${client}.`,
});

/** The path of the helper this server may launch, or a failure saying why there is none. */
export const helperToLaunch = async ({
  helperFiles,
  codeRequirement,
  serverVersion,
  client,
  developmentBuild,
}: HelperToLaunchDependencies): Promise<Outcome<string>> => {
  if (developmentBuild !== undefined) return succeeded(developmentBuild);

  const installed = await helperFiles.installed();
  if (!installed.ok) return installed;
  if (installed.value === undefined) return failed(notInstalled);

  const verified = await codeRequirement.verify(installed.value);
  if (!verified.ok) return failed(failsCodeRequirement(verified.failure));

  const read = await helperFiles.versionOf(verified.value);
  if (!read.ok) return read;

  const version = read.value;
  if (isNewer(version, serverVersion)) {
    return failed(serverOlderThanHelper(version, serverVersion, client));
  }
  if (isNewer(serverVersion, version)) {
    return failed(helperOlderThanServer(version, serverVersion));
  }

  return succeeded(verified.value.path);
};
