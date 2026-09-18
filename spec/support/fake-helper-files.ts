import type { HelperFile, HelperFiles } from "../../src/application/setup/helper-files.js";
import type { Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";

/** Where the installed helper lives, as ADR-0003 fixes it. */
export const fixedPath = "~/Library/Application Support/apple-native-mcp/apple-native-mcp";

export const shippedPath = "~/.npm/_npx/apple-native-mcp/native/apple-native-mcp";

/** A helper file and the version it carries, as a scenario reads it back. */
type Held = { readonly path: string; readonly version: string };

/**
 * The shipped and installed helpers, held in memory.
 *
 * It answers the same contract as the real files (spec/contracts), so the scenarios that use
 * it are worth trusting only for as long as it passes that contract.
 */
export class FakeHelperFiles implements HelperFiles {
  readonly #versions = new Map<string, string>([[shippedPath, "1.0.0"]]);

  ships(version: string): void {
    this.#versions.set(shippedPath, version);
  }

  hasInstalled(version: string): void {
    this.#versions.set(fixedPath, version);
  }

  installedAt(): Held | undefined {
    const version = this.#versions.get(fixedPath);
    return version === undefined ? undefined : { path: fixedPath, version };
  }

  shipped(): Promise<Outcome<HelperFile>> {
    return Promise.resolve(succeeded({ path: shippedPath }));
  }

  installed(): Promise<Outcome<HelperFile | undefined>> {
    return Promise.resolve(
      succeeded(this.#versions.has(fixedPath) ? { path: fixedPath } : undefined),
    );
  }

  versionOf(helper: HelperFile): Promise<Outcome<string>> {
    const version = this.#versions.get(helper.path);
    if (version !== undefined) return Promise.resolve(succeeded(version));

    return Promise.resolve(
      failed({
        code: "helper-version-unreadable",
        sentence: `The helper at ${helper.path} carries no version.`,
      }),
    );
  }

  install(helper: HelperFile): Promise<Outcome<HelperFile>> {
    const version = this.#versions.get(helper.path);
    if (version !== undefined) this.#versions.set(fixedPath, version);
    return Promise.resolve(succeeded({ path: fixedPath }));
  }
}
