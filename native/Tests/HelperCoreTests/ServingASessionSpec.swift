import Testing

@testable import HelperCore

@Suite("serving a session")
struct ServingASessionSpec {
  let asking = #"{"protocolVersion":1,"id":"1","request":"calendars"}"#

  @Test("answers each line with one line, in order, until the other side closes")
  func answersEveryLine() {
    var lines = [asking, asking]
    var written: [String] = []

    serve(
      aHelper(), reading: { lines.isEmpty ? nil : lines.removeFirst() },
      writing: { written.append($0) })

    #expect(written.count == 2)
  }

  // #7: a script that was given up on is still running, and Mail stayed busy with one for
  // minutes. A fresh helper is the only thing that does not queue behind it.
  @Test("given the helper has to stop, writes the response it owes and reads nothing more")
  func stopsAfterTheResponseItOwes() {
    var lines = [asking, asking, asking]
    var written: [String] = []

    serve(
      aHelper(), reading: { lines.isEmpty ? nil : lines.removeFirst() },
      writing: { written.append($0) }, stoppingWhen: { written.count == 1 })

    #expect(written.count == 1)
    #expect(lines.count == 2)
  }
}
