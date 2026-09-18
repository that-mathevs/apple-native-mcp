import { execFile } from "node:child_process";

import type { CodeRequirement } from "../../application/setup/code-requirement.js";
import type { HelperFile } from "../../application/setup/helper-files.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";

/**
 * The identity a helper has to carry: this project's identifier, signed with the Developer ID of
 * team 4A82YT3HVP (ADR-0003).
 */
export const pinnedCodeRequirement =
  'identifier "io.github.that-mathevs.apple-native-mcp" and anchor apple generic and ' +
  "certificate 1[field.1.2.840.113635.100.6.2.6] exists and " +
  "certificate leaf[field.1.2.840.113635.100.6.1.13] exists and " +
  'certificate leaf[subject.OU] = "4A82YT3HVP"';

/** On the sealed system volume, so nothing the user can write stands in for it (ADR-0008). */
const codesign = "/usr/bin/codesign";

/**
 * The code requirement, checked by codesign.
 *
 * codesign is started by absolute path with an argument list, never through a shell. Anything
 * but a clean exit refuses the helper file, whatever the reason.
 */
export const codesignCodeRequirement = (requirement: string): CodeRequirement => ({
  verify: (helper: HelperFile): Promise<Outcome<HelperFile>> =>
    new Promise((resolve) => {
      execFile(
        codesign,
        ["--verify", "--strict", `-R=${requirement}`, helper.path],
        (error, _stdout, stderr) => {
          if (error === null) {
            resolve(succeeded(helper));
            return;
          }

          resolve(
            failed({
              code: "helper-fails-code-requirement",
              sentence: `The helper at ${helper.path} does not meet the code requirement.`,
              evidence: stderr.trim() === "" ? error.message : stderr.trim(),
            }),
          );
        },
      );
    }),
});
