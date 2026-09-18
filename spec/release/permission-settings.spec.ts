import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { permissionSettings } from "../../src/application/setup/permissions.js";

// Setup --remove names each permission's setting without the helper, which it has just taken
// away, so the server keeps its own copy of what the helper says. A copy that drifted would send
// the user to a setting that is not there.

const helperSetting = async (name: string): Promise<string | undefined> => {
  const source = await readFile(
    new URL("../../native/Sources/HelperCore/Permission.swift", import.meta.url),
    "utf8",
  );
  return new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "u").exec(source)?.[1];
};

describe("the settings setup names", () => {
  it("name the calendar permission's setting exactly as the helper does", async () => {
    expect(permissionSettings.calendar).toBe(await helperSetting("calendarPermissionSetting"));
  });

  it("name the reminders permission's setting exactly as the helper does", async () => {
    expect(permissionSettings.reminders).toBe(await helperSetting("remindersPermissionSetting"));
  });

  it("name the contacts permission's setting exactly as the helper does", async () => {
    expect(permissionSettings.contacts).toBe(await helperSetting("contactsPermissionSetting"));
  });

  it("name the setting for controlling Notes exactly as the helper does", async () => {
    expect(permissionSettings.notes).toBe(await helperSetting("notesPermissionSetting"));
  });
});
