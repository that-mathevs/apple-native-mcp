# fpjnijweide/apple-mcp

- **Remote:** `fork-fpjnijweide`
- **Branches read:** `main` (8 commits). `fix-mail-search` and `index-safe-mode` have no commits of
  their own (`git log upstream/<b>..fork-fpjnijweide/<b>` is empty), so they were skipped.
- **Commits accounted for:** 8 / 8
- **Last commit:** 2026-02-24 (`48cd701`)
- **In one paragraph:** Two authors stacked on one branch. Ayaan Ahmad (3 commits, 2025-08-20)
  added contact-name resolution to Messages, dropped the Messages `unread` operation, changed
  notes to return HTML bodies and wrote debug logging and credit banners. fpjnijweide (5 commits,
  2026-02-23/24) did the substantive work: a committed EventKit helper (`CalHelper.app`) for reading
  calendars, mail reads moved from AppleScript to Mail's `Envelope Index` SQLite and `.emlx` files
  on disk, contacts edit/delete, and finally the split of the 7 multiplexed tools into 32
  `{domain}-{verb}` tools. The ideas are worth learning from: the TCC-attribution trick for the helper,
  Envelope Index reads, respecting calendars the user has hidden, per-operation schemas. The code
  isn't: SQL, AppleScript and shell commands are still built from strings, several advertised
  filters are silently ignored while the reply claims they were applied, and the recipient
  resolution picks the first partial name match.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Calendar (read) | EventKit through a committed Swift CLI inside an `.app` bundle (`CalHelper.app`), one process per call, argv in, custom `<<<EVENT>>>`/`<<<F>>>` delimited text out | Run directly first. If access is denied, relaunched through `open -W -g CalHelper.app --args ...` and output read from a temp file |
| Calendar (hidden calendars) | `defaults read com.apple.iCal DisabledCalendars`, then UIDs mapped to names through the helper | Excludes calendars the user unticked in Calendar.app |
| Calendar (create) | AppleScript string (unchanged from upstream) | Same injection holes as upstream |
| Mail (unread, latest, search, locate a message) | `bun:sqlite`, opened read-only, on `~/Library/Mail/V10/MailData/Envelope Index` | Needs Full Disk Access for bun. Queries are string-built |
| Mail (message body, attachments) | `find` (execFile) for `<ROWID>.emlx` / `<ROWID>.partial.emlx` under the account directory, then the file is read and MIME parsed by hand | No osascript |
| Mail (accounts, mailboxes, send, unread for one account) | AppleScript string | Unread for one account falls back to all accounts on any error |
| Contacts | AppleScript string, `every person whose name contains`, one delimited string per record | Now also returns emails and birthdays. Adds edit and delete |

## Changes

### C1 One tool per operation (32 tools)

- **Kind:** refactor
- **Context:** cross-cutting
- **Symptom:** Upstream exposes 7 tools, each taking an `operation` enum and one flat bag of
  optional properties. A client can't allow reads while confirming writes, and the schema can't
  say which arguments each operation needs.
- **Root cause:** `upstream/main:tools.ts` defines one `Tool` per app. Only `operation` is
  `required` (e.g. `tools.ts:26`, `:58`, `:90`, `:142`, `:190`, `:254`). `index.ts` then checks
  arguments with hand-written type guards for each tool.
