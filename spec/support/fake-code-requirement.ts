import type { CodeRequirement } from "../../src/application/setup/code-requirement.js";
import type { HelperFile } from "../../src/application/setup/helper-files.js";
import type { Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";

/** A code requirement every helper meets, until a scenario says one does not. */
export class FakeCodeRequirement implements CodeRequirement {
  readonly #unmet = new Map<string, string>();

  /** The helper at this path is someone else's, and this is what checking it said. */
  isNotMetBy(path: string, evidence: string): void {
    this.#unmet.set(path, evidence);
  }

  verify(helper: HelperFile): Promise<Outcome<HelperFile>> {
    const evidence = this.#unmet.get(helper.path);
    if (evidence === undefined) return Promise.resolve(succeeded(helper));

    return Promise.resolve(
      failed({
        code: "helper-fails-code-requirement",
        sentence: `The helper at ${helper.path} does not meet the code requirement.`,
        evidence,
      }),
    );
  }
}
