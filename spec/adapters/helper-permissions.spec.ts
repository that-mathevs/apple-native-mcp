import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { Helper } from "../../src/adapters/native/helper.js";
import { helperPermissions } from "../../src/adapters/native/helper-permissions.js";
import { succeeded } from "../../src/domain/failure.js";

// How the helper's answer to a permission request is read. A state the server does not know is
// refused rather than guessed at: a guess would report a permission granted that is not.

const answeringHelper = fileURLToPath(
  new URL("fixtures/a-helper-that-answers.mjs", import.meta.url),
);

describe("the helper's permissions", () => {
  let helper: Helper | undefined;

  const answering = (result: Record<string, unknown>): Helper => {
    process.env.A_HELPER_THAT_ANSWERS_RESULT = JSON.stringify(result);
    helper = new Helper(() => Promise.resolve(succeeded(answeringHelper)));
    return helper;
  };

  afterEach(() => {
    helper?.stop();
    delete process.env.A_HELPER_THAT_ANSWERS_RESULT;
  });

  it("given a refusal, answers with it and the setting that allows it", async () => {
    const setting = "System Settings > Privacy & Security > Calendars > apple-native-mcp";
    const permissions = helperPermissions(answering({ state: "refused", setting }));

    expect(await permissions.askFor("calendar")).toStrictEqual({
      ok: true,
      value: { state: "refused", setting },
    });
  });

  it("given a grant, answers with it and no setting", async () => {
    const permissions = helperPermissions(answering({ state: "granted" }));

    expect(await permissions.askFor("reminders")).toStrictEqual({
      ok: true,
      value: { state: "granted" },
    });
  });

  it("given a state it does not know, refuses rather than guessing", async () => {
    const permissions = helperPermissions(answering({ state: "probably" }));

    expect(await permissions.askFor("calendar")).toMatchObject({
      ok: false,
      failure: { code: "permission-state-unreadable", evidence: "probably" },
    });
  });
});
