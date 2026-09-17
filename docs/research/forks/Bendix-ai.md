# Bendix-ai/apple-mcp

- **Remote:** `fork-Bendix-ai`
- **Branches read:** `main` (7 commits). `fix-mail-search` and `index-safe-mode` have no commits of
  their own, so they were skipped.
- **Commits accounted for:** 7 / 7
- **Last commit:** 2026-01-30 (`fff9dd8`)
- **In one paragraph:** One developer in Norway (Bjarne Bendixen, local hostname in the commit
  email), all commits co-authored with Claude, all in a single day. It only touches calendar
  reads. First it replaced upstream's dummy event with a real AppleScript query using a Norwegian
  date format. Finding that too slow (30–120 s by its own account), it added a Swift EventKit CLI
  and kept the AppleScript query as the fallback. The "fallback path" in the last commit is a
  hard-coded `/Users/bjarne/...` path to the binary. It's a useful data point on how a
  per-call EventKit CLI performs and on locale-dependent AppleScript dates. The helper protocol
  shouldn't be copied: **its arguments reach a shell unquoted, so a calendar search is a
  command-injection hole.**

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Calendar (list, search) | Swift CLI `swift/CalendarCLI` using EventKit. One short-lived process per call, argv flags in, one pretty-printed JSON document on stdout | Plain Mach-O executable, not an `.app` bundle, so there is no `Info.plist` and no usage description. Invoked through `execSync` with a shell string |
| Calendar (list, search), fallback | AppleScript `every event of cal whose start date ≥ … and start date ≤ …`, with `date "DD.MM.YYYY HH:mm"` literals | Used when the binary isn't found or returns `success: false` for any reason |
| Calendar (create) | AppleScript, as upstream, but with the Norwegian date literal | Upstream's unescaped `location`/`notes` interpolation is kept |

## Changes

### C1 Calendar reads go through a per-call EventKit CLI

