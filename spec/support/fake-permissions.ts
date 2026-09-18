import type {
  Permission,
  PermissionAnswer,
  Permissions,
} from "../../src/application/setup/permissions.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";

/** Permissions the user has granted, until a scenario says otherwise, recording what is asked. */
export class FakePermissions implements Permissions {
  readonly askedFor: Permission[] = [];
  readonly #answers = new Map<Permission, Outcome<PermissionAnswer>>();

  answers(permission: Permission, answer: PermissionAnswer): void {
    this.#answers.set(permission, succeeded(answer));
  }

  cannotAsk(permission: Permission, sentence: string): void {
    const failure: NamedFailure = { code: "helper-stopped", sentence };
    this.#answers.set(permission, failed(failure));
  }

  askFor(permission: Permission): Promise<Outcome<PermissionAnswer>> {
    this.askedFor.push(permission);
    return Promise.resolve(this.#answers.get(permission) ?? succeeded({ state: "granted" }));
  }
}
