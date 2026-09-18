import Foundation
import HelperCore

/// The session over stdio. Nothing but a response ever reaches stdout. Findings X-V9: a single
/// stray line of text on stdout breaks a stdio session for good, so anything this helper wants to
/// say to a human goes to stderr, and the whole of the protocol is `Helper.respond(to:)`.
func serveSession(_ helper: Helper, stoppingWhen mustStop: () -> Bool) {
  serve(
    helper, reading: { readLine(strippingNewline: true) },
    writing: { write($0, to: FileHandle.standardOutput) }, stoppingWhen: mustStop)
}

/// Written straight to the descriptor rather than through `print`, because a pipe buffers `print`
/// and the other side would wait on a response the helper had already written.
func write(_ line: String, to handle: FileHandle) {
  handle.write(Data((line + "\n").utf8))
}
