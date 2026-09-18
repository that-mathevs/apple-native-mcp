import type { HelperInstallation } from "../application/setup/install-helper.js";
import type { Permission, PermissionAnswer } from "../application/setup/permissions.js";
import type { RemoveHelperDependencies } from "../application/setup/remove-helper.js";
import { removeHelper } from "../application/setup/remove-helper.js";
import type { SetUpDependencies } from "../application/setup/set-up.js";
import { setUp } from "../application/setup/set-up.js";
import type { NamedFailure, Outcome } from "../domain/failure.js";

/** Where a command's lines go: the terminal the user ran it in. */
export type Print = (line: string) => void;

const changeSentences: Record<HelperInstallation["change"], (version: string) => string> = {
  installed: (version) => `Installed the helper, version ${version}.`,
  updated: (version) => `Updated the helper to version ${version}.`,
  unchanged: (version) => `The helper is already version ${version}.`,
  kept: (version) => `Kept the helper already installed, version ${version}, which is newer.`,
  replaced: (version) =>
    `Replaced a helper that was not signed as apple-native-mcp with version ${version}.`,
};

const permissionNames: Record<Permission, string> = {
  calendar: "Calendar",
  reminders: "Reminders",
  contacts: "Contacts",
  notes: "Notes",
  mail: "Mail",
};

const permissionLine = (permission: Permission, answer: Outcome<PermissionAnswer>): string => {
  const name = permissionNames[permission];
  if (!answer.ok) return `${name}: could not be asked. ${answer.failure.sentence}`;

  const { state, setting } = answer.value;
  switch (state) {
    case "undecided":
      return `${name}: not answered yet. Run setup again to be asked.`;
    case "restricted":
      return `${name}: restricted. A profile on this Mac forbids it, so it cannot be allowed here.`;
    case "granted":
      return `${name}: granted.`;
    case "refused":
    case "writeOnly": {
      const said = state === "writeOnly" ? "write-only" : state;
      return setting === undefined
        ? `${name}: ${said}.`
        : `${name}: ${said}. To allow it, turn on ${setting}.`;
    }
  }
};

/** A command that could not do its work says why, with the evidence, and exits 1. */
const stopped = (failure: NamedFailure, print: Print): number => {
  print(`Setup stopped. ${failure.sentence}`);
  if (failure.evidence !== undefined) print(`  ${failure.evidence}`);
  return 1;
};

/**
 * `apple-native-mcp setup`: what it prints, one line at a time, and the status it exits with.
 * Setup changes no setting itself: a permission is asked for, and what the user answered is
 * reported with the setting that would change it.
 */
export const setupCommand = async (
  dependencies: SetUpDependencies,
  print: Print,
): Promise<number> => {
  const report = await setUp(dependencies);
  if (!report.installation.ok) return stopped(report.installation.failure, print);

  const { change, version } = report.installation.value;
  print(changeSentences[change](version));

  if (change === "kept") {
    print(
      "This setup is older than that helper, so it asked for nothing. " +
        "Run `npx apple-native-mcp@latest setup` instead.",
    );
    return 1;
  }

  for (const { permission, answer } of report.permissions) {
    print(permissionLine(permission, answer));
  }

  return 0;
};

/** `apple-native-mcp setup --remove`: what it prints, and the status it exits with. */
export const removeCommand = async (
  dependencies: RemoveHelperDependencies,
  print: Print,
): Promise<number> => {
  const removal = await removeHelper(dependencies);
  if (!removal.ok) return stopped(removal.failure, print);

  const { removed, toTurnOff } = removal.value;
  print(
    removed === undefined
      ? "No helper was installed, so none was removed."
      : `Removed the helper at ${removed.path}.`,
  );

  print("To take back what it was allowed, turn off:");
  for (const { permission, setting } of toTurnOff) {
    print(`  ${permissionNames[permission]}: ${setting}`);
  }

  return 0;
};
