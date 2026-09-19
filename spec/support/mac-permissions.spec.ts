import { describe, expect, it } from "vitest";

import { failed, succeeded } from "../../src/domain/failure.js";
import { findingFor, whatStandsInTheWay } from "./mac-permissions.js";

// What a Mac spec does about a permission before its first scenario. A contract that found one
// missing used to fail every scenario it had, and the next run found the next one: the user asked
// for every permission to be settled up front, with Settings opened at the pane that fixes it.

const helperPath = "/path/to/apple-native-mcp";

describe("settling a Mac spec's permissions", () => {
  it("given every permission it needs granted, finds nothing in the way", () => {
    const findings = [findingFor("calendar", succeeded({ state: "granted" }))];

    expect(whatStandsInTheWay(findings, helperPath)).toBeUndefined();
  });

  it("given a permission refused, opens the pane that turns it on and names its setting", () => {
    const refused = findingFor("calendar", succeeded({ state: "refused" }));

    expect(whatStandsInTheWay([refused], helperPath)).toMatchObject({
      panes: ["Privacy_Calendars"],
      message: expect.stringContaining("Calendars > apple-native-mcp") as string,
    });
  });

  it("given two permissions set in one pane, opens it once", () => {
    const findings = [
      findingFor("notes", succeeded({ state: "refused" })),
      findingFor("mail", succeeded({ state: "refused" })),
    ];

    expect(whatStandsInTheWay(findings, helperPath)?.panes).toStrictEqual(["Privacy_Automation"]);
  });

  // A helper that crashed or timed out is not a permission: a pane could not fix it.
  it("given the helper failed rather than answered, says so and opens no pane", () => {
    const broken = findingFor("reminders", failed({ code: "helper-timed-out", sentence: "…" }));

    expect(whatStandsInTheWay([broken], helperPath)).toMatchObject({
      panes: [],
      message: expect.stringContaining("helper-timed-out") as string,
    });
  });

  // Full Disk Access lists only what has been added to it, so switching it on can't be the whole
  // instruction.
  it("given Full Disk Access missing, says how to add the helper, with its path", () => {
    const missing = findingFor(
      "fullDiskAccess",
      failed({ code: "message_store_permission_missing", sentence: "…" }),
    );

    expect(whatStandsInTheWay([missing], helperPath)).toMatchObject({
      panes: ["Privacy_AllFiles"],
      message: expect.stringContaining(helperPath) as string,
    });
  });

  it("given the message store read, finds Full Disk Access granted", () => {
    const read = findingFor("fullDiskAccess", succeeded({ state: "granted" }));

    expect(whatStandsInTheWay([read], helperPath)).toBeUndefined();
  });
});
