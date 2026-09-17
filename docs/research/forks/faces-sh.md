# faces-sh/apple-mcp

- **Remote:** `fork-faces-sh`
- **Branches read:** `main` (34 commits + 11 merge commits), `oss-cleanup` (11 commits, 10 not on
  `main`), and ten PR branches that are all already merged into `main` and add nothing of their
  own: `faces` (1), `fix/reminders-launch-on-create` (2), `fix/uniform-failure-envelope` (4),
  `feat/contact-identifier` (6), `perf/bulk-property-fetches` (8), `feat/notes-list-is-an-index` (9),
  `feat/reminders-via-eventkit` (10), `feat/contacts-calendar-via-maestro` (11),
  `feat/messages-say-how-many` (12), `fix/read-says-how-many-and-names-are-optional` (13),
  `feat/find-a-conversation` (14). They form one stack of PRs #1 to #12. `fix-mail-search` and
  `index-safe-mode` have no commits beyond `upstream/`, so they were skipped. `HEAD` is `main`.
- **Commits accounted for:** 44 / 44 unique non-merge commits (plus the 11 merge commits, which
  hold no changes of their own)
- **Last commit:** 2026-09-03 (`main`). `oss-cleanup` stops at 2026-07-26.
- **In one paragraph:** This is the Apple bridge inside Faces' Mac product, which is called
  "Maestro" (earlier "Faced"). It's written by one committer (`sybileak`), almost entirely with
  Claude, and its commit messages are long, careful post-mortems full of numbers measured on the
  owner's own Mac. `main` cuts the server down to five apps (contacts, notes, messages, reminders,
  calendar). Mail, maps and web search are gone, so **this fork has no mail code**. The query
  grammar that the brief took for mail search is actually *messages* search, and its corpus is
  shared with a Python mail proxy that isn't in this repo. On `main`, reminders, contacts and
  calendar aren't read by this process at all. It POSTs JSON to loopback HTTP "doors" that
  Maestro serves, and Maestro reads EventKit and Contacts in its own process (C6). That part
  can't be reused, but the reason for it (TCC grants attach to the process that holds them) is
  the key input to Decision 3. Notes use JXA with bulk property reads. Messages are read from
  `chat.db` through the `sqlite3` CLI via `execFile`, and sent with a string-built AppleScript
  whose values are escaped. The Messages half is the most valuable Phase 1 material so far: a
  real conversation model, a proper `attributedBody` decoder, name-to-person resolution that asks
  instead of guessing, matching against existing handles that never guesses a country, a
  "genuine contact" rule, a send that is checked against the store afterwards, and a wrong-number
  refusal. Every one of these came out of a real mis-send and comes with a test. `oss-cleanup` is
  a divergent line: a generic OSS build with contacts and notes CRUD and a checked-in Swift
  EventKit helper (C7). Its idea of the circuit cache is **alarming** (C33), and it forbids
  reading back after a write, which contradicts non-negotiable 3. Much of it is worth learning
  from, but the plan's non-negotiables are only partly met: scripts and SQL are still built from
  strings (escaped), nothing is read-only by default, no send needs confirmation, and the
  wrong-number check allows any number that no contact card claims.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Contacts (`main`) | HTTP POST to Maestro's contacts door (`MAESTRO_CONTACTS_URL` + `x-contact-secret`). Maestro reads `CNContactStore`. | `utils/maestro.ts`. Fails with `app_not_running` when the door isn't configured. No fallback. Before 82efc89 it was JXA with bulk columns, and before 0216d96 JXA per card. |
| Calendar (`main`) | HTTP POST to Maestro's calendar door. Maestro uses EventKit (`predicateForEvents`). | `open` still calls JXA `Application("Calendar").activate()`. |
| Reminders (`main`) | HTTP POST to Maestro's reminders door. Maestro uses EventKit. | `open` still does a JXA `activate()`. |
| Reminders, Calendar (`oss-cleanup`) | `execFile` of a checked-in Swift binary, `helpers/EventKitHelper.swift` → `dist/eventkit-helper <domain> <op> <json>`, 90 s timeout | Payload goes in as one JSON argv, results come back as JSON on stdout. Full CRUD plus recurrence. Also one AppleScript read (`listCalendarNames`) with no interpolation. |
| Contacts, Notes (`oss-cleanup`) | JXA via `@jxa/run`, values passed as `run()` arguments | CRUD. `whose` filters with a scan fallback. Never reads back after a write. |
| Notes (`main`) | JXA via `@jxa/run`, values passed as `run()` arguments. Reads are whole-collection property reads (`Notes.notes.name()`, `.plaintext()`). | No `whose`. Matching happens in TypeScript. |
| Messages read | `execFile("sqlite3", ["-json", chat.db, sql])`, no shell | SQL is built from strings, with `'` doubled (`escapeSqlString`) and numbers clamped. `main` opens `chat.db` **read-write** (no `-readonly`). `oss-cleanup` adds `-readonly` and a timeout. |
| Messages send | `execFile("osascript", ["-e", script])` with an 8 s timeout and SIGKILL. The recipient, body and chat guid are escaped into AppleScript string literals. | After the send, `chat.db` is polled to confirm the message left (C25). `oss-cleanup` still uses `run-applescript`, with no timeout and no check. |
| Mail, Maps, Web search | removed | `ROADMAP.md`: mail "want to add back". Web search is dropped for good. |

## Changes

### C1 Every script value arrives as a JXA argument, not spliced into source

- **Kind:** hardening
- **Context:** cross-cutting
- **Symptom:** A name, folder, calendar or date containing a quote broke the tool or ran as
  script. List and search came back empty because a string result was treated as an array.
- **Root cause:** Upstream builds AppleScript source with raw `${...}` interpolation everywhere,
  for example `utils/reminders.ts:258` (`make new reminder ... {name:"${cleanName}"}`) and
  `utils/message.ts:77` (`buddy "${phoneNumber}"`, not escaped at all). It then parses the
  string it gets back. `utils/calendar.ts:~102` even returns a hard-coded dummy event "since
  Calendar queries are too slow".
- **Technique:** Contacts, notes, reminders and calendar were rewritten on `@jxa/run`. Every
  user value goes in through `run(fn, args)` (e.g. `utils/notes.ts` `createNote`,
  `scanFolder`), and results come back as real JS objects.
- **Evidence:** `784db41` (all branches). Later, on `main`, contacts, calendar and reminders move
  to Maestro (C6), so on `main` notes is the only JXA module with arguments.
- **Quality of the fix:** complete for the JXA modules. It doesn't reach Messages, which still
  builds its source from strings (C2).
- **Verdict:** adopt the idea. It's plan.md's "static script, values as JSON arguments". Credit it.
- **Scenarios:**
  - [contract] `the automation runner` — `given a value containing quotes, backslashes and newlines, delivers it to the script unchanged`
  - [acceptance] `creating a note` — `given a title that contains AppleScript syntax, creates a note with exactly that title`

### C2 Messages escapes what it still splices: AppleScript literals and SQL literals

- **Kind:** hardening
- **Context:** messages
- **Symptom:** A message body or recipient containing `"` or `\` could break out of the send
  script. Shell-built `sqlite3 "..."` commands could be broken out of via the shell.
- **Root cause:** `utils/message.ts:73-78` escapes only `"` in the body and nothing in the
  recipient. `utils/message.ts:98,244,308,434` run `sqlite3` through `exec` with the SQL inside
  a double-quoted shell string.
- **Technique:**
  - `escapeAppleScriptString` (`utils/native.ts`) doubles `\` first, then escapes `"`. It's
    applied to the buddy, the body and the chat guid.
  - `osascript` and `sqlite3` both run through `execFile` with an argv vector, so no shell is
    involved.
  - SQL literals go through `escapeSqlString` (doubles `'`).
  - Integer ids are guarded (`Number.isInteger`, `Math.floor`) and limits clamped.
  - Dates reach SQL only as numbers parsed by `when.ts`.
- **Evidence:** `784db41`, `42c2fd7`, `39b7e40` (moves the send from `run-applescript` to
  bounded `execFile osascript`).
