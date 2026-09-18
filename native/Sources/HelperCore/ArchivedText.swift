import Foundation

/// Why a message's archived text could not be read, in words that go out as the evidence.
public struct ArchiveUnreadable: Error, Equatable, Sendable {
  public let reason: String
}

/// The text of a message Messages keeps as archived rich text: an attributed string written as a
/// typedstream, the format NSArchiver writes.
///
/// A stranger writes every byte of it, so it is read as data and nothing more (#21). The reader
/// walks the archive's own structure, never scanning for markers, and creates nothing an archive
/// names: NSUnarchiver would instantiate any class a message chose (MSG-103). It is total. Every
/// read is checked against what is left, depth and size are bounded, and a reference back to
/// something already read is never followed, so no archive can send it round in a circle.
enum ArchivedText {
  /// Far beyond any message's rich text, and small enough that a hostile one costs nothing.
  static let greatestSize = 1 << 20
  /// How deep objects may nest. A message's own nest three or four deep.
  static let greatestDepth = 32
  /// How many values one archive may hold before it is given up on.
  static let greatestValues = 100_000

  static func text(of archive: Data) -> Result<String, ArchiveUnreadable> {
    guard archive.count <= greatestSize else {
      return .failure(ArchiveUnreadable(reason: "the archive is larger than \(greatestSize) bytes"))
    }

    var reader = Reader(bytes: Array(archive))
    do {
      try reader.readHeader()
      var values: [Value] = []
      while !reader.isAtEnd { values += try reader.readGroup(depth: 0) }
      return textOfTheAttributedString(in: values)
    } catch let unreadable as ArchiveUnreadable {
      return .failure(unreadable)
    } catch {
      return .failure(ArchiveUnreadable(reason: String(describing: error)))
    }
  }

  /// The text is the string an attributed string holds: the first string object among its
  /// contents. Everything after it is attributes, whose names are not the text (faces-sh
  /// cad640a returned an attribute name for an audio message).
  private static func textOfTheAttributedString(in values: [Value]) -> Result<
    String, ArchiveUnreadable
  > {
    guard
      case .object(let className, let contents)? = values.first,
      let className, className.hasSuffix("AttributedString")
    else {
      return .failure(ArchiveUnreadable(reason: "the archive holds no attributed string"))
    }

    for case .object(let held?, let stringContents) in contents
    where held == "NSString" || held == "NSMutableString" {
      for case .bytes(let bytes) in stringContents {
        guard let text = String(bytes: bytes, encoding: .utf8) else {
          return .failure(ArchiveUnreadable(reason: "the text is not UTF-8"))
        }
        return .success(text)
      }
    }
    return .failure(ArchiveUnreadable(reason: "the attributed string holds no text"))
  }
}

/// What reading a value came to. Only what the text is found in is kept.
private indirect enum Value {
  case object(className: String?, contents: [Value])
  case bytes([UInt8])
  case other
}

/// How a typedstream says what the next values are, one code per value.
private indirect enum TypeCode {
  case object
  case classReference
  case bytes
  case sharedString
  case integer
  case float(width: Int)
  case array(count: Int, element: TypeCode)
  case structure([TypeCode])
}

/// The reader, and everything it has read that later bytes may refer back to.
private struct Reader {
  // The markers a typedstream writes where an integer could be, and the number references to
  // earlier strings and objects count from.
  static let twoByteInteger: UInt8 = 0x81
  static let fourByteInteger: UInt8 = 0x82
  static let floatingPoint: UInt8 = 0x83
  static let new: UInt8 = 0x84
  static let none: UInt8 = 0x85
  static let endOfObject: UInt8 = 0x86
  static let firstReference = -110

  let bytes: [UInt8]
  var cursor = 0
  var sharedStrings: [[UInt8]] = []
  var objects = 0
  var values = 0

  init(bytes: [UInt8]) { self.bytes = bytes }

  var isAtEnd: Bool { cursor >= bytes.count }

