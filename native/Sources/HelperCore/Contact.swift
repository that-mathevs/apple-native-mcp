/// One labelled detail of a contact: a phone number, an email address or a URL. The label is
/// exactly what the store holds, Apple's own included, such as `_$!<Mobile>!$_`: saying it the way
/// a person would is the server's rule, not the helper's.
public struct LabelledText: Equatable, Sendable {
  public let label: String
  public let text: String

  public init(label: String, text: String) {
    self.label = label
    self.text = text
  }
}

public struct PostalAddress: Equatable, Sendable {
  public let label: String
  public let street: String
  public let city: String
  public let region: String
  public let postalCode: String
  public let country: String

  public init(
    label: String, street: String, city: String, region: String, postalCode: String,
    country: String
  ) {
    self.label = label
    self.street = street
    self.city = city
    self.region = region
    self.postalCode = postalCode
    self.country = country
  }
}

/// A person or company in Contacts. It has no note: macOS keeps that field for apps Apple has
/// entitled, so the helper never asks the store for it.
public struct Contact: Equatable, Sendable {
  public let identifier: String
  public let namePrefix: String
  public let givenName: String
  public let middleName: String
  public let familyName: String
  public let nameSuffix: String
  public let nickname: String
  public let organisation: String
  public let jobTitle: String
  public let phoneNumbers: [LabelledText]
  public let emailAddresses: [LabelledText]
  public let postalAddresses: [PostalAddress]
  public let urls: [LabelledText]

  public init(
    identifier: String, namePrefix: String, givenName: String, middleName: String,
    familyName: String, nameSuffix: String, nickname: String, organisation: String,
    jobTitle: String, phoneNumbers: [LabelledText],
    emailAddresses: [LabelledText], postalAddresses: [PostalAddress], urls: [LabelledText]
  ) {
    self.identifier = identifier
    self.namePrefix = namePrefix
    self.givenName = givenName
    self.middleName = middleName
    self.familyName = familyName
    self.nameSuffix = nameSuffix
    self.nickname = nickname
    self.organisation = organisation
    self.jobTitle = jobTitle
    self.phoneNumbers = phoneNumbers
    self.emailAddresses = emailAddresses
    self.postalAddresses = postalAddresses
    self.urls = urls
  }
}

/// The contacts as the helper reaches them. Contacts.framework sits behind this and nothing else
/// does: the Contacts app is never scripted, so it is never launched and no Automation consent is
/// ever asked for (upstream #65).
public protocol ContactStore: Sendable {
  /// What macOS currently allows.
  func permission() -> Permission

  /// Ask macOS for contacts access, which prompts the user, and report what they chose.
  /// Only ever called while the permission is undecided: macOS prompts once and no more.
  func requestPermission() -> Permission

  /// Every contact, read afresh. Which of them a name or a number finds is the server's rule.
  func contacts() throws(ContactsUnreadable) -> [Contact]
}

/// The contact store would not be read. It carries what the store said, verbatim.
public struct ContactsUnreadable: Error, Equatable, Sendable {
  public let evidence: String

  public init(evidence: String) {
    self.evidence = evidence
  }
}

/// Reading the contacts: the rules that sit between the protocol and Contacts.framework.
struct ContactsReading: Sendable {
  let store: ContactStore

  func permission() -> Permission {
    store.permission()
  }

  func requestPermission() -> Permission {
    .askingOnce(held: store.permission(), ask: store.requestPermission)
  }

  /// A fetch that failed is never an answer of nobody: a send would read "no such contact" as
  /// "this person is unknown".
  func contacts() -> Result<[Contact], NamedFailure> {
    store.permission().whenItAllows(
      \.allowsReading, else: NamedFailure.contactsPermissionMissing, reading)
  }

  private func reading() -> Result<[Contact], NamedFailure> {
    do {
      return .success(try store.contacts())
    } catch {
      return .failure(.contactsUnreadable(evidence: error.evidence))
    }
  }
}

extension LabelledText {
  var asFields: [String: Any] { ["label": label, "text": text] }
}

extension PostalAddress {
  var asFields: [String: Any] {
    [
      "label": label, "street": street, "city": city, "region": region,
      "postalCode": postalCode, "country": country,
    ]
  }
}

extension Contact {
  var asFields: [String: Any] {
    [
      "identifier": identifier, "namePrefix": namePrefix, "givenName": givenName,
      "middleName": middleName, "familyName": familyName, "nameSuffix": nameSuffix,
      "nickname": nickname, "organisation": organisation, "jobTitle": jobTitle,
      "phoneNumbers": phoneNumbers.map(\.asFields),
      "emailAddresses": emailAddresses.map(\.asFields),
      "postalAddresses": postalAddresses.map(\.asFields),
      "urls": urls.map(\.asFields),
    ]
  }
}
