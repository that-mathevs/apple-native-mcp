import Foundation

@testable import HelperCore

// The words a contacts scenario uses to set a Mac up without having one.

let sam = Contact(
  identifier: "contact-sam", namePrefix: "Dr", givenName: "Sam", middleName: "James",
  familyName: "Okafor", nameSuffix: "Jr", nickname: "Sammy",
  organisation: "Hartley & Finch", jobTitle: "Surveyor",
  phoneNumbers: [LabelledText(label: "_$!<Mobile>!$_", text: "+44 7700 900123")],
  emailAddresses: [LabelledText(label: "_$!<Work>!$_", text: "sam@hartleyfinch.example")],
  postalAddresses: [
    PostalAddress(
      label: "_$!<Home>!$_", street: "4 Mill Lane", city: "Leeds", region: "West Yorkshire",
      postalCode: "LS1 4AB", country: "United Kingdom")
  ],
  urls: [LabelledText(label: "_$!<HomePage>!$_", text: "https://okafor.example")])

/// A contact store that is not a Mac's: it holds whatever a scenario says it holds.
struct FakeContactStore: ContactStore {
  final class Asking: @unchecked Sendable {
    var times = 0
  }

  var permissionHeld: Permission = .granted
  var answersWhenAsked: Permission = .refused
  var held: [Contact] = []
  var refusesToRead: String?
  let asking = Asking()

  func permission() -> Permission { permissionHeld }

  func requestPermission() -> Permission {
    asking.times += 1
    return answersWhenAsked
  }

  func contacts() throws(ContactsUnreadable) -> [Contact] {
    if let said = refusesToRead { throw ContactsUnreadable(evidence: said) }
    return held
  }

  func failingToRead(saying evidence: String) -> FakeContactStore {
    var store = self
    store.refusesToRead = evidence
    return store
  }

  func holding(_ contacts: Contact...) -> FakeContactStore {
    var store = self
    store.held += contacts
    return store
  }

  func permission(_ permission: Permission) -> FakeContactStore {
    var store = self
    store.permissionHeld = permission
    return store
  }

  func answering(_ permission: Permission) -> FakeContactStore {
    var store = self
    store.answersWhenAsked = permission
    return store
  }
}

func aContactStore() -> FakeContactStore { FakeContactStore() }

func helperReading(_ store: FakeContactStore) -> Helper {
  Helper(calendarStore: aCalendarStore(), reminderStore: aReminderStore(), contactStore: store, messageStore: noMessageStore)
}
