import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Helper } from "../../src/adapters/native/helper.js";
import { helperMailStore } from "../../src/adapters/native/mail-store.js";
import { succeeded } from "../../src/domain/failure.js";
import { aMailStore } from "./mail-store.contract.js";

/**
 * The same contract, against the real helper and the Mail on this Mac.
 *
 * It needs a built helper, Mail with an account set up, and the permission to read it, so it is
 * its own command (`npm run spec:mac`) and never part of hosted CI. The first run asks, which
 * `setup` does for users.
 */
const helperPath = fileURLToPath(
  new URL("../../native/.build/release/apple-native-mcp", import.meta.url),
);

const helper = new Helper(() => Promise.resolve(succeeded(helperPath)));

beforeAll(async () => {
  await helper.ask({ request: "mail_permission_request" }, { waitsOnTheUser: true });
}, 120_000);

afterAll(() => {
  helper.stop();
});

aMailStore({
  name: "the helper-backed mail store",
  build: () => Promise.resolve({ mailStore: helperMailStore(helper) }),
});

describe("the helper-backed mail store, on a Mac", () => {
  // Run from a worker thread while the helper's main thread sat blocked, a script's Apple Event
  // sometimes never got its reply: six mail accounts answered in under 300 ms each and the
  // seventh ran out its time budget, while /usr/bin/osascript answered thirty times in thirty.
  // Scripts run on the helper's main thread now, and only a real app, asked many times in one
  // helper, can show that they keep hearing back.
  it("given the same mail account's mailboxes thirty times over in one helper, answers every time", async () => {
    const mailStore = helperMailStore(helper);
    const accounts = await mailStore.mailAccounts();
    const [first] = accounts.ok ? accounts.value : [];
    if (!first) throw new Error("Mail has no mail account to ask about");

    for (let run = 0; run < 30; run += 1) {
      expect(await mailStore.mailboxes(first)).toMatchObject({ ok: true });
    }
  }, 120_000);
});
