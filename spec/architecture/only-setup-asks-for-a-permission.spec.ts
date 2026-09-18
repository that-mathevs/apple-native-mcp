import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// A tool never asks for a permission: a prompt in the middle of an agent's call interrupts the
// user with a question nobody at the keyboard asked, and setup is where they expect it (#33).
// The helper answers any request it is sent, so the rule is held here, over the server's source:
// only the adapter setup asks through may name a permission request.

const source = fileURLToPath(new URL("../../src", import.meta.url));

const modulesIn = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => join(entry.parentPath, entry.name));
};

describe("asking for a permission", () => {
  it("is done by setup's permissions adapter alone: no tool's path through the server names a permission request", async () => {
    const asking: string[] = [];
    for (const module of await modulesIn(source)) {
      if ((await readFile(module, "utf8")).includes("_permission_request")) {
        asking.push(relative(source, module));
      }
    }

    expect(asking).toStrictEqual(["adapters/native/helper-permissions.ts"]);
  });
});
