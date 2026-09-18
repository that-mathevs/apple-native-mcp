import type { ContactNames } from "../../src/application/messages/contact-names.js";
import type { NamedFailure, Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";

/**
 * The names the user's contacts give handles, held in memory: nobody is named until a scenario
 * says who. It counts its reads, so a scenario can say how often the contacts were read.
 */
export class FakeContactNames implements ContactNames {
  reads = 0;

  readonly #names = new Map<string, string>();
  #failure: NamedFailure | undefined;

  knows(handle: string, name: string): void {
    this.#names.set(handle, name);
  }

  refuses(failure: NamedFailure): void {
    this.#failure = failure;
  }

  namesOf(handles: readonly string[]): Promise<Outcome<ReadonlyMap<string, string>>> {
    this.reads += 1;
    if (this.#failure) return Promise.resolve(failed(this.#failure));

    const named = handles.flatMap((handle) => {
      const name = this.#names.get(handle);
      return name === undefined ? [] : [[handle, name] as const];
    });
    return Promise.resolve(succeeded(new Map(named)));
  }
}