- **Quality of the fix:** partial.
  - **Escaping (complete by reading):** for a double-quoted AppleScript literal only `\` and `"`
    are special, and they're escaped in the right order. Doubling `'` is complete for an SQLite
    string literal. Every value I traced into SQL was either escaped or numeric. **I found no
    injection hole on `main` or `oss-cleanup`.**
  - **Still string-built:** scripts and SQL are still assembled as strings, which non-negotiable
    1 forbids.
  - **Read-write connection:** `main` opens `chat.db` without `-readonly`, so any future slip in
    the escaping would have write access to the user's message store.
  - **The target of the send is a name lookup, not a literal:** `buddy "<x>"` is resolved at the
    app level, not `of targetService`, which is set but never used.
- **Verdict:** reject the technique (escaping instead of parameters). Adopt argv without a shell
  and `-readonly`. Verify: `a Unicode quotation mark (U+201C/U+201D), U+2028, or a "¬" inside a
  message body is delivered literally by the escaped osascript source and does not end the
  string literal`.
- **Scenarios:**
  - [acceptance] `sending a message` — `given a body containing quotes, backslashes and a line break, delivers exactly that text`
  - [contract] `the message store` — `opens the history read-only: a query can never change it`

### C3 Every failure has one shape: a code, one sentence, then the evidence verbatim

- **Kind:** hardening
- **Context:** cross-cutting
- **Symptom:** Errors came back as prose with no code. A permission problem and a crash looked
  alike, and the output from macOS that would tell them apart was thrown away.
- **Root cause:** Each catch rewrote the error into its own sentence, and dispatch then guessed
  the meaning back out with `errorMessage.includes("access")` (`index.ts:268,361,501,946,1092`).
- **Technique:** `utils/failure.ts`.
  - **Result shape:** `isError: true`, and the text is `[<code>] <what did not happen>` followed
    by stderr and the error message verbatim.
  - **Body handling:** the body is capped at 4000 characters with a `...[truncated]` marker, and
    `Authorization`/`Cookie` headers and `access_token`/`refresh_token`/`client_secret` values
    are redacted.
  - **Raising:** a typed `ToolFailure(code, summary, body)` is raised where the failure happens
    and rendered once, at dispatch, through `failureResultFrom`.
  - **Codes:** `permission_denied`, `app_not_running`, `timeout`, `not_found`,
    `applescript_error`, `database_error`, `bad_request`, `app_disabled`, `unknown_tool`,
    `internal_error`. Messages also throws `wrong_number`, `message_not_sent` and
    `ambiguous_number`, which **aren't in the `FailureCode` union**.
  - **Classifying Apple Events errors:** `classifyAppleError` matches -1743, -1744 and -10004
    plus phrases for a denial, -600 and -609 for not running, and -1712 for a timeout. A code
    it can't place falls through to `applescript_error`.
  - **Unknown tool vs disabled app:** an unknown tool is now checked before the app-disabled
    gate.
- **Evidence:** `42c2fd7`, `ac53e87` (`fix/uniform-failure-envelope`). Tests are in
  `tests/envelope.test.ts`. The spec it follows (`docs/MCP_FAILURE_ENVELOPE.md`) isn't in this
  repo. Upstream #15.
- **Quality of the fix:** partial.
  - **Guessing from strings:** denials are detected by matching strings ("not allowed",
    "permission to"), which can misfile an ordinary script error as a denial.
  - **Types:** the three Messages codes shouldn't typecheck.
  - **Unconfirmed reported as failed:** "unconfirmed" isn't a code of its own. A send whose
    outcome couldn't be checked comes back as `message_not_sent` (C25).
- **Verdict:** adopt the idea (a named failure code, a sentence, verbatim evidence, a length cap,
  redaction). Also verify: `tsc --noEmit passes on fork-faces-sh/main` (I expect it to fail on
  the three codes).
- **Scenarios:**
  - [acceptance] `a failing tool` — `given any failure, reports it as an error whose first line names the failure and says what did not happen`
  - [acceptance] `a failing tool` — `given the underlying process complained, carries its words verbatim after the first line`
  - [domain] `failure evidence` — `given evidence carrying a bearer token, redacts the credential and keeps the rest`
  - [domain] `failure evidence` — `given evidence longer than the cap, cuts it and marks the cut`
  - [acceptance] `calling a tool` — `given a tool name the server has never had, refuses it as unknown rather than disabled`

### C4 A denied permission names the permission, the pane and the app to enable

- **Kind:** fix
- **Context:** cross-cutting
- **Symptom:** A user with a missing grant got a dead tool. The message didn't say which switch
  to flip, or it named "Faced", which had since been renamed, so no such row existed in System
  Settings.
- **Root cause:** Upstream's denial text is generic, and the name of the host app was hard-coded.
  `APPLE_MCP_APP_NAME` was passed in but never read.
- **Technique:** `hostAppName()` reads `APPLE_MCP_APP_NAME`, falling back to "this app".
  `grantSentence(...paths)` produces "Enable <app> under System Settings > Privacy & Security >
  <path>[, and under <path2>]". Every summary object names its own pane:
  - reading Messages: **Full Disk Access**
  - sending Messages: **Automation > Messages**
  - notes: **Automation > Notes**
  - calendar: **Calendars** plus **Automation > Calendar**
  - reminders and contacts, through Maestro: **Reminders** and **Contacts**

  There's a deliberate rule not to add guesses ("no 'then try again'"). One test walks every
  denial sentence in the server. `oss-cleanup` makes the same move independently (`4c3096d`).
- **Evidence:** `ac53e87`, `4c3096d` (`oss-cleanup`), `42c2fd7`. Upstream #65, #71.
- **Quality of the fix:** partial. The sentence is right, but the classification underneath it is
  a string heuristic (C3). The server never asks macOS for the TCC status, and never tells "not
  yet asked" apart from "denied".
- **Verdict:** adopt the idea. It is non-negotiable 5. Verify: `on macOS 14+, a JXA call to Notes
  without Automation consent raises -1743, while one that is merely not yet prompted raises
  -1744`.
- **Scenarios:**
  - [acceptance] `reading message history` — `given Full Disk Access is not granted, fails as a missing permission that names Full Disk Access and the app to enable`
  - [acceptance] `sending a message` — `given Automation control of Messages is denied, fails as a missing permission that names Automation > Messages`
  - [domain] `a missing-permission failure` — `never suggests anything it cannot know, such as trying again`

### C5 A read that could not happen is never reported as an empty result

- **Kind:** fix
- **Context:** cross-cutting
- **Symptom:** A message with attachments said it had none. An unusable handle said "no
  messages". A denied Full Disk Access, a missing `chat.db`, a corrupt `chat.db` and a missing
  `sqlite3` binary were all reported as "grant Full Disk Access". A calendar scan in which every
  calendar failed said "no events". An empty search string "found nothing".
- **Root cause:** `utils/message.ts:247,254` (`getAttachmentPaths` returns `[]` on error),
  `utils/message.ts:92-115` (`checkMessagesDBAccess` returns `false` for every cause),
  `utils/calendar.ts:140,200`, `utils/reminders.ts:131-175`, `utils/notes.ts:133,205` (every
  catch returns `[]`).
- **Technique:** `throwMessagesDbFailure` splits the cases into a denial (EACCES/EPERM/"unable to
  open database file"/"authorization denied"), `not_found` (ENOENT on the db) and
  `database_error`, and keeps sqlite3's own words. `ensureMessagesDBAccess` runs `SELECT 1`
  before every read *and before every send* (`ac0058a`). An empty needle is a `bad_request`. When
  every item fails, the call fails. Totals that are only a nicety return 0 rather than throwing.
- **Evidence:** `42c2fd7`, `ac0058a`. Upstream #66, #58 (contacts), #69.
- **Quality of the fix:** complete for Messages. For the Maestro-backed apps the question moves
  into Maestro, which can't be checked from here.
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [acceptance] `reading message history` — `given the message database cannot be opened, fails rather than reporting no messages`
  - [acceptance] `reading message history` — `given no message database exists on this Mac, fails as not found rather than as a missing permission`
  - [acceptance] `searching the calendar` — `given empty search text, refuses rather than reporting zero results`

### C6 Maestro: EventKit and Contacts are read by the host app that holds the grant

- **Kind:** refactor
- **Context:** reminders, contacts, calendar
- **Symptom:**
  - **Reminders:** list and search never returned. One property read took about 35 s and `list`
    gave no answer in 420 s.
  - **Contacts:** "all contacts" returned 252 of 1,645 cards.
  - **Calendar:** a 7-day read took 4.6 s and drifted to 15 s.
- **Root cause:** The cost of Apple Events is per element for Reminders and per event for
  Calendar, and no bulk shape of the call avoids it (measured in `0216d96`: 50 list names 18.7 s,
  15 reminders' names 32.1 s). The contacts list went through the phone-only `getAllNumbers`
  (upstream `utils/contacts.ts:53-125`).
- **Technique:** `utils/maestro.ts` `ask(door, action, payload, summaries)`:
  - **The call:** POST `{action, ...payload}` to `MAESTRO_<STORE>_URL` with a per-store secret
    header.
  - **The reply:** `{ok:true, ...}`, or `{ok:false, code, reason}`, where the code and sentence
    travel unchanged into the envelope.
  - **No door:** `app_not_running` "can only be read inside Maestro". There's **no fallback** to
    scripting, on purpose, because the scripted path gave wrong answers rather than slow ones.
  - **Why Maestro does the reading:** a TCC grant attaches to a process, and "a helper would key
    its own grant". The Maestro code (Swift, EventKit, `CalendarOrderTests`) **isn't in this
    repo**.
  - **Measured:** reminders lists went from 155 s to 0.05 s, contacts from 1.8 s (252 cards) to
    0.79 s (1,645 cards), and calendar from 4.59 s to 0.04 s.
  - **Creates:** "read back from the store" happens inside Maestro.
- **Evidence:** `dbffae5`, `82efc89` (`feat/reminders-via-eventkit`,
  `feat/contacts-calendar-via-maestro`). Upstream #53, #26, #10, #75, #74, #25.
- **Quality of the fix:** can't be judged from this repo. The server side is a thin authenticated
  RPC client. There's a contradiction inside the fork: the `oss-cleanup` helper says the opposite
  about TCC attribution (C7).
- **Verdict:** reject the mechanism (a proprietary host over loopback HTTP). Adopt the finding
  that EventKit and Contacts.framework are the only workable route, and that no scripted fallback
  should exist. Verify: `a Swift helper spawned by the MCP server's Node process gets its
  Reminders/Contacts TCC prompt attributed to the host app (Terminal/Claude), not to the helper,
  and a grant to the host covers it`. This decides Decision 3.
- **Scenarios:**
  - [contract] `the reminder store` — `given a store of over a thousand reminders, lists them all within a second`
  - [acceptance] `listing contacts` — `given cards that have only an email, includes them in the list`
  - [acceptance] `reading reminders` — `given the native helper cannot be reached, fails naming that rather than falling back to scripting`

### C7 A Swift EventKit helper for reminders and calendar, with recurrence (oss-cleanup)

- **Kind:** feature
- **Context:** reminders, calendar
- **Symptom:** Reminders search blew its time budget and read as "no matches". A repeat such as
  "every day at 8:30" was dropped, because Apple Events can't set recurrence.
- **Root cause:** It's per-list Apple Event costs, about 5 s per list (`39585ad`).
- **Technique:** `helpers/EventKitHelper.swift`, called by `utils/eventkit.ts` through `execFile`,
  one JSON argv per call.
  - **Operations:** reminders `lists/list/search/create/update/delete`, calendar
    `list/search/get/create/update/delete`.
  - **Access:** requested on every run with `requestFullAccessTo{Reminders,Events}` (macOS 14+,
    with a fallback for older versions). A denial comes back as `{error, denied:true}` and exits
    2, which becomes `PermissionError`.
  - **Dates:** they go in as epoch ms and come out as ISO in local time, because "an agent reading
    UTC parrots UTC at the user" (`bfd5b64`).
  - **Recurrence:** `{frequency, interval}` maps to `EKRecurrenceRule`. A repeating reminder
    without a due date is refused.
  - **Finding an event to change:** by `eventId`, or by the title within a window. More than one
    match returns `ambiguous` with the candidates. Updates and deletes use
    `span: .futureEvents`.
  - **Finding a reminder to change:** by id or **the first reminder whose name contains the
    text**, with no ambiguity check.
  - **Limits:** `MAX_ITEMS` 1000.
  - **Build:** `swiftc` at build time.
  - **No fallback path:** "two implementations of the same contract is how silent divergence
    happens". An earlier version kept a JXA fallback (`7160b0a`), which was then removed.
  - **Permissions:** "TCC responsibility walks up to the app that spawned us".
- **Evidence:** `7160b0a`, `bfd5b64`, `4587d0a` (`oss-cleanup`). Upstream #64, #34, #53, #27.
- **Quality of the fix:** partial.
  - **Reminder writes can hit the wrong item:** update and delete act on the first
    `contains` match, which can edit or delete the wrong reminder.
  - **Silent truncation:** the 1000 cap on `list` isn't reported.
  - **The 60 s access wait:** if it times out, the result counts as not granted.
  - **Recurring deletes:** `.futureEvents` on delete removes the whole remaining series with no
    warning.
  - **What works:** the argv/JSON protocol and the local-time output.
- **Verdict:** adopt the idea (this is plan.md's Swift helper in miniature). Reject a mutation
  target chosen by first-contains. Verify: `EKReminder.dueDateComponents built with hour and
  minute keeps the time when shown in Reminders.app (upstream #64)`.
- **Scenarios:**
  - [acceptance] `creating a reminder` — `given a daily repeat and a due time, creates a reminder that repeats every day`
  - [acceptance] `creating a reminder` — `given a repeat but no due date, refuses: a repeat needs an anchor`
  - [acceptance] `changing an event by title` — `given two events in the window share the title, refuses and lists both with their ids`
  - [acceptance] `deleting a reminder by name` — `given two reminders contain the text, refuses and lists both rather than deleting the first`
  - [contract] `the native helper` — `reports every date in the user's local time with its offset`

### C8 Creating a twin of an existing reminder or event is refused (oss-cleanup)

- **Kind:** feature
- **Context:** reminders, calendar
- **Symptom:** "Actually make that 8:30" was dispatched as a second create, which left two
  reminders or a double-booked meeting.
- **Root cause:** Upstream has no update, so a change turns into a new item (upstream #27 "edits
  create new items").
- **Technique:** In the helper, `create` fails when an open reminder has the same name (case
  insensitive), or an upcoming event within the next year has the same title. The failure names
  the existing item (and the event id) and points at `update`. `allowDuplicate=true` overrides it.
- **Evidence:** `bcdc856` (`oss-cleanup`). Upstream #27.
- **Quality of the fix:** partial. It only catches an exact title match. For calendars, a
  weekly "Standup" makes every new "Standup" require the override.
- **Verdict:** adopt the idea (an explicit override for an obvious duplicate). Scope the calendar
  check to overlapping times rather than a whole year.
- **Scenarios:**
  - [acceptance] `creating a reminder` — `given an open reminder with the same name, refuses and names the existing one so it can be changed instead`
  - [acceptance] `creating a reminder` — `given the caller says a second copy is wanted, creates it despite the same name`

### C9 A calendar that doesn't exist is refused with the real names listed

- **Kind:** fix
- **Context:** calendar
- **Symptom:** "Put it on my troyth gmail cal" failed, and the model had no way to learn the real
  calendar names, so it went round in circles until it hit its step cap.
- **Root cause:** Upstream `createEvent` quietly uses the default calendar when the name doesn't
  match, and there's no operation that lists calendars.
- **Technique:**
  - **`oss-cleanup`:** a `listCalendars` operation (one AppleScript read, which splits the list
    on `", "`), and a create that fails with "not found" appends the names.
  - **`main`:** Maestro fails with `not_found` "naming the writable calendars". A read-only
    calendar is refused the same way.
- **Evidence:** `34dced4` (`oss-cleanup`), `82efc89`.
- **Quality of the fix:** partial. A calendar whose name contains ", " breaks the list on
  `oss-cleanup`. The `main` behaviour lives in Maestro.
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [acceptance] `creating an event` — `given a calendar name that matches no calendar, refuses and lists the calendars events can be created in`
  - [acceptance] `creating an event` — `given a read-only calendar, refuses rather than writing somewhere else`

### C10 Scripted reminder search limited by time, that says how much it covered (superseded)

- **Kind:** fix
- **Context:** reminders
- **Symptom:** On a 50-list iCloud store, a search returned "no matches" for reminders that exist.
- **Root cause:** A per-reminder property loop over Apple Events. Even `whose` costs about 5 s per
  list.
- **Technique:**
  - **Filtering:** `whose(name contains)` per list, one event each.
  - **Order and budget:** the default list first, then a sweep under a hard time budget.
  - **Coverage:** it reports "searched 12 of 50 lists".
  - **Result text:** matches go into `content`.
- **Evidence:** `8ac7cb9`, `39585ad` (`oss-cleanup`). Deleted three commits later by `4587d0a`.
- **Quality of the fix:** partial, and superseded. The measurement (about 5 s per list even with
  `whose`) is the lasting value.
- **Verdict:** reject: superseded by EventKit. Keep the rule that partial coverage is stated
  (C16).
- **Scenarios:**
  - [acceptance] `searching reminders` — `given the search could not cover every list, says how many lists it covered`

### C11 Reminders is launched before a create (superseded)

- **Kind:** fix
- **Context:** reminders
- **Symptom:** "Set a reminder" failed unless Reminders.app was already open.
- **Root cause:** Writing to a Reminders app that isn't running, from a detached subprocess, throws
  an AppleEvents connection error. Upstream `createReminder` never activates the app
  (`utils/reminders.ts:227-300`).
- **Technique:** `Application("Reminders").activate()` at the top of the JXA create.
- **Evidence:** `3c590df` (`fix/reminders-launch-on-create`). Removed by `dbffae5` when creates
  moved to Maestro.
- **Quality of the fix:** partial, and superseded.
- **Verdict:** reject: superseded by EventKit, which needs no running app. It matters only if
  Notes or Messages scripting show the same thing (verify: `a JXA make-new on Notes.app when the
  app is not running succeeds without an activate`).
- **Scenarios:**
  - [contract] `the note automation` — `given Notes is not running, creates the note all the same`

### C12 Notes are read one property per Apple Event, never one note at a time

- **Kind:** fix
- **Context:** notes
- **Symptom:**
  - **Listing and searching:** `notes list` took 945 s. A search took 1,016 s and looked at only
    the first 1,000 of 3,152 notes, finding 4 of the 14 matches.
  - **Folder scan:** 51.8 s for 29 notes.
- **Root cause:** Upstream loops over the notes, reading each note's properties separately
  (`utils/notes.ts:78-133,140-205,341-435`), and caps the list at 50 notes and 200 characters
  (`utils/notes.ts:6,8`). The fork's first rewrite kept the per-note loop.
- **Technique:**
  - **Reads:** `Notes.notes.name()` and `Notes.notes.plaintext()` are two events for the whole
    store (0.44 s for 3.5 MB). A folder scan is five events: folder names, then four columns.
  - **Matching:** done in TypeScript. **Measured: `whose({plaintext:{_contains}})` took 2.51 s
    against 0.49 s** for the two column reads plus JS matching, and `whose` can't see titles.
  - **Alignment check:** `assertAlignedColumns` fails when columns come back with different
    lengths, after one retry.
  - **Truncation:** `MAX_NOTES` goes from 1,000 to 5,000, and truncation is reported.
  - **Folder lookup:** one `folders.name()` call and an index, 0.004 s against 0.8 s.
  - **What it gives up:** one unreadable note now fails the whole read, and how
    password-protected notes behave is "not measured".
- **Evidence:** `0216d96` (`perf/bulk-property-fetches`). `tests/bulk-reads.test.ts` "notes are
  read a column at a time". Upstream #67, #44, #43.
- **Quality of the fix:** partial. The whole store crosses the JXA stdout pipe on every search
  (the stated ceiling is 100 MB). Locked notes are unknown.
- **Verdict:** verify: `on a store of several thousand notes, whole-collection name() and
  plaintext() reads return aligned arrays in under a second, and a password-protected note does
  not fail the read`. This feeds the "Notes: JXA vs NoteStore.sqlite" row. The `oss-cleanup`
  line chose `whose` with a scan fallback instead (C34), so the two lines conflict.
- **Scenarios:**
  - [contract] `the note store` — `given thousands of notes, searches every one of them rather than the first few`
  - [contract] `the note store` — `given the store changes between two column reads, fails rather than pairing one note's title with another's body`
  - [acceptance] `searching notes` — `given text that appears only in a note's title, finds that note`

### C13 A contact lookup returns the emails and the card's stable id

- **Kind:** fix
- **Context:** contacts
- **Symptom:**
  - **No emails:** asking Contacts for somebody's email returned nothing.
  - **Missing cards:** the list left out everyone without a phone (1,370 of 1,647 cards).
  - **Slow:** a search took 211 s.
- **Root cause:** Upstream reads only phones (`utils/contacts.ts:53-125`, `findNumber`), and only
  lists contacts that have one (`:92`).
- **Technique:**
  - **Results:** each result carries `id` (verified equal to `CNContact.identifier`, and the same
    as JXA `person.id()`), `name`, `emails[]` and `phones[]`.
  - **Name search:** the whole query first, then each word of three or more letters, with
    duplicates removed by id. So the full name ranks ahead of a surname match.
  - **Listing:** `contactsIndex` prints every card, emails before phones, and says "(no email or
    phone on the card)" rather than dropping it.
- **Evidence:** `26a3d1c` (`feat/contact-identifier`), `82efc89`, `16172e8`.
  `tests/contacts-render.test.ts`. Upstream #75, #47, #58.
- **Quality of the fix:** complete for the output. The matching is a plain substring match (no
  accent folding, unlike messages search).
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [acceptance] `looking up a contact` — `given a card with only an email, reports that email`
  - [acceptance] `looking up a contact` — `reports each card's stable identifier, so the same person can be addressed again after a rename`
  - [acceptance] `looking up a contact` — `given a full name that is also a surname elsewhere, lists the full-name match first`
  - [acceptance] `listing contacts` — `given a card with neither email nor phone, lists it and says it has neither`

### C14 Putting names on messages costs one read of the address book per request

- **Kind:** fix
- **Context:** messages, contacts
- **Symptom:** `unread` with `limit 2` took 306 s, and with `limit 10` it took 30 minutes.
- **Root cause:** Upstream `index.ts:455-470` calls `findContactByPhone` for each message inside
  `Promise.all`, and each call reads the whole address book over Apple Events.
- **Technique:** `namesForHandles(handles)` resolves a batch in one pass. Emails match exactly
  (case-insensitive) and phones match with `phonesMatch` (equal digits, or a shared tail of at
  least 7 digits). `findContactByPhone` is a batch of one. Results are **not cached** across
  calls, on purpose: "somebody who adds a contact and immediately asks who just texted" would get
  a stale name. `oss-cleanup` instead caches briefly, sharing in-flight scans.
- **Evidence:** `0216d96`. `tests/bulk-reads.test.ts` "a batch of handles is ONE read".
- **Quality of the fix:** complete. Its phone matching is looser than C22's matching of handles
  that exist, which is used for threads.
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [acceptance] `listing unread messages` — `given many unread messages from different senders, reads the address book once to name them`

### C15 "The next N events" are the earliest N across every calendar

- **Kind:** fix
- **Context:** calendar
- **Symptom:** "The next 5 events" returned five from one calendar starting months later, out of
  order, while earlier events sat in calendars the scan never opened.
- **Root cause:** The scan filled the limit one calendar at a time and stopped (the fork's own
  first JXA rewrite did this, and upstream `getEvents` returns a dummy event).
- **Technique:** Collect the start times of every calendar, sort, cut in TypeScript, then read
  details only for the events kept. On `main` the sort moved into Maestro
  (`CalendarOrderTests`, not in this repo), and the TS side keeps "the order Maestro sent is the
  order returned".
- **Evidence:** `0216d96`, `82efc89`. `tests/bulk-reads.test.ts`. Upstream #74, #25.
- **Quality of the fix:** complete as designed. The code that runs on `main` can't be seen.
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [domain] `a calendar window` — `given more events than the limit across several calendars, keeps the earliest ones whichever calendar holds them`
  - [acceptance] `listing events` — `reports events in start order across calendars`

### C16 A page of results says what it is a page of, and where the ceiling is

- **Kind:** fix
- **Context:** cross-cutting
- **Symptom:** Four answers that were quietly partial: notes "1,000 of 3,152", contacts "252 of
  1,645", mail search "10 of about 201" (in the Python proxy), unread "10 of 70". The agent
  reported the page size as the total ("there are ten invoice emails").
- **Root cause:** Upstream prints `Found ${n}` with no total (e.g. `index.ts:478`) and caps
  silently.
- **Technique:**
  - **`showing(shown, total, noun, ofWhat, ceiling)`** (`utils/showing.ts`):
    - "Showing 10 of 70 unread message(s). Ask for more with limit, or narrow the search:"
    - at the ceiling (50) it says "50 is the most this can return at once, so narrow the search"
      rather than advising a larger limit that can't work
    - a total below what's shown is clamped
    - zero rows gives "No …"
  - **Counts:** a second `COUNT(*)` query shares one WHERE constant with the page query. It
    returns 0 on error, so the page still ships.
  - **Notes and calendar:** they use separate suffix notes (they admit to being duplicates).
  - **Messages search:** it reports "The most recent N messages were searched, back to <date>"
    when its scan limit was reached.
- **Evidence:** `54c30e3`, `799d643`, `16172e8`, `ccc9f55`. `tests/showing.test.ts`.
- **Quality of the fix:** partial. Three copies of one idea, and a failed count silently degrades
  to "no total".
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [domain] `a page of results` — `given fewer shown than exist, states both numbers`
  - [domain] `a page of results` — `given the page is at the hard ceiling, advises narrowing rather than asking for more`
  - [acceptance] `listing unread messages` — `given more unread than the limit, reports how many are unread in total`
  - [acceptance] `searching messages` — `given the search stopped before the oldest message, says how far back it reached`

### C17 A notes list or reminders list is an index; the full content is one search away

- **Kind:** fix
- **Context:** notes, reminders
- **Symptom:**
  - **Notes:** `notes list` returned 2.3 MB of text in a single turn.
  - **Reminders:** `reminders list` answered only "Found 50 lists and 1217 reminders." The
    reminders themselves were in a top-level `reminders` field, which MCP clients never show.
- **Root cause:** Upstream `index.ts:846-850` (and `:865,921`) puts results in non-`content`
  fields. Upstream notes list returns full previews.
- **Technique:**
  - **Notes list:** a header, "N notes, first 200 characters of each. To read one in full, search
    for its name.", then `name: <first 200 characters, whitespace flattened>` for every note.
  - **Reminders list:** `remindersIndex` gives a header with to-do and done counts, then every
    list with its id, and under each list every reminder name with its due date. To-do items
    come before done ones, and done ones are marked. Reminders whose list doesn't match are still
    printed, and notes are left out ("search for it by name"): 42 KB for 1,217 reminders.
  - **Search and listById:** they return full detail (`remindersDetail`).
  - **Content only:** everything goes into `content`.
- **Evidence:** `94149a2` (`feat/notes-list-is-an-index`), `dbffae5`.
  `tests/reminders-render.test.ts`. Internal #504, #499.
- **Quality of the fix:** partial.
  - **Search isn't whole:** notes search is described as returning "whole bodies" but uses
    `notePreview`, which cuts at 2,000 characters.
  - **No read by id:** there's no way to read one note by id, so a note sharing a title can't
    be reached.
  - **Size:** the notes index is still 608 KB for 3,154 notes.
- **Verdict:** adopt the idea (an index, plus reading one item by id). Reject read-by-title as the
  only route.
- **Scenarios:**
  - [acceptance] `listing notes` — `reports every note's title with a short preview and says how to read one in full`
  - [acceptance] `listing reminders` — `names every reminder under its list, to do before done, rather than only counting them`
  - [acceptance] `any tool result` — `puts everything the agent needs in the content it reads, never in a side field`
  - [acceptance] `reading a note` — `given a note longer than the preview, returns its whole body`

### C18 attributedBody is decoded by reading the typedstream, not by regex

- **Kind:** fix
- **Context:** messages
- **Symptom:** Message bodies came back as mojibake (`https://s.sumup.com/77ojrn_q��iI/��`),
  accents were destroyed ("most of the message" in French), and an audio transcript was lost.
- **Root cause:** Upstream `utils/message.ts:156-230` runs `Buffer.toString()` over the blob,
  applies XML regexes that don't match a typedstream, then scrubs its own artefacts with
  `.replace(/\s*iI\s*[A-Z]\s*$/, "")`.
- **Technique:** `utils/typedstream.ts`.
  - **Scanning:** it looks for `+` (0x2B), then a length: one byte if below 0x80, `0x81` followed
    by 2 bytes little-endian, or `0x82` followed by 3 bytes. It then reads that many UTF-8 bytes.
  - **Rejecting bad frames:** it skips lengths that overrun the blob and slices that decode to
    U+FFFD.
  - **The text:** the first string that isn't archive bookkeeping (`NSString`, `__kIM…`,
    `at_N_<guid>` transfer ids, bare GUIDs).
  - **URLs:** extracted from the decoded text.
  - **Origin:** ported from Faces' voiceprint reader.
  - **Measured:** of 44,758 messages, 63 had `text`. Everything else is `attributedBody` only.
