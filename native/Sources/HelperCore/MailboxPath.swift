/// A mailbox's path, every name from the outermost in, read from how Mail addresses it.
///
/// Mail addresses a mailbox by one full name: its path joined with "/". A mailbox's own name and
/// the names of the mailboxes it sits inside, innermost first, say where that full name divides,
/// so a name that holds a slash stays one name. Whatever Mail has no mailbox for, such as a
/// server folder that holds no mail, is divided at each slash, which is all that is known of it.
///
/// Whatever it is handed, the path joined with "/" is the full name again: a later read addresses
/// the mailbox by exactly that.
func mailboxPath(fullName: String, name: String, containers: [String]) -> [String] {
  var path: [String] = []
  var remaining = fullName

  for known in [name] + containers {
    if remaining == known {
      return [known] + path
    }
    guard remaining.hasSuffix("/" + known) else { break }
    path.insert(known, at: 0)
    remaining.removeLast(known.count + 1)
  }

  return remaining.split(separator: "/", omittingEmptySubsequences: false).map(String.init) + path
}
