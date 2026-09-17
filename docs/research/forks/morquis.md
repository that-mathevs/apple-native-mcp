# morquis/apple-mcp

- **Remote:** `fork-morquis`
- **Branches read:** `main` (121 commits: 90 non-merge, 31 merges). `HEAD` points at `main`.
  There are no other branches.
- **Commits accounted for:** 121 / 121
- **Last commit:** 2026-05-08
- **In one paragraph:** One German-speaking user with Exchange/M365 and iCloud accounts
  (`Posteingang` is hard-coded as an inbox name, `0163…` numbers default to `+49`, and the
  bridge matches the German "Applikation … gefunden" error). The work came in two bursts:
  Codex PRs in June 2025, then Claude Code sessions in April–May 2026. **Read this before
  counting commits.** The fork doesn't branch from `upstream/main`. It branches from an
  *older, rewritten copy* of upstream's history. 67 of the 121 commits (49 non-merge,
  18 merges) are patch-identical to upstream commits up to `ec3018b` "publish" (2025-04-02):
  the tree of the fork's `11d210a` is byte-identical to upstream's `ec3018b`. So the fork's
  own work is **41 non-merge commits plus 13 PR merges**, and it never picked up upstream's
  later work (the April–August 2025 mail/reminders fixes and the "total revamp with tests"
  in `70172d6`). Its baseline already drove Calendar, Notes and Reminders through `@jxa/run`,
  so "fixed" here often means "fixed relative to `ec3018b`". **Architecture:** despite the
  brief's description, `core/` holds exactly one module, `core/jxa-bridge.ts`, an
  `osascript -l JavaScript -e <script>` runner with timeouts and typed errors. Everything
  else is still `utils/<app>.ts` plus a 2,500-line `index.ts`. **Escaping:** the fork did
  remove upstream's AppleScript string splicing. It replaced it with JXA scripts built as
  template strings, with a hand-rolled `escapeJXAString` copied into 8 files. That escaping
  is sound for a double-quoted JS literal. But **two call sites run escaped input through
  `String.prototype.replace`, whose `$'`/`` $` `` replacement patterns undo it.** That gives
  code execution through Contacts writes and through Notes scoping (both proven below).
  Reminders' `listById` also calls any method name the caller supplies. **Worth learning
  from:** it has the richest real-world Mail and Contacts knowledge of any fork (label
  sentinels, the FAX quirk, the note entitlement, phones not persisting through the
  scripting bridge, Exchange performance, scoped message references, dry runs), a good
  osascript kill-escalation, and a solid `chat.db` read path. Its unit tests pin the text
  of generated scripts, not behaviour.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Calendar | JXA (`Application("Calendar")`) via `core/jxa-bridge.ts`; values spliced in as escaped literals | Overlap query `startDate < rangeEnd && endDate > rangeStart` per calendar. RRULE expanded by hand inside the script. 5-minute timeout. |
| Reminders | JXA (`Application("Reminders")`), escaped literals | Replaces `@jxa/run` (which passed args as JSON). `list` without a name returns lists only. |
| Contacts (read) | JXA scripting bridge; bulk accessors `Contacts.people.name()` / `.phones.value()` | Search by name (`whose`), by email or phone (full scan in the script). |
| Contacts (write) | Contacts.framework through the JXA–ObjC bridge (`$.CNContactStore`, `CNSaveRequest`) inside osascript | The scripting bridge silently drops phones on write (`a77212a`). Reads back through the scripting bridge. |
| Messages (read) | `better-sqlite3` on `~/Library/Messages/chat.db`, `readonly`, `query_only`, prepared statements | Replaces the `sqlite3` shell-out. Joins through `chat_message_join`/`chat_handle_join`. |
| Messages (send) | JXA `Messages.send(text, {to: buddy})`, values as `JSON.stringify` literals | Buddy looked up on the iMessage service by exact handle. No read-back. |
| Notes | JXA (`Application("Notes")`), `whose` filters, account → folder scoping | Escaped literals, plus a placeholder `.replace` for scope (injection, see C4). |
| Mail | JXA (`Application("Mail")`) + `System Events` process check + `Mail.activate()`; export writes files with `NSFileManager`/`NSString` and `Mail.save` inside JXA | Replaces most AppleScript. `whose({readStatus:false})` on named inboxes. |
| Maps, Photos, Music | JXA | Out of v1 scope. Maps "search" fabricates a result named after the query when nothing is selected. |
| Web search | `fetch` of DuckDuckGo HTML | Re-indented only. |

## Changes

### C1 A single osascript runner with timeouts that actually kill the child

- **Kind:** infra
- **Context:** cross-cutting
- **Symptom:** A hung Apple Events call (e.g. walking ~3,000 contacts during CloudKit sync) left
  `osascript` running after the request timed out. Test workers were adopted by `launchd` and
  polled forever.
- **Root cause:** upstream calls `run-applescript` with no timeout or cancellation
  (`utils/message.ts:74`, `utils/notes.ts:118`, etc. at `upstream/main`). `ec3018b` also used
  `@jxa/run`, which has no timeout either.
- **Technique:** `core/jxa-bridge.ts` `spawn`s `osascript -l JavaScript -e <script>` with no
  shell. On timeout it rejects immediately, sends `SIGTERM`, and after `killGraceMs` (default
  5 s) sends `SIGKILL` if the child is still alive. The escalation timer is `unref`'d. Output
  handling: a non-zero exit plus stderr matching "Can't get application" / "Application isn't
  running" / the German "Applikation … gefunden" becomes `JXAAppNotRunningError`. Any other
  failure is a `JXAExecutionError` carrying script, stdout, stderr, exit code, signal,
  `timedOut` and `timeoutMs`. `wrapJXAFunction` wraps a body in try/catch and prints
  `{"success":false,"error":…}`, which the runner turns back into a thrown error. A test-only
  `_runWithChild` seam swaps in `/bin/bash` with `trap '' TERM` to prove the escalation.
  `a977f72` adds a `bunfig.toml` preload that `process.exit(1)`s an integration run after
  10 minutes.
- **Evidence:** `97d5918`, `a8283e2`, `a977f72`
- **Quality of the fix:** partial. The process handling is good. But the runner takes a
  *whole script string*, so every caller still builds code from input (see C3 and C4). It
  doesn't recognise the "not authorised" error (-1743, errAEEventNotPermitted), so a missing
  Automation permission surfaces as raw stderr, not as a named failure. The German pattern
  shows how brittle stderr matching is across locales.
- **Verdict:** adopt the idea (timeout → terminate → force-kill, typed failure carrying
  exit/signal/timed-out, and the ignore-SIGTERM test double) for the `automation` adapter
  *and* for the Swift helper's supervisor. Reject matching localized stderr text. Classify by
  OSStatus number instead.
- **Scenarios:**
  - [contract] `the automation runner` — `given a script that outlives its time budget,
    reports a timeout and leaves no process behind`
  - [contract] `the automation runner` — `given a child that ignores the polite stop, still
    ends it after the grace period`
  - [contract] `the automation runner` — `given the target app refuses Apple Events,
    reports a missing Automation permission that names the app`

### C2 Upstream's AppleScript string splicing replaced by escaped JXA literals

- **Kind:** hardening
- **Context:** cross-cutting (calendar, reminders, contacts, messages, notes, mail)
- **Symptom:** A quote or backslash in a message, email subject, note title or event name
  broke the script or ran as code (upstream's injection hole).
- **Root cause:** `upstream/main` escapes only `"` before splicing:
  `utils/message.ts:75-78` (`buddy "${phoneNumber}"` is not escaped at all),
  `utils/mail.ts:299-304`, `utils/calendar.ts:284-291`, `utils/notes.ts:157` (search term not
  escaped). A trailing backslash breaks out of the literal.
