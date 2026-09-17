# One MCP tool per operation

Upstream exposed one tool per app with an `operation` argument (`calendar` with `search`, `open`,
`list`, `create`). We expose one tool per operation instead (`list_events`, `create_event`), each
named with `CONTEXT.md` terms. Each tool then has an input schema containing only its own
arguments, and precise annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`), so a
client can approve reads freely and still gate writes. We gave up compatibility with upstream's
tool names. That costs little: the package is archived and broken, and no working install depends
on those names. fpjnijweide's fork had already split upstream into 32 tools.
