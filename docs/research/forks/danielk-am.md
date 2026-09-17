# danielk-am/apple-mcp

- **Remote:** `fork-danielk-am`
- **Branches read:**
  - `main` (5 commits)
  - `dependabot/npm_and_yarn/modelcontextprotocol/sdk-1.26.0` (1 commit not on main, branched
    from `ae5295e`)
  - `dependabot/npm_and_yarn/hono/node-server-2.0.10` (1 commit not on main, branched from
    `9d9122c`)

  `fix-mail-search` and `index-safe-mode` have no commits of their own, so they were skipped.
- **Commits accounted for:** 7 / 7
- **Last commit:** 2026-07-23 (`a98f45f`, a Dependabot bump). The last commit on `main` is
  2026-05-11 (`9d9122c`).
- **In one paragraph:** A personal/family fork by Daniel Kam. The README says local-only, and
  `CONTRIBUTING.md` refuses outside PRs. All five commits landed on 2026-05-11, co-authored with
  Claude Sonnet 4.6 / Opus 4.7. It fixes upstream's empty notes and reminders, and adds Photos,
  Shortcuts and Safari tools.

  Two findings matter for the rebuild:
  - **Reminders move to EventKit through JXA's ObjC bridge**, after the fork's own AppleScript
    rewrite, earlier the same day, came back empty.
  - **The notes fix works for a reason other than the one the commit gives.** Upstream's notes
    returned one "Untitled Note" because `run-applescript` returns stdout *text*, so
    `Array.isArray(result)` is never true. It wasn't because `&` flattens records. The same fork
    then reintroduced that exact bug in its calendar and mail rewrites.

  Upstream #43/#44 ("whose is not a function", "Application isn't running") were raised against
  upstream's **earlier JXA code**, which `upstream/main` had already replaced. See C1. Both
  Dependabot branches are noise, as expected.

  Alarming for a hostile-input threat model: the Safari tool runs arbitrary JavaScript in the
  user's logged-in tabs, the Shortcuts tool runs any shortcut, and the Safari history search has
  a SQL quoting bug that input can trigger.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Notes | AppleScript (run-applescript), results returned as one string with ASCII 30 (RS) between records and ASCII 31 (US) between fields | Iterates `notes` or `notes of account "…"` one note at a time. `escapeAS` escapes `\` and `"` |
| Reminders | JXA (`osascript -l JavaScript -e <script>` through `spawn`, no shell) using `ObjC.import('EventKit')`: `EKEventStore`, `fetchRemindersMatchingPredicate:completion:` with a manual run-loop pump, and `saveReminder:commit:error:` | Values are spliced into the JS source as `JSON.stringify` literals. Output is JSON on stdout. Opening the app is still AppleScript `activate` |
| Calendar | AppleScript, `events of cal whose start date ≥ … and ≤ …`, then bulk property reads (`summary of evts`) | Returns a list of records, which run-applescript turns into text, so parsing is broken (C4) |
| Mail (unread, search) | AppleScript, per account → per mailbox, `whose read status is false` / `whose subject contains` | Same broken record parsing (C5) |
| Photos | AppleScript | Out of scope |
| Shortcuts | `shortcuts` CLI through `spawn` with an argv array, input on stdin | Out of scope |
| Safari | AppleScript for tabs and `do JavaScript`, JXA `NSPropertyListSerialization` for `Bookmarks.plist`, `sqlite3` CLI on a temp copy of `History.db` | Out of scope |

## Changes

### C1 Notes list and search return the actual notes

