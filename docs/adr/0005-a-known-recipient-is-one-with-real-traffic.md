# A known recipient is one the user has real traffic with

Non-negotiable 4 refuses a send to anyone the user hasn't already messaged, which upstream's #48
("ghost" contacts) showed the cost of missing. "Already messaged" is read strictly: the handle must
appear in the message store with real traffic, meaning an incoming message or an outgoing one the
store shows as sent or delivered. A contact card is **not** enough on its own, however the handle got
there, because a card is easy to add from any synced device and an agent that can read contacts can
find one to hide behind. Ghost chats and failed sends don't qualify either, so one wrong number sent
to doesn't whitelist itself. An existing group chat qualifies as a chat, never as a licence to
message its members privately. Email follows the same shape, using that account's Sent mail and
existing conversations, and refuses when the check can't be completed. An allowlist narrows this
rule and can never widen it.

The cost is that texting a number for the first time has to happen in Messages, and that a contact's
unused second number is refused until it's used once. The refusal names the contact rather than the
handle it would have suggested, so a refusal can't be used to read contact details out of the
machine, and the user still gets there by naming the contact.

Decided in [issue #16](https://github.com/that-mathevs/apple-native-mcp/issues/16).
