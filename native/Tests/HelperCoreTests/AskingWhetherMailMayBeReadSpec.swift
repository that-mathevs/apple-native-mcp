import Testing

@testable import HelperCore

// Mail is guarded by a permission of its own, and its setting is somewhere else entirely: under
// Automation, beneath the helper's name, because Mail is reached by scripting it.
@Suite("asking whether Mail may be read")
struct AskingWhetherMailMayBeReadSpec {
  let asking = #"{"protocolVersion":1,"id":"1","request":"mail_permission"}"#

  @Test("given the permission is granted, says so")
  func reportsAGrant() {
    #expect(
      helperReading(aMailStore()).respond(to: asking)
        == #"{"id":"1","protocolVersion":1,"result":{"state":"granted"}}"#)
  }

  @Test("given the permission was refused, names the mail setting to enable and where it is")
  func namesTheSettingToEnable() {
    #expect(
      helperReading(aMailStore().permission(.refused)).respond(to: asking)
        == #"""
        {"id":"1","protocolVersion":1,"result":{"setting":"System Settings > Privacy & Security > Automation > apple-native-mcp > Mail","state":"refused"}}
        """#)
  }

  @Test("given Mail will not start, reports that rather than a state macOS never gave")
  func reportsAMailThatWillNotStart() {
    let store = aMailStore().notStarting(saying: "Mail did not start within 8 seconds. (-600)")

    #expect(helperReading(store).respond(to: asking).contains(#""code":"mail_did_not_start""#))
  }
}

@Suite("asking the user for Mail")
struct AskingTheUserForMailSpec {
  let asking = #"{"protocolVersion":1,"id":"1","request":"mail_permission_request"}"#

  @Test("given nobody has been asked yet, asks macOS and reports what the user chose")
  func asksWhileUndecided() {
    let store = aMailStore().permission(.undecided).answering(.granted)

    #expect(
      helperReading(store).respond(to: asking)
        == #"{"id":"1","protocolVersion":1,"result":{"state":"granted"}}"#)
    #expect(store.record.timesAsked == 1)
  }

  @Test("given the user already refused, does not ask again and names the setting to enable")
  func doesNotAskAfterARefusal() {
    let store = aMailStore().permission(.refused).answering(.granted)

    #expect(
      helperReading(store).respond(to: asking)
        == #"{"id":"1","protocolVersion":1,"result":{"setting":"\#(mailPermissionSetting)","state":"refused"}}"#)
    #expect(store.record.timesAsked == 0)
  }
}