- **Evidence:** `cad640a`. `tests/typedstream.test.ts` (8 cases, including accents, the
  2-byte length, a transcript among attribute names, and an overrun). Upstream #62.
- **Quality of the fix:** partial. It's a heuristic scan for `+`, not a real typedstream parser,
  and "first non-bookkeeping string" could pick an attribute value (for example a link preview
  title) over the body. Mentions and multi-part bodies aren't handled.
- **Verdict:** adopt the idea. plan.md already asks for a real decoder, and these fixtures are
  good seeds. Verify: `the first non-bookkeeping string is the body for messages with a mention,
  a rich link, an edited message and an inline reply`.
- **Scenarios:**
  - [domain] `an attributed body` — `given accented and non-Latin text, decodes it intact`
  - [domain] `an attributed body` — `given a body longer than 127 bytes, reads its multi-byte length`
  - [domain] `an attributed body` — `given an audio message, finds the transcript among the archive's own attribute names`
  - [domain] `an attributed body` — `given a length that overruns the blob, yields nothing rather than garbage`

### C19 A conversation (chat) is the unit, and groups are conversations

- **Kind:** feature
- **Context:** messages
- **Symptom:**
  - **No thread list:** "The last five messages I received" returned 5 of 71 unread marketing
    texts. There was no way to list the threads.
  - **Groups invisible:** a group thread showed up as separate people, so the discussion couldn't
    be named.
  - **Flat handle reads:** reading by number printed one person's side of three group chats
    interleaved as "your conversation with +1408…".
  - **No group replies:** a group couldn't be answered.
