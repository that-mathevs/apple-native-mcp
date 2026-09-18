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
        "no Node APIs, no packages. Anything it needs is passed to it. A rule's own " +
        "spec sits beside it and does import the test runner, so specs are not modules " +
        "this rule speaks about.",
      severity: "error",
      from: { path: "(?:^|/)src/domain/", pathNot: "\\.spec\\.ts$" },
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
      name: "nothing-imports-the-composition-root",
      comment:
        "main.ts is the composition root: the one place adapters meet use cases. " +
        "It is the only module exempt from the rules above, so nothing may import it " +
        "and borrow that exemption.",
      severity: "error",
      from: { pathNot: "(?:^|/)src/main\\.ts$" },
      to: { path: "(?:^|/)src/main\\.ts$" },
    },
    {
      name: "only-native-adapters-start-a-process",
      comment:
        "Hostile tool input must never reach a shell. The server starts exactly two " +
        "processes, each by absolute path with an argument list: the signed Swift " +
        "helper (ADR-0002, ADR-0003) and /usr/bin/codesign, which checks the helper " +
        "before it is copied or launched (ADR-0008). Only the native adapters that " +
        "own those launches may import child_process; anywhere else it is a way to " +
        "run a command line.",
      severity: "error",
      from: { path: "(?:^|/)src/", pathNot: "(?:^|/)src/adapters/native/" },
      to: { path: "^(?:node:)?child_process$" },
    },
    {
      name: "nothing-runs-a-command-line",
      comment:
        "The packages that build a command line out of strings, or run AppleScript " +
        "by handing text to osascript, are how upstream's injection hole was reached. " +
        "Not even the native adapters may import one.",
      severity: "error",
      from: { path: "(?:^|/)src/" },
      to: {
        path: "^(?:execa|zx|shelljs|cross-spawn|child-process-promise|run-applescript|@jxa/run)$",
      },
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
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".js"],
      conditionNames: ["import", "node", "default"],
    },
  },
};
