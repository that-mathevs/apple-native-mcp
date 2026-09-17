# therealap/apple-mcp

- **Remote:** `fork-therealap`
- **Branches read:** `main` (16 commits: 14 of its own plus 2 PR merges),
  `claude/calendar-appointment-additions-3luhbl` (15 commits, 0 not on main),
  `claude/hae-export-code-qxv3ez` (13 commits, 0 not on main),
  `fix/folder-scoping-and-trash-exclusion` (2 commits, 0 not on main)
- **Commits accounted for:** 16 / 16
- **Last commit:** 2026-09-05 (pushed 2026-09-06)
- **In one paragraph:** A personal fork run by therealap. The three branches are
  PR branches that were merged into `main`, so `main` holds everything. There are two
  bursts of work. On 2026-08-13 the owner made six hand commits to Notes: scoping list
  and search to a folder, leaving out Recently Deleted, and finally working out why
  upstream's list and search never returned real notes. From 2026-08-29 to 2026-09-04,
  Claude Code sessions (each commit carries a `Claude-Session:` trailer) added a
  `health` tool that reads JSON files written by the third-party iOS app **Health Auto
  Export** ("HAE"), fixed the test entry points, and rewrote calendar event creation.
  The fork is known for "calendar appointments", but that is one commit, `d50bfae`,
  which fixes creating an event. It adds nothing new for appointments. What's worth
  learning from: the Notes result-encoding bug (it very likely explains upstream #67),
  the Recently Deleted and smart-folder duplicates, the calendar create fixes, and a
  general rule that results must say when they were cut short. The health tool is
  well built but out of v1 scope, and it doesn't touch a macOS app at all.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Notes | AppleScript via `run-applescript`, strings built in code | Walks `folders`, then `notes of folder`, and returns one string of delimited records instead of an AppleScript record list. Search terms and folder names now get escaped. Create is unchanged and still unescaped. |
| Calendar (create only) | AppleScript via `run-applescript`, strings built in code | Sets dates field by field (`set year/month/day/time of d`), with escaping for `\` and `"`. Returns `uid` and calendar name joined by `\|:\|`. |
| Health (new, `other:health`) | Plain filesystem read of JSON files (`node:fs`), no Apple API | Reads the export folder that the Health Auto Export iOS app syncs through iCloud Drive or Dropbox. It never opens the HealthKit store. macOS has no HealthKit store to script. |

## Changes

### C1 Notes list and search return the actual notes

- **Kind:** fix
- **Context:** notes
- **Symptom:** Listing or searching notes returned at most one note, called "Untitled
  Note", with empty content, however many notes matched. An agent reads that as
  "search finds nothing useful".
- **Root cause:** `run-applescript` (v7) runs `osascript` and returns **stdout as
  text**. It never gives back structured values. Upstream builds a list of AppleScript
  records (`utils/notes.ts:107-108`, `178-179`) and then treats the result as an array
  of objects (`utils/notes.ts:118-128`, `190-200`). The text looks like
  `name:a, content:b, name:c, content:d` (confirmed with `osascript` on this Mac).
  `Array.isArray` is false, so it gets wrapped as `[string]`, `noteData.name` is
  undefined, and the result is one "Untitled Note". The same wrong assumption sits
  under every upstream module that returns records.
- **Technique:** Each script builds a single string,
  `name<FS>content<RS>name<FS>content<RS>…`, which `parseDelimitedNotes` splits. The
  separators are U+241E and U+241F. Those are the printable *Control Pictures* glyphs
  ␞ ␟, not the ASCII control characters, and the code comments have the two names
  swapped.
- **Evidence:** `220462c`. It replaced `normalizeApplescriptListResult`, which `a675a7b`
  had added and which still couldn't work. Very likely resolves upstream #67 ("content
  search not working in latest version").
- **Quality of the fix:** partial. A note whose title or body contains ␞ or ␟ is split
  wrongly, and any content after a second ␞ is dropped silently. No id, dates or folder
  are returned, so two notes with the same title can't be told apart. The scripts are
  still built from strings. `runAppleScript`'s `trim()` still eats trailing whitespace
  on the last note.
- **Verdict:** adopt the idea. Never parse AppleScript's human-readable output. In the
  rebuild, the static JXA script returns `JSON.stringify(...)` and the adapter
  validates that JSON with a schema. This belongs in the automation runner's contract.
- **Scenarios:**
  - [contract] `the automation runner` — `given a script that returns several records, hands back every record with its fields intact`
  - [contract] `the automation runner` — `given text containing separator-like characters, returns it unchanged: results are structured, not delimited`
  - [acceptance] `searching notes` — `given three notes that mention the term, reports all three with their titles and a preview of their content`

### C2 Notes list and search scoped to one folder

- **Kind:** feature (also a fix, because upstream's schema already offered it)
- **Context:** notes
- **Symptom:** Asking for the notes in a folder either ignored the folder or returned
  nothing.
- **Root cause:** The tool accepted `folderName`, but the handler never passed it to
  list or search (`index.ts:293`, `index.ts:310`). `getNotesFromFolder` counted the
  notes and then returned `notes: []` whatever it found (`utils/notes.ts:402-427`).
- **Technique:** `findNote` and `getAllNotes` now take `folderName`. The scoped script
  collects **every** folder with that name in every account and reads the notes of
  each. `getNotesFromFolder` is now `getAllNotes(folderName)`. The tool description
  explains that search and list are scoped when a folder is given.
- **Evidence:** `63bfc01`, `a675a7b` (`fix/folder-scoping-and-trash-exclusion`, then main)
- **Quality of the fix:** partial.
  - It lost upstream's "Folder not found" failure (`utils/notes.ts:398-400`). A folder
    name with a typo now returns an empty success, which breaks "results tell the
    truth".
  - Same-named folders in different accounts (iCloud "Notes" and Gmail "Notes") are
    merged, and nothing says which account a note came from.
  - Whether `folders` of the application includes nested subfolders isn't checked.
- **Verdict:** adopt the idea, but identify a folder by account and folder (as morquis
  does), and refuse a folder that doesn't exist.
- **Scenarios:**
  - [acceptance] `listing notes in a folder` — `given a folder name, reports only the notes filed in that folder`
  - [acceptance] `listing notes in a folder` — `given a folder name that no account has, refuses and names the folders that do exist`
  - [acceptance] `listing notes in a folder` — `given two accounts that each have a folder of that name, reports each note with the account it belongs to`
  - [domain] `a note folder` — `is identified by its account and its name together: folder names repeat across accounts`

### C3 Deleted notes stay out of list and search

- **Kind:** fix
- **Context:** notes
- **Symptom:** Notes the user had deleted still came up in search and list results, so
  an agent could quote or act on a note that had been binned.
- **Root cause:** Upstream reads `notes` of the application (`utils/notes.ts:91`,
  `160`). According to the fork, that includes notes in the Recently Deleted folder.
- **Technique:** Loop over `folders` instead, and skip any folder whose name is in
  `EXCLUDED_FOLDERS`, which contains `"Recently Deleted"`. The skip only applies when no
  folder is named, so naming "Recently Deleted" explicitly still reads it.
- **Evidence:** `63bfc01`, `88c75f6`, `a675a7b`
- **Quality of the fix:** partial. The match is on the English display name, so any
  other system language breaks it. There's no stable way to identify the trash folder.
- **Verdict:** verify: on macOS 26, `notes` of application `"Notes"` includes notes in
  Recently Deleted, and the trash folder can be recognised in a way that doesn't depend
  on the language (by a folder property or id, or in `NoteStore.sqlite` by the marked-
  for-deletion flag). If that holds, adopt the idea.
- **Scenarios:**
  - [acceptance] `searching notes` — `given a matching note in Recently Deleted, leaves it out of the results`
  - [acceptance] `listing notes in a folder` — `given Recently Deleted by name, reports the notes waiting to be deleted`
  - [contract] `the notes store` — `never reports a deleted note as a live one, whatever the system language`

### C4 Notes no longer come up twice

- **Kind:** fix
- **Context:** notes
- **Symptom:** Once list and search walked folders (C3), the same note showed up more
  than once.
- **Root cause:** According to the fork's comment, smart folders appear in `folders`
  alongside real folders and repeat the notes filed in real folders. Upstream didn't
  have this problem because it read `notes` directly. C3 introduced it.
- **Technique:** Folders called `"All"`, `"Group"`, `"Last Month"`,
  `"Last Week Changes"` and `"People"` are hard-coded into `EXCLUDED_FOLDERS`.
- **Evidence:** `2efb44b`
- **Quality of the fix:** wrong. Apple doesn't ship folders with those names; they look
  like the owner's own smart folders. On anyone else's Mac, a real folder called
  "People" or "All" would vanish from unscoped results without a word, and their own
  smart folders would still produce duplicates.
- **Verdict:** reject the technique: it hard-codes one user's folder names. Adopt the
  finding, which needs checking first. Verify: on macOS 26, smart folders come back
  in `folders` of the Notes application and repeat notes from real folders, and a
  scripting property tells a smart folder from a real one. Whatever is found, remove
  duplicates by note id, never by folder name.
- **Scenarios:**
  - [acceptance] `searching notes` — `given a smart folder that also shows a matching note, reports that note once`
  - [acceptance] `listing notes` — `given a real folder named "People", includes its notes`

### C5 Reading the folder of each note is too slow to finish

- **Kind:** fix (performance)
- **Context:** notes
- **Symptom:** Listing and searching timed out on a real Notes library.
- **Root cause:** A problem in the fork's own intermediate version `88c75f6`. That
  version went back to reading `notes` of the app and asked for
  `name of container of currentNote` for each note. The fork's comment calls this
  "unusably slow". Upstream never did it, but upstream never filtered by folder
  either.
- **Technique:** Walk `folders` and read `notes of currentFolder` for each one, so the
  folder is known without a per-note lookup.
- **Evidence:** `88c75f6` (introduced), `a675a7b` (fixed)
- **Quality of the fix:** complete for the problem it created. Each note's `name` and
  `plaintext` still cost one Apple Event each, and search still reads the full text of
  every note to filter on the Mac side.
- **Verdict:** verify: in a library of about 1,000 notes, reading `container` for each
  note takes much longer than reading notes folder by folder, and reading `name` and
  `plaintext` in bulk (`notes.name()`, `notes.plaintext()` in JXA) removes the per-note
  cost. The answer feeds the Notes "JXA vs `NoteStore.sqlite`" row in plan.md.
- **Scenarios:**
  - [contract] `the notes store` — `given a library of a thousand notes, lists a folder within the tool timeout`

### C6 Search text and folder names can no longer break the Notes script

- **Kind:** hardening
- **Context:** notes
- **Symptom:** A search term or folder name containing `"` could break the script or
  inject AppleScript, which can run `do shell script`.
- **Root cause:** `set searchTerm to "${searchTerm}"` with no escaping
  (`utils/notes.ts:157`). Folder names are also spliced in unescaped
  (`utils/notes.ts:249`, `255`, `266-275`, `363`).
- **Technique:** `asLiteral()` escapes `\` and then `"` before splicing, for search
  terms, folder names and the excluded-folder list.
- **Evidence:** `a675a7b`
- **Quality of the fix:** partial. For an AppleScript string literal, escaping `\` and
  `"` is enough. But `createNote` is untouched: `folderName` is still unescaped
  (fork `utils/notes.ts:396-418`), and `title` escapes only `"`, so a title ending in
  `\` escapes the closing quote and opens an injection. The approach is still string
  splicing.
- **Verdict:** adopt the idea (tool input is hostile), reject the technique:
  non-negotiable 1 bans splicing. Values reach static scripts only as JSON arguments.
- **Scenarios:**
  - [acceptance] `searching notes` — `given search text full of quotes and backslashes, searches for that literal text and runs nothing else`
  - [acceptance] `creating a note` — `given a title ending in a backslash, creates the note with that exact title`

### C7 Creating a calendar event actually creates it

- **Kind:** fix
- **Context:** calendar
- **Symptom:** According to the commit, every "create event" request failed before the
  event was made, so no appointment could ever be added.
- **Root cause:** The commit blames `set targetCal to null` (`utils/calendar.ts:274`),
  saying AppleScript has no `null`. That isn't the whole story: `osascript -e 'set x to
  null'` compiles and runs on this Mac (outside a `tell` block). The other candidate is
  `date "${start.toLocaleString()}"` (`utils/calendar.ts:270-271`). Node formats that
  as `9/4/2026, 3:00:00 PM`, and whether AppleScript's `date` accepts that string
  depends on the Mac's region settings.
- **Technique:** Use `missing value` instead of `null`. Build each date as
  `current date`, then `day 1`, `year`, `month`, `day`, `time` (seconds). Day goes to 1
  before the month changes so that, say, the 31st never rolls into the next month.
  All-day events snap to midnight. The C8 to C10 changes are in the same commit.
- **Evidence:** `d50bfae` (`claude/calendar-appointment-additions-3luhbl`, merged in
  `1a09e54`)
- **Quality of the fix:** partial.
  - Nothing reads the event back after creating it (#66). Success just means the
    script returned.
  - All-day snapping happens *after* the `end <= start` check, so a same-day all-day
    event gets start == end.
  - `getEvents` in the same file still splices unescaped `fromDate`/`toDate`
    (fork `utils/calendar.ts:145-146`, upstream `108-109`) and still returns a
    placeholder "No events available" event, which the fork didn't touch.
- **Verdict:** verify: on macOS 26, upstream's create script fails, and the cause is
  `set targetCal to null` inside `tell application "Calendar"` or `date "<toLocaleString>"`
  under a non-US locale, or both. The rebuild uses EventKit anyway, so the lasting
  lesson is "never send dates to the app as text". Adopt that.
- **Scenarios:**
  - [acceptance] `creating an event` — `given a title, a start and an end, reports the event as created only once the calendar holds it`
  - [contract] `the event store` — `given a start time, stores exactly that instant whatever the Mac's region format`
  - [domain] `an all-day event` — `given a start and end on the same day, spans that whole day`

### C8 Event text can no longer break the Calendar script

- **Kind:** hardening
- **Context:** calendar
- **Symptom:** A location or note containing `"` let tool input run as AppleScript.
  A backslash in a title broke the script.
- **Root cause:** Location and notes were spliced **unescaped** into the `if "…" ≠ ""`
  checks (`utils/calendar.ts:286`, `290`). The calendar name was unescaped
  (`utils/calendar.ts:276`). The title escaped only `"` (`utils/calendar.ts:284`).
- **Technique:** One `escapeForAppleScript` escapes `\` then `"`. The empty-string
  checks are gone: a `set location`/`set description` line is emitted only when the
  value is present.
- **Evidence:** `d50bfae`
- **Quality of the fix:** complete for `createEvent` as a string-escaping fix. The
  approach is still splicing, and `getEvents` is still open (see C7).
- **Verdict:** adopt the idea, reject the technique (non-negotiable 1). With EventKit
  there's no script to inject into.
- **Scenarios:**
  - [acceptance] `creating an event` — `given a location and notes containing quotes and script syntax, stores them as plain text`

### C9 An event is never filed in a calendar the caller didn't ask for

- **Kind:** fix
- **Context:** calendar
- **Symptom:** If the calendar name was misspelt or didn't exist, the event quietly went
  into whichever calendar came first, and the result said nothing about it.
- **Root cause:** `on error → set targetCal to first calendar` (`utils/calendar.ts:277-280`).
  If no name was given, the fallback name was `"Calendar"` (`utils/calendar.ts:266`).
- **Technique:** If a named calendar isn't found, raise
  `error "Calendar \"X\" was not found."`. With no name, use the first calendar, and
  fail clearly if there are none. The script returns `uid|:|calendar name`, and the
  success message names the calendar used.
- **Evidence:** `d50bfae`
- **Quality of the fix:** partial.
  - Calendar names repeat across accounts (iCloud "Home" and Google "Home"), and
    `calendar "X"` takes the first match.
  - "First calendar" is arbitrary, and may be read-only or a subscription.
  - The error doesn't list the calendars that do exist.
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [acceptance] `creating an event` — `given a calendar that does not exist, refuses and names the calendars that do: an appointment never lands somewhere unexpected`
  - [acceptance] `creating an event` — `reports which calendar the event was filed in`
  - [acceptance] `creating an event` — `given no calendar, files it in the user's default calendar for new events`
  - [acceptance] `creating an event` — `given a calendar that cannot be written to, refuses and says so`

### C10 Truncated results say they were truncated

- **Kind:** hardening
- **Context:** cross-cutting (shown in the health tool)
- **Symptom:** A health archive going back eight years hit the 500-file scan limit. The
  totals were quietly built from part of the data and looked plausible.
- **Root cause:** A hidden cap. The same pattern is in upstream: Notes stops at
  `MAX_NOTES: 50` (`utils/notes.ts:6`, `94`, `163`) and says nothing, and the fork keeps
  that.
- **Technique:** `ExportData.truncated` is set when the walk stops at `MAX_FILES`. The
  `sources` output and the diagnostic script print a WARNING. The limit went up to
  10,000.
- **Evidence:** `5176aa5`
- **Quality of the fix:** partial. Only `sources` reports truncation. `query`,
  `summary` and `listMetrics` build on the same truncated data without a warning, which
  is exactly where wrong totals hurt. The flag is `paths.length >= MAX_FILES`, so a
  folder with exactly 10,000 files is reported as truncated.
- **Verdict:** adopt the idea for every capped read in v1 (notes, messages, mail,
  events).
- **Scenarios:**
  - [acceptance] `listing notes` — `given more notes than one response holds, reports how many were left out and how to see them`
  - [domain] `a page of results` — `knows whether it is complete`

### C11 Health data from Health Auto Export exports ("HAE export")

- **Kind:** feature
- **Context:** other:health
- **Symptom:** No access to Apple Health data. macOS has no scriptable or on-device
  HealthKit store to read.
- **Root cause:** n/a (new capability)
- **Technique:** "HAE" is **Health Auto Export**, a paid third-party iOS app. It runs
  automations that write HealthKit metrics and workouts as JSON (or CSV) to iCloud
  Drive, Dropbox and similar. The container this fork confirmed is
  `iCloud~com~ifunography~HealthExport`. `utils/health.ts` (1,042 lines) does the
  following:
  - Finds the folder: the `directory` argument, then `APPLE_MCP_HEALTH_DIR`, then an
    iCloud container matching `/health[a-z]*export/i`, then fixed candidate paths.
  - Walks it for `*.json` (depth 4, up to 10k files, 64 MB per file), accepting
    `{data:{metrics,workouts}}` or a bare payload.
  - Parses HAE timestamps (`2024-01-15 07:30:00 +0000`) by hand.
  - Keeps every numeric field, so composite metrics (blood pressure, sleep stages) can
    be queried field by field.
  - De-duplicates overlapping re-exports on `metric + timestamp`, newest file wins.
  - Offers five operations: `sources`, `listMetrics`, `query` (raw, or daily, weekly,
    monthly or total buckets with sum, avg, min and max), `workouts`, `summary`.
  - Matches metric names loosely ("steps" finds `step_count`) and suggests names when
    nothing matches.
  - Caches for 30 s, keyed on each file's size and mtime.
  - Explains setup when no folder is found, and gives a reason for each file it skipped
    when nothing parses (`c7b7f2b`).
  - Adds a DXT `user_config` for the folder (`aa97910`) and a `bun run health:check`
    diagnostic script (`67eeee8`).
  - 27 fixture-based unit tests run without a Mac.
- **Evidence:** `5f50276`, `aa97910`, `c7b7f2b`, `67eeee8`, `c93618c`, `5176aa5`
  (`claude/hae-export-code-qxv3ez`, merged in `b691220`)
- **Quality of the fix:** Good for a personal tool, with three flaws.
  - The `directory` argument comes straight from tool input. An agent under prompt
    injection can make the server walk any readable folder and return file paths plus
    JSON parse error messages from it.
  - De-duplicating on `metric + timestamp` alone merges samples from different sources
    (phone and watch) recorded at the same instant, so it undercounts.
  - A timestamp with no offset is read in the server's local time zone.
- **Does it belong here?** Not in v1. It reads files from a third-party iOS app rather
  than driving a native macOS app, it adds a paid dependency the server can't control,
  and it isn't one of plan.md's six contexts. It fits better as a separate MCP server,
  or as a context to consider after v1 next to Photos and Music.
- **Verdict:** out of v1 scope
- **Scenarios:**
  - [acceptance] `reading health data` — `given a folder not named in the settings, refuses to read it: tool input never chooses which files are opened`

### C12 A test run that finds no tests fails instead of passing

- **Kind:** infra
- **Context:** cross-cutting
- **Symptom:** `npm run test` reported success while running zero tests. The
  `tests/mcp/` suite described in `TEST_README.md` was never committed. The published
  `.dxt` manifest listed a different set of tools from the server.
- **Root cause:**
  - `test-runner.ts` splits commands on spaces and spawns them without a shell, so
    `tests/**/*.test.ts` reached `bun` unexpanded and matched nothing.
  - `.gitignore`'s bare `mcp` also ignored `tests/mcp/`.
  - Nothing checked `manifest.json` against `tools.ts`.
  - `test:web-search` pointed at a file that doesn't exist.
- **Technique:**
  - Pass the `tests` directory to bun and anchor the ignore rule as `/mcp`.
  - Add `tests/mcp/handlers.test.ts`, which checks tool schemas (unique names, every
    property described, `operation` is an enum and required).
  - Assert that the manifest tools equal the server's tools.
  - Drive `bun run index.ts` over stdio to check that an unknown tool, bad arguments and
    a missing required parameter come back as `isError` results, and that the server
    still answers afterwards.
  - Remove the dangling web-search scripts.
  - Also in `5f50276`: the safe-mode timeout reset now clears `maps` as well
    (`index.ts:95-101`).
- **Evidence:** `1ad9f60`, `5f50276` (safe-mode line only)
- **Quality of the fix:** complete for what it targets.
- **Verdict:** adopt the idea: CI fails on an empty or missing suite, and a check keeps
  the tool list and any packaging manifest in step. The safe-mode reset is rejected
  because the rebuild has no eager/lazy module loading.
- **Scenarios:**
  - [acceptance] `the server` — `given a request for a tool it does not have, reports an error result and keeps answering`
  - [acceptance] `the server` — `given arguments that fail validation, reports which argument is wrong without touching any app`
  - [contract] `the extension package` — `advertises exactly the tools the server lists`

## Noise

- Stray `applemcp.patch` committed and then deleted (the patch holds the same diff as
  `63bfc01`): `63bfc01` (patch file only), `5589fcd`
- PR merge commits, no content of their own: `b691220`, `1a09e54`
- README, TEST_README and manifest description text for the health tool (they ride
  along in `5f50276`, `aa97910`, `1ad9f60`, `67eeee8`); `bun.lockb` churn

## Glossary candidates

- **note folder:** a container of notes inside an account. The name isn't unique
  across accounts, so the fork merges folders that share a name.
- **Recently Deleted:** the folder where deleted notes wait before they are purged.
  Deleted notes still appear in the app-wide `notes` collection, and normal reads have
  to leave them out.
- **smart folder:** a saved-search view that shows notes filed in real folders. When
  the code walks folders, it repeats those notes.
- **account (Notes):** iCloud, On My Mac, Gmail and so on. Each has its own folder tree.
- **calendar:** a named container of events inside an account. Names can repeat, and
  some calendars can't be written to.
- **event uid:** the identifier Calendar gives a newly created event. The fork returns
  it with the calendar name.
- **all-day event:** an event with no times. The fork stores it from midnight to
  midnight.
- **health export / export file (out of scope):** a JSON file written by Health Auto
  Export, containing `metrics[]` (name, units, `data[]` samples) and `workouts[]`.
- **metric / sample / field (out of scope):** a HealthKit quantity type
  (`step_count`), one timestamped reading of it, and the named numbers a composite
  reading carries (`systolic`, `deep`).
- **truncated:** a result that stopped at a limit before reading everything, and has to
  say so.

## Open questions

- What actually made upstream's calendar create fail: `null` inside
  `tell application "Calendar"`, the locale-dependent `date "…"` string, or both?
  `set x to null` works outside a `tell` block on macOS 26.3.
- Does `folders` of application `"Notes"` return nested subfolders and smart folders on
  macOS 26? Do smart folders expose a property that tells them apart? What is Recently
  Deleted called on non-English systems, and can it be recognised without its name?
- Is Recently Deleted really part of the app-wide `notes` collection, or did the
  duplicates come only from walking folders? Commit `88c75f6` suggests the first
  folder-walking version (`63bfc01`) looked broken because of the C1 parsing bug rather
  than the walk itself. The fork may have misread what it saw.
- Does the scoped `set targetCal to calendar "X"` inside `try` raise when the calendar
  doesn't exist, or return a reference that fails later at `make new event`?
- Health Auto Export's JSON format isn't documented in the repo. The fork's fixtures are
  hand-written, apart from what the `c93618c` and `5176aa5` messages say about a real
  archive. Is there a public schema?
