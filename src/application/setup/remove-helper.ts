import type { Outcome } from "../../domain/failure.js";
import { succeeded } from "../../domain/failure.js";
import type { HelperFile, HelperFiles } from "./helper-files.js";
import type { Permission } from "./permissions.js";
import { permissionSettings, permissionsAskedBySetup } from "./permissions.js";

export type RemoveHelperDependencies = {
  readonly helperFiles: HelperFiles;
};

/** What was removed, and every permission the user still has to take back themselves. */
export type HelperRemoval = {
  readonly removed: HelperFile | undefined;
  readonly toTurnOff: readonly { readonly permission: Permission; readonly setting: string }[];
};

/**
 * Take the installed helper away. Only the user can take back a macOS permission, and one
 * outlives the helper it was granted to, so every permission is listed whether or not a helper
 * was there to remove.
 */
export const removeHelper = async ({
  helperFiles,
}: RemoveHelperDependencies): Promise<Outcome<HelperRemoval>> => {
  const removed = await helperFiles.remove();
  if (!removed.ok) return removed;

  return succeeded({
    removed: removed.value,
    toTurnOff: permissionsAskedBySetup.map((permission) => ({
      permission,
      setting: permissionSettings[permission],
    })),
  });
};
