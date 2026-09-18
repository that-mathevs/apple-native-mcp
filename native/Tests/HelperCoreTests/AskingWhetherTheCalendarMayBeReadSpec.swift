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

// Nothing reads a calendar until the user has been asked, and macOS only prompts while the
// permission is undecided: once it has been refused, asking again does nothing at all, so the
// helper says what to change instead of asking into the void.
@Suite("asking the user for the calendar")
struct AskingTheUserForTheCalendarSpec {
  @Test("given nobody has been asked yet, asks macOS and reports what the user chose")
  func asksWhileUndecided() {
    let store = aCalendarStore().permission(.undecided).answering(.granted)
    let helper = helperReading(store)

    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"1","request":"calendar_permission_request"}"#)
        == #"{"id":"1","protocolVersion":1,"result":{"state":"granted"}}"#)
    #expect(store.asking.times == 1)
  }

  @Test("given the user already refused, does not ask again and names the setting to enable")
  func doesNotAskAfterARefusal() {
    let store = aCalendarStore().permission(.refused).answering(.granted)
    let helper = helperReading(store)

    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"1","request":"calendar_permission_request"}"#)
        == #"{"id":"1","protocolVersion":1,"result":{"setting":"\#(calendarPermissionSetting)","state":"refused"}}"#)
    #expect(store.asking.times == 0)
  }

  @Test("given the permission is already granted, does not ask again")
  func doesNotAskWhenAlreadyGranted() {
    let store = aCalendarStore().permitted()
    let helper = helperReading(store)

    #expect(
      helper.respond(to: #"{"protocolVersion":1,"id":"1","request":"calendar_permission_request"}"#)
        == #"{"id":"1","protocolVersion":1,"result":{"state":"granted"}}"#)
    #expect(store.asking.times == 0)
  }
}
