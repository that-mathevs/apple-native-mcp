import { beforeEach, describe, expect, it } from "vitest";

import { removeCommand } from "../../../src/cli/setup.js";
import { FakeHelperFiles, fixedPath } from "../../support/fake-helper-files.js";

// What `npx apple-native-mcp setup --remove` does and says. Nothing may be left holding a
// permission to the user's data (user story 53), but only the user can take one back, so setup
// removes the helper and says exactly which settings to turn off, and where.

const revoking = [
  "To take back what it was allowed, turn off:",
  "  Calendar: System Settings > Privacy & Security > Calendars > apple-native-mcp",
  "  Reminders: System Settings > Privacy & Security > Reminders > apple-native-mcp",
  "  Contacts: System Settings > Privacy & Security > Contacts > apple-native-mcp",
];

describe("removing the helper", () => {
  let helperFiles: FakeHelperFiles;

  /** What setup --remove printed, and the exit status it ended with. */
  const removing = async (): Promise<{ printed: string[]; status: number }> => {
    const printed: string[] = [];
    const status = await removeCommand({ helperFiles }, (line) => {
      printed.push(line);
    });
    return { printed, status };
  };

  beforeEach(() => {
    helperFiles = new FakeHelperFiles();
  });

  it("given an installed helper, removes it and lists every permission to turn off, and where", async () => {
    helperFiles.hasInstalled("0.1.0");

    const { printed, status } = await removing();

    expect(printed).toStrictEqual([`Removed the helper at ${fixedPath}.`, ...revoking]);
    expect(helperFiles.installedAt()).toBeUndefined();
    expect(status).toBe(0);
  });

  it("given no helper is installed, says there was nothing to remove and still lists what to turn off", async () => {
    // A permission outlives the helper it was granted to, so it is listed either way.
    const { printed, status } = await removing();

    expect(printed).toStrictEqual(["No helper was installed, so none was removed.", ...revoking]);
    expect(status).toBe(0);
  });
});
