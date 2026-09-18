import type { Outcome } from "../../domain/failure.js";
import type { HelperInstallation, InstallHelperDependencies } from "./install-helper.js";
import { installHelper } from "./install-helper.js";
import type { Permission, PermissionAnswer, Permissions } from "./permissions.js";
import { permissionsAskedBySetup } from "./permissions.js";

export type SetUpDependencies = InstallHelperDependencies & {
  readonly permissions: Permissions;
};

/** What setup did, and what each permission is now. */
export type SetUpReport = {
  readonly installation: Outcome<HelperInstallation>;
  readonly permissions: readonly {
    readonly permission: Permission;
    readonly answer: Outcome<PermissionAnswer>;
  }[];
};

/**
 * Install the helper, then ask for every permission it holds, one at a time so the user meets
 * one prompt at once. A helper that could not be installed is asked for nothing, and neither is
 * a newer one this setup kept: the server starts no helper newer than itself.
 */
export const setUp = async (dependencies: SetUpDependencies): Promise<SetUpReport> => {
  const installation = await installHelper(dependencies);
  if (!installation.ok || installation.value.change === "kept") {
    return { installation, permissions: [] };
  }

  const permissions: SetUpReport["permissions"][number][] = [];
  for (const permission of permissionsAskedBySetup) {
    permissions.push({ permission, answer: await dependencies.permissions.askFor(permission) });
  }

  return { installation, permissions };
};
