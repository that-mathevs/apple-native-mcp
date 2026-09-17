# The helper owns every privacy-protected access

macOS gives a permission to whichever process it holds *responsible*, not to the process that asks.
Left to that default, the Calendar grant would land on the Homebrew `node` binary under Claude
Desktop, where every node-based MCP server shares it and a node upgrade drops it. Under a terminal
it would land on the terminal, which extends it to everything run there. So the Swift helper
disclaims responsibility and owns every privacy-protected access: Calendar, Reminders, Contacts,
Full Disk Access to read `chat.db`, and the Automation consent that running scripts against
Messages, Notes and Mail needs. The Node server has no privileged access of its own. This moves
reading `chat.db` and running static scripts out of Node adapters and behind the helper protocol, so
prepared-statement SQL is written in Swift. The user grants one named identity, `apple-native-mcp`,
and a confused or compromised Node process can't read personal data on its own.

Evidence: [issue #4](https://github.com/that-mathevs/apple-native-mcp/issues/4). Decided in
[issue #8](https://github.com/that-mathevs/apple-native-mcp/issues/8).
