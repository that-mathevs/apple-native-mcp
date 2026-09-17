# Results are records, not prose

Almost everything this server returns was written by someone other than the user: an email body, a
message, a note, an invitation. Returned as prose, that text sits in the same channel as the
server's own words, and the forks show what follows. ANierbeck wrapped bodies in an "external
content" banner and sicdigital separated fields with `||`; one crafted email forged both. So every
tool returns JSON records in `content`, mirrored in `structuredContent` against an output schema,
and text the user didn't write is always a field of a record, never spliced into a sentence. Fields
such as `body` and `text` are external content by definition, documented once. We add no per-field
marker, because anything an attacker can type into a body they can also imitate.

An index returns a fixed set of small fields per item and a detail read returns one item in full, so
a list's size can't be driven by how long someone else's message is (a fork's notes listing reached
2.3 MB). Failures are named failures carried in the result with `isError: true`: a stable code, one
sentence, and the outside evidence verbatim. A send that happened but couldn't be checked is not an
error; it reports an `unconfirmed` outcome, so the agent doesn't send again.

The cost is real: records are more tokens than prose and read less naturally. We take that over a
result shape a hostile body can forge.

Decided in [issue #22](https://github.com/that-mathevs/apple-native-mcp/issues/22).
