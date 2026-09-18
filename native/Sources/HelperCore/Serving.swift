/// One JSON request per line in, one JSON response per line out, until the other side closes or
/// the helper has to stop.
///
/// A script given up on when its time budget ran out is still running, and nothing can cancel
/// it. So once the response saying so has been written the helper stops reading, and the server
/// starts a fresh helper for its next request rather than queueing behind a stuck one (#7).
public func serve(
  _ helper: Helper,
  reading nextLine: () -> String?,
  writing write: (String) -> Void,
  stoppingWhen mustStop: () -> Bool = { false }
) {
  while let line = nextLine() {
    write(helper.respond(to: line))
    if mustStop() { return }
  }
}
