import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

describe("the helper-backed note store, on a Mac", () => {
  // #44: run from a worker thread while the helper's main thread sat blocked, a script's Apple
  // Event sometimes never got its reply, and one run in every dozen or so hung until its time
  // budget ran out. Scripts run on the helper's main thread now, and only a real app, asked many
  // times in one helper, can show that they keep hearing back.
  it("given the same script thirty times over in one helper, answers every time", async () => {
    const noteStore = helperNoteStore(helper);

    for (let run = 0; run < 30; run += 1) {
      expect(await noteStore.noteFolders()).toMatchObject({ ok: true });
    }
  }, 120_000);
});
