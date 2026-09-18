import Foundation
import Testing

@testable import HelperCore

// Upstream #62 read the archive with regular expressions and returned mojibake, or "not readable",
// for any message Messages kept only in its archived rich text. The helper walks the archive's
// structure instead (#21), and a stranger writes every byte of it, so every way it can be wrong is
// a refusal with a reason, never a crash, a guess or a hang.
@Suite("reading a message's archived text")
struct ReadingArchivedTextSpec {
  func text(of archive: Data) -> Result<String, ArchiveUnreadable> {
    ArchivedText.text(of: archive)
  }

  @Test("given a message a person wrote, reads its text exactly")
  func readsTheText() {
    #expect(text(of: anArchive(of: written("Hey Ben, wall at 6?"))) == .success("Hey Ben, wall at 6?"))
  }

  // morquis 96759b3: a byte-wise reader split accented letters and emoji.
  @Test("given accented text, another script and emoji, reads each intact")
  func readsEveryScript() {
    for said in ["à demain, c'est la rentrée", "见面吧", "🧗‍♀️ ok 👍🏽"] {
      #expect(text(of: anArchive(of: written(said))) == .success(said))
    }
  }

  // morquis 96759b3 read a one-byte length only, and cut every long message short.
  @Test("given a message longer than a one-byte length, reads the whole of it")
  func readsALongMessage() {
    for long in [String(repeating: "z", count: 400), String(repeating: "é", count: 40_000)] {
      #expect(text(of: anArchive(of: written(long))) == .success(long))
    }
  }

  @Test("given a mention of someone, reads the text as written, not the handle behind it")
  func readsAMention() {
    let mention = written("Ben, bring the rope").mentioning(
      "ben@example.com", at: NSRange(location: 0, length: 3))

    #expect(text(of: anArchive(of: mention)) == .success("Ben, bring the rope"))
  }

  @Test("given a rich link, reads the link as the text, whatever binary data rides beside it")
  func readsARichLink() {
    let link = written("https://example.com/route").linking(URL(string: "https://example.com/route")!)

    #expect(text(of: anArchive(of: link)) == .success("https://example.com/route"))
  }

  @Test("given a message the user edited, reads the text as it now stands")
  func readsAnEditedMessage() {
    #expect(text(of: anArchive(of: written("See you at 7").edited())) == .success("See you at 7"))
  }

  @Test("given an archive cut short, refuses it as unreadable rather than returning what it read")
  func refusesATruncatedArchive() {
    let archive = anArchive(of: written("Hey Ben, wall at 6?"))

    for count in [0, 5, 20, archive.count / 2, archive.count - 1] {
      #expect(text(of: archive.cut(after: count)).isUnreadable)
    }
  }

  @Test("given a length that runs past the end of the archive, reads nothing past it")
  func refusesAnOverrunningLength() {
    let archive = anArchive(of: written("Hey Ben")).overrunning("Hey Ben")

    #expect(text(of: archive).isUnreadable)
  }

  @Test("given nesting deeper than it reads, stops at the bound and refuses the archive")
  func refusesDeepNesting() {
    #expect(text(of: anArchive(of: written("Deep").nesting(200))).isUnreadable)
  }

  @Test("given nesting within the bound, still reads the text")
  func readsShallowNesting() {
    #expect(text(of: anArchive(of: written("Shallow").nesting(4))) == .success("Shallow"))
  }

  // An archive refers back to what it wrote before by number. Following those numbers is how a
  // reader can be sent round in a circle, so the helper never follows one.
  @Test("given an archive that refers to itself, stops rather than following it round")
  func stopsAtASelfReference() {
    var cyclic = Array(anArchive(of: written("x")).prefix(16))
    // A root object of a class it names, whose only content refers back to the root itself.
    cyclic += [0x84, 0x01, 0x40, 0x84, 0x84, 0x84, 0x12]
    cyclic += Array("NSAttributedString".utf8) + [0x00, 0x85, 0x92, 0x92, 0x86]

    #expect(text(of: Data(cyclic)).isUnreadable)
  }

  // Every byte of an archive is a stranger's to choose. Whatever one byte is changed to, the reader
  // answers or refuses; it never crashes, reads past the end or runs on.
  @Test("given any one byte of a real archive changed, answers or refuses, and never crashes")
  func survivesEveryOneByteChange() {
    let archive = Array(anArchive(of: written("Ben, bring the rope").mentioning(
      "ben@example.com", at: NSRange(location: 0, length: 3))))

    for position in archive.indices {
      for value: UInt8 in [0x00, 0x7f, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x92, 0xff] {
        var changed = archive
        changed[position] = value
        _ = text(of: Data(changed))
      }
    }
  }

  @Test("given something that is not an archive at all, refuses it")
  func refusesAStranger() {
    #expect(text(of: Data("just some text".utf8)).isUnreadable)
    #expect(text(of: anArchive(ofRoot: NSNumber(value: 7))).isUnreadable)
  }

  @Test("never names a reader that would create what an archive names")
  func neverUnarchives() throws {
    let sources = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
      .appendingPathComponent("Sources")
    let files = FileManager.default.enumerator(at: sources, includingPropertiesForKeys: nil)!
    for case let file as URL in files where file.pathExtension == "swift" {
      let source = try String(contentsOf: file, encoding: .utf8)
      for call in ["Unarchiver(", "Unarchiver.", "unarchiveObject", "unarchivedObject"] {
        #expect(!source.contains(call), "\(file.lastPathComponent) calls an unarchiver")
      }
    }
  }
}

extension Result where Failure == ArchiveUnreadable {
  var isUnreadable: Bool {
    if case .failure = self { return true }
    return false
  }
}
