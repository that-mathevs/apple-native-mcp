import type { HelperInstallation } from "../application/setup/install-helper.js";
import type { Permission, PermissionAnswer } from "../application/setup/permissions.js";
import type { RemoveHelperDependencies } from "../application/setup/remove-helper.js";
import { removeHelper } from "../application/setup/remove-helper.js";
import type { SetUpDependencies } from "../application/setup/set-up.js";
import { setUp } from "../application/setup/set-up.js";
import type { Outcome } from "../domain/failure.js";

const installed: Record<HelperInstallation["change"], (version: string) => string> = {
  installed: (version) => `Installed the helper, version ${version}.`,
  updated: (version) => `Updated the helper to version ${version}.`,
  unchanged: (version) => `The helper is already version ${version}.`,
  kept: (version) => `Kept the helper already installed, version ${version}, which is newer.`,
  replaced: (version) =>
    `Replaced a helper that was not signed as apple-native-mcp with version ${version}.`,
};

const named: Record<Permission, string> = { calendar: "Calendar", reminders: "Reminders" };

const permissionLine = (permission: Permission, answer: Outcome<PermissionAnswer>): string => {
  const name = named[permission];
  if (!answer.ok) return `${name}: could not be asked. ${answer.failure.sentence}`;

  const { state, setting } = answer.value;
  if (state === "undecided") return `${name}: not answered yet. Run setup again to be asked.`;

  const said = state === "writeOnly" ? "write-only" : state;
  return setting === undefined
    ? `${name}: ${said}.`
    : `${name}: ${said}. To allow it, turn on ${setting}.`;
};

/**
 * `apple-native-mcp setup`: what it prints, one line at a time, and the status it exits with.
 * Setup changes no setting itself: a permission is asked for, and what the user answered is
 * reported with the setting that would change it.
 */
export const setup = async (
  dependencies: SetUpDependencies,
  print: (line: string) => void,
): Promise<number> => {
  const report = await setUp(dependencies);

  if (!report.installation.ok) {
    const { sentence, evidence } = report.installation.failure;
    print(`Setup stopped. ${sentence}`);
    if (evidence !== undefined) print(`  ${evidence}`);
    return 1;
  }

  const { change, version } = report.installation.value;
  print(installed[change](version));

  for (const { permission, answer } of report.permissions) {
    print(permissionLine(permission, answer));
  }

  return 0;
};

/** `apple-native-mcp setup --remove`: what it prints, and the status it exits with. */
export const removeSetup = async (
  dependencies: RemoveHelperDependencies,
  print: (line: string) => void,
): Promise<number> => {
  const removal = await removeHelper(dependencies);

  if (!removal.ok) {
    const { sentence, evidence } = removal.failure;
    print(`Setup stopped. ${sentence}`);
    if (evidence !== undefined) print(`  ${evidence}`);
    return 1;
  }

  const { removed, toTurnOff } = removal.value;
  print(
    removed === undefined
      ? "No helper was installed, so none was removed."
      : `Removed the helper at ${removed.path}.`,
  );

  print("To take back what it was allowed, turn off:");
  for (const { permission, setting } of toTurnOff) print(`  ${named[permission]}: ${setting}`);

  return 0;
};
