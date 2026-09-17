# apple-native-mcp

An MCP server that gives an agent safe, reliable access to your own data in the native
macOS apps: **Calendar, Reminders, Contacts, Messages, Notes and Mail**.

> **Not usable yet.** This is a rewrite in progress. The repository currently holds the
> plan, the research behind it, the architecture rules and their specs — no server.

## Why it exists

[supermemoryai/apple-mcp](https://github.com/supermemoryai/apple-mcp) was archived in
January 2026 with its bugs unfixed, including a command-injection hole in the tools that
send messages and create events. Around 25 forks each fixed a piece of it, and nobody
brought the fixes together. This project collects what those forks learned and rebuilds
the server from scratch, crediting every fork whose idea it adopts.

## What "safe" will mean here

These are the rules the rewrite is being built to, and the specs are written before the
code that satisfies them. None of it works yet.

- **Tool input is hostile.** Nothing that reaches a tool is ever spliced into a script, a
  shell command or a SQL string. Scripts are static files that take JSON arguments, and SQL
  is always a prepared statement. The one process the server starts is its own signed
  helper, launched by path with an argument list: a dependency rule already fails the build
  if any other module imports `node:child_process`, or if any module at all imports a
  package that builds a command line.
- **Read-only by default.** Every capability that writes is off until you turn it on, and
  sending a message or an email asks you to confirm that send.
- **Results tell the truth.** A tool reports success only after checking the store, and
  says so plainly when it cannot check.
- **Recipients must be known.** A message goes only to someone you have already messaged.
- **Failures say how to fix them.** A missing macOS permission names the setting to change
  and where to find it.

## Where the work is

| | |
|---|---|
| [`plan.md`](plan.md) | the rewrite, phase by phase, with the non-negotiables |
| [`docs/adr/`](docs/adr) | the decisions that shape the code |
| [`docs/research/`](docs/research) | what every fork and upstream issue taught, merged into a scenario backlog |
| [`src/README.md`](src/README.md) | the layers and the rule each one obeys |

Progress is tracked in [GitHub Issues](https://github.com/that-mathevs/apple-native-mcp/issues).

## Building on it

Node 24 or newer, on macOS.

```sh
npm install
npm run check   # typecheck, lint, and the spec
```

## Credit

Rewritten from [apple-mcp](https://github.com/supermemoryai/apple-mcp) by Dhravya Shah,
MIT licensed. The forks whose ideas are adopted are credited as each one lands.
