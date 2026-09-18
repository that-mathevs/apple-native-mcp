import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { calendarEventStore } from "../../src/adapters/native/calendar-event-store.js";
import { Helper } from "../../src/adapters/native/helper.js";

// What the server does when the helper dies between doing the work and saying so. A read is
// simply asked again. A write must not be: asked twice, it happens twice (faces-sh bcdc856 and
// upstream #27 are the same meeting three times over), and the check for a duplicate has
// already been passed by then.

const dyingHelper = fileURLToPath(new URL("fixtures/a-helper-that-dies.mjs", import.meta.url));

const noon = new Date("2026-09-18T16:00:00Z");

describe("a helper that stops before it answers", () => {
  let log: string;
  let helper: Helper;

  const requestsReceived = (): string[] =>
    readFileSync(log, "utf8")
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => (JSON.parse(line) as { request: string }).request);

  beforeEach(() => {
    log = join(mkdtempSync(join(tmpdir(), "apple-native-mcp-")), "requests.log");
    process.env.A_HELPER_THAT_DIES_LOG = log;
    helper = new Helper(dyingHelper);
  });

  afterEach(() => {
    helper.stop();
    delete process.env.A_HELPER_THAT_DIES_LOG;
  });

  it("given a read, starts the helper again and asks once more before giving up with a named failure", async () => {
    const read = await calendarEventStore(helper).calendars();

    expect(read).toMatchObject({ ok: false, failure: { code: "helper-stopped" } });
    expect(requestsReceived()).toStrictEqual(["calendars", "calendars"]);
  });

  it("given a write, never sends it a second time, and reports the outcome as unconfirmed rather than as a failure to retry", async () => {
    const created = await calendarEventStore(helper).create({
      title: "Lunch",
      calendarIdentifier: "cal-1",
      time: { kind: "timed", start: noon, end: new Date(noon.getTime() + 60 * 60 * 1000) },
    });

    expect(created).toStrictEqual({ ok: true, value: { confirmed: false } });
    expect(requestsReceived()).toStrictEqual(["create_event"]);
  });
});
