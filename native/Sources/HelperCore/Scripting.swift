import Foundation

/// A script that ships inside the helper and is chosen by name. It can only be made from text
/// written in the helper's own source: whatever a request supplies reaches it as JSON arguments
/// and never as script text. Upstream built its scripts out of strings, and a quote in a note's
/// name or a search ended the string and let the rest run (upstream #67, #74, #25).
public struct StaticScript: Equatable, Sendable {
  public let name: String
  /// JavaScript for Automation defining `run(argumentsJson)`, which answers with JSON text.
  public let source: String

  public init(name: StaticString, source: StaticString) {
    self.name = "\(name)"
    self.source = "\(source)"
  }
}

/// An app the helper scripts, and the name System Settings lists it under.
public struct ScriptedApp: Equatable, Sendable {
  public let bundleIdentifier: String
  public let name: String

  public init(bundleIdentifier: String, name: String) {
    self.bundleIdentifier = bundleIdentifier
    self.name = name
  }

  /// Where the user lets the helper control this app. Scripting an app is an Automation consent
  /// of its own, separate from every other permission and granted per app.
  public var permissionSetting: String {
    "System Settings > Privacy & Security > Automation > apple-native-mcp > \(name)"
  }
}

/// The numbers an Apple Event fails with that the helper acts on. They are what tells one failure
/// from another: the words beside them change with the macOS version and the user's language.
public enum AppleEventError {
  /// The user refused to let the helper control the app.
  public static let notPermitted = -1743
  /// Nobody has been asked yet, and sending the event would prompt them.
  public static let wouldAskTheUser = -1744
  /// The app did not answer in time.
  public static let timedOut = -1712
  /// The object asked for is not there.
  public static let noSuchObject = -1728
  /// The answer was too big to carry, which bulk reads of a large note folder hit (#6).
  public static let tooBigToCarry = -1741
  /// The app is not running, so macOS cannot say whether it may be controlled.
  public static let notRunning = -600
}

/// A script did not come to an answer. It carries the error's number and words verbatim: the
/// number is what tells a refused consent (-1743) from an object that is not there (-1728), a
/// timeout (-1712) or an answer too big to carry (-1741), and the words are all a person gets.
public struct ScriptFailed: Error, Equatable, Sendable {
  public let number: Int
  public let message: String

  public init(number: Int, message: String) {
    self.number = number
    self.message = message
  }

  public var evidence: String { "\(message) (\(number))" }

  /// The script outlived its time budget, in the number an Apple Event timeout has.
  public static func timedOut(after seconds: TimeInterval) -> ScriptFailed {
    ScriptFailed(
      number: AppleEventError.timedOut,
      message: "The script did not answer within \(Int(seconds)) seconds.")
  }

  /// A script was given up on earlier, so the helper is stopping and runs nothing more: the
  /// script is still running, and a second one would only queue behind it in the same app.
  public static let helperIsStopping = ScriptFailed(
    number: AppleEventError.timedOut,
    message: "An earlier script was given up on, so the helper is stopping and ran nothing.")

  /// The app did not start, so macOS could not be asked whether it may be controlled.
  public static func didNotStart(_ app: ScriptedApp, within seconds: TimeInterval) -> ScriptFailed {
    ScriptFailed(
      number: AppleEventError.notRunning,
      message: "\(app.name) did not start within \(Int(seconds)) seconds.")
  }

  /// The script answered, and not with JSON. Text that is not the promised structure is never
  /// passed on as if it were (danielk-am 9d9122c invented an untitled item out of it).
  public static let answeredWithoutJSON = ScriptFailed(
    number: 0, message: "The script answered with something that is not JSON.")
}

/// Running the helper's scripts. OSAKit sits behind this and nothing else does, so everything
/// that reads a script's answer is specified against a fake and needs no app and no consent.
public protocol ScriptRunner: Sendable {
  /// Run a script with these arguments and answer with the JSON it returned. A script that
  /// outlives its time budget is given up on, and the helper then has to stop: nothing can
  /// cancel an Apple Event in flight, and the app stays busy with it (#7).
  func run(
    _ script: StaticScript, arguments: [String: Any], within seconds: TimeInterval
  ) throws(ScriptFailed) -> Data

  /// Whether the helper may control an app, asking the user only when told to. A tool never
  /// asks: the first Apple Event is what makes macOS prompt, so nothing is run while undecided.
  /// macOS can only say for an app that is running, so the app is started in the background when
  /// it is not, and an app that will not start is a failure and never a missing permission.
  func automationPermission(for app: ScriptedApp, asking: Bool) throws(ScriptFailed) -> Permission

  /// Whether a script was given up on, after which the helper has to stop.
  var hasGivenUpOnAScript: Bool { get }
}

/// How long a script gets. It sits under the server's budget for a whole request, so the caller
/// hears the context's own named failure rather than a helper that went quiet.
public let scriptTimeBudget: TimeInterval = 8
