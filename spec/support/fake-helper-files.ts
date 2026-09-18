import type { HelperFile, HelperFiles } from "../../src/application/setup/helper-files.js";
import type { Outcome } from "../../src/domain/failure.js";
import { succeeded } from "../../src/domain/failure.js";

/** Where the installed helper lives, as ADR-0003 fixes it. */
export const fixedPath = "~/Library/Application Support/apple-native-mcp/apple-native-mcp";

export const shippedPath = "~/.npm/_npx/apple-native-mcp/native/apple-native-mcp";

/**
 * The shipped and installed helpers, held in memory.
 *
 * It answers the same contract as the real files (spec/contracts), so the scenarios that use
 * it are worth trusting only for as long as it passes that contract.
 */
export class FakeHelperFiles implements HelperFiles {
  #shipped: HelperFile = { path: shippedPath, version: "1.0.0" };
  #installed: HelperFile | undefined;

  ships(version: string): void {
    this.#shipped = { path: shippedPath, version };
  }

  hasInstalled(version: string): void {
    this.#installed = { path: fixedPath, version };
  }

  installedAt(): HelperFile | undefined {
    return this.#installed;
  }

  shipped(): Promise<Outcome<HelperFile>> {
    return Promise.resolve(succeeded(this.#shipped));
  }

  installed(): Promise<Outcome<HelperFile | undefined>> {
    return Promise.resolve(succeeded(this.#installed));
  }

  install(helper: HelperFile): Promise<Outcome<HelperFile>> {
    this.#installed = { ...helper, path: fixedPath };
    return Promise.resolve(succeeded(this.#installed));
  }
}
