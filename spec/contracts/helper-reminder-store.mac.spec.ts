import { fileURLToPath } from "node:url";

import { afterAll, beforeAll } from "vitest";

import { Helper } from "../../src/adapters/native/helper.js";
import { helperReminderStore } from "../../src/adapters/native/reminder-store.js";
import { succeeded } from "../../src/domain/failure.js";
import { aReminderStore } from "./reminder-store.contract.js";

/**
 * The same contract, against the real helper and the reminders on this Mac.
 *
 * It needs a built helper and reminders access, so it is its own command (`npm run spec:mac`)
 * and never part of hosted CI. The first run asks for access, which `setup` will do for users.
 */
const helperPath = fileURLToPath(
  new URL("../../native/.build/release/apple-native-mcp", import.meta.url),
);

const helper = new Helper(() => Promise.resolve(succeeded(helperPath)));

beforeAll(async () => {
  await helper.ask({ request: "reminders_permission_request" }, { waitsOnTheUser: true });
}, 120_000);

afterAll(() => {
  helper.stop();
});

aReminderStore({
  name: "the helper-backed reminder store",
  build: () => Promise.resolve({ reminderStore: helperReminderStore(helper) }),
});
