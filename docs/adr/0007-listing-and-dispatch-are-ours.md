# Listing and dispatch are ours

A tool whose capability is off has to be missing from `tools/list` and still answer a call, with a
named failure that says which setting to add. gene-jelly `b99bbce` only removed such tools from the
list, which left them callable by any client holding an older list and by any agent that guessed
the name. The SDK's `McpServer` can't express the rule: a tool it has disabled answers a call with
the bare sentence "Tool … disabled", an unknown tool and invalid arguments answer the same way, and
it offers no hook for answering them differently. [ADR-0006](0006-results-are-records-not-prose.md)
wants every refusal to be a record an agent can branch on.

So the server answers `tools/list` and `tools/call` itself. A tool is data: its name, its schemas,
its annotations, the write capability that switches it on, and what to call. One function decides
whether a tool is offered, and both the list and the dispatcher ask it, so the two can't disagree.
A tool with no capability is offered only when it says it only reads, which keeps a write that
forgot to name its capability from being on because nothing said otherwise. Arguments are checked
against the input schema before the tool runs, and the record against the output schema before it
leaves, which the SDK used to do for us.

The handlers are set on the protocol server that `McpServer` wraps. The SDK marks that class as
being for advanced use and steers everyone else to `McpServer`; this is that use, and we take the
cost of owning forty lines the SDK would otherwise own, including keeping up with anything
`tools/call` gains, such as tasks.

Decided while building [issue #34](https://github.com/that-mathevs/apple-native-mcp/issues/34).