- **Technique:** `48cd701` rewrites `tools.ts` as 32 `Tool` constants named `{domain}-{verb}`
  in kebab-case, where camelCase operations become kebab (`listById` → `list-by-id`). Each lists
  only its own properties and its own `required`. `index.ts` becomes one flat 32-case switch with
  `errorResult`/`successResult` helpers, and about 400 lines of type guards are deleted.
  The full list, with the upstream operation each came from:

  | Domain | Tools | Upstream source |
  |---|---|---|
  | Contacts (3) | `contacts-search`, `contacts-edit`, `contacts-delete` | `contacts` had no operation. `edit`/`delete` were added by `42c9e11` as operations first |
  | Notes (3) | `notes-search`, `notes-list`, `notes-create` | `notes` search/list/create |
  | Messages (3) | `messages-read`, `messages-send`, `messages-schedule` | `messages` read/send/schedule. `unread` was removed in `93daf09` |
  | Mail (7) | `mail-unread`, `mail-search`, `mail-open`, `mail-latest`, `mail-mailboxes`, `mail-accounts`, `mail-send` | `mail` unread/search/latest/mailboxes/accounts/send. `open` was added in `42c9e11` |
  | Reminders (5) | `reminders-list`, `reminders-search`, `reminders-list-by-id`, `reminders-open`, `reminders-create` | `reminders` list/search/listById/open/create |
  | Calendar (4) | `calendar-list`, `calendar-search`, `calendar-open`, `calendar-create` | `calendar` list/search/open/create |
  | Maps (7) | `maps-search`, `maps-directions`, `maps-list-guides`, `maps-save`, `maps-pin`, `maps-add-to-guide`, `maps-create-guide` | `maps` search/directions/listGuides/save/pin/addToGuide/createGuide |

- **Evidence:** `48cd701` (`tools.ts`, `index.ts`). Upstream #8 (array vs object input) is
  related.
