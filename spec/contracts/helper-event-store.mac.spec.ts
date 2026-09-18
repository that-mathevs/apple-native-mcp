import { fileURLToPath } from "node:url";

import { afterAll } from "vitest";

import { calendarEventStore } from "../../src/adapters/native/calendar-event-store.js";
import { Helper } from "../../src/adapters/native/helper.js";
import { succeeded } from "../../src/domain/failure.js";
import { anEventStore, anEventStoreThatListsCalendars } from "./event-store.contract.js";

/**
 * The same contract, against the real helper and the real calendar on this Mac.
 *
 * It needs a built helper and calendar access, so it is its own command (`npm run spec:mac`) and
 * never part of hosted CI. A fake that passes its contract is only worth trusting while the real
 * store passes the same one.
 */
const helperPath = fileURLToPath(
  new URL("../../native/.build/release/apple-native-mcp", import.meta.url),
);

const helper = new Helper(() => Promise.resolve(succeeded(helperPath)));

afterAll(() => {
  helper.stop();
});

anEventStore({
  name: "the helper-backed event store",
  build: () => Promise.resolve({ eventStore: calendarEventStore(helper) }),
});

anEventStoreThatListsCalendars({
  name: "the helper-backed event store",
  build: () => Promise.resolve({ eventStore: calendarEventStore(helper) }),
});
