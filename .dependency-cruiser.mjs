/**
 * The architecture rules from plan.md, machine-checked.
 *
 * Every rule is specified by a scenario in spec/architecture/dependency-rules.spec.ts,
 * which runs each rule against a fixture that breaks it. Paths are matched with a
 * leading `(?:^|/)` so the same rules apply to the real tree under src/ and to the
 * fixture trees the scenarios cruise.
 */

/** @type {import("dependency-cruiser").IConfiguration} */
export default {
  forbidden: [
    {
      name: "domain-is-pure",
      comment:
        "Domain holds the rules, so it imports nothing at all: no adapters, no MCP, " +
        "no Node APIs, no packages. Anything it needs is passed to it.",
      severity: "error",
      from: { path: "(?:^|/)src/domain/" },
      to: { pathNot: "(?:^|/)src/domain/" },
    },
    {
      name: "use-cases-speak-to-ports",
      comment:
        "A use case names the port it needs and is handed an implementation. " +
        "Importing an adapter would bind it to one way of reaching macOS.",
      severity: "error",
      from: { path: "(?:^|/)src/application/" },
      to: { path: "(?:^|/)src/adapters/" },
    },
    {
      name: "use-cases-do-not-know-about-mcp",
      comment: "MCP is one way in. A use case works the same whoever calls it.",
      severity: "error",
      from: { path: "(?:^|/)src/application/" },
      to: { path: "(?:^|/)src/mcp/" },
    },
    {
      name: "adapters-do-not-know-about-mcp",
      comment: "An adapter serves the use cases, and knows nothing of tools or results.",
      severity: "error",
      from: { path: "(?:^|/)src/adapters/" },
      to: { path: "(?:^|/)src/mcp/" },
    },
    {
      name: "mcp-does-not-reach-for-adapters",
      comment:
        "Tools call use cases. Reaching for an adapter would wire macOS into the edge " +
        "and put a code path beyond the reach of the acceptance specs.",
      severity: "error",
      from: { path: "(?:^|/)src/mcp/" },
      to: { path: "(?:^|/)src/adapters/" },
    },
    {
      name: "contexts-meet-at-ports",
      comment:
        "Calendar, reminders, contacts, messages, notes and mail each keep their own " +
        "rules. When one needs another, it asks through a port.",
      severity: "error",
      from: { path: "(?:^|/)src/(?:domain|application)/([^/]+)/" },
      to: {
        path: "(?:^|/)src/(?:domain|application)/([^/]+)/",
        pathNot: "(?:^|/)src/(?:domain|application)/$1/",
      },
    },
    {
      name: "only-main-wires-everything",
      comment:
        "main.ts is the composition root: the one place adapters meet use cases. " +
        "Nothing imports it, so nothing can borrow its wiring.",
      severity: "error",
      from: { pathNot: "(?:^|/)src/main\\.ts$" },
      to: { path: "(?:^|/)src/main\\.ts$" },
    },
    {
      name: "no-shell-anywhere",
      comment:
        "Hostile tool input must never reach a shell. Scripts are static files run " +
        "with JSON arguments, so nothing in the server spawns a command line.",
      severity: "error",
      from: { path: "(?:^|/)src/" },
      to: { path: "^(?:node:)?child_process$" },
    },
    {
      name: "no-circular-imports",
      comment: "A cycle means the two modules are one module wearing two names.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "(?:^|/)node_modules/" },
    exclude: { path: "(?:^|/)node_modules/" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".js"],
      conditionNames: ["import", "node", "default"],
    },
  },
};
