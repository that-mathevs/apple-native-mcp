import Testing

@testable import HelperCore

@Suite("asking for the reminder lists")
struct AskingForTheReminderListsSpec {
  let asking = #"{"protocolVersion":1,"id":"3","request":"reminder_lists"}"#

  // sicdigital 791f5f2 keyed reminder lists by title, so two called "Groceries" became one.
  @Test("given two reminder lists with one title in different calendar accounts, returns both, each with its own identifier and account")
  func keepsListsSharingATitleApart() {
    let helper = helperReading(aReminderStore().holding(groceries, localGroceries))

    #expect(
      helper.respond(to: asking)
        == #"""
        {"id":"3","protocolVersion":1,"result":{"reminderLists":[{"account":{"identifier":"account-icloud","title":"iCloud"},"identifier":"list-groceries","title":"Groceries"},{"account":{"identifier":"account-local","title":"On My Mac"},"identifier":"list-local-groceries","title":"Groceries"}]}}
        """#)
  }

  // Upstream #53: a refused permission read as a Mac with no reminder lists at all.
  @Test("given the reminders permission was refused, reports the permission failure naming the setting, not an empty set of reminder lists")
  func reportsThePermissionFailure() {
    #expect(
      helperReading(aReminderStore().permission(.refused).holding(groceries)).respond(to: asking)
        == #"""
        {"failure":{"code":"reminders_permission_missing","evidence":"refused","sentence":"apple-native-mcp cannot read your reminders until it is allowed to, in System Settings > Privacy & Security > Reminders > apple-native-mcp."},"id":"3","protocolVersion":1}
        """#)
  }

  // A tool never asks for a permission, and the setting is not there to turn on until macOS has
  // asked once, so a permission nobody has asked for points at setup instead (#33).
  @Test("given nobody has been asked for the reminders permission yet, says to run setup rather than naming a setting that is not there")
  func pointsAtSetupWhileUndecided() {
    #expect(
      helperReading(aReminderStore().permission(.undecided).holding(groceries)).respond(to: asking)
        == #"""
        {"failure":{"code":"reminders_permission_missing","evidence":"undecided","sentence":"apple-native-mcp has not been asked for your reminders yet. Run `npx apple-native-mcp setup` to be asked."},"id":"3","protocolVersion":1}
        """#)
  }
}
