import Testing

@testable import HelperCore

// Reminders are guarded by a permission of their own: a user can allow the calendar and refuse
// the reminders, and each answer names its own setting (upstream #65).
@Suite("asking whether the reminders may be read")
struct AskingWhetherTheRemindersMayBeReadSpec {
  @Test("given the permission is granted, says so")
  func reportsAGrant() {
    #expect(
      helperReading(aReminderStore()).respond(
        to: #"{"protocolVersion":1,"id":"1","request":"reminders_permission"}"#)
        == #"{"id":"1","protocolVersion":1,"result":{"state":"granted"}}"#)
  }

  @Test("given the permission was refused, names the reminders setting to enable and where it is")
  func namesTheSettingToEnable() {
    #expect(
      helperReading(aReminderStore().permission(.refused)).respond(
        to: #"{"protocolVersion":1,"id":"1","request":"reminders_permission"}"#)
        == #"""
        {"id":"1","protocolVersion":1,"result":{"setting":"System Settings > Privacy & Security > Reminders > apple-native-mcp","state":"refused"}}
        """#)
  }
}

@Suite("asking the user for the reminders")
struct AskingTheUserForTheRemindersSpec {
  let asking = #"{"protocolVersion":1,"id":"1","request":"reminders_permission_request"}"#

  @Test("given nobody has been asked yet, asks macOS and reports what the user chose")
  func asksWhileUndecided() {
    let store = aReminderStore().permission(.undecided).answering(.granted)

    #expect(
      helperReading(store).respond(to: asking)
        == #"{"id":"1","protocolVersion":1,"result":{"state":"granted"}}"#)
    #expect(store.record.timesAsked == 1)
  }

  @Test("given the user already refused, does not ask again and names the setting to enable")
  func doesNotAskAfterARefusal() {
    let store = aReminderStore().permission(.refused).answering(.granted)

    #expect(
      helperReading(store).respond(to: asking)
        == #"{"id":"1","protocolVersion":1,"result":{"setting":"\#(remindersPermissionSetting)","state":"refused"}}"#)
    #expect(store.record.timesAsked == 0)
  }
}
