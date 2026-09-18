import { beforeEach, describe, expect, it } from "vitest";

import { setupCommand } from "../../../src/cli/setup.js";
import { FakeCodeRequirement } from "../../support/fake-code-requirement.js";
import { FakeHelperFiles, shippedPath } from "../../support/fake-helper-files.js";
import { FakePermissions } from "../../support/fake-permissions.js";

// What `npx apple-native-mcp setup` does and says. Setup is the one place a permission is asked
// for: upstream failed on a missing permission without naming the setting to change (upstream
// #65), and tools that open System Settings on their own interrupt an agent mid-call.

describe("running setup", () => {
  let helperFiles: FakeHelperFiles;
  let codeRequirement: FakeCodeRequirement;
  let permissions: FakePermissions;

  /** What setup printed, and the exit status it ended with. */
  const runningSetup = async (): Promise<{ printed: string[]; status: number }> => {
    const printed: string[] = [];
    const status = await setupCommand({ helperFiles, codeRequirement, permissions }, (line) => {
      printed.push(line);
    });
    return { printed, status };
  };

  beforeEach(() => {
    helperFiles = new FakeHelperFiles();
    codeRequirement = new FakeCodeRequirement();
    permissions = new FakePermissions();
    helperFiles.ships("0.1.0");
  });

  it("given a Mac with no helper, installs it and says which version", async () => {
    const { printed, status } = await runningSetup();

    expect(printed[0]).toBe("Installed the helper, version 0.1.0.");
    expect(status).toBe(0);
  });

  it("asks for each permission up front and reports what each one is now", async () => {
    permissions.answers("calendar", { state: "granted" });
    permissions.answers("reminders", { state: "granted" });

    const { printed } = await runningSetup();

    expect(permissions.askedFor).toStrictEqual(["calendar", "reminders", "contacts"]);
    expect(printed.slice(1)).toStrictEqual([
      "Calendar: granted.",
      "Reminders: granted.",
      "Contacts: granted.",
    ]);
  });

  // Setup changes no setting itself: the only thing it can do to a permission is ask for it.
  it("given a permission the user refused, names the setting that allows it", async () => {
    const setting = "System Settings > Privacy & Security > Calendars > apple-native-mcp";
    permissions.answers("calendar", { state: "refused", setting });

    const { printed } = await runningSetup();

    expect(printed).toContain(`Calendar: refused. To allow it, turn on ${setting}.`);
  });

  it("given a permission a profile on this Mac forbids, says so rather than naming a setting the user cannot change", async () => {
    permissions.answers("calendar", {
      state: "restricted",
      setting: "System Settings > Privacy & Security > Calendars > apple-native-mcp",
    });

    const { printed } = await runningSetup();

    expect(printed).toContain(
      "Calendar: restricted. A profile on this Mac forbids it, so it cannot be allowed here.",
    );
  });

  it("given a permission nobody has answered yet, says so and that running setup again asks", async () => {
    permissions.answers("reminders", { state: "undecided" });

    const { printed } = await runningSetup();

    expect(printed).toContain("Reminders: not answered yet. Run setup again to be asked.");
  });

  it("given a permission that could not be asked, says so rather than calling it refused", async () => {
    // EventKit reports a failed ask as "not granted"; calling it a refusal would send the user to
    // a setting macOS never created (#57).
    permissions.cannotAsk("calendar", "The helper stopped before it answered.");

    const { printed } = await runningSetup();

    expect(printed).toContain(
      "Calendar: could not be asked. The helper stopped before it answered.",
    );
  });

  it("given a shipped helper that fails the code requirement, stops before asking for anything and says why", async () => {
    codeRequirement.isNotMetBy(shippedPath, "code failed to satisfy specified code requirement(s)");

    const { printed, status } = await runningSetup();

    expect(printed).toStrictEqual([
      "Setup stopped. The shipped helper is not signed as apple-native-mcp, so nothing was installed.",
      "  code failed to satisfy specified code requirement(s)",
    ]);
    expect(permissions.askedFor).toStrictEqual([]);
    expect(status).toBe(1);
  });

  it("given a newer helper already installed, keeps it, asks for nothing, and says how to run the newer setup", async () => {
    // This setup is older than the helper, and the server refuses to start a helper newer than
    // itself, so asking through it would only fail twice over.
    helperFiles.hasInstalled("0.2.0");

    const { printed, status } = await runningSetup();

    expect(printed).toStrictEqual([
      "Kept the helper already installed, version 0.2.0, which is newer.",
      "This setup is older than that helper, so it asked for nothing. " +
        "Run `npx apple-native-mcp@latest setup` instead.",
    ]);
    expect(permissions.askedFor).toStrictEqual([]);
    expect(status).toBe(1);
  });
});
