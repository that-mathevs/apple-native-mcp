import { afterEach, describe, expect, it } from "vitest";

import { Helper } from "../../src/adapters/native/helper.js";
import type { Outcome } from "../../src/domain/failure.js";
import { failed, succeeded } from "../../src/domain/failure.js";

// The helper is checked before every launch, not once when the server starts: it is started again
// after it stops, and the fixed path can change hands in between (ADR-0003). These run without a
// helper built: a program that exits at once stands in for one that died.

const refusal = {
  code: "helper-fails-code-requirement",
  sentence: "The helper at the fixed path is not signed as apple-native-mcp.",
} as const;

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

  it("given a helper that stopped, asks which helper to launch again before starting another", async () => {
    const asked: string[] = [];
    helper = new Helper((): Promise<Outcome<string>> => {
      asked.push("asked");
      return Promise.resolve(succeeded("/usr/bin/true"));
    });

    await helper.ask({ request: "events_in_range" });

    expect(asked).toHaveLength(2);
  });
});
