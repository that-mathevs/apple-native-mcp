import Testing

@testable import HelperCore

@Suite("asking whether the calendar may be read")
struct AskingWhetherTheCalendarMayBeReadSpec {
  @Test("given the permission is granted, says so, so the server need not guess before reading")
  func reportsAGrant() {
    let helper = helperReading(aCalendarStore().permitted())
    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"1","request":"calendar_permission"}"#)
        == #"{"id":"1","protocolVersion":1,"result":{"state":"granted"}}"#)
  }

  @Test("given nobody has been asked yet, says the permission is undecided rather than refused")
  func reportsAnUndecidedPermission() {
    let helper = helperReading(aCalendarStore().permission(.undecided))
    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"1","request":"calendar_permission"}"#)
        == #"{"id":"1","protocolVersion":1,"result":{"state":"undecided"}}"#)
  }

  // Upstream #65: a denied permission surfaced as a bare failure and left the user hunting for the
  // setting. Every answer about the calendar permission names the setting and where it lives.
  @Test("given the permission was refused, names the setting to enable and where it is")
  func namesTheSettingToEnable() {
    let helper = helperReading(aCalendarStore().permission(.refused))
    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"1","request":"calendar_permission"}"#)
        == #"""
        {"id":"1","protocolVersion":1,"result":{"setting":"System Settings > Privacy & Security > Calendars > apple-native-mcp","state":"refused"}}
        """#)
  }

  @Test("given the permission covers writing only, says the calendar still cannot be read")
  func reportsWriteOnlyAsUnreadable() {
    let helper = helperReading(aCalendarStore().permission(.writeOnly))
    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"1","request":"calendar_permission"}"#)
        == #"""
        {"id":"1","protocolVersion":1,"result":{"setting":"System Settings > Privacy & Security > Calendars > apple-native-mcp","state":"writeOnly"}}
        """#)
  }
}