- **Kind:** fix
- **Context:** notes
- **Symptom:** Listing or searching notes returned a single "Untitled Note" with no content, or
  nothing (upstream #67, likely; #27, #22). On older upstream builds the errors were "Application
  isn't running (-600)" and "`Application("Notes").notes.whose` is not a function (-2700)"
  (#43, #44).
- **Root cause:** There are two different root causes, for two upstream generations.
  - **#43/#44 (filed 2025-05-12)** were against the JXA implementation that preceded upstream's
    AppleScript rewrite (`70172d6`, 2025-08-09). `70172d6^:utils/notes.ts:34` calls
    `Notes.notes.whose({_or:[{name:{_contains}}, {plaintext:{_contains}}]})` through `@jxa/run`.
    The reporter got -600 on list/create and "whose is not a function" on search in the same
    session. That suggests JXA couldn't connect to Notes and so never loaded its scripting
    terminology, which leaves `notes` without element-array methods. The reporter also saw that
    Notes never appeared under Automation. This is a hypothesis (verify). An upstream commenter
    worked around it by filtering in JS. **`upstream/main` no longer contains this code**: its
    notes, reminders and calendar modules use `run-applescript`, and `@jxa/run` survives only in
    `utils/maps.ts`.
  - **What is broken at `upstream/main`** is the result parsing. `run-applescript@7`'s
    `runAppleScript` returns `stdout.trim()`, a string (checked in the published 7.1.0 source).
    `upstream/main:utils/notes.ts:121` and `:193` do
    `Array.isArray(result) ? result : result ? [result] : []`, so any non-empty output becomes
    one element, a string. `noteData.name` is then `undefined` and the note becomes
    "Untitled Note" (`:124`, `:196`).

  The fork's commit message blames AppleScript's `&` flattening records. The code at `:108` and `:179`
  (`notesList & {noteInfo}`) builds a correct list; the loss happens at the text boundary.
- **Technique:** `9d9122c` rewrites `utils/notes.ts`:
  - each note is emitted as `name US content US folder US account US modDate RS`
  - newlines in content are replaced with a literal `\n` through `text item delimiters`
  - `name of container` and `name of account` are read inside `try` blocks, because CloudKit
    shared notes raise errors there
  - search runs `ignoring case` over `plaintext`
  - `escapeAS` escapes backslash and quote in every interpolated string (a hardening over
    upstream's quote-only escape at `upstream/main:utils/notes.ts:291`, `:295`)
  - limit and preview length are configurable (defaults 200/200).

  Nothing replaces JXA's `whose`: search still loops over every note, one Apple Event per
  property.
- **Evidence:** `9d9122c`. Upstream #67, #43, #44 (the last two only indirectly, see Root cause).
- **Quality of the fix:** partial.
  - Delimited text is a sound transport.
  - Literal `\n` in a note is corrupted into a newline on the way back.
  - CR line endings pass through.
  - `limit`/`contentPreview` are type-checked as numbers but still interpolated into script
    source.
  - Scanning is O(all notes) Apple Events, slow on large libraries.
  - Content is truncated plaintext, with no way to read one note in full.
  - Notes are identified by name only, with no id.
  - `createNote` still reports success from the script's own `SUCCESS:` string without reading
    the note back.
- **Verdict:** adopt the idea: every script returns structured text (JSON) that the adapter
  parses and validates, never a scripting-language record. verify: "on macOS 14–26, JXA
  `Application('Notes').notes.whose({...})()` works when Automation permission for Notes is
  granted, and fails with -600 / 'whose is not a function' when it is not". This settles whether
  the Notes *verify* row in plan.md can use JXA at all.
- **Scenarios:**
  - [contract] `the notes store` — `given several notes, returns each with its own title and body`
  - [acceptance] `listing notes` — `given Notes has not granted Automation access, fails with a permission failure that names the setting to change`
  - [domain] `a scripting result` — `given output that is not the expected structure, refuses it rather than inventing an untitled item`

### C2 Notes are scoped by account and folder

- **Kind:** feature
- **Context:** notes
- **Symptom:** With iCloud and a work account, notes from both were mixed, and there was no way
  to see folders or read one folder.
- **Root cause:** Upstream iterates the application-level `notes` element only.
- **Technique:**
  - `account` narrows the source to `notes of account "<name>"`
  - `listFolders` walks `accounts → folders` (one level of subfolders) and reports name,
    account, parent and note count
  - `listFromFolder` walks folders breadth-first and matches an exact, case-sensitive name; the
    tool description warns to include any emoji prefix
  - an unknown folder returns `NOTFOUND` and a "Folder … not found" failure.
- **Evidence:** `9d9122c` (`utils/notes.ts`, `tools.ts`, `index.ts`)
- **Quality of the fix:** partial. `listFolders` goes only one level deep, while `listFromFolder`
  searches every level, so they disagree. The first folder with a matching name wins across
  accounts. Folders are identified by name rather than id. Shared notes report empty folder and
  account.
- **Verdict:** adopt the idea (account and folder scoping, and a named not-found failure).
  Morquis covers the same ground, so compare there.
- **Scenarios:**
  - [acceptance] `listing a note folder` — `given a folder name that exists in two accounts, refuses and names both accounts`
  - [acceptance] `listing a note folder` — `given a folder that does not exist, fails and says so rather than returning no notes`

### C3 Reminders are read and created through EventKit instead of Reminders' AppleScript

- **Kind:** fix
- **Context:** reminders
- **Symptom:** Listing and searching reminders always returned nothing, and listing timed out
  (upstream #53, #26, #10, #59). Reminders were created without a time (#64).
- **Root cause:** `upstream/main:utils/reminders.ts:146-170` only runs `count of lists` and
  returns `[]` either way ("Complex reminder queries are too slow and unreliable"). Search
  (`:199-210`) and list-by-id (`:372-373`) are the same stubs.

  The fork first rewrote these in AppleScript with bulk property reads and `whose completed is
  false` (`ad3e9e9`). Later the same day, `9d9122c` replaced that, stating that on macOS 14+
  **`count of lists` returns 0 even with TCC granted**. The code can't confirm the claim.
  A likely explanation is that Reminders' scripting interface now needs the host's *Reminders*
  privacy grant as well as Automation, and returns empty collections without one (verify).
- **Technique:** `utils/reminders.ts` builds a JXA script (prologue + body + epilogue) and runs
  `spawn("osascript", ["-l","JavaScript","-e",script])` with a 15–20 s kill timer. Output is
  parsed as JSON, and an `{error}` payload becomes a rejection.
  - **Access:** `EKEventStore.authorizationStatusForEntityType(EKEntityTypeReminder)` is checked
    and accepted if it is 2, 3 or 4. `requestFullAccessToReminders` is never called.
  - **Read:** `predicateForRemindersInCalendars(picked)`, then
    `fetchRemindersMatchingPredicateCompletion`, with `NSRunLoop` pumped for up to 10 s. Completed
    reminders are filtered out in JS, because the incomplete-only predicate's selector "renders
    inconsistently" in JXA. Each reminder yields id (`calendarItemIdentifier`), externalId, title,
    notes, completed, dates from `descriptionWithLocale(null)`, `dueDateComponents.date`,
    priority, list name and list id.
  - **Search:** fetches up to 5000 reminders, then filters title and notes in JS.
  - **Create:**
    - resolves the list by name or id, and **falls back to `defaultCalendarForNewReminders` if
      neither matches**
    - sets title, notes and priority
    - parses `dueDate` with `NSISO8601DateFormatter`
    - saves with `saveReminder:commit:error:` and returns the object it built.
  - **Values:** every string reaches the script as a `JSON.stringify` literal, and priority
    through `Number.isFinite`.

  The `reminders` tool's operations are unchanged. A richer module API (`listAll`,
  `includeCompleted`, `priority`) exists but isn't exposed.
- **Evidence:** `ad3e9e9` (superseded AppleScript attempt), `9d9122c`. Upstream #53, #26, #10,
  #59, #64.
- **Quality of the fix:** partial. Reading reminders through EventKit is the right move, but
  there are real bugs.
  - **Denied counts as granted:** status `2` is `EKAuthorizationStatusDenied`; the comment calls
    it "authorized in pre-Sonoma", but authorized was `3`. A denied host proceeds, fetches
    nothing and reports "No reminders".
  - **Access is never requested.** A host that has never asked won't appear in System Settings
    → Reminders, so the failure's instructions can't be followed (upstream #65's pattern).
  - **The due date is broken.**
    - The formatter mask `1|2|4|8|16|256` sets year, month, *week-of-year*, an undefined bit, day
      and dash separator, with no time and no time zone, so a full ISO timestamp likely fails to
      parse.
    - The calendar-unit mask `(1<<2)|(1<<4)|(1<<8)|(1<<16)|(1<<32)|(1<<64)` evaluates in JS to
      `year|day|0x100|0x10000|1|1`, with no month, hour or minute, because `1<<32 === 1`.
    - The reminder is then saved and reported as created without the due date, so #64 is not
      fixed (verify).
  - **Wrong list:** an unknown `listName` silently writes to the default list.
  - **Silent empty result:** if the completion handler doesn't fire within 10 s, `[]` is written
    and the reply says there are no reminders.
  - **No check after writing:** create re-serialises the in-memory object rather than reading
    the store.
  - **Script source is still generated by string splicing.** JSON literals are a sound escape
    for JS, but this breaks the "static script, JSON args" rule.
- **Verdict:** adopt the idea: EventKit for reminders, confirming the plan's table. The fork's
  own AppleScript attempt, abandoned the same day, is supporting evidence. reject the JXA
  ObjC-bridge technique in favour of the Swift helper. The bridge's selector mangling, run-loop
  pumping and integer bitmasks are exactly where its bugs are. verify: "on macOS 14+, Reminders
  AppleScript `count of lists` returns 0 when the host has Automation but not Reminders access".
- **Scenarios:**
  - [acceptance] `listing reminders` — `given reminders access was denied, fails with a permission failure rather than reporting no reminders`
  - [acceptance] `listing reminders` — `given reminders access has never been requested, asks for it before reporting a failure`
  - [acceptance] `creating a reminder` — `given a due date and time, reports it created only after reading it back with that due date and time`
  - [acceptance] `creating a reminder` — `given a list that does not exist, refuses and names the lists that do`
  - [contract] `the reminders store` — `given the store does not answer in time, fails with a timeout rather than returning no reminders`

### C4 Calendar reads replace the dummy event with a date-filtered query

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Listing returned a dummy "Calendar operations too slow" event, search returned
  nothing, and opening an event only activated Calendar (upstream #74, #25).
- **Root cause:** `upstream/main:utils/calendar.ts:102-117` (dummy event), `:177` (empty search),
  `:332` (open just activates the app).
- **Technique:** Per calendar:
  - `events of cal whose start date ≥ startD and start date ≤ endD`
  - then one Apple Event per property for the whole set: `summary of evts`, `uid of evts`,
    `start date of evts`, `end date of evts`, `allday event of evts`
  - location and description read per event
  - results are built as a list of records.

  Search filters that list in JS. Open finds `events of cal whose uid is "<id>"` and calls `show`.
  Dates are built as `date "${d.toLocaleString("en-US")}"`.
- **Evidence:** `ad3e9e9`. Upstream #74, #25.
- **Quality of the fix:** wrong. It returns AppleScript records, then applies the same
  `Array.isArray` parse on run-applescript's string that C1 diagnosed. So a list most likely comes
  back as one "Untitled Event" (verify).
  - `en-US` date literals only parse on an en-US system locale (Bendix-ai hit the same problem
    with a Norwegian locale).
  - Filtering on `start date` misses events that began before the range.
  - Recurring events likely appear only once, as their series (verify).
  - `eventId` is escaped for quotes only.
- **Verdict:** adopt the idea: push filtering into the store and read properties in bulk.
  reject the mechanism: EventKit in the plan supersedes it.
- **Scenarios:**
  - [contract] `the calendar store` — `given a weekly meeting, returns one occurrence per week in the range`

### C5 Mail unread and search return the messages they found

- **Kind:** fix
- **Context:** mail
- **Symptom:** Unread and search always reported no mail (upstream #69, #58, #30, #19).
- **Root cause:** `upstream/main:utils/mail.ts:138` returns `"SUCCESS:" & (count of emailList)`
  and `:143-146` returns `[]`, discarding the collected list. `:237`, `:242-245` do the same for
  search.
- **Technique:** Iterates `accounts → every mailbox of acct` (instead of the flat `mailboxes`,
  which mixed accounts), with `whose read status is false` or `whose subject contains needle`,
  up to `MAX_EMAILS`. It builds `{sub, snd, dt, body, rd, mb:"account / mailbox"}` records.
- **Evidence:** `ad3e9e9`. Upstream #69, #58, #30, #19.
- **Quality of the fix:** wrong. It returns a list of records, parsed with the same `Array.isArray`
  on a string (see C1), so it likely yields one garbage message. Variables named `body` and `rd`
  inside `tell application "Mail"` may clash with Mail's terminology (fpjnijweide separately fixed
  an "'rd' reserved word bug"). Search matches the subject only. The needle escapes quotes only.
- **Verdict:** adopt the idea: enumerate per account, then per mailbox, and label results with
  both. reject the mechanism.
- **Scenarios:**
  - [acceptance] `listing unread mail` — `given two accounts with an inbox each, labels every message with its account and mailbox`

### C6 Shortcuts can be listed and run

- **Kind:** feature
- **Context:** other:shortcuts
- **Symptom:** No way to trigger HomeKit, Focus or other App Intents from an agent.
- **Root cause:** Not in upstream.
- **Technique:** `spawn("shortcuts", [...])` with an argv array (no shell):
  - `list [--folder-name] [--show-identifiers]`
  - `list --folders`
  - `run <name> [--input-path -] [--output-path - --output-type public.utf8-plain-text]`, with
    input on stdin and a 60 s default timeout that the caller can override
  - `view <name>`.
- **Evidence:** `9d9122c`
- **Quality of the fix:** complete as a wrapper. Out of scope for this rebuild, it's also a
  capability to run anything: a shortcut can run shell scripts or send messages, with no
  confirmation and no allowlist.
- **Verdict:** out of v1 scope. If added later, only allowlisted shortcuts should run, each with
  confirmation.
- **Scenarios:**
  - [acceptance] `running a shortcut` — `given a shortcut not named in the settings, refuses to run it`

### C7 Safari tabs, JavaScript, bookmarks, Reading List and history

- **Kind:** feature
- **Context:** other:safari
- **Symptom:** No browser access.
- **Root cause:** Not in upstream.
- **Technique:**
  - AppleScript for list/open/close/activate tabs, escaping `\` and `"`.
  - `runJs`: `do JavaScript "<js>" in <tab>` (needs "Allow JavaScript from Apple Events").
  - JXA reads `~/Library/Safari/Bookmarks.plist` through `NSPropertyListSerialization`.
  - History: `History.db` is copied to `$TMPDIR` and queried with the `sqlite3` CLI (execFile).
    "Placeholders" are filled by `finalSql.replace("?", '<escaped value>')` once per parameter.
- **Evidence:** `9d9122c` (`utils/safari.ts`)
- **Quality of the fix:** wrong for a hostile-input model.
  - `runJs` lets any prompt-injected instruction run script in the user's logged-in pages
    (session theft, form submission).
  - The history search puts the same value in two placeholders. If the search text itself
    contains `?`, the second `replace` lands *inside* the first literal, so the value ends up as
    bare SQL (injection into the `sqlite3` CLI, on a temp copy).
  - Needs Full Disk Access.
- **Verdict:** out of v1 scope. Record `do JavaScript` as a threat-model example of a capability
  never to offer.
- **Scenarios:**
  - [domain] `a history search` — `given search text containing a question mark, matches it literally`

### C8 Photos albums, favourites, recent and search

- **Kind:** feature
- **Context:** other:photos
- **Symptom:** No Photos access (upstream #38).
- **Root cause:** Not in upstream.
- **Technique:**
  - AppleScript: `album "<name>"`, `media items` with a `limit`, favourites found by scanning
    `limit*5` items
  - search and open use `spotlight "<text>"` to show Photos' UI
  - names are escaped for quotes only.
- **Evidence:** `61cdb09`
- **Quality of the fix:** partial. Quote-only escaping lets a backslash break out of the string.
  Search opens the UI rather than returning results.
- **Verdict:** out of v1 scope
- **Scenarios:**
  - [acceptance] `browsing an album` — `given an album name containing a backslash and a quote, finds that album and runs nothing else`

### C9 Dependencies pinned to exact versions

- **Kind:** hardening
- **Context:** cross-cutting
- **Symptom:** A malicious patch release of a dependency would be installed automatically.
- **Root cause:** `upstream/main:package.json` uses `^` ranges and `"@types/bun": "latest"`.
- **Technique:** Every dependency is pinned to an exact version, TypeScript is pinned as a peer
  dependency, the repository URL is fixed, and `CONTRIBUTING.md` refuses outside PRs. Dependabot
  is turned on in GitHub (not in the commit).
- **Evidence:** `ae5295e`
- **Quality of the fix:** complete for direct dependencies. The lockfile does the rest.
- **Verdict:** adopt the idea (exact pins plus a lockfile, with automated update PRs).
- **Scenarios:** none (infra, not behaviour)

## Noise

- README rewritten for the personal fork: `0b4f949`, plus the README section in `9d9122c`.
- Dependabot bumps on side branches, not merged (package.json one-liners):
  - `e5a21f1`: `@modelcontextprotocol/sdk` 1.5.0 → 1.26.0
  - `a98f45f`: `@hono/node-server` 1.13.8 → 2.0.10
- A test cast for the typed reminders return: the `tests/integration/reminders.test.ts` hunk in
  `ad3e9e9`.

## Glossary candidates

- **account (Notes)**: a Notes account such as "iCloud" or an Exchange address, which owns
  folders. Shared (CloudKit) notes have no readable container or account.
- **folder (Notes)**: nested under an account. The fork identifies folders by exact,
  case-sensitive name, emoji included.
- **reminder list**: an `EKCalendar` for entity type reminder, with a title, `calendarIdentifier`
  and a source (account).
- **reminder id**: `calendarItemIdentifier` (local). `calendarItemExternalIdentifier` is the
  server-side id that survives sync.
- **authorization status**: EventKit's per-entity grant: 0 not determined, 1 restricted, 2 denied,
  3 full access, 4 write-only (events only).
- **shortcut**: a user-authored Shortcuts workflow, addressed by name or UUID, taking text input
  on stdin.

## Open questions

- Why exactly did JXA report "Application isn't running" alongside "whose is not a function"
  (#43/#44): Automation not granted, Notes not launched in the osascript context, or a
  terminology change in Notes 4.12? This needs a Mac with Automation access revoked, then granted.
- Does `EKReminder.dueDateComponents.date` return a value when the components have no calendar
  set? If not, every due date the fork reads back is `null`.
- Did the fork's calendar and mail changes ever work on the author's Mac? A test run of `ad3e9e9`
  would settle whether run-applescript's text output really defeats them.