- **Root cause:** Upstream keys everything on `handle.id` (`utils/message.ts:258-313`): it
  selects `WHERE h.id IN (...)` across all chats and has no chat model.
- **Technique:** `utils/conversation.ts`.
  - **Conversation fields:** `{chatId (chat.ROWID), guid (chat.guid, what AppleScript
    addresses), isGroup (chat.style 43, 45 = one-to-one; participant count is not the test),
    participants (chat_handle_join → handle.id, the user excluded), title (display_name),
    last*}`.
  - **`recent`:** one row per chat by its latest genuine message (C23).
  - **`conversationsWith(handleSets)`:** chats that hold every person, where each person matches
    through any of their handles.
  - **Reading by handle:** goes through the same lookup. The newest chat is the default, and the
    others are listed as "also in N other conversations".
  - **`readConversation(chatId)`:** reads by `chat_message_join`, with the sender from a LEFT
    JOIN on handle.
  - **Sending into a thread:** `send ... to chat id "<guid>"`.
- **Evidence:** `cad640a`, `ccc9f55`, `20c7fa3`, `0736b63`. `tests/conversation.test.ts`,
  `tests/messages-find.test.ts`. Upstream #3, #62.
- **Quality of the fix:** complete for reads. The chat list is re-queried in full, unbounded, on
  every name lookup, and search calls `listConversations(200)`, so a thread older than the 200th
  chat has no label.
