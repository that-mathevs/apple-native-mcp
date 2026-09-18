import Contacts
import Foundation
import HelperCore

/// The one place Contacts.framework is touched. The Contacts app is never scripted, so reading a
/// contact never launches it and never asks for an Automation consent (upstream #65).
final class FrameworkContactStore: ContactStore, @unchecked Sendable {
  private let store = CNContactStore()

  /// The user's answer, once they have given one in this process, for the reason the event and
  /// reminder stores hold theirs (#57). The session serves one request at a time on one thread.
  private var answer: Permission?

  /// Every field a contact record carries, and no other. `CNContactNoteKey` is not among them and
  /// must never be: without Apple's entitlement, asking for it fails the whole fetch.
  private var keys: [CNKeyDescriptor] {
    [
      CNContactIdentifierKey, CNContactNamePrefixKey, CNContactGivenNameKey,
      CNContactMiddleNameKey, CNContactFamilyNameKey, CNContactNameSuffixKey,
      CNContactNicknameKey, CNContactOrganizationNameKey, CNContactJobTitleKey,
      CNContactPhoneNumbersKey, CNContactEmailAddressesKey, CNContactPostalAddressesKey,
      CNContactUrlAddressesKey,
    ].map { $0 as CNKeyDescriptor }
  }

  func permission() -> Permission {
    .held(reported: reported(), answered: answer)
  }

  func requestPermission() -> Permission {
    answer = .asking { answered in
      self.store.requestAccess(for: .contacts, completionHandler: answered)
    }
    return permission()
  }

  func contacts() throws(ContactsUnreadable) -> [Contact] {
    let request = CNContactFetchRequest(keysToFetch: keys)
    // One person kept in iCloud and in Exchange is one contact to the user, and one here.
    request.unifyResults = true

    var found: [Contact] = []
    do {
      try store.enumerateContacts(with: request) { contact, _ in
        found.append(Self.asContact(contact))
      }
    } catch {
      // A fetch that stopped partway has not read the contacts, however many it got through.
      throw ContactsUnreadable(evidence: error.localizedDescription)
    }
    return found
  }

  private func reported() -> Permission {
    switch CNContactStore.authorizationStatus(for: .contacts) {
    case .notDetermined: .undecided
    case .restricted: .restricted
    case .denied: .refused
    case .authorized: .granted
    // A state this helper has never heard of is not a state it may read in.
    @unknown default: .restricted
    }
  }

  private static func asContact(_ contact: CNContact) -> Contact {
    Contact(
      identifier: contact.identifier,
      namePrefix: contact.namePrefix,
      givenName: contact.givenName,
      middleName: contact.middleName,
      familyName: contact.familyName,
      nameSuffix: contact.nameSuffix,
      nickname: contact.nickname,
      organisation: contact.organizationName,
      jobTitle: contact.jobTitle,
      phoneNumbers: contact.phoneNumbers.map {
        LabelledText(label: $0.label ?? "", text: $0.value.stringValue)
      },
      emailAddresses: contact.emailAddresses.map {
        LabelledText(label: $0.label ?? "", text: $0.value as String)
      },
      postalAddresses: contact.postalAddresses.map {
        PostalAddress(
          label: $0.label ?? "", street: $0.value.street, city: $0.value.city,
          region: $0.value.state, postalCode: $0.value.postalCode, country: $0.value.country)
      },
      urls: contact.urlAddresses.map {
        LabelledText(label: $0.label ?? "", text: $0.value as String)
      })
  }
}