- **Kind:** feature
- **Context:** calendar
- **Symptom:** Listing events returned a dummy "Calendar operations too slow" event and search
  returned nothing (upstream #74, #25). Once replaced with real AppleScript, a query took 30 s to
  over 2 min.
- **Root cause:** `upstream/main:utils/calendar.ts:102-117` returns a hard-coded dummy event, and
  `:177` returns an empty search. Calendar.app's AppleScript is slow per event.
- **Technique:** `swift/CalendarCLI.swift` (296 lines, committed **with** a compiled binary
  `swift/CalendarCLI`: arm64 only, ad-hoc linker signature, strings match the source. No
  `Package.swift` or build script, so the build step is undocumented).

  **Protocol:**
  - argv subcommands: `calendars`, `list`, `search <text>`
  - flags: `--from <ISO or yyyy-MM-dd>`, `--to <…>`, `--limit <n>` (default 50),
    `--calendars <name1,name2>`
  - output: one JSON object per run, `{success, events:[{id, title, calendarName, startDate,
    endDate, isAllDay, location?, notes?}], error}` or `{success, calendars:[String], error}`
  - not long-lived: every call creates a new `EKEventStore` and blocks on a semaphore around
    `requestFullAccessToEvents` (macOS 14+) or `requestAccess(to: .event)`
  - access denied prints `success:false` with exit code 0
  - bad subcommand, or `search` without text, prints usage and exits 1.

  **Coverage:** `list` and `search` of events only (search matches title, location and notes,
  case-insensitively, in Swift), plus `calendars` (names only). There is no create, no reminders,
  and `calendars` is never called from TypeScript. The range is snapped to the start of `from`'s
  day and 23:59:59 of `to`'s day.

  When no `--calendars` is given, it skips a hard-coded title list: "Birthdays", "Siri
  Suggestions", "Helligdager i Norge", "Merkedagskalender", "Scheduled Reminders".

  Dates come out as `DateFormatter` `.full` date + `.short` time strings (locale-dependent, no
  seconds, no offset), and `index.ts` now prints them verbatim (`bb0c1ab`) instead of
  `new Date(...)`.

  **Permission attribution:** the CLI is a bare executable spawned by the MCP server, so TCC
  attributes the Calendars request to the responsible process (Terminal, or the MCP host app), not
  to the CLI. Nothing requests access proactively, and the denied message only says "Calendar
  access denied".

  The TS side (`utils/calendar.ts`) calls `requestCalendarAccess` only on the AppleScript path,
  and that checks Automation (`tell application "Calendar" to return name`), not Calendars
  privacy.

  The commit claims ~6 s against 2+ min for AppleScript.
- **Evidence:** `6e5ff6c`, `bb0c1ab`. Upstream #74, #25.
- **Quality of the fix:** partial, with an alarming flaw.
  - `runSwiftCLI` runs ``execSync(`"${SWIFT_CLI_PATH}" ${args.join(' ')}`)``. `searchText` and
    each `calendarNames` entry go into the shell **unquoted**, so a search for `x; <command>` runs
    the command.
  - Even benign input is word-split: `search team meeting` searches only "team".
  - `ekEvents.prefix(limit)` is applied before sorting, so the limit keeps whichever events EventKit
    returned first, not the earliest.
  - The date strings aren't machine-readable.
  - `from`/`to` are derived from `toISOString().split('T')[0]`, the UTC date, which is off by one
    day early in the morning at positive UTC offsets.
  - The skip list is Norwegian and title-based rather than based on calendar type.
  - The binary is committed and arm64-only.
  - Errors return `[]`, which the reply renders as "No events found".
- **Verdict:** adopt the idea (EventKit for calendar reads, filtering inside the helper). reject:
  the protocol. It is argv through a shell, per call, with human-formatted dates. The plan's
  long-lived JSON-lines helper is the right shape. verify: "a bare CLI helper spawned by Claude
  Desktop gets a Calendars prompt attributed to Claude Desktop, and succeeds once granted". This
  feeds Decision 3.
- **Scenarios:**
  - [acceptance] `searching events` — `given search text containing shell or script syntax, matches it literally and runs nothing`
  - [contract] `the native helper` — `given a request with any string argument, receives that argument byte for byte`
  - [contract] `the calendar store` — `given more events in range than the limit, returns the earliest by start`
  - [domain] `an event time` — `renders as an ISO 8601 instant with its offset, so an agent can compare times`
  - [acceptance] `searching events` — `given the helper reports calendar access denied, fails with a permission failure rather than reporting no events`

### C2 Fall back to AppleScript when the helper is missing or fails

- **Kind:** feature
- **Context:** calendar
- **Symptom:** Without the compiled binary (e.g. a fresh clone on an Intel Mac), calendar reads
  would fail.
- **Root cause:** A binary helper isn't always present or runnable.
- **Technique:** There are two fallbacks.
  - **Path fallback** (`fff9dd8`): `getSwiftCLIPath` tries `../swift/CalendarCLI` relative to
    `import.meta.url`, then the hard-coded `/Users/bjarne/apple-mcp/swift/CalendarCLI`, else `''`.
  - **Mechanism fallback** (`6e5ff6c`): if the path is empty, *or* `runSwiftCLI` returns
    `success:false` (not found, access denied, timeout after 30 s, JSON parse error, non-zero
    exit), `getEvents`/`searchEvents` run the AppleScript query from `3366690`/`d8c994a`/`9599219`:
    - it iterates calendars not in the skip list (or in `calendarNames`)
    - `every event of cal whose start date ≥ startDate and start date ≤ endDate`
    - bulk-reads uid, summary, start, end and all-day, joined by `|||` and `###`
    - it drops location and notes to save time (`9599219`)
    - search matches the title only.
- **Evidence:** `3366690`, `9599219`, `d8c994a`, `6e5ff6c`, `fff9dd8`
- **Quality of the fix:** wrong.
  - The fallback silently changes what a result means: no location or notes, title-only search,
    and events that started before the range (ongoing, multi-day) are missed. Recurring series
    probably appear only as their first occurrence (verify).
  - It turns a permission denial into a 30–120 s AppleScript run under a different permission
    (Automation).
  - `calendarNames` are interpolated unescaped into `{"…"}`, which is AppleScript injection, on
    top of the shell injection in C1.
  - The hard-coded home path is a developer leftover.
- **Verdict:** reject: a silent fallback that returns different data under a different permission
  breaks "results tell the truth". The helper should be required for calendar, and its absence a
  named failure that says how to fix it.
- **Scenarios:**
  - [acceptance] `reading events` — `given the native helper is not installed, fails with a named failure that says how to install it`
  - [contract] `the calendar store` — `given a meeting that began before the range and ends inside it, includes that meeting`

### C3 AppleScript date literals built in a fixed locale format

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Creating an event failed, or got the wrong time, because AppleScript couldn't parse
  the date (upstream #34, #64 for reminders show the same class of bug).
- **Root cause:** `upstream/main:utils/calendar.ts:270-271` builds `date "${start.toLocaleString()}"`.
  AppleScript parses date literals with the *system* locale, and Node's `toLocaleString()` output
  doesn't match it.
- **Technique:** `formatDateNorwegian` emits `DD.MM.YYYY HH:mm`, which matches a Norwegian system
  locale, for create and for the fallback queries.
- **Evidence:** `ff8af9c`, `3366690`
- **Quality of the fix:** wrong. It fixes the author's Mac and breaks every non-Norwegian locale.
  The real lesson is that string date literals in AppleScript depend on locale.
- **Verdict:** adopt the idea (never pass dates as locale strings). reject the technique.
- **Scenarios:**
  - [contract] `the calendar store` — `given the Mac's region uses day-first dates, creates the event at the instant requested`

### C4 Filter events to named calendars

- **Kind:** feature
- **Context:** calendar
- **Symptom:** Results mixed every calendar (family, work, holidays), with no way to narrow them.
- **Root cause:** Upstream's `calendar` tool has no calendar filter for list/search.
- **Technique:** `calendarNames: string[]` added to the `calendar` tool schema (`tools.ts`) and
  passed through to both paths. With no names given, the hard-coded system and holiday skip list
  applies.
- **Evidence:** `6e5ff6c`
- **Quality of the fix:** partial. It matches exact titles only, where two calendars can share a
  title across accounts. Names aren't validated against what exists, and an unknown name silently
  yields no events.
- **Verdict:** adopt the idea: scope reads by calendar identifier, listed from the store. Refuse
  unknown calendars.
- **Scenarios:**
  - [acceptance] `reading events` — `given a calendar that does not exist, refuses and lists the calendars that do`

## Noise

- `package-lock.json` added (1535 lines) alongside the perf change: `9599219` (the calendar part
  is accounted for in C2).
- Printing date strings verbatim instead of reparsing them is part of C1: `bb0c1ab`.

## Glossary candidates

- **calendar name**: an EventKit calendar's `title`. The fork treats it as an identifier, although
  it isn't unique.
- **system calendar**: the fork's term for Birthdays, Siri Suggestions, national holidays and
  Scheduled Reminders. EventKit models most of these by calendar type or source rather than by
  title.

## Open questions

- Is the ~6 s per call dominated by process start plus `requestFullAccessToEvents`, or by the
  query? A long-lived helper would answer whether per-call cost matters.
- On macOS 14+, does a bare, unbundled CLI get a Calendars prompt at all when its responsible
  process is Claude Desktop (whose own `Info.plist` would need
  `NSCalendarsFullAccessUsageDescription`)?
- Does Calendar.app's `every event whose start date …` return one entry per recurring series or
  one per occurrence?