  mutating func readHeader() throws {
    guard try readInteger() == 4, try readBytes() == Array("streamtyped".utf8) else {
      throw ArchiveUnreadable(reason: "the archive is not a typedstream")
    }
    _ = try readInteger()
  }

  /// A type encoding and a value for each code in it.
  mutating func readGroup(depth: Int) throws -> [Value] {
    guard let encoding = try readSharedString() else {
      throw ArchiveUnreadable(reason: "a value has no type")
    }
    var parser = TypeParser(encoding: encoding)
    let codes = try parser.parseAll()
    return try codes.map { try readValue($0, depth: depth) }
  }

  private mutating func readValue(_ code: TypeCode, depth: Int) throws -> Value {
    values += 1
    guard values <= ArchivedText.greatestValues else {
      throw ArchiveUnreadable(reason: "the archive holds more than \(ArchivedText.greatestValues) values")
    }

    switch code {
    case .object: return try readObject(depth: depth + 1)
    case .classReference:
      _ = try readClass()
      return .other
    case .bytes: return .bytes(try readBytes())
    case .sharedString:
      let marker = try readByte()
      if marker == Self.new { _ = try readSharedString() } else if marker != Self.none {
        _ = try readInteger(startingWith: marker)
      }
      return .other
    case .integer:
      _ = try readInteger()
      return .other
    case .float(let width):
      if try peek() == Self.floatingPoint {
        cursor += 1
        _ = try take(width)
      } else {
        _ = try readInteger()
      }
      return .other
    case .array(let count, .integer) where count >= 0:
      // A run of bytes, such as the data a data detector leaves beside a link.
      _ = try take(count)
      return .other
    case .array(let count, let element):
      guard count >= 0, count <= ArchivedText.greatestValues else {
        throw ArchiveUnreadable(reason: "an array claims \(count) values")
      }
      for _ in 0..<count { _ = try readValue(element, depth: depth) }
      return .other
    case .structure(let fields):
      for field in fields { _ = try readValue(field, depth: depth) }
      return .other
    }
  }

  private mutating func readObject(depth: Int) throws -> Value {
    guard depth <= ArchivedText.greatestDepth else {
      throw ArchiveUnreadable(reason: "objects nest deeper than \(ArchivedText.greatestDepth)")
    }

    let marker = try readByte()
    switch marker {
    case Self.none: return .other
    case Self.new:
      objects += 1
      let className = try readClass()
      var contents: [Value] = []
      while try peek() != Self.endOfObject { contents += try readGroup(depth: depth) }
      cursor += 1
      return .object(className: className, contents: contents)
    default:
      // A reference back to an object already read. It is checked, and never followed.
      try check(reference: try readInteger(startingWith: marker), within: objects)
      return .other
    }
  }

  /// A class and the classes it descends from, answering the most derived one's name.
  private mutating func readClass() throws -> String? {
    var name: String?
    while true {
      let marker = try readByte()
      switch marker {
      case Self.none: return name
      case Self.new:
        objects += 1
        guard let written = try readSharedString() else {
          throw ArchiveUnreadable(reason: "a class has no name")
        }
        if name == nil { name = String(decoding: written, as: UTF8.self) }
        _ = try readInteger()
      default:
        try check(reference: try readInteger(startingWith: marker), within: objects)
        return name
      }
    }
  }

  private mutating func readSharedString() throws -> [UInt8]? {
    let marker = try readByte()
    switch marker {
    case Self.none: return nil
    case Self.new:
      let string = try readBytes()
      sharedStrings.append(string)
      return string
    default:
      let reference = try readInteger(startingWith: marker)
      try check(reference: reference, within: sharedStrings.count)
      return sharedStrings[reference - Self.firstReference]
    }
  }

  /// A length and that many bytes. A length past the end is refused before anything is read.
  private mutating func readBytes() throws -> [UInt8] {
    let length = try readInteger()
    guard length >= 0 else { throw ArchiveUnreadable(reason: "a length is negative") }
    return try take(length)
  }

