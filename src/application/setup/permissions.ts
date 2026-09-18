import type { Outcome } from "../../domain/failure.js";

/** The permissions the helper holds, one per store it guards. */
export const permissionsAskedBySetup = ["calendar", "reminders"] as const;

export type Permission = (typeof permissionsAskedBySetup)[number];

/**
 * Where each permission is turned on and off, as the helper names it: setup lists these when it
 * removes the helper, which can no longer be asked.
 */
export const permissionSettings: Readonly<Record<Permission, string>> = {
  calendar: "System Settings > Privacy & Security > Calendars > apple-native-mcp",
  reminders: "System Settings > Privacy & Security > Reminders > apple-native-mcp",
};

/** What macOS allows the helper, in the helper's own words (native/README.md). */
export const permissionStates = [
  "granted",
  "refused",
  "undecided",
  "restricted",
  "writeOnly",
] as const;

export type PermissionState = (typeof permissionStates)[number];

export type PermissionAnswer = {
  readonly state: PermissionState;
  /** The setting to change and where, whenever changing one is what would help. */
  readonly setting?: string;
};

/** Where a permission is asked for: the helper, which is what macOS attributes a grant to. */
export type Permissions = {
  /** Asks the user while nobody has been asked, and otherwise says what was answered. */
  readonly askFor: (permission: Permission) => Promise<Outcome<PermissionAnswer>>;
};
