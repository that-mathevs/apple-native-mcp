import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { helperContactStore } from "../../src/adapters/native/contact-store.js";
import { Helper } from "../../src/adapters/native/helper.js";
import { succeeded } from "../../src/domain/failure.js";
import { settledBeforeRunning } from "../support/mac-permissions.js";
import { aContactStore } from "./contact-store.contract.js";

/**
 * The same contract, against the real helper and the contacts on this Mac.
 *
 * It needs a built helper and contacts access, so it is its own command (`npm run spec:mac`)
 * and never part of hosted CI. The first run asks for access, which `setup` does for users. It
 * only reads, and nothing it reads is printed: the contract checks shapes, not people.
 */
const helperPath = fileURLToPath(
  new URL("../../native/.build/release/apple-native-mcp", import.meta.url),
);

const helper = new Helper(() => Promise.resolve(succeeded(helperPath)));

beforeAll(async () => {
  await settledBeforeRunning(helper, helperPath, ["contacts"]);
}, 120_000);

afterAll(() => {
  helper.stop();
});

aContactStore({
  name: "the helper-backed contact store",
  build: () => Promise.resolve({ contactStore: helperContactStore(helper) }),
});

const contactsAppIsRunning = (): boolean =>
  spawnSync("pgrep", ["-x", "Contacts"], { encoding: "utf8" }).stdout.trim() !== "";

describe("the helper-backed contact store, on a Mac", () => {
  // upstream #65: upstream scripted the Contacts app, which launched it and needed an Automation
  // consent on top of the contacts permission. Reading through Contacts.framework needs neither,
  // and this is the one place that can show it.
  it.skipIf(contactsAppIsRunning())(
    "given the Contacts app is not running, reads the contacts without starting it",
    async () => {
      const read = await helperContactStore(helper).contacts();

      expect(read.ok).toBe(true);
      expect(contactsAppIsRunning()).toBe(false);
    },
  );
});
