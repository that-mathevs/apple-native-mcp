import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { calendarEventStore } from "../../src/adapters/native/calendar-event-store.js";
import { Helper } from "../../src/adapters/native/helper.js";
import { helperPermissions } from "../../src/adapters/native/helper-permissions.js";
import { helperReminderStore } from "../../src/adapters/native/reminder-store.js";
import { succeeded } from "../../src/domain/failure.js";

// danielk-am ad3e9e9 and upstream #53: a store that never answered held the tool call until the
// client gave up, and every call after it waited in the same queue.

const stuckHelper = fileURLToPath(
  new URL("fixtures/a-helper-that-gets-stuck.mjs", import.meta.url),
);

/**
 * Short, so the scenarios are quick; the server's own time budget is the same rule, longer. It
 * covers starting the fake helper, a Node process, which on a loaded machine can take a few
 * hundred milliseconds: at 200 the fresh helper once timed out too, in a full run.
 */
const timeBudget = 500;

describe("a helper that takes too long to answer", () => {
  let log: string;
  let helper: Helper;

  const gettingStuckOn = (...requests: string[]): void => {
    process.env.A_HELPER_THAT_GETS_STUCK_ON = requests.join(",");
  };

  const slowOver = (request: string, milliseconds: number): void => {
    process.env.A_HELPER_THAT_GETS_STUCK_SLOW = `${request}:${String(milliseconds)}`;
  };

  /** What the helpers were started for and asked, in order, across every start. */
  const whatHappened = (): string[] =>
    readFileSync(log, "utf8")
      .split("\n")
      .filter((line) => line !== "");

  beforeEach(() => {
    log = join(mkdtempSync(join(tmpdir(), "apple-native-mcp-")), "helper.log");
    process.env.A_HELPER_THAT_GETS_STUCK_LOG = log;
    helper = new Helper(() => Promise.resolve(succeeded(stuckHelper)), {
      answersWithin: timeBudget,
    });
  });

  afterEach(() => {
    helper.stop();
    delete process.env.A_HELPER_THAT_GETS_STUCK_LOG;
    delete process.env.A_HELPER_THAT_GETS_STUCK_ON;
    delete process.env.A_HELPER_THAT_GETS_STUCK_SLOW;
  });

  it("given a read it never answers, fails with a named timeout once its time budget runs out rather than waiting for ever", async () => {
    gettingStuckOn("reminder_lists");

    const read = await helperReminderStore(helper).reminderLists();

    expect(read).toMatchObject({ ok: false, failure: { code: "helper-timed-out" } });
  });

  it("given a call after one that timed out, is answered by a helper started afresh rather than queued behind the stuck one", async () => {
    gettingStuckOn("reminder_lists");
    await helperReminderStore(helper).reminderLists();

    const next = await helperReminderStore(helper).reminders({
      reminderLists: ["list-1"],
      includeCompleted: false,
    });

    expect(next.ok).toBe(true);
    expect(whatHappened()).toStrictEqual(["started", "reminder_lists", "started", "reminders"]);
  });

  // NN3: a write the helper took but never answered may have happened, so it is never sent again.
  it("given a write it never answers, reports the outcome as unconfirmed and never sends it a second time", async () => {
    gettingStuckOn("create_event");
    const noon = new Date("2026-09-18T16:00:00Z");

    const created = await calendarEventStore(helper).create({
      title: "Lunch",
      calendarIdentifier: "cal-1",
      time: { kind: "timed", start: noon, end: new Date(noon.getTime() + 60 * 60 * 1000) },
    });

    expect(created).toStrictEqual({ ok: true, value: { confirmed: false } });
    expect(whatHappened().filter((line) => line === "create_event")).toHaveLength(1);
  });

  it("given two reads at once and a helper stuck on the first, answers the second from a helper started afresh", async () => {
    gettingStuckOn("reminder_lists");
    const reminderStore = helperReminderStore(helper);

    const [stuck, next] = await Promise.all([
      reminderStore.reminderLists(),
      reminderStore.reminders({ reminderLists: ["list-1"], includeCompleted: false }),
    ]);

    expect(stuck).toMatchObject({ ok: false, failure: { code: "helper-timed-out" } });
    expect(next.ok).toBe(true);
    expect(whatHappened()).toStrictEqual(["started", "reminder_lists", "started", "reminders"]);
  });

  it("given a read asked while the user is still answering a prompt, waits its turn rather than timing out and stopping the prompt", async () => {
    slowOver("reminders_permission_request", timeBudget * 2);

    const [answer, read] = await Promise.all([
      helperPermissions(helper).askFor("reminders"),
      helperReminderStore(helper).reminderLists(),
    ]);

    expect(answer).toStrictEqual({ ok: true, value: { state: "granted" } });
    expect(read.ok).toBe(true);
    expect(whatHappened().filter((line) => line === "started")).toHaveLength(1);
  });

  it("given a request that waits on the user, such as a permission prompt, waits past the time budget for their answer", async () => {
    slowOver("reminders_permission_request", timeBudget * 2);

    const answer = await helperPermissions(helper).askFor("reminders");

    expect(answer).toStrictEqual({ ok: true, value: { state: "granted" } });
  });
});