- **Verdict:** adopt the idea. It's the core Messages data model for `CONTEXT.md`. Verify: `a sent
  message in a one-to-one chat carries the other party's handle_id, while a sent message in a
  group carries handle_id 0`. `main` says the group case gives 0, and `oss-cleanup` says the 1:1
  case does.
- **Scenarios:**
  - [acceptance] `recent conversations` — `lists one row per conversation, groups included and marked as groups, newest first`
  - [acceptance] `reading a conversation` — `given a phone number, shows both sides of that person's newest thread and mentions their other threads`
  - [domain] `a conversation` — `given a group that has shrunk to one other person, is still a group`
  - [acceptance] `reading a conversation by names` — `given two people, opens the newest thread that holds both of them`

### C20 A name resolves to one person or becomes a question; recency only breaks ties

- **Kind:** feature
- **Context:** messages, contacts
- **Symptom:**
  - **Names refused:** `read "Caroline"` was refused, so the agent looked her up in Contacts,
    picked a *different* Caroline, and read an empty address.
  - **Merged people:** reading the owner's own full name opened his mother's thread, because loose
    Contacts matching merged both cards' handles.
- **Root cause:** Upstream has no name path. The fork's first version pooled the handles of every
  card that matched.
- **Technique:** `resolveRecipient(cards, lastSeenByHandle)`, a pure function, has four outcomes:
  - **`one`:** exactly one card with handles wins **however cold the thread**, or several cards
    of which exactly one has been in touch.
  - **`several`:** returns the candidates, with last-in-touch or "never in touch".
  - **`unknown`:** Contacts was read and has no one by that name. It's never phrased as "no
    messages from them", because most handles have no card.
  - **`cannot-ask`:** Contacts couldn't be read. It gets its own sentence, naming the grant.

  How it works:
  - **Order of a person's handles:** by their own genuine last contact, with dead handles last,
    never dropped.
  - **Lookup:** through every spelling of the handle (`9852b0e`). The first version never
    matched a card spelled "+1 (555) 010-0100" against E.164 `handle.id`, so ranking did nothing and a
    `one` could be a different person.
  - **Several names ("Ana and Ben", `namesAsked` splitting on `, & + and et`):** each
    name resolves separately. Any `several` makes the whole request a question. A two-word name
    stays one name.
- **Evidence:** `cad640a`, `0d381f9`, `68cd07b`, `9852b0e`. `tests/recipient.test.ts`,
  `tests/conversation.test.ts`. Upstream #48.
- **Quality of the fix:** complete for the rule. Matching a card to a name is a substring match,
  so "Ann" can match "Joanne".
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [domain] `resolving a name to a person` — `given exactly one matching card, resolves to that person however long since they were in touch`
  - [domain] `resolving a name to a person` — `given several matching cards and only one in touch, resolves to the one in touch`
  - [domain] `resolving a name to a person` — `given several matching cards all in touch, asks which one and lists them with when each was last in touch`
  - [domain] `resolving a name to a person` — `given no card matches, reports the name as unknown rather than claiming there are no messages`
  - [acceptance] `reading a conversation by name` — `given contacts cannot be read, fails as a missing Contacts permission rather than saying nobody has that name`
  - [domain] `resolving a name to a person` — `given two cards share a surname, never merges their handles`
  - [domain] `a person's handles` — `given a card that spells a number with punctuation, ranks it by the history stored under its E.164 form`

### C21 Reads may default to a thread; sends must be unambiguous

- **Kind:** hardening
- **Context:** messages
- **Symptom:**
  - **No sending by name:** the agent was shown the contact's name, couldn't send to a name, and
    gave up.
  - **Silent no-op:** `send` to a first name built `buddy "<name>"`, which Messages accepts
    and does nothing with, yet the tool said "Message sent to <name>".
  - **Strangers in the group:** a two-name send could land in a group with strangers in it.
  - **Wrong name echoed:** the confirmation repeated the raw input, not who actually received it.
- **Root cause:** Upstream `index.ts:384-389` prints `Message sent to ${args.phoneNumber}` whatever
  happened. `buddy` is resolved by name at the app level.
