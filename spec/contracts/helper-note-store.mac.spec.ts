import { fileURLToPath } from "node:url";

import { afterAll, beforeAll } from "vitest";

import { Helper } from "../../src/adapters/native/helper.js";
import { helperNoteStore } from "../../src/adapters/native/note-store.js";
import { succeeded } from "../../src/domain/failure.js";
import { aNoteStore } from "./note-store.contract.js";

/**
 * The same contract, against the real helper scripting the Notes on this Mac.
 *
 * It needs a built helper and the Automation consent to control Notes, so it is its own command
 * (`npm run spec:mac`) and never part of hosted CI. The first run asks for the consent, which
 * `setup` does for users, and starts Notes in the background if it is not running. It only
 * reads, and nothing it reads is printed: the contract checks shapes, not what anybody wrote.
 */
const helperPath = fileURLToPath(
  new URL("../../native/.build/release/apple-native-mcp", import.meta.url),
);

const helper = new Helper(() => Promise.resolve(succeeded(helperPath)));

beforeAll(async () => {
  await helper.ask({ request: "notes_permission_request" }, { waitsOnTheUser: true });
}, 120_000);

afterAll(() => {
  helper.stop();
});

aNoteStore({
  name: "the helper-backed note store",
  build: () => Promise.resolve({ noteStore: helperNoteStore(helper) }),
});
