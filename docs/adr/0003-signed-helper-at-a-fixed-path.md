# A signed helper at a fixed per-user path, checked before every launch

A grant held by a bare executable survives an update only when both its path and its signing
identity stay the same. An ad-hoc build loses the grant on every rebuild, and every build loses it
when the file moves. So the helper is not built from source on the user's Mac, as `plan.md` first
recommended. Instead it ships as a universal bare executable with an embedded Info.plist, signed
with Black Rabbit LLC's Developer ID and hardened runtime, and notarised in CI. The npm package and
the `.mcpb` both carry it. On startup the server copies it to
`~/Library/Application Support/apple-native-mcp/apple-native-mcp`, replacing it in place only with a
newer version, so every install channel and every update shares one path and one grant. That path
is user-writable, and a stranger's binary there would prompt under a trusted name. So before copying
and before every launch, the server checks the helper against a pinned code requirement
(identifier plus team `4A82YT3HVP`), and refuses anything else with a named failure. Development
builds need an explicit developer setting in the client config, which tool input can't set.

## Considered options

- **Build from source at install time:** needs the Xcode command line tools, and users are prompted
  again after every update.
- **Run the helper from wherever the channel installed it:** pinned `npx` versions and Claude Code
  plugin bundles change path on every update, and two channels mean two grants.
- **A `.app` bundle:** possibly keyed by bundle ID, but untested, and a fixed path already gives
  stability.

Evidence: [issue #4](https://github.com/that-mathevs/apple-native-mcp/issues/4). Decided in
[issue #8](https://github.com/that-mathevs/apple-native-mcp/issues/8).
