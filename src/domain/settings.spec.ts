import { describe, expect, it } from "vitest";

import { excludes, isOn, settingsFrom, writeCapabilities } from "./settings.js";

describe("the settings", () => {
  it("given a client's configuration that says nothing, switches every write capability off", () => {
    const settings = settingsFrom({});

    expect(writeCapabilities.filter((capability) => isOn(settings, capability))).toStrictEqual([]);
  });

  // faces-sh 784db41 switched an app's writes on together, so allowing drafts allowed sending.
  it("given sending messages switched on, leaves sending email off: one capability never implies another", () => {
    const settings = settingsFrom({ APPLE_NATIVE_MCP_CAPABILITIES: "send_message" });

    expect(isOn(settings, "send_message")).toBe(true);
    expect(isOn(settings, "send_email")).toBe(false);
  });

  it("given capabilities written with spaces around the commas, reads each of them", () => {
    const settings = settingsFrom({
      APPLE_NATIVE_MCP_CAPABILITIES: " create_event ,create_note, ",
    });

    expect([...settings.capabilities]).toStrictEqual(["create_event", "create_note"]);
  });

  it("given a name that is not a capability, says which name and which capabilities exist", () => {
    const settings = settingsFrom({ APPLE_NATIVE_MCP_CAPABILITIES: "send_mesage" });

    expect(settings.unparsed).toContain('"send_mesage"');
    expect(settings.unparsed).toContain("send_message");
  });

  // Some clients hand an optional setting the user left blank to the server as an empty
  // string. Reading that as "no allowlist" would show an agent every calendar on a typo.
  it("given a calendar allowlist that is set but empty, keeps every calendar from the agent: an allowlist fails closed", () => {
    const settings = settingsFrom({ APPLE_NATIVE_MCP_CALENDAR_ALLOWLIST: "" });

    expect(excludes(settings.calendars, "cal-work")).toBe(true);
  });

  it("given settings that do not parse, still keeps excluded calendars from the agent", () => {
    const settings = settingsFrom({
      APPLE_NATIVE_MCP_CAPABILITIES: "everything",
      APPLE_NATIVE_MCP_EXCLUDED_CALENDARS: "cal-therapy",
    });

    expect(excludes(settings.calendars, "cal-therapy")).toBe(true);
  });

  // A misspelt exclusion is the dangerous kind of typo: the calendar the user meant to keep
  // back stays in view, and nothing else would ever say so.
  it("given a setting of this server's that it does not know, says the settings do not parse and switches every write capability off", () => {
    const settings = settingsFrom({
      APPLE_NATIVE_MCP_CAPABILITIES: "create_event",
      APPLE_NATIVE_MCP_EXCLUDED_CALENDAR: "cal-therapy",
    });

    expect(settings.unparsed).toContain("APPLE_NATIVE_MCP_EXCLUDED_CALENDAR");
    expect(isOn(settings, "create_event")).toBe(false);
  });

  it("given the client's other environment, reads only the settings that are this server's", () => {
    const settings = settingsFrom({ PATH: "/usr/bin", APPLE_NATIVE_MCP_HELPER: "/opt/helper" });

    expect(settings.unparsed).toBeUndefined();
  });
});
