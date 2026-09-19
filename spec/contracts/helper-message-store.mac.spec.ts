import { fileURLToPath } from "node:url";

import { afterAll } from "vitest";

import { Helper } from "../../src/adapters/native/helper.js";
import { helperMessageStore } from "../../src/adapters/native/message-store.js";
import { succeeded } from "../../src/domain/failure.js";
import { settledBeforeRunning } from "../support/mac-permissions.js";
import { aMessageStore } from "./message-store.contract.js";

/**
 * The same contract, against the real helper and the message store on this Mac.
 *
 * It needs a built helper holding Full Disk Access, which only the user can grant in System
 * Settings, so it is its own command (`npm run spec:mac`) and never part of hosted CI.
 */
const helperPath = fileURLToPath(
  new URL("../../native/.build/release/apple-native-mcp", import.meta.url),
);

const helper = new Helper(() => Promise.resolve(succeeded(helperPath)));

// Full Disk Access can't be asked for; without it, this stops before any scenario, saying how.
await settledBeforeRunning(helper, helperPath, ["fullDiskAccess"]);

afterAll(() => {
  helper.stop();
});

aMessageStore({
  name: "the helper-backed message store",
  build: () => Promise.resolve({ messageStore: helperMessageStore(helper) }),
});