  private mutating func readInteger() throws -> Int {
    try readInteger(startingWith: try readByte())
  }

  private mutating func readInteger(startingWith marker: UInt8) throws -> Int {
    switch marker {
    case Self.twoByteInteger:
      let two = try take(2)
      return Int(Int16(bitPattern: UInt16(two[0]) | UInt16(two[1]) << 8))
    case Self.fourByteInteger:
      let four = try take(4)
      let bits = four.enumerated().reduce(UInt32(0)) { $0 | UInt32($1.element) << (8 * $1.offset) }
      return Int(Int32(bitPattern: bits))
    case 0x80, 0x83...0x91:
      throw ArchiveUnreadable(reason: "a marker 0x\(String(marker, radix: 16)) stands where a number should")
    default:
      return Int(Int8(bitPattern: marker))
    }
  }

  private func check(reference: Int, within count: Int) throws {
    let index = reference - Self.firstReference
    guard index >= 0, index < count else {
      throw ArchiveUnreadable(reason: "a reference points at something not yet read")
    }
  }

  private mutating func readByte() throws -> UInt8 { try take(1)[0] }

  private func peek() throws -> UInt8 {
    guard cursor < bytes.count else { throw ArchiveUnreadable(reason: "the archive ends early") }
    return bytes[cursor]
  }

  private mutating func take(_ count: Int) throws -> [UInt8] {
    guard count >= 0, count <= bytes.count - cursor else {
      throw ArchiveUnreadable(reason: "the archive ends inside a value")
    }
    defer { cursor += count }
    return Array(bytes[cursor..<cursor + count])
  }
}

/// Reads a type encoding such as `@`, `iI`, `[16c]` or `{_NSRange=QQ}`.
private struct TypeParser {
  let encoding: [UInt8]
  var cursor = 0

  init(encoding: [UInt8]) { self.encoding = encoding }

  mutating func parseAll() throws -> [TypeCode] {
    var codes: [TypeCode] = []
    while cursor < encoding.count { codes.append(try parseOne(depth: 0)) }
    guard !codes.isEmpty else { throw ArchiveUnreadable(reason: "a type encoding is empty") }
    return codes
  }

  private mutating func parseOne(depth: Int) throws -> TypeCode {
    guard depth <= ArchivedText.greatestDepth, cursor < encoding.count else {
      throw ArchiveUnreadable(reason: "a type encoding is cut short")
    }
    let code = encoding[cursor]
    cursor += 1

    switch UnicodeScalar(code) {
    case "@": return .object
    case "#": return .classReference
    case "+": return .bytes
    case "*", "%", ":": return .sharedString
    case "c", "C", "s", "S", "i", "I", "l", "L", "q", "Q", "B": return .integer
    case "f": return .float(width: 4)
    case "d": return .float(width: 8)
    case "[":
      var count = 0
      while cursor < encoding.count, let digit = Int(String(UnicodeScalar(encoding[cursor]))) {
        count = count * 10 + digit
        guard count <= ArchivedText.greatestSize else {
          throw ArchiveUnreadable(reason: "an array claims too many values")
        }
        cursor += 1
      }
      let element = try parseOne(depth: depth + 1)
      try expect("]")
      return .array(count: count, element: element)
    case "{":
      while cursor < encoding.count, encoding[cursor] != UInt8(ascii: "=") { cursor += 1 }
      try expect("=")
      var fields: [TypeCode] = []
      while cursor < encoding.count, encoding[cursor] != UInt8(ascii: "}") {
        fields.append(try parseOne(depth: depth + 1))
      }
      try expect("}")
      return .structure(fields)
    default:
      throw ArchiveUnreadable(reason: "a type encoding holds \(Character(UnicodeScalar(code)))")
    }
  }

  private mutating func expect(_ character: Character) throws {
    guard cursor < encoding.count, encoding[cursor] == character.asciiValue else {
      throw ArchiveUnreadable(reason: "a type encoding is cut short")
    }
    cursor += 1
  }
}
