/// The environment variable the helper's own disclaimed relaunch sets on its child, so the child
/// knows it is already the process macOS holds responsible and serves the session.
public let disclaimedMarkKey = "APPLE_NATIVE_MCP_RESPONSIBILITY_DISCLAIMED"

/// What the helper does when it starts.
public enum StartingChoice: Equatable, Sendable {
  /// Relaunch itself once with responsibility disclaimed, then wait for that child.
  case relaunchDisclaimed
  /// Serve the JSON-lines session on stdio.
  case serveSession
}

/// macOS attributes a permission prompt, and the grant it leaves behind, to whichever process it
/// holds *responsible*. Started from Node or a terminal, that would be Node or the terminal, so
/// every node-based server would share one grant and a Node upgrade would drop it (ADR-0002).
/// The helper therefore relaunches itself once with responsibility disclaimed and serves the
/// session from that child.
public func startingChoice(environment: [String: String]) -> StartingChoice {
  let mark = environment[disclaimedMarkKey] ?? ""
  return mark.isEmpty ? .relaunchDisclaimed : .serveSession
}