- **Quality of the fix:** partial. For Decision 2, what got **better**:
  - each schema lists exactly the arguments its operation reads, with accurate `required` (e.g.
    `mail-send` requires `to`, `subject`, `body`)
  - a client can allow or confirm tools by name, e.g. auto-allow `*-search` and confirm
    `messages-send`
  - dispatch is one flat switch with no second operation switch inside
  - tool descriptions can be specific ("List recent emails with short previews, regardless of
    read status").

  What got **worse** or stayed broken:
  - the type guards were deleted and nothing replaced them. Every argument is cast (`args.name as
    string`), required fields are only truthiness checks, and `limit` is never checked as a number
  - no MCP tool annotations (`readOnlyHint`, `destructiveHint`), so "granular permissions" relies
    on the client matching names. `contacts-delete` looks no different from `contacts-search`
  - `manifest.json` still lists the 7 old tools (only the Messages description was edited, in
    `93daf09`)
  - advertised parameters are silently dropped: `mail-search` declares `account`/`mailbox`, but
    the handler never passes them and still prints "in account X". `mail-latest` passes `account`
    into a query that ignores it. `mail-open` passes `searchTerm` into `readMail`'s `sender`
    parameter (`index.ts` `mail-open` case against `utils/mail.ts` `readMail(subject, sender,
    mailbox)`)
  - `messages-unread` is gone
  - names put the implementation into the surface (`reminders-list-by-id`), mix nouns and verbs
    unevenly (`mail-unread`, `mail-latest`), and reminders tools still return `lists` and
    `reminders` as top-level result fields that most clients never show.

  Seven multiplexed tools became 32 tools, and 25 once Maps is out of scope. That cost in listed
  tool definitions is fine but real.
- **Verdict:** adopt the idea (supports Recommend B in Decision 2). Pair it with zod schemas, tool
  annotations, and names taken from the glossary rather than from upstream's operation strings.
- **Scenarios:**
  - [acceptance] `the tool list` — `given the default configuration, offers only tools that read`
  - [acceptance] `the tool list` — `marks every tool that changes a store as destructive, so a client can ask before it runs`
  - [acceptance] `a tool call` — `given an argument the tool does not declare, refuses the call: an ignored filter would make the reply lie`
  - [acceptance] `a tool call` — `given a limit that is not a positive whole number, refuses the call and names the argument`

### C2 Calendar reads go through an EventKit helper app (and no longer return a dummy event)

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Listing events returned one fake event titled "No events available - Calendar
  operations too slow". Search always returned nothing (upstream #74, #25).
- **Root cause:** `upstream/main:utils/calendar.ts:102-117` builds a hard-coded dummy event, and
  `:177` returns an empty list for search.
- **Technique:** `cal-helper.swift` (committed, 158 lines) plus a compiled binary at
  `CalHelper.app/Contents/MacOS/cal-helper` (arm64 only, ad-hoc signed, identifier
  `com.appleMCP.cal-helper`. Its strings match the committed source). Behaviour:
  - calls `requestFullAccessToEvents` on every run
  - **protocol:** argv `events <yyyy-MM-dd from> <yyyy-MM-dd to> <limit> [excludedNames,comma,joined]`
    or `calendars`, plus an optional `--output <file>`
  - uses `predicateForEvents`, **sorts by start date before applying the limit**, groups by
    calendar, and prints `Name:<<<CAL>>>` headers and `<<<EVENT>>>title<<<F>>>datetime<<<F>>>location: …`
    lines, with newlines in notes flattened to spaces
  - the TS side (`utils/calendar.ts` `runCalHelper`) runs it with `exec` (a shell string). If
    stderr says "denied", it relaunches through `open -W -g "CalHelper.app" --args --output
    /tmp/cal-helper-<ms>.txt …` so LaunchServices makes the bundle its own responsible process.
    `Info.plist` carries `NSCalendarsUsageDescription` and `LSUIElement`
  - search fetches at most `MAX_EVENTS` (20) events in the range, then filters in JS.
- **Evidence:** `42c9e11`. Upstream #74, #25.
- **Quality of the fix:** partial.
  - Search only looks at the first 20 events in the window, so matches later in the range are
    missed.
  - `limit` is capped at 20.
  - Dates are formatted without a time zone.
  - Excluded calendar names are joined into a double-quoted shell string, so a calendar name
    containing `"` or `$(...)` is shell injection. Calendar names can come from subscriptions and
    shared calendars, not only from the user.
  - The `open -W` fallback builds a shell string too.
  - `Info.plist` lacks `NSCalendarsFullAccessUsageDescription`, which macOS 14+ expects for
    `requestFullAccessToEvents` (verify).
  - An ad-hoc signature means a TCC grant tied to this cdhash is lost on every rebuild.
  - The binary is committed alongside its source, arm64 only.
  - Temp file names are predictable in `/tmp`.
  - Creating events still goes through upstream's AppleScript unchanged, with `location` and
    `notes` unescaped (`upstream/main:utils/calendar.ts:284-290`) and a `toLocaleString()` date
    literal (`:270-271`).
- **Verdict:** adopt the idea: EventKit, and sort by start before applying the limit. verify:
  "running the helper as its own `.app` through LaunchServices makes the Calendar permission
  prompt name the helper, where a plain child process of Claude Desktop is denied without a
  prompt". This feeds Decision 3.
- **Scenarios:**
  - [contract] `the calendar store` — `given events in a date range, returns every occurrence in that range ordered by start`
  - [acceptance] `searching events` — `given more matching events than the limit, returns the earliest matches rather than whatever came first`
  - [acceptance] `reading events` — `given calendar access has not been granted, fails with a permission failure that names the setting to change`
  - [acceptance] `creating an event` — `given a title containing script syntax, stores the title verbatim and runs nothing`

### C3 Calendars the user hid in Calendar.app stay hidden

- **Kind:** feature
- **Context:** calendar
- **Symptom:** Holiday, birthday and subscribed calendars the user had unticked still flooded
  the results.
- **Root cause:** Upstream has no notion of hidden calendars.
- **Technique:** `getDisabledCalendarNames` runs `defaults read com.apple.iCal DisabledCalendars`,
  regex-extracts UUIDs, maps them to names through `cal-helper calendars`, and passes the names as
  an exclusion list.
- **Evidence:** `42c9e11` (`utils/calendar.ts` `getDisabledCalendarNames`)
- **Quality of the fix:** partial. It matches by title, not identifier, even though it has the
  identifier, so two calendars with the same title are both excluded. The names are shell-joined
  (see C2), and any failure silently turns the filter off.
- **Verdict:** verify: "`com.apple.iCal DisabledCalendars` lists the calendar identifiers that are
  unticked in Calendar.app on macOS 14–26". If it holds, consider it as a default filter by
  identifier, with an allowlist in settings taking precedence.
- **Scenarios:**
  - [domain] `the calendars searched` — `given a calendar the user has hidden, leaves it out unless the settings name it`

### C4 Mail reads come from the Envelope Index instead of AppleScript

- **Kind:** fix
- **Context:** mail
- **Symptom:** Unread and search returned no mail (upstream #69, #58, #30, #19), and scanning by
  AppleScript took seconds to minutes.
- **Root cause:** `upstream/main:utils/mail.ts:138` returns `"SUCCESS:" & (count of emailList)`
  and `:143-146` then returns `[]`, so the collected data is thrown away (the same at `:237`,
  `:242-245`). Where it did scan, it used `repeat` loops over every mailbox (`:89`, `:187`).
- **Technique:** Three steps: `42c9e11` moved to `whose` clauses, `c8e39f6` searched "All Mail"
  once, and `6cf16c0`/`05305b2` replaced both with SQL through `bun:sqlite` (`readonly: true`).
  - Joins `messages`, `subjects`, `addresses`, `mailboxes` and `summaries`.
  - Converts `date_sent` with `datetime(m.date_sent,'unixepoch','+31 years')`.
  - Derives the mailbox name by stripping the scheme and the 36-char account UUID from
    `mailboxes.url`.
  - Excludes `ews://` accounts and `All Mail`/`Alle e-mail`/Spam/Trash/Drafts by URL pattern.
  - Adds `searchSender`, `searchSubject` and `searchContent` (ANDed) next to the broad
    `searchTerm`. The commit claims 0.04s against 4.4s.
- **Evidence:** `42c9e11`, `c8e39f6`, `6cf16c0`, `05305b2`. Upstream #69, #58, #30, #19.
- **Quality of the fix:** partial.
  - SQL is string-built, escaping only `'` (enough for a SQLite literal, but `%` and `_` stay
    wildcards) and `LIMIT ${maxEmails}`.
  - Path hard-coded to `V10`.
  - Exchange (`ews://`) accounts are excluded entirely.
  - "Content" search only covers `summaries.summary`, not the body.
  - `account` filters are accepted and ignored (C1).
  - The `+31 years` epoch shift and the UUID-length slicing are unverified assumptions about the
    schema.
  - Needs Full Disk Access for the runtime binary, with no permission failure of its own: errors
    are swallowed into `[]`, so the reply says "No emails found".
- **Verdict:** verify: "Envelope Index `messages.date_sent` is seconds since 2001-01-01 and
  `mailboxes.url` is `<scheme>://<account-uuid>/<percent-encoded path>` on macOS 14–26". This feeds
  the Mail *verify* row in plan.md: the approach is promising and ~100x faster by its own
  measurement.
- **Scenarios:**
  - [contract] `the mail store` — `given a sender, subject and body term together, returns only messages matching all three`
  - [acceptance] `searching mail` — `given the mail store cannot be opened for lack of Full Disk Access, fails with a permission failure rather than reporting no mail`
  - [domain] `a mailbox address` — `given a Mail mailbox URL, yields its account and its human-readable path`

### C5 Opening one email reads its `.emlx` file and lists attachments

- **Kind:** feature
- **Context:** mail
- **Symptom:** There was no way to read an email's full body. Large bodies over AppleScript hit
  AppleEvent error -10000.
- **Root cause:** Upstream has no open/read operation for mail.
- **Technique:** `mail-open`:
  - finds the newest message whose subject `LIKE %subject%` (`LIMIT 1`)
  - locates `<ROWID>.emlx` or `.partial.emlx` with `find` (execFile, argv, 5s timeout) under
    `~/Library/Mail/V10/<account-uuid>`
  - reads the byte count on the first line, then that many bytes of MIME
  - hand-parses multipart and picks the `text/html` part, decoding quoted-printable and base64
  - lists files in the sibling `Attachments/<ROWID>/` directory, with MIME types by extension.

  `42c9e11` first copied attachments into `$TMPDIR`, and `48cd701` replaced that with the path
  inside Mail's own store.
- **Evidence:** `42c9e11`, `48cd701`
- **Quality of the fix:** partial.
  - A message is identified by a subject substring, so two emails with similar subjects are
    ambiguous and the newest wins silently.
  - Raw HTML is returned to the agent, which is a prompt-injection surface.
  - The MIME parsing is regex-based (first `boundary=` only, and nested multiparts are misread).
  - Content is decoded as UTF-8 regardless of charset.
  - Attachments are exposed as paths into `~/Library/Mail`.
- **Verdict:** adopt the idea: address a message by a stable identifier from search results,
  never by subject. verify: "`.emlx` files are named by `messages.ROWID` and live under
  `V10/<account-uuid>/**/Messages/`".
- **Scenarios:**
  - [acceptance] `opening a message` — `given an identifier from a search result, returns that message's full text and never a different message with a similar subject`
  - [domain] `a message body` — `given a multipart message with plain and HTML parts, yields readable text in the declared charset`

### C6 Contacts return emails and birthdays, and are searched in the app

- **Kind:** fix
- **Context:** contacts
- **Symptom:** Contacts without a phone number were invisible, and emails were never returned
  (upstream #75, #47, #58). The lookup was slow.
- **Root cause:** `upstream/main:utils/contacts.ts:92-94` only adds a contact if
  `count of personPhones > 0` and never reads emails. It loops over up to 1000 people with
  `repeat` (`:6`, `:68`).
- **Technique:** `whose name contains` pushes filtering into Contacts. A single script collects
  name, phones, emails and a `YYYY-M-D` birthday, joined by `<<<F>>>`/`<<<R>>>`. Listing everyone
  is capped at 100 people.
- **Evidence:** `42c9e11`. Upstream #75, #47.
- **Quality of the fix:** partial.
  - Escaping covers `"` but not `\`, so input like `x\" & …` still breaks out of the literal.
  - Listing without a name still drops contacts that have no phone (`getAllNumbers`) and stops at
    100.
  - `findContactByPhone` still loops over every person.
  - The birthday format isn't zero-padded.
- **Verdict:** adopt the idea (emails and people without phones must be returned). The mechanism
  is superseded by Contacts.framework in the plan.
- **Scenarios:**
  - [contract] `the contacts store` — `given a person with only an email address, returns that person with the email`

### C7 Contacts can be edited and deleted by exact name

- **Kind:** feature
- **Context:** contacts
- **Symptom:** No way to fix a contact's birthday, phone, email or name.
- **Root cause:** Upstream is read-only for contacts.
- **Technique:** `editContact`/`deleteContact` run `every person whose name is "<name>"` and refuse
  unless exactly one matches ("Found N contacts named …. Please be more specific."). Birthdays are
  built component by component (`set year of bday to …`) to avoid locale parsing. A non-empty
  `phone`/`email` *adds* a value. An empty string deletes *every* phone or email. Then `save`.
- **Evidence:** `42c9e11`, exposed as tools in `48cd701`
- **Quality of the fix:** partial. The exactly-one-match rule and component-built dates are good.
  But escaping is `"`-only, the empty-string-clears-all semantics is an easy destructive mistake,
  delete has no confirmation or write-enablement, `newName` is split on whitespace into
  first/last (breaking multi-word surnames), and nothing re-reads the contact afterwards.
- **Verdict:** out of v1 scope for writes. Adopt the idea "refuse unless exactly one match" for
  any future write, and "build dates from components, never from a locale string" everywhere.
- **Scenarios:**
  - [domain] `choosing a contact to change` — `given a name that matches more than one person, refuses and lists the candidates`

### C8 Messages accept a contact name instead of a number

- **Kind:** feature
- **Context:** messages
- **Symptom:** An agent had to look a number up before it could read or send.
- **Root cause:** Upstream's `messages` tool requires `phoneNumber` (`upstream/main:tools.ts:58`
  onward, `index.ts` `isMessagesArgs`).
- **Technique:** `resolvePhoneNumber` (`index.ts`, `93daf09` then `48cd701`):
  - if `phoneNumber` is given, it's used as is
  - otherwise `contacts.findNumber(contactName)` does a partial `name contains` match over all
    people and takes `numbers[0]`, the first phone of the first match
  - a vestigial `.split(", ")`/`startsWith("+")` step then chooses from a one-element array.

  The `contacts-search` description tells the model it is "MANDATORY" to call it first.
- **Evidence:** `93daf09`, `48cd701`
- **Quality of the fix:** wrong. "Jo" resolves to whichever contact containing "Jo" comes first,
  and to that contact's first number, which may be a landline or a work number. A raw
  `phoneNumber` bypasses any check. This is the ghost-recipient failure of upstream #48 made
  easier to trigger.
- **Verdict:** reject: violates non-negotiable 4 (recipients must be known). Keep only the lesson
  that name resolution must be exact and must refuse ambiguity.
- **Scenarios:**
  - [domain] `resolving a recipient` — `given a name that partially matches several contacts, refuses and names each candidate`
  - [domain] `resolving a recipient` — `given a contact with several numbers and no chat history with any, refuses: the intended number is unknown`

### C9 Notes return full HTML bodies with title matches first

- **Kind:** feature
- **Context:** notes
- **Symptom:** Notes came back truncated to 200 characters, and title matches weren't ranked
  above body matches.
- **Root cause:** `upstream/main:utils/notes.ts` reads `plaintext` and truncates to
  `MAX_CONTENT_PREVIEW`.
- **Technique:** `93daf09` reads `body` (HTML) without truncation, splits matches into
  `titleMatches & contentMatches`, and labels them "TITLE MATCH"/"CONTENT MATCH". Because
  run-applescript returns text, it adds a regex parser for a single `name:…, content:…, priority:…`
  string. It also adds an unexposed `editNote` that **deletes** the note and makes a new one with
  unescaped `noteName`. `createNote` sets `body` after `make` "for rich text".
- **Evidence:** `93daf09`
- **Quality of the fix:** wrong.
  - The string parser can only ever yield one note.
  - `upstream/main:utils/notes.ts:121`, `:193` still fall through to `Array.isArray` on a string.
  - Returning full HTML for up to 50 notes makes replies huge.
  - `editNote` is destructive (it loses the creation date, attachments and folder) and is dead
    code.
  - The `notes-create` description tells agents to "update" by creating a duplicate.
- **Verdict:** adopt the idea: rank title matches above body matches. reject the rest.
- **Scenarios:**
  - [acceptance] `searching notes` — `given one note titled with the term and another mentioning it in the body, lists the titled note first`

## Noise

- Debug logging, credit banners, README rewrite, lockfile: `7ecf179`, `19881d7`, and the
  `bun.lockb` churn in `42c9e11`.
- Superseded intermediate mail approaches (AppleScript `whose`, the "All Mail" fallback, the
  `sqlite3` CLI, `$TMPDIR` attachment copies), all replaced within the same day: `c8e39f6`,
  `05305b2`. Their surviving ideas are in C4/C5.

## Glossary candidates

- **mailbox URL**: `mailboxes.url` in the Envelope Index, `<scheme>://<account-uuid>/<path>`. The
  fork derives both the account directory and the display path from it.
- **Envelope Index**: Mail's SQLite catalogue of messages (subjects, addresses, summaries,
  mailboxes). It holds metadata and a summary, not full bodies.
- **emlx**: Mail's on-disk message file. The first line is a byte count, then raw MIME, then an
  Apple plist. `.partial.emlx` means attachments are stored separately under `Attachments/<ROWID>/`.
- **disabled calendar**: a calendar unticked in Calendar.app, recorded by UID in
  `com.apple.iCal DisabledCalendars`.
- **responsible process**: the process macOS TCC attributes a permission request to. The fork
  relaunches its helper through LaunchServices so the helper, not the host, is responsible.

## Open questions

- Does macOS 14+ show a Calendar full-access prompt for a bundle whose `Info.plist` has only
  `NSCalendarsUsageDescription`, or does it deny silently?
- Does `open -W -g` reliably wait for an `LSUIElement` app and pass its exit status? The code
  treats any failure as "access denied".
- Is `+31 years` exact for `date_sent` (the epoch offset is 978307200 s), and does
  `summaries.summary` hold the full plain text or only a preview?
- Why are `ews://` accounts excluded: a schema difference, or just duplicates?
