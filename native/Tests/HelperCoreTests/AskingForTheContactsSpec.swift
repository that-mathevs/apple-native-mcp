import Testing

@testable import HelperCore

// Upstream reached Contacts by scripting the app, which launched it, needed an Automation consent
// and timed out on a few thousand contacts (upstream #65). The helper reads the contact store
// itself.
@Suite("asking for the contacts")
struct AskingForTheContactsSpec {
  let asking = #"{"protocolVersion":1,"id":"7","request":"contacts"}"#

  @Test("returns every contact as a record with every kind of detail it has, each with its label exactly as the store holds it")
  func returnsEveryContactInFull() {
    #expect(
      helperReading(aContactStore().holding(sam)).respond(to: asking)
        == #"""
        {"id":"7","protocolVersion":1,"result":{"contacts":[{"emailAddresses":[{"label":"_$!<Work>!$_","text":"sam@hartleyfinch.example"}],"familyName":"Okafor","givenName":"Sam","identifier":"contact-sam","jobTitle":"Surveyor","middleName":"James","namePrefix":"Dr","nameSuffix":"Jr","nickname":"Sammy","organisation":"Hartley & Finch","phoneNumbers":[{"label":"_$!<Mobile>!$_","text":"+44 7700 900123"}],"postalAddresses":[{"city":"Leeds","country":"United Kingdom","label":"_$!<Home>!$_","postalCode":"LS1 4AB","region":"West Yorkshire","street":"4 Mill Lane"}],"urls":[{"label":"_$!<HomePage>!$_","text":"https://okafor.example"}]}]}}
        """#)
  }

  @Test("given no contacts, answers with none rather than a failure")
  func answersWithNoContacts() {
    #expect(
      helperReading(aContactStore()).respond(to: asking)
        == #"{"id":"7","protocolVersion":1,"result":{"contacts":[]}}"#)
  }

  // morquis 5c01104: macOS keeps the contact note for apps Apple has entitled, and asking the
  // framework for it without the entitlement takes the whole fetch down.
  @Test("given a request for the contact note, refuses it by name and never asks the store for it, rather than crashing")
  func refusesTheContactNote() {
    let response = helperReading(aContactStore().holding(sam)).respond(
      to: #"{"protocolVersion":1,"id":"7","request":"contacts","include":["note"]}"#)

    #expect(response.contains(#""code":"contact_note_unavailable""#))
    #expect(!response.contains("Okafor"))
  }

  @Test("given a request to include something the helper has never heard of, refuses it rather than ignoring it")
  func refusesAnUnknownInclusion() {
    let response = helperReading(aContactStore()).respond(
      to: #"{"protocolVersion":1,"id":"7","request":"contacts","include":["photo"]}"#)
    #expect(response.contains(#""code":"request_malformed""#))
  }

  // upstream #65, morquis 96759b3: a refused permission read as there being no contacts.
  @Test("given the contacts permission was refused, refuses and names the setting to enable rather than answering with no contacts")
  func refusesWithoutThePermission() {
    let response = helperReading(aContactStore().holding(sam).permission(.refused))
      .respond(to: asking)

    #expect(response.contains(#""code":"contacts_permission_missing""#))
    #expect(response.contains("Privacy & Security > Contacts > apple-native-mcp"))
    #expect(!response.contains("Okafor"))
  }
}

@Suite("reading the contacts")
struct ReadingTheContactsSpec {
  // NN3: a fetch that failed is not an answer of nobody. A `try?` here once turned every failure
  // into "no contacts", which a send would then read as "this person is unknown".
  @Test("given the contact store would not be read, reports that with what the store said, rather than answering with no contacts")
  func reportsAStoreThatWouldNotBeRead() {
    let response = helperReading(
      aContactStore().holding(sam).failingToRead(saying: "The operation couldn't be completed."))
      .respond(to: #"{"protocolVersion":1,"id":"7","request":"contacts"}"#)

    #expect(response.contains(#""code":"contacts_unreadable""#))
    #expect(response.contains(#""evidence":"The operation couldn't be completed.""#))
    #expect(!response.contains("Okafor"))
  }

  // A tool never asks for a permission, and the setting only exists once macOS has asked.
  @Test("given nobody has been asked for the contacts permission yet, points at setup rather than at a setting that is not there")
  func pointsAtSetupWhileUndecided() {
    let response = helperReading(aContactStore().permission(.undecided))
      .respond(to: #"{"protocolVersion":1,"id":"7","request":"contacts"}"#)

    #expect(response.contains(#""code":"contacts_permission_missing""#))
    #expect(response.contains("npx apple-native-mcp setup"))
    #expect(!response.contains("Privacy & Security"))
  }
}

@Suite("asking whether the contacts may be read")
struct AskingWhetherTheContactsMayBeReadSpec {
  @Test("reports the contacts permission without reading a single contact")
  func reportsThePermission() {
    #expect(
      helperReading(aContactStore().permission(.undecided)).respond(
        to: #"{"protocolVersion":1,"id":"8","request":"contacts_permission"}"#)
        == #"{"id":"8","protocolVersion":1,"result":{"state":"undecided"}}"#)
  }

  @Test("given nobody has been asked yet, asks the user and reports what they chose")
  func asksTheUser() {
    let store = aContactStore().permission(.undecided).answering(.granted)
    let response = helperReading(store).respond(
      to: #"{"protocolVersion":1,"id":"8","request":"contacts_permission_request"}"#)

    #expect(response.contains(#""state":"granted""#))
    #expect(store.asking.times == 1)
  }

  @Test("given the user already refused, names the setting to change rather than asking again: macOS prompts once")
  func doesNotAskTwice() {
    let store = aContactStore().permission(.refused)
    let response = helperReading(store).respond(
      to: #"{"protocolVersion":1,"id":"8","request":"contacts_permission_request"}"#)

    #expect(response.contains("Privacy & Security > Contacts > apple-native-mcp"))
    #expect(store.asking.times == 0)
  }
}
