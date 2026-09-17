# Every send is confirmed through elicitation, or it isn't offered

A message or an email leaves the Mac under the user's name and can't be taken back, so
Non-negotiable 2 asks the user to confirm each one. The only mechanism that shows the user what will
actually be sent is MCP elicitation: the server asks the client to display the resolved recipient,
how it was resolved, the service and the full body as untrusted content, and sends only on an
explicit accept. The elicitation carries a required field the user must set, so a client that
auto-accepts an empty form can't stand in for consent. Both spec shapes are supported,
`elicitation/create` and the tool-result form, chosen by what the client negotiates.

A client that doesn't support elicitation is not offered the send tools at all: they are absent from
`tools/list`, and there is no setting that turns them on anyway. Reads work everywhere. We chose
that over the alternatives because each of those quietly weakens the rule: MCP sampling asks a model
that shares the possibly injected context; tool annotations plus the client's own approval are
undone by one "always allow" click; and a prepare/confirm tool pair passes its token through the
model, so a prompt-injected agent can complete both halves with nobody watching. A rule that holds
only on some clients can't be stated honestly in a README.

Decided in [issue #9](https://github.com/that-mathevs/apple-native-mcp/issues/9), on the evidence in
[issue #5](https://github.com/that-mathevs/apple-native-mcp/issues/5) and
[issue #25](https://github.com/that-mathevs/apple-native-mcp/issues/25).
