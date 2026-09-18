# `src/`

Ports and adapters. Each layer obeys one rule, and every rule is specified in
[`spec/architecture/dependency-rules.spec.ts`](../spec/architecture/dependency-rules.spec.ts)
and enforced by [`.dependency-cruiser.mjs`](../.dependency-cruiser.mjs).

| Directory | Holds | Imports |
|---|---|---|
| `domain/<context>/` | the rules, as pure functions and types | nothing at all |
| `application/<context>/` | a use case per tool operation, and its ports | its own domain context |
| `adapters/` | the ways macOS is reached — every protected access goes through the Swift helper (ADR-0002), which `adapters/native/` alone launches — and, outside `native/`, where one context answers another's port, such as the contact names Messages asks for | the ports it implements, domain types and rules, and, for an adapter joining two contexts, the other context's port |
| `mcp/` | tool definitions, input schemas, and how a result or a failure is reported | use cases |
| `cli/` | the `setup` command, and what it prints from a use case's records | use cases |
| `main.ts` | the composition root: the one place adapters meet use cases | everything |

The contexts are `calendar`, `reminders`, `contacts`, `messages`, `notes` and `mail`, plus
`setup`, which installs the helper and chooses the one to launch (ADR-0003).
When one context needs another, it asks through a port rather than importing it.
