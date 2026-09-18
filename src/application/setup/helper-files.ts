import type { Outcome } from "../../domain/failure.js";

/** One helper as it sits on disk, before anything launches it. */
export type HelperFile = {
  readonly path: string;
};

/**
 * Where the shipped helper and the installed helper are kept.
 *
 * The installed helper has one fixed per-user path, whichever channel installed it, so every
 * update keeps the user's grants (ADR-0003).
 */
export type HelperFiles = {
  readonly shipped: () => Promise<Outcome<HelperFile>>;
  /** Nothing, until setup has installed a helper. */
  readonly installed: () => Promise<Outcome<HelperFile | undefined>>;
  /**
   * The version the helper file carries. Ask it only of a helper file that meets the code
   * requirement: a file someone else put at the fixed path may carry any version, or none.
   */
  readonly versionOf: (helper: HelperFile) => Promise<Outcome<string>>;
  /** Put this helper at the fixed path, replacing what is there in place. */
  readonly install: (helper: HelperFile) => Promise<Outcome<HelperFile>>;
  /** Take the installed helper away: the one removed, or nothing when none was installed. */
  readonly remove: () => Promise<Outcome<HelperFile | undefined>>;
};
