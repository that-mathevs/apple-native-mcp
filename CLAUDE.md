# apple-native-mcp

An MCP server that gives an agent safe, reliable access to the user's own data in the
native macOS apps: Calendar, Reminders, Contacts, Messages, Notes and Mail.

It is a rewrite of the archived
[supermemoryai/apple-mcp](https://github.com/supermemoryai/apple-mcp). None of that code
survives. Read [`plan.md`](plan.md) before doing anything: its
**Non-negotiables** apply to every change, and the phases say what is being built and in
what order.

## Commands

- `npm run spec` — the server's suite. `npm run spec:watch` while working.
- `npm run helper:spec` — the Swift helper's suite, `swift test` in `native/`.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — ESLint, type-aware.
- `npm run check` — all four in one go: what CI runs, across its two jobs.

Node 24 or newer. CI runs on a macOS runner.

## How we work

**BDD, outside in.** The suite is the specification: printing the test names has to read
as a document that teaches a stranger what the server does and what it refuses to do. Use
the `bdd` skill for what a test says and the `tdd` skill for the red → green → refactor
loop. No code exists without a scenario asking for it.

**The glossary comes first.** `CONTEXT.md` holds the project's words — handle, chat,
buddy, account, calendar, event, occurrence, reminder list, note folder, mailbox. Every
test name and every exported identifier uses them. A scenario that needs a word the
glossary lacks stops until the word is agreed.

**Write the reason into the scenario.** Where a rule exists because of a real failure,
name the upstream issue or fork commit in a one-line comment above it.

## Architecture

Ports and adapters, laid out in [`src/README.md`](src/README.md). The layers are not a
convention: they are dependency rules in `.dependency-cruiser.mjs`, each one specified by
a scenario in `spec/architecture/dependency-rules.spec.ts` that cruises a fixture tree
breaking it. There are no boundary or lint exceptions.

Decisions that shape the code are ADRs in [`docs/adr/`](docs/adr). The scenario backlog
drawn from every fork and upstream issue is
[`docs/research/findings.md`](docs/research/findings.md).

## Code style

- TypeScript, ESM, `.js` extensions on relative imports, `node:` prefix on builtins.
- Explicit return types on exported functions. Types over interfaces unless extending.
- Two-space indent, double quotes, and lines under 100 characters in code. Prose and
  Markdown tables wrap where they read best.
- Name things with the glossary's words, not the framework's.
- Errors are named failures a caller can act on, never a bare string. A missing macOS
  permission says which setting to change and where.

## Agent skills

### Issue tracker

GitHub Issues on `that-mathevs/apple-native-mcp` (never upstream or a fork). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