- **Technique:** every util (`calendar`, `contacts`, `mail`, `maps`, `music`, `notes`,
  `photos`, `reminders`) has its own copy of `escapeJXAString`, which escapes `\`, `"`, CR,
  LF and TAB. The value is then placed inside `"…"` in a template-literal JXA script. Messages
  send uses `JSON.stringify(value)` instead (`utils/message.ts:423-424`). Numbers pass through
  `Math.trunc` and enums are checked in `index.ts`. `run-applescript` and `@jxa/run` are
  dropped from `package.json`.
- **Evidence:** `d76f3ec` (migration), `96759b3` (messages); unit tests "escapes …" in
  `utils/*.test.ts`
- **Quality of the fix:** partial. It is sound where the escaped value is interpolated
  directly. Modern JavaScriptCore accepts U+2028/U+2029 inside string literals, and no other
  character ends a double-quoted literal. But (a) it is 8 hand-copied functions plus a 9th in
  `tests/integration/helpers/cleanup-jxa.ts`, (b) it moved *away* from `ec3018b`'s `@jxa/run`,
  which passed arguments as JSON, and (c) C3 and C4 show two sites where later string
  manipulation undoes it. The tests only check that quotes and newlines come out escaped, so
  they miss both holes.
- **Verdict:** reject the technique. It proves exactly why the plan says "scripts are static
  files, values arrive only as JSON arguments". Escaping is a property of every call site, and
  this fork still lost it at two of them.
- **Scenarios:**
  - [contract] `the automation runner` — `given any value containing quotes, backslashes,
    line breaks or dollar patterns, delivers it to the script unchanged`
  - [acceptance] `creating a note` — `given a title that looks like script code, stores it as
    the literal title`

### C3 ALARM: code execution through contact phone, email and URL values

- **Kind:** hardening (regression the fork introduced)
- **Context:** contacts
- **Symptom:** none visible. A prompt-injected `contacts` `create` or `update` can run arbitrary
  JXA, including `doShellScript`, as the user.
