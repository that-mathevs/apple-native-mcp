import { execFile } from "node:child_process";

import type { Helper } from "../../src/adapters/native/helper.js";
import { helperMessageStore } from "../../src/adapters/native/message-store.js";
import { helperPermissions } from "../../src/adapters/native/helper-permissions.js";
import {
  permissionSettings,
  type Permission,
  type PermissionAnswer,
} from "../../src/application/setup/permissions.js";
import type { Outcome } from "../../src/domain/failure.js";

/**
 * A Mac spec's permissions, settled before its first scenario: asked for while nobody has
 * answered, and otherwise read. For any not granted, System Settings is opened at the pane that
 * turns it on, and the spec stops with one message saying what to switch on. A spec asks only for
 * what it needs, so a calendar run never asks for Mail, or starts it.
 */

/** A permission a Mac spec can need: one the helper asks for, or Full Disk Access. */
export type Grant = Permission | "fullDiskAccess";

export type Finding =
  | { readonly grant: Grant; readonly kind: "granted" }
  | { readonly grant: Grant; readonly kind: "missing"; readonly state: string }
  | { readonly grant: Grant; readonly kind: "broken"; readonly code: string };

/** The pane of System Settings each permission is turned on in. */
const panes: Readonly<Record<Grant, string>> = {
  calendar: "Privacy_Calendars",
  reminders: "Privacy_Reminders",
  contacts: "Privacy_Contacts",
  notes: "Privacy_Automation",
  mail: "Privacy_Automation",
  fullDiskAccess: "Privacy_AllFiles",
};

const settings: Readonly<Record<Grant, string>> = {
  ...permissionSettings,
  fullDiskAccess: "System Settings > Privacy & Security > Full Disk Access > apple-native-mcp",
};

/**
 * What an answer says about a permission. Full Disk Access can't be asked for, so it is found
 * missing by a read the store refuses for want of it. Any other failure is the helper's, which no
 * setting would fix.
 */
export const findingFor = (
  grant: Grant,
  answer: Outcome<Pick<PermissionAnswer, "state">>,
): Finding => {
  if (answer.ok) {
    return answer.value.state === "granted"
      ? { grant, kind: "granted" }
      : { grant, kind: "missing", state: answer.value.state };
  }
  return answer.failure.code === "message_store_permission_missing"
    ? { grant, kind: "missing", state: "not granted" }
    : { grant, kind: "broken", code: answer.failure.code };
};

/** The panes to open and what to tell the user, or nothing when every permission is granted. */
export const whatStandsInTheWay = (
  findings: readonly Finding[],
  helperPath: string,
): { readonly panes: readonly string[]; readonly message: string } | undefined => {
  const broken = findings.filter((finding) => finding.kind === "broken");
  if (broken.length > 0) {
    return {
      panes: [],
      message:
        "The helper failed while its permissions were being checked, which no setting fixes: " +
        broken.map(({ grant, code }) => `${grant} (${code})`).join(", "),
    };
  }

  const missing = findings.filter((finding) => finding.kind === "missing");
  if (missing.length === 0) return undefined;

  const lines = missing.map(({ grant, state }) => `  ${settings[grant]} (now ${state})`);
  const adding = missing.some(({ grant }) => grant === "fullDiskAccess")
    ? "\nFull Disk Access lists only what has been added to it: if apple-native-mcp isn't " +
      `there, click +, press Command-Shift-G, paste this path, and choose it:\n  ${helperPath}`
    : "";

  return {
    panes: [...new Set(missing.map(({ grant }) => panes[grant]))],
    message:
      "Switch these on in System Settings (opened for you), then run the Mac specs again:\n" +
      lines.join("\n") +
      adding,
  };
};

const opening = (pane: string): Promise<void> =>
  new Promise((resolve) => {
    const url = `x-apple.systempreferences:com.apple.preference.security?${pane}`;
    execFile("open", [url], () => {
      resolve();
    });
  });

const answerFor = async (
  helper: Helper,
  grant: Grant,
): Promise<Outcome<Pick<PermissionAnswer, "state">>> => {
  if (grant !== "fullDiskAccess") return await helperPermissions(helper).askFor(grant);

  const read = await helperMessageStore(helper).chats(1);
  return read.ok ? { ok: true, value: { state: "granted" } } : read;
};

/** Settle these permissions for the helper at this path, or stop the spec saying what to do. */
export const settledBeforeRunning = async (
  helper: Helper,
  helperPath: string,
  grants: readonly Grant[],
): Promise<void> => {
  const findings: Finding[] = [];
  for (const grant of grants) findings.push(findingFor(grant, await answerFor(helper, grant)));

  const inTheWay = whatStandsInTheWay(findings, helperPath);
  if (inTheWay === undefined) return;

  for (const pane of inTheWay.panes) await opening(pane);
  throw new Error(inTheWay.message);
};
