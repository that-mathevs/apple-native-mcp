import { cruise } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

import configuration from "../../.dependency-cruiser.mjs";

// Upstream had no boundaries at all: its MCP handlers built AppleScript strings inline,
// so there was nowhere to put a rule and no way to test one. These rules are the
// architecture, and a rule nobody has seen fail is a rule nobody can trust, so every one
// of them is cruised here against a fixture tree that breaks it.

const { forbidden = [], options } = configuration;

const fixture = (name: string): string =>
  new URL(`fixtures/${name}/src`, import.meta.url).pathname;

const brokenRulesIn = async (tree: string): Promise<readonly string[]> => {
  const { output } = await cruise([tree], {
    ...options,
    validate: true,
    ruleSet: { forbidden },
    outputType: "json",
  });

  const { summary } = JSON.parse(output as string) as {
    summary: { violations: { rule: { name: string } }[] };
  };

  return summary.violations.map((violation) => violation.rule.name);
};

describe("the dependency rules", () => {
  it("given the source as it stands, reports nothing out of place", async () => {
    expect(await brokenRulesIn("src")).toStrictEqual([]);
  });

  it("given a domain rule that reaches for an adapter, refuses: domain holds rules and does no I/O", async () => {
    expect(await brokenRulesIn(fixture("domain-is-pure"))).toContain("domain-is-pure");
  });

  it("given a use case that imports an adapter, refuses: a use case is handed its ports", async () => {
    expect(await brokenRulesIn(fixture("use-cases-speak-to-ports"))).toContain(
      "use-cases-speak-to-ports",
    );
  });

  it("given a use case that imports the MCP layer, refuses: a use case works the same whoever calls it", async () => {
    expect(await brokenRulesIn(fixture("use-cases-do-not-know-about-mcp"))).toContain(
      "use-cases-do-not-know-about-mcp",
    );
  });

  it("given an adapter that imports the MCP layer, refuses: an adapter serves use cases, not tools", async () => {
    expect(await brokenRulesIn(fixture("adapters-do-not-know-about-mcp"))).toContain(
      "adapters-do-not-know-about-mcp",
    );
  });

  it("given an MCP tool that reaches for an adapter, refuses: only the composition root wires macOS in", async () => {
    expect(await brokenRulesIn(fixture("mcp-does-not-reach-for-adapters"))).toContain(
      "mcp-does-not-reach-for-adapters",
    );
  });

  it("given one context reaching into another context's rules, refuses: contexts meet at ports", async () => {
    expect(await brokenRulesIn(fixture("contexts-meet-at-ports"))).toContain(
      "contexts-meet-at-ports",
    );
  });

  it("given a module that imports the composition root, refuses: nobody borrows main's wiring", async () => {
    expect(await brokenRulesIn(fixture("only-main-wires-everything"))).toContain(
      "only-main-wires-everything",
    );
  });

  it("given a module that imports node:child_process, refuses: hostile tool input never reaches a shell", async () => {
    expect(await brokenRulesIn(fixture("no-shell-anywhere"))).toContain("no-shell-anywhere");
  });

  it("given two modules that import each other, refuses: a cycle is one module wearing two names", async () => {
    expect(await brokenRulesIn(fixture("no-circular-imports"))).toContain("no-circular-imports");
  });
});
