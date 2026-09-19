import { fileURLToPath } from "node:url";

import { afterAll, describe, it } from "vitest";

import { Helper } from "../../src/adapters/native/helper.js";
import { helperReminderStore } from "../../src/adapters/native/reminder-store.js";
import { succeeded } from "../../src/domain/failure.js";
import { settledBeforeRunning } from "../support/mac-permissions.js";
import { aReminderStore, aReminderStoreThatCreatesReminders } from "./reminder-store.contract.js";

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

// Asked before anything else, the scratch list below included: the lists can't be read until then.
await settledBeforeRunning(helper, helperPath, ["reminders"]);

afterAll(() => {
  helper.stop();
});

aReminderStore({
  name: "the helper-backed reminder store",
  build: () => Promise.resolve({ reminderStore: helperReminderStore(helper) }),
});

/**
 * The one reminder list the write contract may touch: the one titled "scratch", and only when
 * there is exactly one. Anything else, and creating is left unspecified here rather than aimed at
 * a list somebody uses.
 */
const scratchReminderList = async (): Promise<string | undefined> => {
  const read = await helperReminderStore(helper).reminderLists();
  const scratch = (read.ok ? read.value : []).filter(
    ({ title }) => title.trim().toLowerCase() === "scratch",
  );

  return scratch.length === 1 ? scratch[0]?.identifier : undefined;
};

const scratch = await scratchReminderList();

if (scratch === undefined) {
  describe("the helper-backed reminder store, asked to create a reminder", () => {
    it.skip("needs exactly one reminder list titled scratch, and creates nowhere else");
  });
} else {
  aReminderStoreThatCreatesReminders({
    name: "the helper-backed reminder store",
    build: () =>
      Promise.resolve({ reminderStore: helperReminderStore(helper), reminderList: scratch }),
  });
}