- **Technique:**
  - **Last-resort guard:** `sendMessage` refuses anything that isn't `looksLikeHandle` (an email,
    or digits and phone punctuation with at least 5 digits) with a `bad_request` "Nothing was
    sent: … is a name".
  - **One name:** at dispatch it resolves to the person (never to a group they're in). `several`
    returns the candidates with "Nothing was sent yet" (`isError: false`), and `unknown` or
    `cannot-ask` fails.
  - **Several names:** they must land on exactly one shared thread, and that thread must have
    **no participants beyond the names given**. Otherwise nothing is sent and the others are
    named (33 such pairs existed on the owner's Mac).
  - **Confirmation:** it names the handle or participants actually addressed, and "(asked for
    X)" when that differs from the input.
- **Evidence:** `20c7fa3`, `0736b63`, `9852b0e`, `39b7e40`. `tests/messages-find.test.ts` "a
  send that cannot happen is never reported as done". Upstream #48, #66.
- **Quality of the fix:** partial.
  - **Cold threads:** a single matching card sends to that person even if never in touch (only
    C22's check stands in the way).
  - **Results that aren't errors:** "Nothing was sent yet" questions come back with
    `isError: false`.
  - **No confirmation step:** nothing asks the user before sending (non-negotiable 2).
- **Verdict:** adopt the idea (the read/send asymmetry, the extra-participants refusal, a
  confirmation naming the real recipient). Verify: `Messages' app-level buddy "<name>" accepts
  an unregistered name and sends nothing without raising an error`.
- **Scenarios:**
  - [acceptance] `sending a message by name` — `given the name fits several people, sends nothing and lists who they could be`
  - [acceptance] `sending a message to several people` — `given the only thread they share also holds others, sends nothing and names the others`
  - [acceptance] `sending a message to several people` — `given they share more than one thread, sends nothing: a message must not go to the wrong one`
  - [acceptance] `sending a message` — `given a recipient that is neither a handle nor a resolvable name, refuses and says nothing was sent`
  - [acceptance] `sending a message` — `given a name was resolved, confirms the handle actually addressed alongside what was asked for`

### C22 Addresses match only handles that already exist; a number that fits two countries is refused

- **Kind:** fix
- **Context:** messages
- **Symptom:**
  - **Sent to France:** on a Mac in Paris, a Canadian number typed without its country code was
    normalised to +33 and sent to a real French subscriber (which also crashed Messages).
  - **Crash on a formatted number:** sending a formatted national spelling such as "(555) 010-0100" opened a chat
    with that literal identifier, and IMCore crashed while sorting chats.
  - **Missing thread:** reading by a card's spelling ("+1 (555) 010-0199") found no thread.
- **Root cause:** Upstream `utils/message.ts:39-70` assumes +1 for any bare number. The fork's
  `handleCandidates` parsed against `APPLE_REGION`, which means the Mac's region. Participants
  were compared as exact strings.
- **Technique:**
  - **`matchKnownHandles(input, known)`:** returns only strings already in `handle.id`, trying in
    order:
    1. the same string
    2. the same email, case-insensitively
    3. a non-numeric name (a carrier, a short code) matched only against itself
    4. the same digits
    5. one number's digits ending with the other's, sharing at least 7 digits, **trusted only if
       every match is the same number**

    Otherwise it returns `ambiguous` → `ambiguous_number` "give it with its country code". An
    ambiguous handle adds nothing to a thread search.
  - **`sendableHandle`:** passes a bare national number through unchanged and tidies only a
    number starting with `+` to E.164. The fork abandoned always sending E.164 (`9609cb4`) an hour
    later (`ad467f8`) because it invented a country.
  - **Test:** the region is pinned to FR, US, CA and JP and must give identical answers.
- **Evidence:** `784db41` (libphonenumber, `APPLE_REGION`), `9609cb4`, `ad467f8`, `ac0058a`,
  `a663d12`. `tests/handle-match.test.ts`, `tests/recipient.test.ts`. Upstream #24, #48.
- **Quality of the fix:** partial.
  - **The deprecated guesser is still used:** `handleCandidates` still does the region guess,
    and it's used by the wrong-number check (C26) and by `resolveRecipient` lookups.
  - **Ambiguity found too late:** on the send path the ambiguity check (`handleIdsFor`) runs
    **after** the message has been handed to Messages, inside the outcome check (C25).
  - **Crash-prone spelling still possible:** a bare formatted number with no stored handle is
    still sent in its formatted spelling, the shape that crashed IMCore.
- **Verdict:** adopt the idea. Verify: `sending to a bare formatted national number such as
  "(555) 010-0100" makes Messages create a chat whose identifier is that literal string`.
- **Scenarios:**
  - [domain] `matching an address to known handles` — `never returns a handle that is not already stored`
  - [domain] `matching an address to known handles` — `given a national number whose digits end two different stored numbers in different countries, reports it as ambiguous`
  - [domain] `matching an address to known handles` — `gives the same answer whatever region the Mac is set to`
  - [domain] `matching an address to known handles` — `given a card spelling with punctuation, matches the E.164 handle with the same digits`
  - [acceptance] `sending a message` — `given a number that fits two countries, refuses before anything is sent and asks for the country code`

### C23 Only genuine contact counts as having been in touch; our failed sends don't

- **Kind:** fix
- **Context:** messages
- **Symptom:** A self-reinforcing loop.
  1. A send to a dead landline failed (error 22).
  2. The failed row made the landline the most recent handle.
  3. The ranking then preferred it, and the wrong-number check saw "history".
  4. The next send went there again.

  It took six sends and six Messages crashes. The resulting "ghost chat" of five red bubbles was
  shown as "your conversation with <mother>" while her 7,754-message thread was hidden, and the
  send path took the ghost's guid.
- **Root cause:** There's no upstream equivalent. The fork's own recency queries counted every
  row.
- **Technique:** The exported `GENUINE_CONTACT = "(m.is_from_me = 0 OR (m.is_sent = 1 AND
  COALESCE(m.error, 0) = 0))"` is used by `lastSeenByHandle`, by the latest-message-per-chat
  subquery (duplicated inline in `conversation.ts`), and by the check that a thread is live in
  `sendToConversation`. A test runs the predicate against a real SQLite file.
- **Evidence:** `6e4b47a`, `9852b0e`, `ac0058a`. `tests/genuine-contact.test.ts`.
- **Quality of the fix:** partial. The predicate is copied rather than shared in
  `conversation.ts`, and `readConversation` and the unread/search queries don't apply it, so the
  red bubbles still appear inside a thread's content. That is arguably right, but it isn't
  stated.
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [domain] `having been in touch` — `given only our own undelivered messages to a handle, counts that handle as never in touch`
  - [domain] `having been in touch` — `given a message they sent us, counts it`
  - [acceptance] `recent conversations` — `given a thread holding only our own failed sends, does not list it as a conversation`

### C24 An empty search says what would have worked

- **Kind:** fix
- **Context:** messages
- **Symptom:** "<name> <name> meeting" found nothing and the run stopped, although the
  discussion was one `read` away, in their group thread.
- **Root cause:** Upstream answers "No messages found" with no guidance.
- **Technique:** The empty answer tells the caller to use fewer words, and to read the
  conversation by the people's names if the words are names. The final text still says "every
  word has to appear in the same message", **which went stale** when C28 made words rank rather
  than filter.
- **Evidence:** `616cefe`, `049af46` (the guidance names an action, "list recent conversations",
  not a tool verb, because the tool is proxied under other names), `6fe0c03` (the schema
  description said "Phone number", which talked the model out of passing a name).
- **Quality of the fix:** partial. The advice sentence contradicts the ranking it sits beside.
- **Verdict:** adopt the idea (a dead end names its ways out, in terms of actions, not tool
  names).
- **Scenarios:**
  - [acceptance] `searching messages` — `given nothing matches, suggests reading a conversation by the people's names`
  - [acceptance] `a failure that suggests a next step` — `names the action to take rather than an operation name that may not exist in the caller's toolset`

### C25 A send is reported as sent only once the store shows our message left

- **Kind:** fix
- **Context:** messages
- **Symptom:**
  - **Undelivered but "sent":** "Message sent" was printed over a message sitting in `chat.db`
    with `is_sent = 0, error = 22`, shown red with "Not Delivered".
  - **Swallowed send:** `buddy "<first name>"` was accepted and silently dropped.
  - **Broken first check:** the first check compared Unix seconds against Apple-epoch seconds
    (off by 978,307,200) with no recipient filter, so it read whatever outgoing row was newest
    anywhere on the machine.
- **Root cause:** Upstream `utils/message.ts:72-80` returns what `runAppleScript` returns, and
  `index.ts:389` always says sent. AppleScript `send` returns when Messages *accepts* the text.
- **Technique:** in `utils/message.ts`:
  - **Before sending:** `ensureMessagesDBAccess()`, so a denied Full Disk Access fails closed
    rather than turning both checks off (`ac0058a`).
  - **Timing:** `started = Date.now()`. `osascript` runs with an 8 s timeout and SIGKILL. **A
    timeout isn't a verdict**: it's logged and the store is checked anyway (`39b7e40`).
  - **`sendFailure(handle, started, scope)`:** the threshold is `(started/1000 − 978307200 − 2) ×
    1e9` in apple-epoch **nanoseconds**, the column's own units. It polls 10 times at 500 ms
    intervals:
    ```sql
    SELECT m.error, m.is_sent FROM message m
    LEFT JOIN handle h … LEFT JOIN chat_message_join cmj …
    WHERE m.is_from_me = 1 AND m.date > <threshold>
      AND (h.id IN (<ids>) | cmj.chat_id IN (SELECT ROWID FROM chat WHERE guid = '<guid>'))
    ORDER BY m.date DESC LIMIT 1
    ```
  - **Outcomes:**
    - no row: keep waiting
    - `error ≠ 0`: failure, "NOT delivered … (Messages reported error N)"
    - `is_sent = 1`: success
    - a row that isn't sent and has no error: keep waiting
    - still nothing after about 5 s: failure, "No record … does not appear to have been sent.
      Check the conversation before sending it again"
    - the store throws while polling: failure, "handed to Messages, but … could not be read to
      confirm"
  - **Result:** all of these throw `message_not_sent` (`isError: true`).
- **Evidence:** `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`. No test pins `sendFailure` itself.
  Upstream #66, #24.
- **Quality of the fix:** partial.
  1. **Unconfirmed reported as failed:** "unconfirmed" is reported as a failure with the same
     code, so an agent may resend a message that went (non-negotiable 3 wants a distinct
     unconfirmed outcome).
  2. **Pending looks like "no record":** a row that exists but hasn't reached `is_sent = 1`
     within about 5 s (a slow network) gets the "no record" wording, which is false.
  3. **Recipient ids computed after sending:** for a handle send, `ids` come from
     `handleIdsFor(target)`, **evaluated after the AppleScript returned**. If Messages hasn't
     created the handle row yet, `ids = []` becomes `h.id IN ('')`, and a message that went is
     reported as not sent. If the address is ambiguous, `ambiguous_number` is thrown about a
     message already handed over.
  4. **Another device can confirm it:** a send to the same handle from another device within the
     window can be taken for ours.
  5. **Delivery isn't checked:** `is_delivered` is ignored on purpose ("left", not "received").
  6. **No test** covers the polling logic.
- **Verdict:** adopt the idea (confirm against the store, compare in the column's units, filter
  to our recipient and our time, and treat a timeout as unknown, not failed). Use a
  prepared-statement read and give "unconfirmed" its own outcome. Verify: `after an AppleScript
  send to a handle never messaged before, the handle row and the outgoing message row both exist
  in chat.db before osascript returns`. Also verify: `is_sent becomes 1 within 5 s of send for a
  reachable iMessage recipient, and error 22 is written for an unregistered one`.
- **Scenarios:**
  - [acceptance] `sending a message` — `given the store shows our message left with no error, reports it sent to the recipient addressed`
  - [acceptance] `sending a message` — `given the store records our message with a delivery error, reports it not sent and names the error`
  - [acceptance] `sending a message` — `given no outgoing record appears for that recipient, reports that it does not appear to have been sent and warns against sending twice`
  - [acceptance] `sending a message` — `given the store cannot be read after the send, reports the outcome as unconfirmed rather than as sent or failed`
  - [acceptance] `sending a message` — `given Messages stops answering, still checks the store before reporting anything`
  - [contract] `the message store` — `given a send just made, finds only outgoing messages to that recipient newer than the moment of sending`
  - [domain] `a store timestamp` — `converts a moment to Apple-epoch nanoseconds and back without loss`

### C26 A number nobody has messaged is refused when the same person has one that works

- **Kind:** hardening
- **Context:** messages
- **Symptom:** The agent read "<contact> at <landline>" off a thread and sent to the
  number directly, bypassing name resolution. It was a landline with 0 messages in five years,
  while she writes from another number (5,325 messages). Each send failed with error 22 and
  crashed Messages.
- **Root cause:** Ordering handles by recency (C20) only helps when a name is being resolved.
  Upstream has no check at all (#48 "ghost contacts").
- **Technique:** `unusedNumberFor(target, {seenByHandle, whoOwns, cardsFor})` in
  `utils/wrongnumber.ts`, with all dependencies injected. In order:
  1. `seen = lastSeenByHandle()` (genuine contact only, C23). If `target` or any
     `handleCandidates(target)` spelling is in `seen`, **allow**.
  2. `name = whoOwns(target)` (the Contacts batch lookup, `phonesMatch`). No owner means
     **allow** (a new number).
  3. `cardsFor(name)`, filtered to cards that actually contain the target in some spelling. Not
     exactly one card means **allow** (so her son's card isn't used, `9852b0e`).
  4. The owner's handle with the latest genuine traffic. If none has any, **allow**.
  5. Otherwise **refuse** with `wrong_number` "Nothing was sent: <name> has never sent or received
     a message at <target>. They write from <better>. Send again with that number if you meant
     them."

  It **refuses, never redirects**, because someone who just changed number has no history on the
  new one. Any exception inside is **allowed** ("never block a send on a nicety"). In
  `sendToConversation`, a thread with zero genuine messages is refused with `wrong_number`
  (`ac0058a`).
- **Evidence:** `ddf6cb1`, `9852b0e`, `ac0058a`. `tests/wrong-number.test.ts` (5 cases,
  including "a number belonging to nobody is allowed" and "an unreadable Contacts never blocks a
  send").
- **Quality of the fix:** partial, and **much weaker than non-negotiable 4**.
  - **Unknown numbers go through:** any number no contact card holds is sent, even one never
    messaged, so a prompt-injected "text this number" goes through.
  - **Fails open:** it fails open when Contacts is unreadable (and on `main` that includes
    Maestro being unreachable).
  - **Region guessing:** "known" uses the region-guessing `handleCandidates`, so on a French Mac
    a bare Canadian number can count as known through a stranger's +33 handle.
  - **Loose ownership:** ownership uses the looser `phonesMatch` (a 7-digit tail).
- **Verdict:** adopt the idea (refuse rather than redirect, name the handle they actually use,
  inject the dependencies so a safety rule can be tested without sending). Reject fail-open and
  "unknown number allowed": plan.md requires a known contact or a number already messaged.
- **Scenarios:**
  - [acceptance] `sending a message` — `given a number never messaged that belongs to a contact who writes from another number, refuses and names the number they write from`
  - [acceptance] `sending a message` — `refuses to reroute to another number on its own: a changed number would send to a phone they no longer hold`
  - [acceptance] `sending a message` — `given a number that is neither a contact's nor ever messaged, refuses`
  - [acceptance] `sending a message` — `given contacts cannot be read, refuses to send to a number never messaged rather than allowing it`
  - [acceptance] `sending into a conversation` — `given a thread in which nothing was ever genuinely exchanged, refuses`

### C27 Reading a period: since and until, in the user's local days

- **Kind:** feature
- **Context:** messages
- **Symptom:** "Which of her messages went unanswered in six months" was impossible: reads were
  capped at 100 of 7,689 with no way to ask for a period, and the run gave up.
- **Root cause:** Upstream `readMessages` takes only `limit` (`utils/message.ts:258`).
- **Technique:** `utils/when.ts`.
  - **`instantOf(value, edge)`:** accepts `YYYY-MM-DD[ HH:MM[:SS]]`, built in local time. A bare
    date used as an **end** means 23:59:59.999. A date the calendar doesn't have
    (`2026-02-31`) is `null`. The result is in apple-epoch nanoseconds.
  - **`periodClause`:** an unreadable date is **ignored**, not applied, so a typo doesn't
    answer "they never wrote".
  - **`periodSaid`:** echoes only the ends it understood.
  - **Ceiling:** it rises from 100 to 600 when a period is given, "because it bounds the answer
    itself".
- **Evidence:** `1fa9dc5`, `64dac13`. `tests/when.test.ts`, `tests/conversation.test.ts`.
- **Quality of the fix:** partial. Ignoring a typo silently is debatable (the echo is the only
  signal). There's no timezone argument.
- **Verdict:** adopt the idea. Prefer refusing an unreadable date with `bad_request`, since the
  echo already exists.
- **Scenarios:**
  - [domain] `a period` — `given a bare end date, includes the whole of that day`
  - [domain] `a period` — `given a date, starts at local midnight rather than UTC midnight`
  - [domain] `a period` — `given a date the calendar does not have, refuses it rather than rolling over`
  - [acceptance] `reading a conversation for a period` — `given a start and end date, returns every message between them up to the raised ceiling and says which period it covered`

### C28 Messages search: Google's grammar, ranked, over people as well as text, across the whole history

- **Kind:** feature
- **Context:** messages
- **Symptom:**
  - **No search:** it was "[not_supported]".
  - **Literal matching:** two names matched only when adjacent.
  - **Recent history only:** the scan stopped at 1,200 messages ("meeting": 0 hits, while the
    whole history has 232).
  - **Missing sent messages:** an INNER JOIN on handle dropped every message the user sent to a
    group (14,640 of 45,038 rows).
  - **Every word required:** "<name> <name> meeting" found nothing, and
    `"<full name>" OR "<email>"` found nothing.
- **Root cause:** Upstream has no search. The fork's own intermediate versions had these faults.
- **Technique:**
  - **`parseQuery`** (`utils/query.ts`):
    - quoted runs (double or single quotes) are phrases, and `-"…"` / `-word` exclude
    - bare `OR`/`AND` in capitals are no-ops, while lowercase `or` is a word
    - everything is folded (NFD, combining marks stripped, lowercased)
    - an empty query matches nothing
  - **`scoreFields`:**
    - any exclusion hit means no match
    - each phrase adds 4× the best matching field weight, each term adds the best weight
    - `matched²` is added on top
    - zero matched means no hit
  - **Fields:** who (chat title, participants and their contact names, weight 3), the sender's
    name (3), the body (1).
  - **Scope:** it scans up to 50,000 newest rows with a LEFT JOIN on handle, `maxBuffer` 256 MB,
    decodes every body, ranks, and sorts by score then date. Each hit names its thread.
  - **Coverage:** `{scanned, bounded, oldest}`.
  - **Shared corpus:** `shared/query-corpus.json` (14 query-to-parse cases) is the fixture both
    this parser and Faces' Python mail and messaging proxies must satisfy.
- **Evidence:** `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`. `tests/query.test.ts`,
  `tests/query-corpus.test.ts`, `tests/messages-find.test.ts`. The brief's "mail search query
  syntax" is this.
- **Quality of the fix:** partial.
  - **Load:** it loads up to 50k rows of hex (about 48 MB) through a child process's stdout on
    every search.
  - **Stale test name:** `query.test.ts` still says "a quoted phrase is REQUIRED" after
    `bdbb896` made phrases optional.
  - **Label coverage:** thread labels come from only the 200 newest chats.
- **Verdict:** adopt the idea (a known grammar, ranking over filtering, who outranks what,
  coverage stated, a shared corpus). Verify: `a full decode-and-rank over 50,000 messages
  completes in under a second through node:sqlite without the CLI round-trip`.
- **Scenarios:**
  - [domain] `a search query` — `given bare words, treats each as optional and ranks messages matching more of them higher`
  - [domain] `a search query` — `given a quoted phrase, matches it only as consecutive words`
  - [domain] `a search query` — `given a word prefixed with a minus, excludes any message containing it`
  - [domain] `a search query` — `given capitalised OR between phrases, treats it as an operator rather than a word`
  - [domain] `a search query` — `given an empty query, matches nothing rather than everything`
  - [domain] `a search query` — `ignores accents and case`
  - [acceptance] `searching messages` — `given the people's names, ranks their shared thread above a message that merely mentions them`
  - [acceptance] `searching messages` — `given messages the user sent to a group, includes them`
  - [acceptance] `searching messages` — `names the conversation each hit came from`

### C29 A failed contact lookup never sinks the messages

- **Kind:** fix
- **Context:** messages
- **Symptom:** With Contacts denied, `unread`, `recent` and `search` returned no messages at all,
  just a contacts error.
- **Root cause:** Upstream `index.ts:455-470` lets `findContactByPhone`'s error reach the outer
  catch.
- **Technique:** Every name lookup on a read path is wrapped. An empty map falls back to raw
  handles ("a name is a nicety; the messages are the answer"). Thread labels are kept in their
  own try.
- **Evidence:** `799d643`, `ccc9f55`. Tests in `tests/messages-find.test.ts` ("still lists the
  conversations when Contacts refuses").
- **Quality of the fix:** complete. The user is never told the names are missing because of a
  permission.
- **Verdict:** adopt the idea, and add a note that names were unavailable.
- **Scenarios:**
  - [acceptance] `listing unread messages` — `given contacts cannot be read, still lists the messages under their numbers`

### C30 Each app can be switched off for the server

- **Kind:** feature
- **Context:** cross-cutting
- **Symptom:** Upstream has no per-user way to hide an app.
- **Root cause:** Upstream exposes every tool unconditionally.
- **Technique:** `APPLE_MCP_ENABLED_APPS` (comma separated). Unset exposes all apps, and empty
  exposes none. It filters `ListTools` and refuses dispatch with `app_disabled`.
- **Evidence:** `784db41`, `42c2fd7`.
- **Quality of the fix:** partial for plan.md. It gates a whole app, not writes, so it isn't
  read-only by default.
- **Verdict:** adopt the idea at the granularity of a capability (non-negotiable 2).
- **Scenarios:**
  - [acceptance] `listing tools` — `given a capability that is not enabled, does not offer it`
  - [acceptance] `calling a tool` — `given a capability that is not enabled, refuses it as disabled`

### C31 Scheduled sends are in-process timers (main has two early-fire bugs)

- **Kind:** fix
- **Context:** messages
- **Symptom:** A scheduled message is lost if the process exits. On `main`, a `scheduledTime`
  more than about 24.8 days away, or an unparseable one, **sends immediately**.
- **Root cause:** Upstream `utils/message.ts:517-540` uses `setTimeout(delay)` and checks only
  `delay < 0`. Node clamps delays above 2³¹−1 ms to 1 ms. `new Date("garbage")` gives
  `delay = NaN`, and `NaN < 0` is false.
- **Technique:**
  - **`oss-cleanup` (`431f4b1`):** rejects NaN and refuses delays above `2_147_483_647`, with
    "local deferred sends are not persisted" in the description.
  - **`main`:** only turns the past-time error into a `bad_request` and documents "known gap: a
    failure after return has no envelope". The scheduled send does go through the
    wrong-number and outcome checks.
- **Evidence:** `431f4b1` (`oss-cleanup`), `42c2fd7`.
- **Quality of the fix:** partial on `oss-cleanup`. **The bugs remain on `main`.**
- **Verdict:** reject scheduled sends for v1 (unconfirmable and not persisted). If ever built,
  refuse an unreadable time.
- **Scenarios:**
  - [acceptance] `scheduling a message` — `given a time that cannot be read, refuses rather than sending now`

### C32 Faces' messages tool on oss-cleanup: reading by chat membership, read-only SQLite

- **Kind:** refactor
- **Context:** messages
- **Symptom:** Reading a person's messages dropped the user's own replies. Reads could hang on a
  locked DB.
- **Root cause:** Upstream `readMessages` filters `h.id IN (...)` with an INNER JOIN on handle
  (`utils/message.ts:290-303`).
- **Technique:**
  - **`fetchMessages({handles, status, from, limit})`:** scopes by
    `chat_handle_join` membership with a LEFT JOIN on handle, so a sent row with no handle
    renders "(me)".
  - **`fetchConversations`:** uses `ROW_NUMBER() OVER (PARTITION BY chat)`.
  - **Connection:** `sqlite3 -readonly` with an 8 s timeout, and retries.
  - **Sending:** `buddy … of targetService`.
  - **Also:** it keeps upstream's regex decoder and **does not check the send**.
- **Evidence:** `431f4b1` (`oss-cleanup`).
- **Quality of the fix:** partial. It's superseded on `main` by C18, C19 and C25, except for
  `-readonly` and the timeout.
- **Verdict:** adopt the idea (read-only, bounded). Otherwise superseded.
- **Scenarios:**
  - [contract] `the message store` — `given a query while Messages holds a write lock, retries briefly and then fails rather than hanging`

### C33 The circuit cache expands cached payload tokens inside tool arguments (oss-cleanup)

- **Kind:** feature
- **Context:** other:maestro
- **Symptom:** The model retyped long note bodies and threads into the next tool.
- **Root cause:** No upstream equivalent.
- **Technique:** `circuitBuffer.ts`. Before validation, `resolveArgs` walks every string in the
  arguments and replaces each `@@hN@@` with a payload fetched from `MAESTRO_CIRCUIT_URL/get`. On
  the way out, `wrapResult` parks any text result of 200 characters or more and prepends its
  token. It does nothing without the environment variables.
- **Evidence:** `455d4ba` (`oss-cleanup`).
- **Quality of the fix:** wrong, for this server. **Alarming:** any string that reaches a tool,
  including a message body or a note an attacker wrote, is expanded from a cache holding earlier
  tool output. A prompt injection that gets `@@h3@@` into a send body exfiltrates that cached
  result (say, a private note or a thread) to the recipient, and the expansion happens before
  validation.
- **Verdict:** reject: tool input is hostile. Arguments are never expanded from server-side state.
- **Scenarios:**
  - [acceptance] `sending a message` — `given a body containing text shaped like an internal reference, sends that text literally`

### C34 Notes CRUD with Markdown bodies and no read after a write (oss-cleanup)

- **Kind:** feature
- **Context:** notes
- **Symptom:** No update, delete, get-one or folders. Notes created as plain text.
- **Root cause:** Upstream notes has search, list and create only.
- **Technique:**
  - **Bodies:** Markdown (the default), HTML (passed through untouched) or plain text are
    converted to HTML in TS, and user text is HTML-escaped.
  - **Search:** `whose({_or:[name contains, plaintext contains]})`, falling back to a scan when
    `whose` throws.
  - **Get, update, delete:** located by `byId`, or by title using the exact title among `contains`
    matches, **else the first `contains` match**. Update replaces or appends, and replace mode
    lets the first body line become the title.
  - **Folders:** listing, plus idempotent creation.
  - **Rule:** "reads after a write are forbidden" (a read of a mutated note "blocks for SECONDS").
    Results echo the values that were set.
- **Evidence:** `431f4b1` (`oss-cleanup`). Upstream #27, #22, #28 (PR).
- **Quality of the fix:** wrong in two places.
  - **Wrong note deleted:** delete or update by title can hit a different note ("Meeting" matches
    "Meeting notes 2024").
  - **Truth given up:** banning read-back gives up non-negotiable 3.
  - **Lossy replace:** replace mode silently changes the title and discards the body (compare
    KassebaumEngineering's refusal of lossy rewrites).
  - **Unsafe links:** Markdown links take any URL.
- **Verdict:** reject the first-match fallback and the ban on reading back. Adopt locate by id,
  and Markdown as input. Verify: `reading a note's name and modification date immediately after
  setting its body over JXA takes more than a second on an iCloud account`.
- **Scenarios:**
  - [acceptance] `deleting a note by title` — `given several notes whose titles contain the text and none equal it, refuses and lists them`
  - [acceptance] `changing a note` — `given the change was written, reports success only after reading the note back`

### C35 Contacts create, update and delete (oss-cleanup)

- **Kind:** feature
- **Context:** contacts
- **Symptom:** No way to add or fix a contact.
- **Root cause:** Upstream contacts is read-only.
- **Technique:**
  - **Tooling:** JXA with arguments. `Contacts.save()` is required to persist, and the fork says
    a bare push is discarded.
  - **Echo instead of re-read:** results echo the values set, with a display name composed
    locally ("a create that re-read 4 props measured ~2 minutes").
  - **Update and delete target:** "the first contact whose display name matches `name`".
    Removals match phones by digits.
  - **Cache:** a short-lived scan cache, cleared on every write.
- **Evidence:** `431f4b1` (`oss-cleanup`).
- **Quality of the fix:** wrong for deletes: it removes the first card by name with no ambiguity
  check and no read-back.
- **Verdict:** out of v1 scope (plan.md lists no contacts writes). Reject writes whose target is a
  name. Verify: `Contacts.app JXA changes are discarded unless Contacts.save() is called`.
- **Scenarios:**
  - [acceptance] `deleting a contact by name` — `given several cards match the name, refuses and lists them`

## Noise

- Build and packaging: a committed `dist/index.js` bundle that every commit rebuilds; `bun.lock`
  and `package-lock.json` churn; `manifest.json`, the `.dxt`, `TEST_README.md` and upstream's
  integration tests deleted in the rewrite. Folded into `784db41`, `431f4b1` and later commits
  rather than being separate commits.
- Version bump for Maestro's update check: `dee264f`.
- README and ROADMAP neutralised for a generic OSS audience (the docs half of `431f4b1`, whose
  code half is recorded in C31, C32, C34 and C35).
- Merge commits `caf8201`, `da74a70`, `7ff67c0`, `ad793f9`, `536770c`, `1c453a8`, `562a239`,
  `44aac44`, `43cbf80`, `020a3ab`, `2247d56` (PRs #1 and #3 to #12).

Every one of the 44 non-merge commits appears above: `784db41` (C1, C2, C22, C30, noise),
`431f4b1` (C31, C32, C34, C35, noise), `4c3096d` (C4), `8ac7cb9` and `39585ad` (C10), `7160b0a`,
`bfd5b64` and `4587d0a` (C7), `bcdc856` (C8), `34dced4` (C9), `455d4ba` (C33), `3c590df` (C11),
`42c2fd7` (C3, C5, C30, C31), `ac53e87` (C3, C4), `dee264f` (noise), `26a3d1c` (C13), `0216d96`
(C12, C14, C15), `16172e8` (C13, C16), `94149a2` (C17), `dbffae5` (C6, C17), `82efc89` (C6, C9,
C13, C15), `54c30e3` (C16), `799d643` (C16, C29), `cad640a` (C18, C19, C20, C28), `6fe0c03` and
`049af46` (C24), `ccc9f55` (C16, C19, C28, C29), `20c7fa3` (C19, C21), `0736b63` (C19, C21),
`0d381f9` (C20), `68cd07b` (C20, C25), `9609cb4` and `ad467f8` (C22), `ddf6cb1` (C26), `6e4b47a`
(C23), `9852b0e` (C20, C21, C23, C25, C26), `ac0058a` (C5, C22, C25, C26), `a663d12` (C22),
`39b7e40` (C2, C21, C25), `1fa9dc5` and `64dac13` (C27), `616cefe` (C24), `fa7dcbd` and `bdbb896`
(C28).

## Glossary candidates

- **handle:** one address a person is reached at in Messages, a phone number (usually E.164) or an
  Apple ID email. It's a row in `handle`, and `handle.id` is the stored spelling.
- **known handle:** a handle string that already exists in `handle.id`. It's the only thing a
  match may return.
- **ambiguous number:** an address whose digits fit two different known handles in different
  countries. It's refused, never resolved.
- **sendable handle:** the spelling handed to Messages. It's tidied to E.164 only when the input
  already states its country.
- **conversation / chat:** a thread (`chat.ROWID`, addressed by `chat.guid`) with participants.
  It's a *group* when `chat.style = 43` and *one-to-one* at 45, whatever the participant count.
- **participant:** a handle in `chat_handle_join`. The user is never listed.
- **genuine contact:** a message they sent us, or one of ours with `is_sent = 1` and no error. Our
  own failed sends don't count.
- **last in touch / last seen:** the newest genuine contact on any of a person's handles. It
  breaks ties, never filters.
- **ghost chat:** a thread containing only our own failed sends, created by sending to a dead
  address.
- **contact card:** a `CNContact` with a stable `identifier`, name, emails and phones, the phones
  spelled as the person typed them.
- **resolution:** what a name comes to: *one* person, *several* candidates (a question), *unknown*
  (Contacts read, no match), or *cannot ask* (Contacts unreadable).
- **wrong number:** an address never used that belongs to someone who does write from another
  handle. It's refused, and the working handle is named.
- **sent (left):** `is_sent = 1` with no `error` on our outgoing row. That is different from
  *delivered*.
- **error 22:** the `message.error` Messages writes for an iMessage it couldn't deliver to that
  address.
- **Apple-epoch nanoseconds:** the unit of `message.date`, nanoseconds since 2001-01-01 UTC.
- **attributedBody / typedstream:** the archived `NSAttributedString` that holds almost every
  message body. Its strings are framed as `+`, then a length, then UTF-8.
- **bookkeeping string:** a string inside the archive that describes the archive itself
  (`NSString`, `__kIM…`, transfer ids), never text a person wrote.
- **period:** `since` and `until` in the user's local time. A bare end date means that whole day.
- **query:** optional ranked *terms*, exact *phrases* and *exclusions*, all folded.
- **coverage:** how much a search looked at: rows scanned, whether it reached its ceiling, and the
  oldest message reached.
- **page / total / ceiling:** what one answer shows, how many exist, and the most one call can
  ever return.
- **index vs detail:** a list shows every item briefly; a search or get shows items in full.
- **failure envelope:** `[code] sentence` plus the verbatim evidence. The *summary* is what didn't
  happen, and the *body* is the evidence.
- **host app:** the app whose TCC grants the server runs under (Maestro here), named in
  missing-permission failures.
- **door (Maestro):** a loopback HTTP endpoint per store, protected by a shared secret, through
  which the host app reads EventKit or Contacts.
- **reminder list:** an `EKCalendar` for reminders, addressed by id.
- **recurrence:** a frequency (daily, weekly, monthly or yearly) and an interval. A repeating
  reminder needs a due date.
- **duplicate (twin):** a create whose title matches an existing open reminder or upcoming event.

## Open questions

- **TCC attribution:** `main` (C6) says a helper process "would key its own grant". The
  `oss-cleanup` Swift helper says "TCC responsibility walks up to the app that spawned us". Which
  is true for a binary spawned by Node under Terminal or Claude Desktop decides Decision 3, and
  the fork has no evidence either way in code.
- **`handle_id` on sent messages:** `main` says an outgoing message to a *group* has
  `handle_id = 0`. `oss-cleanup` says an outgoing *one-to-one* message does. They're different
  claims, and the LEFT JOIN is right in both cases.
- **Addressing the recipient:** is the app-level `buddy "<x>"` (used on `main`) or
  `buddy "<x>" of targetService` (used on `oss-cleanup`, which says the app-level form "commonly
  fails") the reliable way to reach a new recipient? Or is `participant`/`chat id` addressing
  better on macOS 26?
- **Reading back Notes and Contacts:** does a read immediately after a JXA write really block for
  seconds (`oss-cleanup`), and is that still true when reading the SQLite store or through
  Contacts.framework instead?
- **Locked notes:** do password-protected notes break the whole-collection `plaintext()` read?
- **The Maestro side:** its sort, create read-back, "writable calendars" list and denial codes
  can't be read here. The calendar ordering test is said to live in Maestro's
  `CalendarOrderTests`.
- **Failure codes:** `wrong_number`, `message_not_sent` and `ambiguous_number` are outside
  `FailureCode`. Either the typecheck on `main` fails, or it isn't run (the tests use `bun test`,
  which doesn't typecheck).
- **Personal data:** the commit messages and test fixtures use real names from the owner's family
  and what look like real phone numbers. Nothing from them should be copied into fixtures here.
