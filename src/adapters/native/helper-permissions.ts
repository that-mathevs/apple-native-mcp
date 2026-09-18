import type {
  Permission,
  PermissionAnswer,
  Permissions,
  PermissionState,
} from "../../application/setup/permissions.js";
import { permissionStates } from "../../application/setup/permissions.js";
import type { Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";
import type { Helper } from "./helper.js";

const requests: Record<Permission, string> = {
  calendar: "calendar_permission_request",
  reminders: "reminders_permission_request",
};

const isState = (state: unknown): state is PermissionState =>
  typeof state === "string" && (permissionStates as readonly string[]).includes(state);

/**
 * The permissions as the helper holds them. Asking prompts only while nobody has been asked, and
 * the answer is what the user said in this process even while macOS still reports otherwise
 * (#57).
 */
export const helperPermissions = (helper: Helper): Permissions => ({
  askFor: async (permission: Permission): Promise<Outcome<PermissionAnswer>> => {
    const answered = await helper.ask({ request: requests[permission] });
    if (!answered.ok) return answered;

    const { state, setting } = answered.value;
    if (!isState(state)) {
      return failed({
        code: "permission-state-unreadable",
        sentence:
          `The helper answered for the ${permission} permission with a state this server ` +
          "does not know.",
        evidence: String(state),
      });
    }

    return succeeded({ state, ...(typeof setting === "string" ? { setting } : {}) });
  },
});
