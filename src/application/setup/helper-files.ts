import type { Outcome } from "../../domain/failure.js";

/** One helper on disk, as found before anything launches it. */
export type HelperFile = {
  readonly path: string;
  readonly version: string;
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
  /** Put this helper at the fixed path, replacing what is there in place. */
  readonly install: (helper: HelperFile) => Promise<Outcome<HelperFile>>;
};
