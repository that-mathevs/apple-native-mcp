import { describe, expect, it } from "vitest";

import { commandIn } from "../../../src/cli/command.js";

// What `apple-native-mcp` does, by the arguments it was given. A client starts the server with
// none; a person runs setup. Anything else is refused rather than guessed at: a server started on
// a terminal by a typo would sit there holding stdout, and a misspelt option would run setup when
// it was meant to remove it.

const usage = "Usage: apple-native-mcp [setup [--remove]]";

describe("choosing the command", () => {
  it("given no arguments, serves MCP: that is how a client starts it", () => {
    expect(commandIn([])).toStrictEqual({ command: "serve" });
  });

  it("given setup, sets up", () => {
    expect(commandIn(["setup"])).toStrictEqual({ command: "setup" });
  });

  it("given setup --remove, removes the helper", () => {
    expect(commandIn(["setup", "--remove"])).toStrictEqual({ command: "remove" });
  });

  it("given an option setup does not know, refuses it rather than setting up anyway", () => {
    expect(commandIn(["setup", "--remvoe"])).toStrictEqual({ command: "unknown", usage });
  });

  it("given a command it does not know, refuses it rather than serving on a terminal", () => {
    expect(commandIn(["install"])).toStrictEqual({ command: "unknown", usage });
  });
});
