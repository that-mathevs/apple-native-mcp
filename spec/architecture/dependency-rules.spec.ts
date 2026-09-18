import { fileURLToPath } from "node:url";

import { cruise } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

import configuration from "../../.dependency-cruiser.mjs";

// Upstream had no boundaries at all: its MCP handlers built AppleScript strings inline,
// so there was nowhere to put a rule and no way to test one. These rules are the
// architecture, and a rule nobody has seen fail is a rule nobody can trust, so every one
// of them is cruised here against a fixture tree that breaks it, and the one rule that
// permits something is cruised against a tree that stays inside it. Each fixture
// directory is named after the rule it is about, and each scenario names the rules broken
// in full, so a rule that fires where it shouldn't is a failure too.

const { options, ...ruleSet } = configuration;

const treeAt = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

const fixture = (name: string): string => treeAt(`fixtures/${name}/src`);

const source = treeAt("../../src");

/** Every rule broken anywhere in a tree, named once each. */
const brokenRulesIn = async (tree: string): Promise<readonly string[]> => {
  const { output } = await cruise([tree], {
    ...options,
    validate: true,
    ruleSet,
    outputType: "json",
  });

  const { summary } = JSON.parse(output as string) as {
    summary: { violations: { rule: { name: string } }[] };
  };

  return [...new Set(summary.violations.map((violation) => violation.rule.name))].sort();
};

describe("the dependency rules", () => {
  it("given the source as it stands, reports nothing out of place", async () => {
    expect(await brokenRulesIn(source)).toStrictEqual([]);
  });

  it("given a domain rule that reaches for an adapter, refuses: domain does no I/O", async () => {
    expect(await brokenRulesIn(fixture("domain-is-pure"))).toStrictEqual(["domain-is-pure"]);
  });

  it("given a use case that imports an adapter, refuses: it is handed its ports", async () => {
    expect(await brokenRulesIn(fixture("use-cases-speak-to-ports"))).toStrictEqual([
      "use-cases-speak-to-ports",
    ]);
  });

  it("given a use case that imports MCP, refuses: it works the same whoever calls it", async () => {
    expect(await brokenRulesIn(fixture("use-cases-do-not-know-about-mcp"))).toStrictEqual([
      "use-cases-do-not-know-about-mcp",
    ]);
  });

  it("given an adapter that imports MCP, refuses: it serves use cases, not tools", async () => {
    expect(await brokenRulesIn(fixture("adapters-do-not-know-about-mcp"))).toStrictEqual([
      "adapters-do-not-know-about-mcp",
    ]);
  });

  it("given an MCP tool that imports an adapter, refuses: only main wires macOS in", async () => {
    expect(await brokenRulesIn(fixture("mcp-does-not-reach-for-adapters"))).toStrictEqual([
      "mcp-does-not-reach-for-adapters",
    ]);
  });

  it("given a use case that imports the command line, refuses: setup is one more way in", async () => {
    expect(await brokenRulesIn(fixture("use-cases-do-not-know-about-the-cli"))).toStrictEqual([
      "use-cases-do-not-know-about-the-cli",
    ]);
  });

  it("given an adapter that imports the command line, refuses: it serves use cases, not commands", async () => {
    expect(await brokenRulesIn(fixture("adapters-do-not-know-about-the-cli"))).toStrictEqual([
      "adapters-do-not-know-about-the-cli",
    ]);
  });

  it("given a command that imports an adapter, refuses: only main wires macOS in", async () => {
    expect(await brokenRulesIn(fixture("cli-does-not-reach-for-adapters"))).toStrictEqual([
      "cli-does-not-reach-for-adapters",
    ]);
  });

  it("given a context reaching into another's rules, refuses: contexts meet at ports", async () => {
    expect(await brokenRulesIn(fixture("contexts-meet-at-ports"))).toStrictEqual([
      "contexts-meet-at-ports",
    ]);
  });

  it("given a module that imports main.ts, refuses: nobody borrows its wiring", async () => {
    expect(
      await brokenRulesIn(fixture("nothing-imports-the-composition-root")),
    ).toStrictEqual(["nothing-imports-the-composition-root"]);
  });

  // Upstream's utils/message.ts put the send recipient straight into an osascript string,
  // and AppleScript can run shell commands. This is the rule that makes that unwritable.
  it("given a use case that spawns osascript, refuses: input never reaches a shell", async () => {
    expect(
      await brokenRulesIn(fixture("only-native-adapters-start-a-process")),
    ).toStrictEqual(["only-native-adapters-start-a-process"]);
  });

  it("given the native adapters starting the helper and codesign, permits the two processes they own", async () => {
    expect(await brokenRulesIn(fixture("the-native-adapters"))).toStrictEqual([]);
  });

  it("given a package that builds command lines, refuses it even to the native adapters", async () => {
    expect(await brokenRulesIn(fixture("nothing-runs-a-command-line"))).toStrictEqual([
      "nothing-runs-a-command-line",
    ]);
  });

  it("given two modules that import each other, refuses: a cycle is one module twice", async () => {
    expect(await brokenRulesIn(fixture("no-circular-imports"))).toStrictEqual([
      "no-circular-imports",
    ]);
  });
});
