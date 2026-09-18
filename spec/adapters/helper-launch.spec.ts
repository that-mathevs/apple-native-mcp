import { afterEach, describe, expect, it } from "vitest";

import { Helper } from "../../src/adapters/native/helper.js";
import type { Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";

// The helper is checked before every launch, not once when the server starts: it is started again
// after it stops, and the fixed path can change hands in between (ADR-0003). These run without a
// helper built. A program that exits at once stands in for one that died, and cat, which echoes
// every request back unanswered, for one that stays up.

const refusal = {
  code: "helper-fails-code-requirement",
  sentence: "The helper at the fixed path is not signed as apple-native-mcp.",
} as const;

/** A check that allows this path, and counts how often it was asked. */
const allowing = (path: string): { asked: () => number; check: () => Promise<Outcome<string>> } => {
  let asked = 0;
  return {
    asked: () => asked,
    check: () => {
      asked += 1;
      return Promise.resolve(succeeded(path));
    },
  };
};

describe("the helper, before it starts", () => {
  let helper: Helper | undefined;

  afterEach(() => {
    helper?.stop();
  });

  it("given the helper to launch is refused, answers with that refusal and starts nothing", async () => {
    helper = new Helper(() => Promise.resolve(failed(refusal)));

    expect(await helper.ask({ request: "events_in_range" })).toStrictEqual({
      ok: false,
      failure: refusal,
    });
  });

  // The retry may write to the pipe of a helper that has already gone: an EPIPE nobody listens
  // for would take the whole server down with it (seen when this ran under the full suite).
  it("given a helper that stopped, asks which helper to launch again before starting another", async () => {
    const launch = allowing("/usr/bin/true");
    helper = new Helper(launch.check);

    const answer = await helper.ask({ request: "events_in_range" });

    expect(answer).toMatchObject({ ok: false, failure: { code: "helper-stopped" } });
    expect(launch.asked()).toBe(2);
  });

  it("given calls arriving together, starts one helper for all of them", async () => {
    const launch = allowing("/bin/cat");
    helper = new Helper(launch.check);

    await Promise.all([
      helper.ask({ request: "events_in_range" }),
      helper.ask({ request: "events_in_range" }),
    ]);

    expect(launch.asked()).toBe(1);
  });

  it("given the check itself breaks, answers with a named failure and checks afresh on the next call", async () => {
    let calls = 0;
    helper = new Helper(() => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new Error("codesign could not be run"))
        : Promise.resolve(failed(refusal));
    });

    expect(await helper.ask({ request: "events_in_range" })).toMatchObject({
      ok: false,
      failure: { code: "helper-not-started", evidence: "Error: codesign could not be run" },
    });
    expect(await helper.ask({ request: "events_in_range" })).toMatchObject({
      ok: false,
      failure: refusal,
    });
  });

  it("once stopped, starts nothing more: a call arriving after stop is answered without a helper", async () => {
    const launch = allowing("/bin/cat");
    helper = new Helper(launch.check);
    helper.stop();

    const answer = await helper.ask({ request: "events_in_range" });

    expect(answer).toMatchObject({ ok: false, failure: { code: "helper-stopped" } });
    expect(launch.asked()).toBe(0);
  });
});
