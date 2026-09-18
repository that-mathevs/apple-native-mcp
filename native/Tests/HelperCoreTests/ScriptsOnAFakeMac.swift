import Foundation

@testable import HelperCore

/// A script runner that runs nothing: it remembers what it was asked to run, and answers with
/// whatever a scenario says the app would have said.
final class FakeScriptRunner: ScriptRunner, @unchecked Sendable {
  struct Run {
    let script: String
    let arguments: [String: Any]
  }

  var runs: [Run] = []
  var asked: [(app: ScriptedApp, asking: Bool)] = []
  var answers: [String: String] = [:]
  var failures: [String: ScriptFailed] = [:]
  var permissionHeld: Permission = .granted
  var failsToStart: ScriptFailed?
  var budgets: [TimeInterval] = []

  func run(
    _ script: StaticScript, arguments: [String: Any], within seconds: TimeInterval
  ) throws(ScriptFailed) -> Data {
    runs.append(Run(script: script.name, arguments: arguments))
    budgets.append(seconds)
    if let failure = failures[script.name] { throw failure }
    return Data((answers[script.name] ?? "{}").utf8)
  }

  func automationPermission(
    for app: ScriptedApp, asking: Bool
  ) throws(ScriptFailed) -> Permission {
    asked.append((app, asking))
    if let failure = failsToStart { throw failure }
    return permissionHeld
  }

  var hasGivenUpOnAScript: Bool { false }

  func answering(_ script: String, with json: String) -> FakeScriptRunner {
    answers[script] = json
    return self
  }

  func failing(_ script: String, with failure: ScriptFailed) -> FakeScriptRunner {
    failures[script] = failure
    return self
  }
}
