import { chmod, copyFile, mkdir, readFile, rename, stat } from "node:fs/promises";
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

const versionUnreadable = (path: string, evidence?: string): Outcome<string> =>
  failed({
    code: "helper-version-unreadable",
    sentence: `The helper at ${path} carries no version this server can read.`,
    ...(evidence === undefined ? {} : { evidence }),
  });

const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

/**
 * The helper files as they are on disk.
 *
 * Installing copies the shipped helper next to the fixed path and renames it over whatever is
 * there, so the path is never missing or half-written, and a grant tied to it survives.
 */
export const diskHelperFiles = ({ shipped, fixed }: HelperFilePaths): HelperFiles => ({
  shipped: async (): Promise<Outcome<HelperFile>> => {
    try {
      await stat(shipped);
      return succeeded({ path: shipped });
    } catch (error) {
      return failed({
        code: "helper-not-shipped",
        sentence: `This install carries no helper at ${shipped}, so nothing was installed.`,
        evidence: String(error),
      });
    }
  },

  installed: async (): Promise<Outcome<HelperFile | undefined>> => {
    try {
      await stat(fixed);
      return succeeded({ path: fixed });
    } catch (error) {
      if (isMissing(error)) return succeeded(undefined);
      return failed({
        code: "helper-files-unreadable",
        sentence: `The fixed path ${fixed} could not be read.`,
        evidence: String(error),
      });
    }
  },

  versionOf: async (helper: HelperFile): Promise<Outcome<string>> => {
    let file: Buffer;
    try {
      file = await readFile(helper.path);
    } catch (error) {
      return versionUnreadable(helper.path, String(error));
    }

    const infoPlist = embeddedInfoPlist(file);
    const version =
      infoPlist === undefined
        ? undefined
        : infoPlistString(infoPlist, "CFBundleShortVersionString");

    return version === undefined ? versionUnreadable(helper.path) : succeeded(version);
  },

  install: async (helper: HelperFile): Promise<Outcome<HelperFile>> => {
    const arriving = join(dirname(fixed), `.${String(process.pid)}.arriving`);

    try {
      await mkdir(dirname(fixed), { recursive: true });
      await copyFile(helper.path, arriving);
      await chmod(arriving, 0o755);
      await rename(arriving, fixed);
      return succeeded({ path: fixed });
    } catch (error) {
      return failed({
        code: "helper-install-failed",
        sentence: `The helper could not be put at ${fixed}, so nothing was installed.`,
        evidence: String(error),
      });
    }
  },
});
