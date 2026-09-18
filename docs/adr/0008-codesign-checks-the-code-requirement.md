# codesign checks the code requirement

[ADR-0003](0003-signed-helper-at-a-fixed-path.md) has the server check the helper against a pinned
code requirement before it is copied and before every launch. Node can't call the Security framework
by itself, and the helper can't vouch for its own signature, because a stranger's helper at the
fixed path would simply say yes. So the server runs `/usr/bin/codesign --verify --strict` with the
pinned requirement. That makes it the second process the server starts, next to the helper.

It is launched the way the helper is: by absolute path, with an argument list, and never through a
shell. Only `src/adapters/native/` may start either process. The requirement is a constant and the
path is the one setup chose, so nothing a tool is sent reaches the command line.
`/usr/bin/codesign` sits on the sealed system volume, so nothing the user can write replaces it. The
dependency rule that allowed one process now names two.

## Considered options

- **A native Node addon calling `SecStaticCodeCheckValidity`:** no second process, but the npm
  package would gain a native build step, and the addon would need a signing story of its own.
- **Asking the helper to check itself:** the check exists precisely because the helper at the fixed
  path might not be ours.

Decided while building [issue #33](https://github.com/that-mathevs/apple-native-mcp/issues/33).
