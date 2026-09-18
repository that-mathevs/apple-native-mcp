import Foundation
import HelperCore
import ScriptRunning
import Testing

// The real runner, held to its contract by scripts that touch no app. Upstream wrote its
// arguments into the script's text; here they travel beside it as JSON, and these scenarios are
// what says nothing in them can run (ANierbeck cd72bdf, morquis d76f3ec, upstream #74, #25).

private let echo = StaticScript(
  name: "echo",
  source: #"""
    function run(argumentsJson) {
      return JSON.stringify({ got: JSON.parse(argumentsJson) });
    }
    """#)

private let records = StaticScript(
  name: "records",
  source: #"""
    function run(argumentsJson) {
      return JSON.stringify({
        items: [{ title: "a||b", body: "{\"title\":\"fake\"}" }, { title: "c", body: "" }],
      });
    }
    """#)

private let prose = StaticScript(
  name: "prose", source: #"function run(argumentsJson) { return "3 notes found"; }"#)

private let throwing = StaticScript(
  name: "throwing",
  source: #"function run(argumentsJson) { throw new Error("no such folder"); }"#)

private let big = StaticScript(
  name: "big",
  source: #"""
    function run(argumentsJson) {
      return JSON.stringify({ text: "x".repeat(2000000) });
    }
    """#)

private let endless = StaticScript(
  name: "endless", source: "function run(argumentsJson) { while (true) {} }")

private func decoded(_ json: Data) -> [String: Any] {
  (try? JSONSerialization.jsonObject(with: json)) as? [String: Any] ?? [:]
}

@Suite("running a static script")
struct RunningAScriptSpec {
  let runner = OSAKitScriptRunner()

  @Test("given text full of quotes, backslashes, line breaks, guillemets, dollar patterns, shell metacharacters and script source, delivers it to the script unchanged and runs nothing in it")
  func deliversHostileTextUnchanged() throws {
    let hostile =
      #"" & (do shell script "id") & "\ «x» $(id) `id` ; rm -rf ~"# + "\n"
      + #"}); Application('Finder').quit(); ({"#

    let answer = decoded(try runner.run(echo, arguments: ["text": hostile], within: 5))

    #expect((answer["got"] as? [String: Any])?["text"] as? String == hostile)
  }

  @Test("given numbers, booleans and lists, passes them as data and never as script source")
  func passesEveryJSONTypeAsData() throws {
    let answer = decoded(
      try runner.run(echo, arguments: ["limit": 25, "all": true, "in": ["a", "b"]], within: 5))
    let got = answer["got"] as? [String: Any]

    #expect(got?["limit"] as? Int == 25)
    #expect(got?["all"] as? Bool == true)
    #expect(got?["in"] as? [String] == ["a", "b"])
  }

  // boutquin 2894ab6, therealap 220462c: delimited output let one note's text pose as another's.
  @Test("given records whose fields hold separators and text posing as another record, hands back every record with each field intact")
  func handsBackRecordsIntact() throws {
    let items =
      decoded(try runner.run(records, arguments: [:], within: 5))["items"] as? [[String: String]]

    #expect(items?.count == 2)
    #expect(items?.first == ["title": "a||b", "body": #"{"title":"fake"}"#])
  }

  // danielk-am 9d9122c turned whatever a script printed into an untitled item.
  @Test("given an answer that is not JSON, refuses it rather than passing it on as text")
  func refusesAnAnswerThatIsNotJSON() {
    #expect(throws: ScriptFailed.answeredWithoutJSON) {
      try runner.run(prose, arguments: [:], within: 5)
    }
  }

  // upstream #19
  @Test("given a script that throws, reports a script failure carrying the script's own words")
  func carriesWhatTheScriptThrew() {
    do {
      _ = try runner.run(throwing, arguments: [:], within: 5)
      Issue.record("the script should have failed")
    } catch {
      #expect(error.message.contains("no such folder"))
    }
  }

  // KassebaumEngineering 1d47e74, upstream #67: a long answer was cut off mid-record.
  @Test("given an answer larger than a megabyte, returns all of it")
  func returnsALargeAnswerWhole() throws {
    let text = decoded(try runner.run(big, arguments: [:], within: 10))["text"] as? String
    #expect(text?.count == 2_000_000)
  }

  // Nothing can cancel a script in flight, so a runner that has given up on one says the helper
  // must stop: the server then starts a fresh helper rather than queue behind a stuck one (#7).
  @Test("given a script that outlives its time budget, gives up on it as timed out, and says the helper has to stop")
  func givesUpOnAScriptWhenItsTimeBudgetRunsOut() {
    let runner = OSAKitScriptRunner()
    #expect(!runner.hasGivenUpOnAScript)

    #expect(throws: ScriptFailed.timedOut(after: 1)) {
      try runner.run(endless, arguments: [:], within: 1)
    }
    #expect(runner.hasGivenUpOnAScript)
  }

  // The script given up on is still running. A second would queue behind it in the same app, and
  // OSAKit is not to be entered by two threads at once.
  @Test("given a script was given up on, runs nothing more and says the helper is stopping")
  func runsNothingAfterGivingUp() {
    let runner = OSAKitScriptRunner()
    _ = try? runner.run(endless, arguments: [:], within: 1)

    #expect(throws: ScriptFailed.helperIsStopping) {
      try runner.run(echo, arguments: [:], within: 5)
    }
  }

  // felkru c769cc0 shipped a script with a syntax error that only a user ever ran.
  @Test("every script the helper ships compiles")
  func everyShippedScriptCompiles() {
    for script in NotesScripts.all {
      #expect(runner.whyItDoesNotCompile(script) == nil, "\(script.name)")
    }
  }
}
