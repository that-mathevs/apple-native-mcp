import { randomUUID } from "node:crypto";
import { chmod, constants, copyFile, mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { HelperFile, HelperFiles } from "../../application/setup/helper-files.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import { embeddedInfoPlist, infoPlistString } from "./embedded-info-plist.js";

/** Where the helper files are: the one this install ships, and the fixed path (ADR-0003). */
export type HelperFilePaths = {
  readonly shipped: string;
  readonly fixed: string;
};

/** A named failure carrying what the filesystem said. */
const refusedBecause = <Value>(code: string, sentence: string, error: unknown): Outcome<Value> =>
  failed({ code, sentence, evidence: String(error) });

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

/** A helper file at this path, nothing when there is none, or a failure when it can't be told. */
const helperFileAt = async (path: string): Promise<Outcome<HelperFile | undefined>> => {
  try {
    await stat(path);
    return succeeded({ path });
  } catch (error) {
    if (isMissing(error)) return succeeded(undefined);
    return refusedBecause("helper-files-unreadable", `${path} could not be read.`, error);
  }
};

const versionOf = async (helper: HelperFile): Promise<Outcome<string>> => {
  const unreadable = `The helper at ${helper.path} carries no version this server can read.`;

  let file: Buffer;
  try {
    file = await readFile(helper.path);
  } catch (error) {
    return refusedBecause("helper-version-unreadable", unreadable, error);
  }

  const infoPlist = embeddedInfoPlist(file);
  const version =
    infoPlist === undefined ? undefined : infoPlistString(infoPlist, "CFBundleShortVersionString");

  return version === undefined
    ? failed({ code: "helper-version-unreadable", sentence: unreadable })
    : succeeded(version);
};

/**
 * Copy the helper beside the fixed path and rename it over whatever is there, so the path is
 * never missing or half-written and a grant tied to it survives. The staged file has a name
 * nobody can guess, is never written through a link planted at that name, and is gone again if
 * anything fails.
 */
const installAt =
  (fixed: string) =>
  async (helper: HelperFile): Promise<Outcome<HelperFile>> => {
    const staged = join(dirname(fixed), `.${randomUUID()}.staged`);

    try {
      await mkdir(dirname(fixed), { recursive: true });
      await copyFile(helper.path, staged, constants.COPYFILE_EXCL);
      await chmod(staged, 0o755);
      await rename(staged, fixed);
      return succeeded({ path: fixed });
    } catch (error) {
      await rm(staged, { force: true });
      return refusedBecause(
        "helper-install-failed",
        `The helper could not be put at ${fixed}, so nothing was installed.`,
        error,
      );
    }
  };

const removeAt =
  (fixed: string) =>
  async (): Promise<Outcome<HelperFile | undefined>> => {
    const found = await helperFileAt(fixed);
    if (!found.ok || found.value === undefined) return found;

    try {
      await rm(fixed);
      return found;
    } catch (error) {
      const sentence = `The helper at ${fixed} could not be removed.`;
      return refusedBecause("helper-not-removed", sentence, error);
    }
  };

/** The helper files as they are on disk. */
export const diskHelperFiles = ({ shipped, fixed }: HelperFilePaths): HelperFiles => ({
  shipped: async (): Promise<Outcome<HelperFile>> => {
    const found = await helperFileAt(shipped);
    if (!found.ok) return found;
    if (found.value !== undefined) return succeeded(found.value);

    return failed({
      code: "helper-not-shipped",
      sentence: `This install carries no helper at ${shipped}, so nothing was installed.`,
    });
  },
  installed: async (): Promise<Outcome<HelperFile | undefined>> => await helperFileAt(fixed),
  versionOf,
  install: installAt(fixed),
  remove: removeAt(fixed),
});
