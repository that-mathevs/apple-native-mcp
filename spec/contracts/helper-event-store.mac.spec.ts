import { fileURLToPath } from "node:url";

import { afterAll, describe, it } from "vitest";

import { calendarEventStore } from "../../src/adapters/native/calendar-event-store.js";
import { Helper } from "../../src/adapters/native/helper.js";
import { succeeded } from "../../src/domain/failure.js";
import {
  anEventStore,
  anEventStoreThatCreatesEvents,
  anEventStoreThatListsCalendars,
} from "./event-store.contract.js";

/**
 * The same contract, against the real helper and the real calendar on this Mac.
 *
 * It needs a built helper and calendar access, so it is its own command (`npm run spec:mac`) and
 * never part of hosted CI. A fake that passes its contract is only worth trusting while the real
 * store passes the same one.
 *
 * The first run asks for calendar access, which `setup` does for users. It asks before anything
 * else in this file, the search for the scratch calendar included: a development build is a new
 * program to macOS every time it is rebuilt, so its permission starts out undecided, and a
 * contract that never asked read that as thirteen failures rather than one prompt.
 */
const helperPath = fileURLToPath(
  new URL("../../native/.build/release/apple-native-mcp", import.meta.url),
);

const helper = new Helper(() => Promise.resolve(succeeded(helperPath)));

await helper.ask({ request: "calendar_permission_request" }, { waitsOnTheUser: true });

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

/**
 * The one calendar the write contract may touch: a writable calendar titled "scratch", and only
 * when there is exactly one. Anything else, and creating is left unspecified here rather than
 * aimed at a calendar somebody uses.
 */
const scratchCalendar = async (): Promise<string | undefined> => {
  const read = await calendarEventStore(helper).calendars();
  const scratch = (read.ok ? read.value : []).filter(
    ({ title, acceptsNewEvents }) => acceptsNewEvents && title.trim().toLowerCase() === "scratch",
  );

  return scratch.length === 1 ? scratch[0]?.identifier : undefined;
};

const scratch = await scratchCalendar();

if (scratch === undefined) {
  describe("the helper-backed event store, asked to create an event", () => {
    it.skip("needs exactly one writable calendar titled scratch, and creates nowhere else");
  });
} else {
  anEventStoreThatCreatesEvents({
    name: "the helper-backed event store",
    build: () =>
      Promise.resolve({
        eventStore: calendarEventStore(helper),
        calendar: scratch,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
  });
}