- **Root cause:** `utils/contacts.ts:433` in the fork:
  `wrapValue.replace("{v}", escapedValue)`. A *string* passed as the replacement to
  `String.prototype.replace` expands `` $` `` (the text before the match, here `$("`) and `$'`
  (the text after it, here `")`). Escaping ran first, so the quotes these patterns bring in are
  raw.
- **Technique (of the hole):** phone/email/URL value `` $',globalThis.PWNED=1,$` `` produces
  `$.CNLabeledValue.labeledValueWithLabelValue($("_$!<Work>!$_"), $(""),globalThis.PWNED=1,$(""))`.
  Reproduced by evaluating the exact generated line in Node, where `PWNED` became `1`. The
  payload only needs to avoid `"` and `\`, and single quotes are free. It is reachable through
  `phones`/`emails`/`urls` as an array *or* as the string shorthand, on both `create` and
  `update` (`index.ts` `isContactsArgs` checks only that the field is a string or an array).
  The same replace corrupts ordinary data too: a value containing `$&` or `$$` is silently
  altered.
- **Evidence:** `2483f04` (introduced), `a77212a`, `5c01104` (kept)
- **Quality of the fix:** wrong
- **Verdict:** reject. It also argues for a scenario that feeds `$`-replacement patterns
  through every write path.
- **Scenarios:**
  - [acceptance] `saving a contact` — `given a phone number containing text that looks like
    script, stores exactly that text or refuses it, and runs nothing`

### C4 ALARM: code execution through the Notes account and folder scope

- **Kind:** hardening (regression the fork introduced)
- **Context:** notes
- **Symptom:** none visible. A `notes` `list` or `search` call with a crafted `accountName` and
  `folderName` runs arbitrary JXA.
- **Root cause:** `utils/notes.ts:137-141` in the fork fills a template with two chained
  `.replace` calls: `ACCOUNT_NAME_LITERAL`, then `FOLDER_NAME_LITERAL`. If the account name
  *contains* the text `FOLDER_NAME_LITERAL`, the second replace lands inside the
  already-quoted account literal and splices the folder literal (with its own quotes) there.
- **Technique (of the hole):** `accountName: "a FOLDER_NAME_LITERAL b"`,
  `folderName: "+(globalThis.PWNED=1)+"` produces
  `const accountName = "a "+(globalThis.PWNED=1)+" b";`. Reproduced in Node: `PWNED` became
  `1` before the next line threw `ReferenceError`. `isNotesArgs` only requires non-empty
  strings.
- **Evidence:** `05d1658`
- **Quality of the fix:** wrong
- **Verdict:** reject
- **Scenarios:**
  - [acceptance] `listing notes in a folder` — `given an account name that contains
    placeholder or script-like text, looks it up as a literal name and runs nothing`

### C5 ALARM: reading a reminder list calls any method name the caller supplies

- **Kind:** hardening (hole kept from `ec3018b`)
- **Context:** reminders
- **Symptom:** `reminders` `listById` with `props: ["delete"]` would invoke `delete` on every
  reminder in the list (*verify*). Any other command on the reminder specifier is also callable.
- **Root cause:** fork `utils/reminders.ts:185-188`:
  `const value = typeof candidate === "function" ? reminder[prop]() : candidate;` with `props`
  straight from tool input. `ec3018b` had the same shape, but in bulk (`list[prop]()`).
  `upstream/main` ignores `props` (`utils/reminders.ts:345`). The unit test
  "getRemindersFromListById escapes the list id and props" pins arbitrary prop names as accepted.
- **Technique:** none. The fork kept it and lost `ec3018b`'s bulk fetch (it now calls every prop
  per reminder).
- **Evidence:** `d76f3ec`
- **Quality of the fix:** wrong
- **Verdict:** reject. *verify*: `props: ["delete"]` deletes reminders on macOS 14+.
- **Scenarios:**
  - [domain] `a reminder field selection` — `given a field name outside the known reminder
    fields, refuses: field names never become calls`

### C6 Failures that come back as "nothing found"

- **Kind:** fix (missing), recorded as an anti-pattern
- **Context:** cross-cutting (messages, calendar, contacts, notes)
- **Symptom:** Without Full Disk Access, `messages read` says "No messages found". With Calendar
  access denied, `calendar list` says "No events found". The agent can't tell an empty result
  from a broken one.
- **Root cause:** kept from upstream (e.g. `utils/mail.ts` `catch` returning `[]` at
  `upstream/main`).
- **Technique:** unchanged. Fork `utils/message.ts:337-344` catches every error from
  `better-sqlite3` (including `SQLITE_CANTOPEN` for a TCC denial) and returns `[]`.
  `searchEvents`/`getEvents` return `[]` when the access check fails. `searchContacts` returns
  `[]` when access fails. Permission hints that do exist point at "System Preferences > Security
  & Privacy" (pre-Ventura naming) or "Automation" for everything.
- **Evidence:** `96759b3`, `d76f3ec`
- **Quality of the fix:** wrong
- **Verdict:** reject. Supports non-negotiables 3 and 5.
- **Scenarios:**
  - [acceptance] `reading a chat` — `given the message store can't be opened for lack of Full
    Disk Access, reports that permission by name instead of an empty chat`
  - [acceptance] `listing events` — `given calendar access is denied, reports the missing
    permission and where to grant it`

### C7 Messages are read through chats, so group chats and your own replies appear

- **Kind:** fix
- **Context:** messages
- **Symptom:** Reading a conversation missed group chats and messages you sent. Tapbacks
  showed up as messages. There was no date filter.
- **Root cause:** `upstream/main` `utils/message.ts:281-303` joins `message` to `handle` via
  `m.handle_id` only, and shells out to `sqlite3` (`:244`, `:308`) with values quoted by hand
  (`:274`).
- **Technique:** `better-sqlite3` opened `readonly` with `query_only = ON`, prepared statements
  with `?` placeholders (lists expand to `?,?,…`). Handle IDs → `chat_handle_join` → chat
  ROWIDs. Then `message` ⋈ `chat_message_join` ⋈ `chat`, `LEFT JOIN handle` for the sender,
  `m.associated_message_type = 0` to drop tapbacks/reactions, and optional start/end compared
  on `datetime(m.date/1e9 + 978307200, 'unixepoch', 'localtime')`. Each row carries
  `chat.display_name` as group name, `chat.chat_identifier`, and attachment filenames from
  `attachment` ⋈ `message_attachment_join` when `cache_has_attachments`. Unread uses
  `is_from_me = 0 AND is_read = 0`.
- **Evidence:** `96759b3`; upstream #62 (can't read messages)
- **Quality of the fix:** partial. It merges every chat the handle belongs to (1:1 and every
  group) into one list, so "a chat" isn't a unit the agent can address. The date filter compares
  local-time strings. The `better-sqlite3` native addon forced the build switch in C30.
  `node:sqlite` avoids that.
- **Verdict:** adopt the idea (read-only, prepared statements, chat-centred joins, tapback
  filter, Apple epoch in nanoseconds, attachments listed). Reject merging all of a handle's
  chats into one stream.
- **Scenarios:**
  - [contract] `the message store` — `given a person who is in a group chat and a direct chat,
    lists the two as separate chats`
  - [domain] `a message timestamp` — `given nanoseconds since 2001-01-01, reports the same
    instant in UTC`
  - [contract] `the message store` — `given a reaction to a message, does not list it as a
    message`
  - [acceptance] `reading a chat` — `given messages the user sent, includes them marked as
    from me`

### C8 Numbers outside the US and email handles find their conversations

- **Kind:** fix
- **Context:** messages
- **Symptom:** Every read for a German (+49), Moroccan (+212) or email/iMessage-ID contact came
  back empty, "despite 1700+ messages in the DB".
- **Root cause:** `upstream/main` `utils/message.ts:39-70` `normalizePhoneNumber` assumes US
  numbers and prefixes `+1` to anything else. Email handles become `+1…`.
- **Technique:** `resolveHandleIds` asks the `handle` table itself: (1) exact `id IN (…)` over
  candidate formats (E.164 as-is, a leading `0` becomes `+49…`, 10 digits becomes `+1…`,
  otherwise `+digits`). (2) If that fails and there are ≥ 6 digits, a `LIKE '%digits%'` over
  `id` with spaces, dashes and parentheses stripped. (3) For anything with `@` or a leading
  letter (service IDs like `o2Business`), `id LIKE ?`.
- **Evidence:** `4e257c8`, `96759b3`
- **Quality of the fix:** partial. `+49` for a leading `0` is the author's locale hard-coded.
  The substring fallback can match other people's numbers, and it silently merges several
  handles. `LIKE ?` doesn't escape `%`/`_` from input, so `a%` matches every handle starting
  with `a`.
- **Verdict:** adopt the idea: resolve against the store's own `handle.id` values, and treat
  email and alphanumeric sender IDs as first-class handles. Reject the default country and the
  fuzzy fallbacks. Normalise with the user's region, and on ambiguity return candidates instead
  of merging.
- **Scenarios:**
  - [domain] `a phone number` — `given a national number and the user's region, normalises it
    to E.164`
  - [contract] `the message store` — `given an email address the user has messaged, finds that
    handle`
  - [acceptance] `reading a chat` — `given digits that match several people's handles, refuses
    and lists the candidates: never merges two people`
  - [contract] `the message store` — `given a handle pattern with wildcard characters, matches
    them literally`

### C9 Message text recovered from `attributedBody` without a hex regex

- **Kind:** fix
- **Context:** messages
- **Symptom:** Messages that have only `attributedBody` (most on recent macOS) came back
  garbled, with umlauts and emoji broken.
- **Root cause:** `upstream/main` `utils/message.ts:153-229` hex-encodes the blob in SQL and
  pattern-matches printable runs.
- **Technique:** fork `utils/message.ts:131-167` finds the bytes `NSString` (else
  `NSMutableString`), skips 5 bytes, then reads a length: one byte, or `0x81` followed by a
  2-byte little-endian length. It decodes that many bytes as UTF-8. `text` wins unless it is
  U+FFFC (the object-replacement placeholder).
- **Evidence:** `96759b3`
- **Quality of the fix:** partial. It is a marker heuristic, not a typedstream decoder: no
  `0x82` (4-byte) lengths, a fixed 5-byte preamble, and it takes the first `NSString` in the
  archive. Better than a regex. Still not what the plan asks for.
- **Verdict:** adopt the idea as test data (umlaut, emoji, 0x81-length bodies). *verify* the
  preamble and length encodings against real blobs, then build the real decoder the plan
  specifies.
- **Scenarios:**
  - [domain] `a message body archive` — `given a body longer than 255 bytes, decodes the full
    text`
  - [domain] `a message body archive` — `given text with umlauts and emoji, decodes it
    unchanged`
  - [domain] `a message body archive` — `given only the object-replacement placeholder in
    plain text, reads the text from the archive`

### C10 Sending a message no longer splices text into AppleScript

- **Kind:** hardening
- **Context:** messages
- **Symptom:** Upstream's send broke on (or executed) quotes and backslashes in the message or
  recipient (upstream #24).
- **Root cause:** `upstream/main` `utils/message.ts:74-78`.
- **Technique:** JXA with `JSON.stringify` literals. Finds the first service with
  `serviceType: "iMessage"`, then `buddies.whose({handle: phoneNumber})`, and throws "No
  Messages buddy found" if there is none. Then `Messages.send`. `schedule` is an in-process
  `setTimeout` that is lost on restart.
- **Evidence:** `d76f3ec` (bridge), unit test "sendMessage executes a bridge-backed JXA script"
- **Quality of the fix:** partial. Injection-safe. But there is no confirmation, no check that
  the message reached `chat.db`, the tool says "Message sent" whatever Messages did, the handle
  isn't normalised (so the buddy lookup misses on formatting), and a scheduled send claims
  success for something that may never happen.
- **Verdict:** adopt the idea (recipient must resolve to an existing buddy/handle before
  sending). Reject the unconfirmed success and the in-memory scheduler. *verify* that
  `services`/`buddies` still resolve in the Messages dictionary on macOS 14–26 (newer
  dictionaries name these `accounts`/`participants`).
- **Scenarios:**
  - [acceptance] `sending a message` — `given a recipient with no existing conversation,
    refuses and names the closest known handles`
  - [acceptance] `sending a message` — `given Messages accepted the send but the store shows no
    new outgoing message, reports the outcome as unconfirmed`

### C11 Notes scoped to an account and folder, with an ambiguity error

- **Kind:** feature
- **Context:** notes
- **Symptom:** With several Notes accounts (iCloud, Exchange, On My Mac), same-named folders
  ("Notes") collided. List and search always read everything, and create picked the first folder
  with a matching name.
- **Root cause:** `upstream/main` `utils/notes.ts:86-96` iterates `notes` of the application,
  and `:249-275` finds a folder by name across all accounts.
- **Technique:** `Notes.accounts.whose({name})()` → `account.folders.whose({name})()` →
  `.notes()`. With only a folder name, it collects matches across all accounts and throws
  "Folder … exists in multiple accounts (A, B). Specify accountName" when there is more than
  one. A missing account or folder throws, and doesn't return empty. New `accounts` and
  `folders` operations. Create takes `accountName`. Unscoped search keeps
  `Notes.notes.whose({_or:[{name:{_contains}},{plaintext:{_contains}}]})` (full-content search)
  and falls back to loading every note and matching on title.
- **Evidence:** `05d1658`; upstream #67 (content search), PR #28 (notes by folder)
- **Quality of the fix:** partial. The implementation is injectable (C4), and results carry no
  note id, account or folder, so a note can't be addressed afterwards. Create still
  auto-creates a "Claude" folder and echoes the input back as the created note, with no
  read-back. The fallback loads every note body.
- **Verdict:** adopt the idea: account → folder → note containment, a same-named folder in two
  accounts is ambiguous and refused, missing containers are errors. *verify* `whose` on
  `plaintext` works on macOS 14–26 (upstream #44 "whose is not a function").
- **Scenarios:**
  - [acceptance] `listing notes in a folder` — `given a folder name that exists in two
    accounts and no account, refuses and names both accounts`
  - [acceptance] `listing notes in a folder` — `given an account that doesn't exist, reports
    it as unknown rather than an empty folder`
  - [acceptance] `searching notes` — `given text that appears only in a note's body, finds that
    note`
  - [acceptance] `creating a note` — `given a folder that doesn't exist, refuses rather than
    creating the folder`

### C12 Contacts: full records with labelled phones, emails, URLs, addresses and birthday

- **Kind:** feature
- **Context:** contacts
- **Symptom:** Upstream returns names and phone numbers only (upstream #75, #47), and has no
  create/update/delete.
- **Root cause:** `upstream/main` `utils/contacts.ts:61-100` reads `phones of person` only.
- **Technique:** search by name (`whose name _contains`, then first/last name), by email or
  phone (full scan in the script), max 50. Each record has id, names, organization, job title,
  department, birthday `YYYY-MM-DD`, and `{label,value}` lists. Create, update (replaces whole
  multi-value fields) and delete by id. After a write it reads the contact back so the result
  shows persisted values, not the input.
- **Evidence:** `2483f04`, `a77212a`, `5fa172e` (var-hoisting bug that emptied fields),
  `5c01104`
- **Quality of the fix:** partial. Create reads back by *name*: it takes the first contact whose
  last name equals the new one and whose first name matches. With a pre-existing namesake it
  returns **someone else's id**, and a follow-up delete would delete the wrong person. Phone
  search also matches when either number is a substring of the other, so an empty or short
  normalised number matches many people. Unknown labels are silently written as "work".
- **Verdict:** adopt the idea (full records, labelled values, read-back after write). Reject the
  name-based read-back and substring phone matching. Contacts.framework returns the saved
  identifier directly.
- **Scenarios:**
  - [acceptance] `finding a contact` — `given a person with emails and no phone, returns the
    emails`
  - [acceptance] `creating a contact` — `given an existing contact with the same name, reports
    the new contact's own identifier`
  - [domain] `a phone number match` — `given two numbers that share only a suffix, does not
    treat them as the same number`
  - [acceptance] `updating a contact` — `given a label the address book doesn't know, refuses
    rather than relabelling the value`

### C13 Contact writes go through Contacts.framework because the scripting bridge drops phones

- **Kind:** fix
- **Context:** contacts
- **Symptom:** Creating or updating a contact reported success, but the phone numbers never
  appeared. Emails, URLs and addresses did.
- **Root cause:** claimed macOS scripting-bridge bug: `person.phones.push()` doesn't persist,
  in JXA or in AppleScript.
- **Technique:** inside osascript, `ObjC.import("Contacts")`, `CNMutableContact`,
  `CNLabeledValue` built into an `NSMutableArray` via `addObject` (a JS array literal is
  coerced to `__NSDictionaryM` and CNContact rejects it), `CNSaveRequest`,
  `executeSaveRequestError`. Update/delete fetch with
  `predicateForContactsWithIdentifiers([id])`. The final code passes the scripting-bridge id
  `UUID:ABPerson` unchanged, after `a77212a` first stripped `:ABPerson` and a round-trip test in
  `5c01104` showed that matched nothing.
- **Evidence:** `a77212a`, `5c01104` (integration test "create → delete round-trip with the
  returned ID")
- **Quality of the fix:** complete for the symptom. Using the ObjC bridge from osascript works,
  but this is exactly the job of the plan's Swift helper.
- **Verdict:** *verify*: (1) scripting-bridge `phones.push` doesn't persist on macOS 14–26;
  (2) a scripting-bridge person id equals `CNContact.identifier` including `:ABPerson`. Both
  support "Contacts via Contacts.framework".
- **Scenarios:**
  - [contract] `the address book` — `given a new contact with two labelled phone numbers, reads
    both back after saving`
  - [contract] `the address book` — `given the identifier returned by a save, finds and deletes
    that same contact`

### C14 Contact labels translated to Apple's sentinels, including the FAX quirk

- **Kind:** fix
- **Context:** contacts
- **Symptom:** Clients saw raw labels like `_$!<Mobile>!$_`. Writing "workFax" produced an
  "Assistant" label.
- **Root cause:** Contacts stores well-known labels as sentinel strings. The scripting bridge
  expects the legacy uppercase `_$!<WorkFAX>!$_`, not the CN constant form `_$!<WorkFax>!$_`.
  Writing the CN form silently falls back to `_$!<EX-AssistantPhone>!$_` ("empirically verified
  2026-05-08").
- **Technique:** a two-way map (`work`, `home`, `other`, `mobile`/`iphone`, `main`,
  `workFax`/`homeFax`/`otherFax`, bare `fax` → WorkFAX). Reads map both FAX spellings back,
  and pass unknown custom labels through unchanged. The map is embedded as a JXA lookup
  function in read scripts.
- **Evidence:** `5c01104` (tests "createContact translates fax labels…", "userLabelForCNLabel
  translates known sentinels and passes unknown labels through")
- **Quality of the fix:** partial. Only phone labels are covered. Email/URL/address labels
  (`iCloud`, `school`, `homepage`) fall back to `work` on write.
- **Verdict:** adopt the idea: label vocabulary is a domain rule with a fixed two-way
  translation, and custom labels round-trip. *verify* whether Contacts.framework (not the
  scripting bridge) accepts the CN-constant FAX form. The quirk may belong to the bridge only.
- **Scenarios:**
  - [domain] `a contact detail label` — `given Apple's mobile sentinel, reports it as mobile`
  - [domain] `a contact detail label` — `given a custom label, reports it unchanged`
  - [contract] `the address book` — `given a work fax number, reads it back labelled work fax`

### C15 The contact note field is refused

- **Kind:** hardening
- **Context:** contacts
- **Symptom:** Reading notes returned empty strings, and writing one could crash `osascript`
  (SIGSEGV).
- **Root cause:** `CNContactNoteKey` needs the restricted `com.apple.developer.contacts.notes`
  entitlement, which Apple grants only to reviewed, signed apps.
- **Technique:** `note` removed from the type, schema and handler. The tool description explains
  why. `tests/contacts-schema.test.ts` pins that the schema has no `note` and the description
  says so.
- **Evidence:** `5c01104`
- **Quality of the fix:** complete
- **Verdict:** adopt the idea, and *verify* that the Swift helper, unsigned or ad-hoc signed,
  also can't read notes (and that asking for the key fails cleanly rather than crashing).
- **Scenarios:**
  - [acceptance] `reading a contact` — `never offers a contact note: macOS reserves it for
    entitled apps`

### C16 Listing every phone number reads the address book in one bulk call

- **Kind:** fix (performance)
- **Context:** contacts
- **Symptom:** Listing contacts or looking up a sender's name took minutes with ~3,000 contacts,
  and `messages unread` did this once per message.
- **Root cause:** `upstream/main` `utils/contacts.ts:61-100` loops over every person and every
  phone, one Apple Event per property.
- **Technique:** `Contacts.people.name()` and `Contacts.people.phones.value()` return parallel
  arrays in two Apple Events ("minutes → 3 s for 3160 contacts").
- **Evidence:** `d76f3ec`
- **Quality of the fix:** complete for scripting. Moot under Contacts.framework.
- **Verdict:** reject for the architecture (Contacts goes through the Swift helper). Keep as the
  general JXA lesson: fetch a property over a whole element list, never per element. That
  applies to Notes and Mail if they stay on JXA.
- **Scenarios:**
  - [acceptance] `listing unread messages` — `given many unread messages from the same person,
    resolves that person's name once`

### C17 Calendar events are real, recurring events expanded, scoped by calendar

- **Kind:** fix
- **Context:** calendar
- **Symptom:** `upstream/main` returns a fake "No events available - Calendar operations too
  slow" event and an empty search (upstream #74, #25). On Exchange, `whose` took 15–90 s per
  calendar. Recurring events appeared once, at their first date.
- **Root cause:** `upstream/main` `utils/calendar.ts:97-114` and `:176-181` are stubs. Calendar
  scripting doesn't expand recurrences.
- **Technique:** per calendar (optionally only `calendarName`), `events.whose({_and:[{startDate:
  {_lessThan: rangeEnd}},{endDate:{_greaterThan: rangeStart}}]})`, capped at 200 per calendar.
  Search uses `summary _contains` only ("_or doubles the time"). Recurring events are expanded
  in the script by parsing `recurrence()` (RRULE `FREQ` DAILY/WEEKLY/MONTHLY/YEARLY, `INTERVAL`,
  `UNTIL`, `COUNT`). Results are sorted by start. Timeout 300 s. Tool descriptions tell the agent
  to pass `calendarName`.
- **Evidence:** `d76f3ec`, `0ec1adc` (logging only)
- **Quality of the fix:** partial. As the code comment admits, a recurring series that *started*
  before the range isn't found by the overlap query. `BYDAY`, `BYMONTHDAY`, `EXDATE` and
  modified occurrences are ignored, so weekly Mon/Wed/Fri meetings show only Mondays and
  cancelled occurrences still show. A cap of 200 per calendar truncates silently. Access
  failure returns `[]` (C6).
- **Verdict:** reject the mechanism (EventKit expands occurrences natively). Adopt the domain
  lessons: occurrences not series, overlap semantics for the range, scope by calendar, no
  silent truncation. Evidence for "Calendar via EventKit".
- **Scenarios:**
  - [acceptance] `listing events` — `given a weekly series that began before the range, lists
    each occurrence inside the range`
  - [acceptance] `listing events` — `given a cancelled occurrence of a series, leaves it out`
  - [domain] `a time range` — `given an event that starts before the range and ends inside it,
    counts it as in range`
  - [acceptance] `listing events` — `given more events than the limit, says the list is
    truncated`

### C18 Creating a calendar event with escaped fields in a named calendar

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Upstream's create spliced title, location and notes into AppleScript, and parsed
  dates through `toLocaleString()`.
- **Root cause:** `upstream/main` `utils/calendar.ts:270-291`.
- **Technique:** JXA `Calendar.Event({summary,startDate,endDate,location,description,
  alldayEvent})`, `targetCalendar.events.push`, then reads `uid`. No `calendarName` means the
  first calendar. An unknown `calendarName` returns "not found".
- **Evidence:** `d76f3ec`
- **Quality of the fix:** partial. "First calendar" can be read-only (Birthdays, subscribed).
  There is no read-back beyond the uid, and `new Date(string)` interprets an ISO time without
  an offset as local time without saying so.
- **Verdict:** adopt the idea (unknown calendar refused). Reject "first calendar" as the
  default. Use the store's default calendar for new events, and refuse read-only calendars.
- **Scenarios:**
  - [acceptance] `creating an event` — `given a calendar name that doesn't exist, refuses and
    lists the writable calendars`
  - [domain] `an event time` — `given a date-time without an offset, interprets it in the
    user's time zone and says so`

### C19 Reminders list names instead of every reminder

- **Kind:** fix (performance)
- **Context:** reminders
- **Symptom:** "list" loaded all 272+ reminders and timed out (upstream #53).
- **Root cause:** `ec3018b` `utils/reminders.ts:105-140` read every reminder of every list.
  `upstream/main` gave up (`utils/reminders.ts:148-166` returns `[]`).
- **Technique:** `list` without `listName` returns `{name,id}` of each list, with "Use list with
  listName". With `listName` it returns that list's reminders. Search and create are ported
  from `ec3018b` (`whose` `_or` name/body, create in a named list with `dueDate`, returns fields
  read from the new reminder). Create *auto-creates* the list when the name doesn't match.
  `open` only activates Reminders but reports "Opened Reminders app. Found reminder: …".
- **Evidence:** `d76f3ec`; upstream #53, #64 (create with time works here, while
  `upstream/main` `:256-279` ignores list and due date and returns id `"created-reminder-id"`)
- **Quality of the fix:** partial. A typo in a list name silently creates a new list. `open`
  overstates what happened. Completed and incomplete reminders are mixed with no filter.
- **Verdict:** adopt the idea (lists first, reminders per list). Reject creating lists as a side
  effect.
- **Scenarios:**
  - [acceptance] `listing reminder lists` — `reports each list's name without loading its
    reminders`
  - [acceptance] `creating a reminder` — `given a list name that doesn't exist, refuses and
    names the existing lists`
  - [acceptance] `creating a reminder` — `given a due time, reads it back from the store at the
    same instant`

### C20 Mail: accounts, a mailbox tree with paths, and counts only when asked

- **Kind:** feature
- **Context:** mail
- **Symptom:** Upstream listed flat mailbox names only. On Exchange/M365 accounts with ~600
  mailboxes, anything that counted messages timed out.
- **Root cause:** `upstream/main` `utils/mail.ts:430-450` returns names. Counting requires
  touching every message.
- **Technique:** `accountSummaries` (name, id, type, addresses, enabled) and `accountDetails`
  (server, port, SSL, auth, full name, account directory, delivery account). `mailboxTree` has
  `mailboxStructure: flat|nested` (nested rebuilds parents by walking `container()` to the
  account, joins names with `/`, compares paths after NFC normalisation) and
  `mailboxCounts: none|unread|all` (default none). `timeoutMs` is clamped to 1–300 s.
  `mailboxProps` covers one mailbox. Mailboxes resolve by `/` path: `whose({name: leaf})` then
  compare the rebuilt path, falling back to a breadth-first walk.
- **Evidence:** `8a9b013`, `5bee2f6`, `6361803`, `5c01104`
- **Quality of the fix:** partial. `/` in a mailbox name makes paths ambiguous. Fields come
  from `typeof account.x === "function"` guesses and read as `""`/`0` when missing, so absent
  and empty look the same.
- **Verdict:** adopt the idea (accounts and mailboxes addressed by path within an account,
  counts opt-in, NFC comparison). *verify* whether the Envelope Index gives the tree and counts
  without scripting.
- **Scenarios:**
  - [acceptance] `listing mailboxes` — `given nested mailboxes, reports each with its path
    inside its account`
  - [domain] `a mailbox path` — `given the same name in decomposed and composed Unicode, treats
    them as one path`
  - [acceptance] `listing mailboxes` — `without being asked for counts, reports none rather
    than scanning messages`

### C21 Mail: unread from each account's inbox, not from every mailbox

- **Kind:** fix (performance)
- **Context:** mail
- **Symptom:** "Unread" scanned all 634 mailboxes of an Exchange account (30 s timeout).
- **Root cause:** `upstream/main` `utils/mail.ts:86-100` repeats over every mailbox.
- **Technique:** per account (or one named account), look up the inbox with
  `mailboxes.whose({name})` trying `INBOX`, `Posteingang`, `Inbox`, else take the first mailbox.
  Then `messages.whose({readStatus:false})()`. "30 s → 564 ms". `latest` without an account
  uses the first account.
- **Evidence:** `d76f3ec`; upstream #69/#58 (no mail found)
- **Quality of the fix:** partial. Localised inbox names are a hard-coded list (German only).
  The first-mailbox fallback can be anything. "Latest" silently means "first account's
  mailboxes in order", not newest.
- **Verdict:** adopt the idea (inbox per account, filtered with `whose` on read status). Reject
  name guessing. *verify* whether Mail's `inbox` property or the Envelope Index identifies
  inboxes regardless of language.
- **Scenarios:**
  - [acceptance] `listing unread mail` — `given an account whose inbox has a localised name,
    finds that inbox`
  - [acceptance] `listing the latest mail` — `across accounts, orders messages newest first`

### C22 Mail: message metadata without bodies, keyset pages, stable references and links

- **Kind:** feature
- **Context:** mail
- **Symptom:** Listing messages pulled bodies (slow, and a prompt-injection surface) and had no
  way to page. Nothing identified a message for a follow-up action.
- **Root cause:** `upstream/main` `utils/mail.ts:487-521` reads content for every message it
  lists.
- **Technique:** `messageMetadata` returns subject, sender, dateSent, read, flag (`flagIndex`
  -1…6 → none/red/…/gray), mailbox path, optional attachment names/count, and **no content**.
  Each message carries a `messageReference` {`mailObjectId` (Mail's scripting id), `messageId`
  (RFC 5322 Message-ID without brackets), accountId, accountName, mailboxPath, dateSent,
  dateReceived, sender, subject, messageSize}. There is also a `message:%3C…%3E` deep link.
  Pagination: sort `dateSentDesc|Asc`, limit ≤ 200, and a cursor `{dateSent, mailObjectId}` with
  ties broken by id. The result has `hasMore`, `scannedCount`, `returnedCount`, `nextCursor`.
  Headers can be included and filtered by name (`headerFilter`, case-insensitive, folded
  continuation lines kept). Results go out as `structuredContent` (`9121ab3`).
- **Evidence:** `51e80da`, `0d6918a`, `cc303ee`, `47cab04`, `5a2ae64`, `7212c6d`, `9121ab3`;
  tests `tests/mail-header-filter.test.ts`, `utils/mail.test.ts` "listMessageMetadata uses
  mailbox paths and omits message content"
- **Quality of the fix:** partial. Each page still loads, filters and sorts *every* message in
  the mailbox inside JXA, so it's keyset pagination over O(n) work. `mailObjectId` is only
  stable while Mail's local store is (*verify*). Other operations (unread, messages) still
  return raw extra top-level fields (`emails`, `reminders`) that the MCP spec ignores.
- **Verdict:** adopt the idea: list metadata without bodies by default, give each message a
  reference (Message-ID plus account and mailbox), page with a cursor, return structured
  content.
- **Scenarios:**
  - [acceptance] `listing mail in a mailbox` — `returns no message bodies unless asked: bodies
    are untrusted text`
  - [acceptance] `listing mail in a mailbox` — `given a next-page cursor, continues after the
    last message without repeats or gaps`
  - [domain] `a message reference` — `given a Message-ID in angle brackets, stores it without
    the brackets`
  - [domain] `a header selection` — `given a folded header and a requested name in different
    case, keeps the whole header`

### C23 Mail: searching a mailbox requires a date window

- **Kind:** feature
- **Context:** mail
- **Symptom:** The global `search` read the content of every message in every mailbox of every
  account (upstream #30, #19 "search fails").
- **Root cause:** `upstream/main` `utils/mail.ts:182-215`, the same shape the fork keeps as
  `searchMails`.
- **Technique:** `searchMetadata` requires account, mailbox, `startDate` **and** `endDate`, and
  matches the term (case-insensitive) against subject, sender and optionally attachment names,
  never bodies. Same page shape as C22.
- **Evidence:** `5ce2351`; test "searchMessageMetadata requires an explicit date window"
- **Quality of the fix:** partial. The legacy unbounded `search` is still exposed next to it.
- **Verdict:** adopt the idea: a scoped search must name its account, mailbox and time window.
- **Scenarios:**
  - [acceptance] `searching mail` — `given no date window, refuses: an unbounded scan never
    finishes on large accounts`
  - [acceptance] `searching mail` — `given a term that appears only in an attachment name,
    finds the message when attachment names are searched`

### C24 Mail: flagging and moving one referenced message, with a dry run

- **Kind:** feature
- **Context:** mail
- **Symptom:** No way to triage mail (flag, file) from an agent.
- **Root cause:** not in upstream.
- **Technique:** `setMessageFlag(account, mailbox, mailObjectId, color)` finds the message by
  scanning `mailbox.messages()` for a matching `id()`. It sets `flagIndex` and `flaggedStatus`,
  and returns `{previous, current}` read from the message object after the write.
  `moveMessage(… targetMailbox, dryRun)` resolves both mailboxes by path in the same account,
  runs `Mail.move(message, {to})` unless `dryRun`, and returns `moved: !dryRun` with source and
  target paths.
- **Evidence:** `fa7e5f9`, `59d3aa3`
- **Quality of the fix:** partial. "current" is read from the same in-memory specifier, not
  re-fetched. `moved` is asserted, not checked (the message isn't looked up in the target
  afterwards). The linear id scan is slow on big mailboxes, where `whose({id})` would do.
- **Verdict:** out of v1 scope (v1 mail is read, drafts, confirmed send). Adopt the dry-run
  idea and the before/after report for any later write.
- **Scenarios:**
  - [acceptance] `moving a message` — `given a dry run, reports source and destination and
    changes nothing`

### C25 Mail: exporting a message and its attachments to a directory the caller names

- **Kind:** feature
- **Context:** mail
- **Symptom:** No way to hand an email's `.eml` and attachments to another tool.
- **Root cause:** not in upstream.
- **Technique:** writes `<base>/<ISO time>-<mailObjectId>-<sanitised subject>/` containing
  `<subject>.eml` (`message.source()` via `NSString.writeToFile`) and each attachment via
  `Mail.save(attachment, {in: Path(p)})`. File names strip `\/:*?"<>|,`, are capped at 140
  characters and de-duplicated with a " 2" suffix. `dryRun` supported. Default base
  `/tmp/apple-mcp-mail-exports`. `de6b9f6` removed a "documentsOnly"/"skipInlineImages" filter
  (invoice/receipt heuristics) to keep the server generic.
- **Evidence:** `db82ca5`, `e64a658`, `de6b9f6`
- **Quality of the fix:** partial. `exportDirectory` is any path the process can write, so a
  prompt-injected call can put attacker-supplied attachment bytes anywhere under `$HOME`.
  Attachments that were never downloaded are reported as exported whenever `Mail.save` doesn't
  throw.
- **Verdict:** out of v1 scope. If revisited, reject caller-chosen directories: export only
  into a configured folder.
- **Scenarios:**
  - [acceptance] `exporting a message` — `given a destination outside the configured export
    folder, refuses`

### C26 Mail: mailbox create/rename/move/delete added, then retired as unreliable

- **Kind:** feature, then reverted
- **Context:** mail
- **Symptom:** Structural mailbox operations "are unreliable through Apple Mail Automation on
  Exchange/M365 accounts".
- **Root cause:** claim only, no code evidence of the failure.
- **Technique:** added in `016aeaf` and validated in `2465ad5`. `5c01104` removed them from the
  schema. The dispatcher still accepts the old names and returns a fixed "Unsupported: … do it
  in Apple Mail" message without running JXA, and a runtime-info test pins their absence.
- **Evidence:** `016aeaf`, `2465ad5`, `5c01104`
- **Quality of the fix:** complete as a retirement.
- **Verdict:** out of v1 scope. *verify* the Exchange claim only if mailbox management is ever
  proposed.
- **Scenarios:**
  - [acceptance] `managing mailboxes` — `refuses to create, rename, move or delete a mailbox,
    and says to do it in Mail`

### C27 Mail: Mail is launched when it isn't running; send uses escaped JXA

- **Kind:** fix
- **Context:** mail
- **Symptom:** Mail operations failed with "Application isn't running" (upstream #44/#43 for
  Notes, same class). Send spliced subject and addresses into AppleScript.
- **Root cause:** `upstream/main` `utils/mail.ts:20-66` only probes. Send is at `:285-304`.
- **Technique:** `checkMailAccess` asks `System Events` whether a process named Mail exists. If
  not, `Mail.activate(); delay(2)`, then probes `Mail.mailboxes()` and falls back to
  `Mail.version()`. Send builds `Mail.OutgoingMessage().make()` with `visible = true`, adds
  To/Cc/Bcc recipients, calls `send()`, and returns "Email sent to …".
- **Evidence:** `d76f3ec`
- **Quality of the fix:** partial. It needs a second Automation grant (System Events) and brings
  Mail to the front on every call when it's closed. There is no send confirmation and no check
  of the Sent mailbox, and it reports "Email sent" regardless.
- **Verdict:** adopt the idea (launch the app, but in the background, and report "Mail isn't
  running and couldn't be started" as its own failure). Reject unconfirmed send.
- **Scenarios:**
  - [contract] `the mail automation` — `given Mail isn't running, starts it without bringing it
    to the front`
  - [acceptance] `sending mail` — `given no confirmation from the user, refuses to send`

### C28 A tool that reports the server's build, entry point and schema/dispatch drift

- **Kind:** feature
- **Context:** other:diagnostics
- **Symptom:** A stale bundled build silently broke Mail `accounts`, and the author couldn't tell
  which artifact the MCP client was running.
- **Root cause:** not in upstream.
- **Technique:** `runtimeInfo` (no arguments) returns package/manifest version, argv, exec path,
  detected mode (`node-dist`, `bun-ts`), artifact mtime, git commit read from `.git/HEAD`
  (`47f1515` dropped `execFile('git')`), Node/Bun, pid, hostname, each tool's operation enum,
  and `schemaDispatchDrift` between `tools.ts` and a hand-kept list of mail operations. A unit
  test asserts no drift.
- **Evidence:** `64230cd`, `47f1515`, `5ce2351`, `fa7e5f9`, `db82ca5`, `59d3aa3` (each added an
  operation to the list), `5c01104`
- **Quality of the fix:** complete for its purpose.
- **Verdict:** reject: with one tool per operation, generated from one registry, drift can't
  happen. A version string in the server info is enough. Reporting hostname and argv to the
  model is needless exposure.
- **Scenarios:**
  - [acceptance] `the tool list` — `lists exactly the operations the server can perform`

### C29 Unit tests that pin generated script text, integration tests against real apps

- **Kind:** infra
- **Context:** cross-cutting
- **Symptom:** upstream's only tests drive real apps with real data.
- **Root cause:** `upstream/main` `tests/integration/*.test.ts`.
- **Technique:** `bun test` (commit reports 89 pass / 35 skip). Unit tests `spyOn(jxaBridge,
  "executeJXA")`, re-import the module with a `?test=N` query to bypass the cache, and assert
  on the **script string** (`toContain('var searchText = "Plan \\"trip\\"\\nsoon"')`,
  `toContain("expandOccurrences")`, "emits NSMutableArray.addObject … never arrayWithArray").
  Pure tests: `filterHeaders`, `userLabelForCNLabel`, the tool schemas (no `note`, notes scope
  params and ambiguity wording, structural mail ops absent). Bridge tests run real
  `osascript` (timeout, JSON parse, wrapped error) and the SIGKILL fixture. Integration tests,
  gated by `APPLE_MCP_INTEGRATION=1` with per-app opt-ins for Maps/Photos/Music/Messages, create
  `__apple_mcp_test_<label>_<time>_<rand>` items, clean up LIFO through a `CleanupTracker`,
  and pin: contact create→delete round-trip by returned id; a created reminder is findable; a
  list filtered by name returns only that list; a note created in the default folder is
  findable; create into a missing folder errors; scoped notes ≤ all notes; a missing account
  throws; an unsupported mailbox op says "unsupported". `tests/basic.test.ts` asserts
  `1 + 1`.
- **Evidence:** `97d5918`, `d76f3ec`, `a8283e2`, `a977f72`, `5c01104`, `05d1658`
- **Quality of the fix:** partial. Behaviour is almost never specified. The unit tests would pass
  with the injections in C3–C5 and fail on a harmless refactor. The cleanup helpers delete
  *every* note, folder, list or event with a matching name on the user's real data.
- **Verdict:** adopt the idea: real-app tests are gated behind an explicit switch, use uniquely
  prefixed fixtures and LIFO cleanup, and have a hard watchdog. These are the plan's contract
  runs. Reject asserting on script text. A contract suite that runs against fake and real
  adapters replaces it.
- **Scenarios:**
  - [contract] `the note store` — `given a note created by the suite, removes only that note
    during cleanup`

### C30 Build with `tsc` so the native SQLite addon loads

- **Kind:** infra
- **Context:** cross-cutting
- **Symptom:** The bundled `dist` crashed once `better-sqlite3` was added.
- **Root cause:** `bun build --minify` can't inline a `.node` binary.
- **Technique:** `tsc` to `dist/`, NodeNext, `.js` import specifiers, `node` shebang. The same
  commit fixes a `var i` hoisting bug in the contact-reading IIFE that emptied fields.
- **Evidence:** `5fa172e`
- **Quality of the fix:** complete
- **Verdict:** reject as unnecessary. `node:sqlite` on Node 24 has no native addon. The hoisting
  bug is another argument against generating script code.
- **Scenarios:** none (build configuration)

### C31 Photos and Music tools

- **Kind:** feature
- **Context:** other:photos, other:music
- **Symptom:** no access to Photos or Music.
- **Root cause:** not in upstream (upstream PRs #39, #52).
- **Technique:** JXA. Photos: `mediaItems.whose({name:{_contains}})`, `open` = `whose({id})` or
  name, then `Photos.reveal`. Music: `sources[0].libraryPlaylists[0].tracks.whose({name:
  {_contains}})` returning `persistentID`/name/artist/album, and `play` by persistent id or name.
- **Evidence:** `3e3a3d8`, `d76f3ec`
- **Quality of the fix:** partial (name-only search, with escaped-literal splicing as in C2)
- **Verdict:** out of v1 scope
- **Scenarios:**
  - [acceptance] `searching the music library` — `given part of a track name, returns matching
    tracks with their persistent identifiers`

### C32 Maps and web search ported to the bridge

- **Kind:** refactor
- **Context:** maps, web-search
- **Symptom:** none new.
- **Root cause:** n/a
- **Technique:** Maps functions rewritten over `executeJXA` with escaped literals. Search opens
  `maps://?q=`, waits 2 s, and reads `selectedLocation()`. **When nothing is selected it returns
  a success with a made-up location named after the query.** Web search re-indented only.
- **Evidence:** `d76f3ec`, `5fa172e` (re-indentation in `1074bb8` is listed under Noise)
- **Quality of the fix:** wrong for Maps (a fabricated result)
- **Verdict:** out of v1 scope
- **Scenarios:**
  - [acceptance] `searching places` — `given no place was found, reports none rather than
    inventing one`

## Noise

- Upstream history carried under rewritten SHAs (patch-identical to upstream commits through
  `ec3018b`; tree of `11d210a` equals `ec3018b`), non-merge: `f6a41bb`, `cf05626`, `9181050`,
  `9351a97`, `a12b186`, `5ef1e65`, `b8e7632`, `3ee64ba`, `0b34bbb`, `7527415`, `75ffc81`,
  `dbd51aa`, `a799b3b`, `5449623`, `62a2cd6`, `d5b580d`, `0dbcd51`, `7a73457`, `4b210ef`,
  `123fc54`, `2bb3a4f`, `2e564f7`, `dc60b07`, `020a53e`, `c49486b`, `a7cd912`, `1e097d7`,
  `5f54271`, `cd6e0d0`, `dbdf201`, `72db840`, `1926bf0`, `8529354`, `4558a34`, `d41d235`,
  `3991552`, `e16e021`, `d65c9a6`, `362cea4`, `bddc8a4`, `e4f8388`, `d1373c2`, `abc55e4`,
  `ebc8a09`, `bf02aee`, `6885e73`, `f8dfa1a`, `b2eb556`, `11d210a`
- Upstream history carried under rewritten SHAs, merges: `e3aa89b`, `3d2e315`, `3514613`,
  `8f0ed0a`, `eb9f23c`, `e447e10`, `8508ba0`, `bd1fc1c`, `e5e0991`, `59fded6`, `998f94d`,
  `568f769`, `19c023f`, `fb07813`, `a2b57c8`, `ddb1335`, `4524b9e`, `f572af3`
- Merges of the fork's own Codex PRs #1–#17 (content counted in the commits they merge):
  `c284487`, `dff4183`, `36afdfe`, `8034ce5`, `983fd88`, `fca9d8c`, `88ab897`, `855de2c`,
  `fce4380`, `cd41df1`, `b5094b6`, `2f218be`, `25f47b7`
- Docs, plans, reference files (Mail `.sdef` dump, "apple-map-plan" that is really a mail plan,
  function catalog, AGENTS.md "keep the server generic" note), README fix: `a8c8ab2`, `00741ac`,
  `0fedf0e`, `e9146c7`, `f2ddfdf`, `36f0fed`
- Re-indentation of every util, lint script: `1074bb8`
- Commented out `console.log` inside JXA calendar scripts: `0ec1adc`
- ESLint setup and a `1 + 1` placeholder test: `bcb1357`

## Glossary candidates

- **handle**: a row in `chat.db`'s `handle` table. Its `id` is an E.164 phone number, an email
  address, or an alphanumeric sender ID (e.g. `o2Business`). One person can have several.
- **chat**: a row in `chat`, joined to handles by `chat_handle_join` and to messages by
  `chat_message_join`. Has `chat_identifier` and, for groups, `display_name`. A handle belongs
  to its 1:1 chat and to every group it's in.
- **tapback / reaction**: a `message` row with `associated_message_type ≠ 0`. It isn't a
  message the user wrote.
- **attributedBody**: the archived `NSAttributedString` blob that holds message text when
  `text` is null or U+FFFC.
- **buddy**: Messages' scripting object for a handle on a service (iMessage). Send needs an
  existing buddy.
- **contact identifier**: `UUID:ABPerson`, the same string for the scripting bridge and (per the
  fork) `CNContact.identifier`.
- **contact detail label**: a well-known label is stored as a sentinel `_$!<Work>!$_`. Fax
  labels use the legacy `…FAX` spelling. Custom labels are plain text.
- **contact note**: a field reserved to apps with Apple's contacts-notes entitlement.
- **notes account**: a top-level Notes container (iCloud, Exchange, On My Mac). It contains
  folders, and folder names are unique only within an account.
- **mail account / mailbox path**: a mailbox is addressed by its `/`-joined path inside one
  account, compared after NFC normalisation.
- **inbox**: an account's incoming mailbox. Its displayed name is localised (`INBOX`,
  `Posteingang`).
- **message reference**: {Mail object id, RFC Message-ID, account, mailbox path, dates, sender,
  subject}. What a follow-up action on a mail message needs.
- **mail object id**: Mail's scripting `id()` of a message within its local store. Not the
  Message-ID.
- **flag colour**: Mail `flagIndex` −1 (none) and 0–6 (red, orange, yellow, green, blue, purple,
  gray).
- **occurrence**: one instance of a recurring event inside a range. Calendar scripting returns
  only the series.
- **dry run**: a write that reports what it would change and changes nothing.

## Open questions

- Does `reminder["delete"]()` (C5) delete on current macOS? Treat it as a live destructive path
  until disproved.
- Is a scripting-bridge person id always equal to `CNContact.identifier`, including across
  unified and linked contacts (C13)? Does `phones.push` still fail to persist on macOS 14–26?
- Does the uppercase `…FAX` sentinel quirk apply to Contacts.framework writes, or only to the
  scripting bridge (C14)?
- Can an unsigned or ad-hoc-signed Swift helper read `CNContactNoteKey` at all, and does asking
  for it throw or crash (C15)?
- Is `mailObjectId` stable across Mail restarts and mailbox rebuilds, or is Message-ID plus
  mailbox the only durable reference (C22)?
- The "structural mailbox operations are unreliable on Exchange/M365" claim has no reproducer
  in the repo (C26).
- Why did the author replace `@jxa/run` (JSON arguments) with string-built scripts in
  `97d5918`/`d76f3ec`? No commit says. If it was a performance or permission-prompt problem,
  that matters for the automation adapter.
- The Exchange timings ("30 s → 564 ms", "4 min → 30–130 s") are single-machine anecdotes. EventKit
  and the Envelope Index should make them moot. Confirm before relying on JXA `whose` for Mail.
