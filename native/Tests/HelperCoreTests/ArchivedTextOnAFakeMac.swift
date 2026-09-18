import Foundation

// The words a scenario uses to write a message's text the way Messages keeps it: an attributed
// string archived as a typedstream, the format NSArchiver writes. NSArchiver is deprecated for
// writing new archives, which is exactly why Messages' archives are in this format; the specs
// reach it by name so the build stays free of warnings. Writing an archive is safe. Reading one
// back through NSUnarchiver would instantiate whatever class a stranger named (MSG-103), and the
// helper never does.

/// An archive of this attributed string, byte for byte as Messages would keep it.
func anArchive(of text: NSAttributedString) -> Data {
  anArchive(ofRoot: text)
}

/// An archive of any object, for scenarios that need something Messages would never write.
func anArchive(ofRoot root: NSObject) -> Data {
  let archiver = NSClassFromString("NSArchiver") as! NSObject.Type
  let archived = archiver.perform(NSSelectorFromString("archivedDataWithRootObject:"), with: root)
  return archived!.takeUnretainedValue() as! Data
}

/// Text as a person wrote it, marked the way Messages marks every message: as its first part.
func written(_ text: String) -> NSMutableAttributedString {
  let written = NSMutableAttributedString(string: text)
  written.addAttribute(
    NSAttributedString.Key("__kIMMessagePartAttributeName"), value: NSNumber(value: 0),
    range: NSRange(location: 0, length: (text as NSString).length))
  return written
}

extension NSMutableAttributedString {
  /// A mention of someone, which Messages keeps as an attribute naming their handle.
  func mentioning(_ handle: String, at range: NSRange) -> NSMutableAttributedString {
    addAttribute(
      NSAttributedString.Key("__kIMMentionConfirmedMention"), value: handle as NSString,
      range: range)
    return self
  }

  /// A rich link: the URL as the text, the link as an attribute, and the data detector's own
  /// binary result beside it.
  func linking(_ url: URL) -> NSMutableAttributedString {
    let whole = NSRange(location: 0, length: length)
    addAttribute(
      NSAttributedString.Key("__kIMLinkAttributeName"), value: url as NSURL, range: whole)
    addAttribute(
      NSAttributedString.Key("__kIMDataDetectedAttributeName"),
      value: Data([0x62, 0x70, 0x6c, 0x69, 0x73, 0x74, 0x30, 0x30, 0x00, 0xff]) as NSData,
      range: whole)
    return self
  }

  /// Any attribute Messages keeps on the whole text, with a number as its value.
  func marked(_ attribute: String, as value: Int) -> NSMutableAttributedString {
    addAttribute(
      NSAttributedString.Key(attribute), value: NSNumber(value: value),
      range: NSRange(location: 0, length: length))
    return self
  }

  /// The mark Messages puts on a message the user edited after sending it.
  func edited() -> NSMutableAttributedString {
    addAttribute(
      NSAttributedString.Key("__kIMMessageEditedAttributeName"), value: NSNumber(value: true),
      range: NSRange(location: 0, length: length))
    return self
  }

  /// An attribute whose value nests arrays this deep, which nothing Messages writes comes near.
  func nesting(_ depth: Int) -> NSMutableAttributedString {
    var nested: NSArray = []
    for _ in 0..<depth { nested = [nested] }
    addAttribute(
      NSAttributedString.Key("__kIMNestedAttributeName"), value: nested,
      range: NSRange(location: 0, length: length))
    return self
  }
}

extension Data {
  /// The archive cut short after this many bytes.
  func cut(after count: Int) -> Data { prefix(count) }

  /// The archive with the length of the string holding this text claiming far more than the
  /// archive has left: its one-byte length becomes the mark of a two-byte one, which the text's
  /// own first two bytes then spell as a length in the tens of thousands.
  func overrunning(_ text: String) -> Data {
    let twoByteLength: UInt8 = 0x81
    let bytes = Array(text.utf8)
    var archive = Array(self)
    guard let start = archive.firstRange(of: bytes)?.lowerBound, start > 0 else { return self }
    archive[start - 1] = twoByteLength
    return Data(archive)
  }
}
