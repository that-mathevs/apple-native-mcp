# One spelling for every failure code

An agent saw two spellings of failure code. The server's own parted their words with hyphens
(`capability-off`, `event-not-found`), and the helper's passed through the adapter as the protocol
writes them, parted with underscores (`calendar_permission_missing`). One idea could arrive either
way: `calendar-not-found` from the server's own check, `calendar_not_found` from the helper's.
X-20 asks for a stable code a caller can branch on, and a caller that has to know which half of
the server answered has no such thing.

Every code an agent sees now parts its words with hyphens. The helper's protocol keeps its own
spelling, because a published code never changes and the helper is versioned separately (ADR-0003
ships it as its own signed binary): translating at the boundary costs one line, and changing the
protocol would cost every helper that has shipped. `src/adapters/native/helper.ts` translates each
code as it turns a refusal into a named failure, which is the one place every helper failure
passes through.

The fakes in `spec/support` refuse with the codes the helper-backed adapters produce, word for
word, since a scenario is only worth what its fake has in common with the real thing. The fake
event store had refused with `calendar-access-not-granted` and a `setting` field the helper never
sends, so every scenario asserting them asserted on something that could not happen.

`spec/architecture/failure-codes.spec.ts` lists every code a tool can answer with and holds the
rule: each is parted by hyphens, every code named in `src` is on the list, every code the helper
can send is on it translated, and every code on it can still be answered with, so dead codes don't
accumulate. It reads the source, as the dependency rules do, rather than a tool's answer.

Decided while building [issue #73](https://github.com/that-mathevs/apple-native-mcp/issues/73).
