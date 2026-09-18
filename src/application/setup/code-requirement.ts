import type { Outcome } from "../../domain/failure.js";
import type { HelperFile } from "./helper-files.js";

/**
 * The pinned signing identity a helper must meet before it is copied or launched.
 *
 * The fixed path is one the user can write, so a helper file someone else put there would be
 * asked about under a trusted name (ADR-0003).
 */
export type CodeRequirement = {
  /** The helper it was given when it meets the requirement, or a failure carrying why not. */
  readonly verify: (helper: HelperFile) => Promise<Outcome<HelperFile>>;
};
