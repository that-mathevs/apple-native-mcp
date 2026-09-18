/**
 * A failure a caller can act on: a stable code, one sentence saying what didn't happen, and
 * the evidence from outside verbatim.
 *
 * Upstream passed the underlying error's text straight through, so a denied Automation
 * consent read as "Application isn't running", and one fork sanitised failures by keyword,
 * which hid that same denial (findings X-C7). A code is what a caller can branch on.
 */
export type NamedFailure = {
  readonly code: string;
  readonly sentence: string;
  /**
   * The setting to change and where, when changing one would help: a macOS permission, or a
   * line in the client's configuration.
   */
  readonly setting?: string;
  /** What the app, the store or the helper said, unchanged. */
  readonly evidence?: string;
};

/** Either what was asked for, or a failure saying why not. */
export type Outcome<Value> = { readonly ok: true; readonly value: Value } | {
  readonly ok: false;
  readonly failure: NamedFailure;
};

export const succeeded = <Value>(value: Value): Outcome<Value> => ({ ok: true, value });

export const failed = <Value>(failure: NamedFailure): Outcome<Value> => ({ ok: false, failure });

/** Every refusal to create says first that nothing was created, so nobody tries to undo it. */
export const nothingCreated = (
  code: string,
  sentence: string,
  evidence?: string,
): NamedFailure => ({
  code,
  sentence: `Nothing was created. ${sentence}`,
  ...(evidence === undefined ? {} : { evidence }),
});
