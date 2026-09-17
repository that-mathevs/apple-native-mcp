# KassebaumEngineering/apple-mcp

- **Remote:** `fork-KassebaumEngineering`
- **Branches read:** `main` (4 commits). `HEAD` points at `main`. `fix-mail-search` and
  `index-safe-mode` are upstream copies with no commits of their own
  (`git log upstream/<b>..fork-KassebaumEngineering/<b>` is empty).
- **Commits accounted for:** 4 / 4
- **Last commit:** 2026-08-13
- **In one paragraph:** John Kassebaum's fork, pinned as a Claude Code MCP server and installed
  from a commit SHA (it commits `dist/index.js` so no build is needed). It works alongside a
  personal `mcp-guard.py` hook and a dotfiles allowlist. The commits were co-authored with Claude
  Opus 4.8 and Opus 5, and the messages cite measurements taken on the author's own library. It
  is the most careful of the small forks. It adds a mail draft operation and a server-side send
  allowlist that fails closed. It fixes result framing everywhere with ASCII control separators
  and complete string escaping. It moves calendar onto EventKit through JXA's ObjC bridge, which
  needs no Swift binary. It reads reminders and contacts as bulk properties. Its headline
  feature is a notes update that inspects the note's real protobuf payload in `NoteStore.sqlite`
  and refuses the write when the HTML body can't represent the note. The ideas are strong and the
  diagnosis is better than the code. The notes guard identifies the note differently in SQL and
  in AppleScript, and its "verified" result can report success for a note it never found.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Calendar | JXA (`osascript -l JavaScript`) with `ObjC.import('EventKit')`: `EKEventStore`, `predicateForEventsWithStartDateEndDateCalendars`, `saveEventSpanCommitError`. Values spliced as `JSON.stringify` literals or epoch numbers. | Author measured under 4 s against 35 s for one week-long AppleScript query (verify). Calendar.app need not be running. Access is requested with the deprecated `requestAccessToEntityTypeCompletion`, pumping the run loop for up to 20 s. |
| Reminders | AppleScript, bulk property reads: `name of reminders 1 thru N of targetList`, one Apple Event per property | Author measured about 18 s per bulk property on a 469-item list, and `whose` filters at 20–45 s (verify). Search filters in TypeScript. |
| Contacts | AppleScript, `name of every person` and `value of phones of every person` (two Apple Events in total) | Matching runs in TypeScript. |
| Notes (read) | AppleScript, `name of every note` and `plaintext of every note` in bulk, filtered inside the script | Output capped at 400 000 characters to stay under `execFile`'s 1 MB buffer. |
| Notes (update guard) | Copies `~/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite` with `-wal` and `-shm` to a temp dir, runs `PRAGMA journal_mode=DELETE` on the copy, queries it with the system `sqlite3` via `execFile`, gunzips `ZICNOTEDATA.ZDATA` and walks the protobuf by hand | String-built SQL with `''` escaping (no shell). Needs Full Disk Access or the macOS 14+ app-data permission (verify). |
| Mail (draft) | AppleScript as upstream `sendMail`, `save` instead of `send` | Body is passed through a temp file, the rest is quote-escaped. |

## Changes

### C1 Updating a note refuses when the rewrite would destroy formatting

- **Kind:** feature (hardening)
- **Context:** notes
- **Symptom:** Upstream can't edit a note at all (#27: "creates a new item instead of editing").
  The obvious fix, `set body of note to <html>`, silently destroys content. The author reports
  235 checkboxes and 105 ticks lost from one checklist note.
- **Root cause:** Notes' scripting `body` is an HTML projection of the note's real document, a
  gzip-compressed protobuf in `ZICNOTEDATA.ZDATA`. Some paragraph kinds and all attachments have
  no HTML form, so a read-modify-write through `body` flattens them. The author's survey of 120
  notes: 44 had checklists, 33 Title paragraphs, 15 attachments, 7 Headings, 3 Subheadings. That
  makes 55 % of notes that a naive update would damage.
- **Technique:** What counts as lossy, exactly (`utils/notes-db.ts`):
  - **Paragraph style ids** found anywhere in the note: `0` Title, `1` Heading, `2` Subheading,
    `103` Checklist (`LOSSY_STYLES`).
  - **A checklist sub-message:** any paragraph style with field 5 (`checklist`, wire type 2),
    even when the style id isn't 103. This covers notes where the tick state rides on the
    sub-message.
  - **An attachment:** any row in `ZICCLOUDSYNCINGOBJECT` with `ZNOTE = <pk>` and
    `ZTYPEUTI IS NOT NULL`. Images, PDFs, scans, drawings, tables (`com.apple.notes.table`) and
    link cards all have a type UTI (verify).
  - Treated as safe (not checked): styles `4` monostyled, `100` bulleted, `101` dashed,
    `102` numbered. Inline character attributes aren't looked at at all: bold, italic,
    underline, strikethrough, links, font and colour.

  How it detects them:
  1. Snapshot: copy `NoteStore.sqlite`, `-wal` and `-shm`, then checkpoint the copy, because
     recent edits live only in the WAL.
  2. `select Z_PK from ZICCLOUDSYNCINGOBJECT where ZTITLE1 = '<title>' limit 1`.
  3. `select hex(ZDATA) from ZICNOTEDATA where ZNOTE = <pk> and ZDATA is not null limit 1`,
     then `gunzipSync`.
  4. A hand-written protobuf reader follows `2 → 3 → 5 (attribute_run)* → 2 (paragraph_style) →
     1 (style_type) | 5 (checklist)`. This matches the public `notesproto` layout used by
     apple_cloud_notes_parser.
  5. Count attachments.

  Every failure throws, and `updateNote` turns a throw into a refusal ("fail closed"). That
  covers a missing file, a gunzip error on a password-protected note, an unknown wire type, a
  missing column after a schema change, or `sqlite3` absent. A note with blockers gets a refusal
  that names them and suggests editing in the Notes UI. Otherwise the new body is written with
  `set body of (first note whose name is "<title>")`. The new body's own HTML is not inspected.
- **Evidence:** `e766bc9`. Upstream #27 (edits), and indirectly #22 and #44.
- **Quality of the fix:** partial.
  - **Identity mismatch.** SQL takes the first row whose `ZTITLE1` is equal, case-sensitive and
    including notes in Recently Deleted or in other accounts. AppleScript takes
    `first note whose name is`, which ignores case. With duplicate or differently-cased titles,
    the note inspected can differ from the note overwritten. Neither side uses an id, although
    both stores expose one (AppleScript `id` is an `x-coredata://…/ICNote/p<Z_PK>` URL).
  - **Blind spots (verify each):**
    - block quotes (paragraph style field 8 on macOS 15+)
    - indentation and alignment (fields 4 and 2)
    - highlight and text colour (attribute run fields)
    - inline attachments (hashtags, mentions, links to other notes), which may use
      `ZTYPEUTI1` rather than `ZTYPEUTI`
    - whether bold, italic, strikethrough and links really survive the HTML round trip
  - **Over-blocking.** Title style is what the Notes UI gives a new note's first line by default,
    so the guard may refuse most notes created in the app (verify).
  - **Race.** The three files are copied one after another while Notes may be writing. A torn
    copy usually throws, which is safe, but could read an older consistent state.
  - It depends on a private schema and on the system `sqlite3` binary.
- **Verdict:** adopt the idea: a note update refuses to lose what the scripting body can't
  represent, and says what would be lost. Verify the detection list on macOS 14, 15 and 26
  before relying on it. Reject title-based identity: address notes by id in both the check and
  the write.
- **Scenarios:**
  - [acceptance] `updating a note` — `given a note with a checklist, refuses and names the checklist: the rewrite would drop every tick`
  - [acceptance] `updating a note` — `given a note with an attachment, refuses and names the attachment`
  - [acceptance] `updating a note` — `given a note of plain, bulleted and numbered paragraphs, replaces its body`
  - [acceptance] `updating a note` — `given the note's contents cannot be inspected, refuses rather than assuming the note is simple`
  - [domain] `a note document` — `given paragraph styles and attachments, reports which of them a body rewrite would lose`
  - [contract] `a note store` — `given a note edited seconds ago, reports its current contents, not the last checkpoint`
  - [acceptance] `updating a note` — `given two notes with the same title, refuses and asks which one: the check and the write must see the same note`

### C2 A byte-exact backup of the note is kept before an allowed update

- **Kind:** hardening
- **Context:** notes
- **Symptom:** A backup taken through `body` can't restore what a bad write destroyed. The author
  lost checklist ticks despite having a "backup".
- **Root cause:** `body` is lossy (C1).
- **Technique:** Before writing, the compressed `ZDATA` blob is saved to
  `~/.apple-mcp/note-backups/<ISO stamp>--<title slug>.gz`, and the result reports the path.
- **Evidence:** `e766bc9`.
- **Quality of the fix:** partial. The blob is faithful, but no code path, and no supported API,
  can put it back into Notes. So it's a forensic record, not a backup. It also writes private
  note content into a plaintext directory outside the protected container, and never removes it.
- **Verdict:** adopt the insight (a backup must be taken from the source of truth, not the lossy
  projection). Reject the implementation: an unrestorable copy of private data on disk. If the
  rebuild ever writes bodies, the body it replaced goes in the result instead.
- **Scenarios:**
  - [acceptance] `updating a note` — `given the update succeeds, reports the previous body so the change can be undone by another update`

### C3 The note is re-inspected after the write

- **Kind:** hardening
- **Context:** notes
- **Symptom:** Without a check, an update reports success whatever happened (upstream #66).
- **Root cause:** Upstream never reads back after any write.
- **Technique:** After `set body`, `inspectNote(title)` runs again. If blockers now show up, the
  result is still `success: true`, with a warning and the backup path. If the check throws, it
  says "the post-write check could not run".
- **Evidence:** `e766bc9`.
- **Quality of the fix:** wrong in one important case. Notes derives a note's name from the
  first line of its body (verify). A new body whose first line differs from the old title
  renames the note, the second `inspectNote` finds no row (`found: false`, `blockers: []`), and
  the result is an unqualified "Updated". It also never checks that the body actually changed,
  and Notes may not have flushed the WAL by the time of the snapshot (verify).
- **Verdict:** adopt the idea (read back after writing). Reject the check: confirm by id that the
  stored text now matches what was sent, and otherwise report the outcome as unconfirmed.
- **Scenarios:**
  - [acceptance] `updating a note` — `given the store does not yet show the new body, reports the update as unconfirmed rather than done`
  - [acceptance] `updating a note` — `given a new first line, reports the note's new title`

### C4 Mail can be saved as a draft instead of sent

- **Kind:** feature
- **Context:** mail
- **Symptom:** Upstream mail could only send immediately. There was no way to review first.
- **Root cause:** `utils/mail.ts:260-330` has only `send newMessage`.
- **Technique:** `draftMail` is a copy of `sendMail`: the body goes into a `/tmp` file,
  `make new outgoing message … visible:true`, the recipients are added, then `save newMessage`,
  and it returns "Draft saved … Review and send it yourself." It activates Mail and leaves the
  compose window open. The allowlist (C5) deliberately doesn't apply to drafts.
- **Evidence:** `1e95e41`. Related upstream PR #68 (drafts).
- **Quality of the fix:** partial.
  - Subject, to, cc and bcc are escaped for `"` only, so a subject ending in a backslash can inject
    AppleScript. The same applies to upstream's send, which it copies.
  - It never checks that a draft exists in a Drafts mailbox afterwards.
  - The body temp file is at a predictable `/tmp` path.
  - Only one address is allowed per field.
- **Verdict:** adopt the idea: a draft is the safe default way to write mail, and no confirmation
  is needed because nothing leaves the Mac. Reject the implementation.
- **Scenarios:**
  - [acceptance] `drafting an email` — `given recipients, a subject and a body, saves a draft that is not sent and reports where it was saved`
  - [acceptance] `drafting an email` — `given the draft cannot be found in the drafts mailbox afterwards, reports it as unconfirmed`

### C5 Sends are refused unless every recipient is on an allowlist

- **Kind:** hardening
- **Context:** cross-cutting (mail, messages)
- **Symptom:** A prompt-injected agent could send email or iMessages to anyone.
- **Root cause:** Upstream has no recipient policy (`utils/mail.ts:260`, `utils/message.ts:72`).
- **Technique:** `utils/send-allowlist.ts` reads JSON from `SEND_ALLOWLIST_PATH` or
  `~/dotfiles/security/send-allowlist.json` on every call. A missing or corrupt file means an
  empty allowlist, which blocks everything.
  - **Email:** every match of `[\w.+-]+@[\w-]+\.[\w.-]+` in to, cc and bcc must be in
    `allow_recipients` (case-insensitive). No parsable address means refused.
  - **Messages:** the digits of the number, reduced to the last 10, must equal an allowlisted
    number's last 10 digits. Checked in `sendMessage` and again in `scheduleMessage`.
  - Refusals name the address and the file to edit.
- **Evidence:** `13fd400`. Maps to non-negotiable 4 and upstream #48.
- **Quality of the fix:** partial.
  - **Last-10-digit matching.** Numbers in different countries that share their last 10 digits
    are treated as the same.
  - **Email check.** The regex checks the addresses it can find, not the string Mail receives.
    `to` = `ok@allowed.com, "x"@evil.com` extracts only the allowed address and passes. Whether
    Mail then adds a second recipient is unverified.
  - **Handles.** An iMessage handle that's an email address is always refused, because
    `normalizePhone` returns `""`.
  - The default path is personal to the author.
- **Verdict:** adopt the idea (the server enforces who may be contacted, fails closed and says how
  to change it). Reject the matching rules: compare fully normalised E.164 numbers and parsed
  addresses, and refuse any recipient field that doesn't parse completely. Plan.md's "known
  recipients" rule (already messaged) is the stronger default. An explicit allowlist is a
  setting on top of it.
- **Scenarios:**
  - [acceptance] `sending a message` — `given a number not on the allowlist, refuses and says which setting allows it`
  - [acceptance] `sending an email` — `given a recipient field with one allowed and one unparsable address, refuses the whole send`
  - [domain] `a phone number` — `given two numbers that share their last ten digits but not their country, treats them as different`
  - [acceptance] `sending an email` — `given the allowlist cannot be read, refuses every send`

### C6 Structured results survive osascript, and string escaping is complete

- **Kind:** fix
- **Context:** cross-cutting
- **Symptom:** Notes returned a single "Untitled Note" for every query, and contacts returned
  `{}`. A quote in a search term was reported as "no results".
- **Root cause:** Same flattening as boutquin C1 (`utils/notes.ts:118-121`,
  `utils/contacts.ts:106-109`). Escaping covers `"` only, so a term with `"` or `\` becomes a
  syntax error that the catch block turns into `[]`.
- **Technique:** `utils/applescript-data.ts`:
  - Separators are ASCII 30 between records, 31 between fields and 29 between list items,
    declared in AppleScript as `character id 30/31/29`.
  - `parseRecords` and `parseList` split on them.
  - `escapeForAppleScript` escapes `\` first, then `"`, `\n`, `\r` and `\t`, which covers every
    escape an AppleScript string literal has.
  - `runJxa` runs `osascript -l JavaScript` via `execFile`, with a 16 MB buffer and a timeout.
    It notes that `run-applescript`'s 1 MB default turns large results into `ENOBUFS`.
  - JXA values are spliced as `JSON.stringify` literals.
- **Evidence:** `1d47e74`. Upstream #67, #58, #75 (contacts empty).
- **Quality of the fix:** partial. Escaping is correct for string literals, but scripts are still
  built from strings (against non-negotiable 1), and control-character separators inside note
  bodies aren't escaped.
- **Verdict:** adopt the ideas: a larger output buffer and a timeout, and treating "syntax error
  reported as no results" as a failure. Reject escaping in favour of static scripts with JSON
  argv.
- **Scenarios:**
  - [contract] `an automation runner` — `given a result larger than a megabyte, returns all of it or fails naming the size`
  - [acceptance] `searching notes` — `given text with quotes and backslashes, searches for it literally`
  - [acceptance] `searching notes` — `given the search cannot run, fails and says why instead of reporting no notes`

### C7 Calendar reads and writes go through EventKit from JXA

- **Kind:** fix (refactor of mechanism)
- **Context:** calendar
- **Symptom:** Listing returned a dummy event, search returned nothing, and created events lost
  their time (upstream #74, #25, #66, #34-style drift).
- **Root cause:** `utils/calendar.ts:100-116` (dummy), `:175-178` (stub), `:270-271`
  (`date "<toLocaleString>"`, see boutquin C2). AppleScript range queries are too slow to use.
- **Technique:**
  - A shared JXA prelude: `EKEventStore.alloc.init`, `requestAccessToEntityTypeCompletion(0, cb)`
    with the run loop pumped in 50 ms steps for up to 20 s, then named errors for
    "timed out" and "denied".
  - **Listing:** `predicateForEventsWithStartDateEndDateCalendars` on epoch seconds, then
    `eventsMatchingPredicate`, which expands recurrences into occurrences. Dates are emitted
    with `NSISO8601DateFormatter` (UTC `Z`).
  - **Search:** filters title, notes and location in JS.
  - **Create:** sets `EKEvent` fields from epoch seconds. A named calendar that doesn't exist
    throws "Calendar not found" instead of falling back to another calendar. Otherwise it uses
    `defaultCalendarForNewEvents`, calls `saveEventSpanCommitError(event, 0, true, err)` and
    returns `eventIdentifier`.
  - **Open:** checks `eventWithIdentifier` exists before opening `ical://ekevent/<id>`, and
    otherwise reports not found.
  - `resolveRange` refuses unparsable dates.
- **Evidence:** `1d47e74`. Upstream #74, #25, #6, #66.
- **Quality of the fix:** partial.
  - **Access prompt.** On macOS 14+ the old access API is deprecated. Whether it still grants
    full access to osascript, and which app the prompt names, is unverified.
  - **Date-only input.** It's still `new Date()` in UTC, so an all-day event can land a day
    early.
  - **Read-back.** Create doesn't read the event back. It trusts `save` returning true.
  - **Occurrence ids.** Occurrences of a recurring event share one `eventIdentifier`, so "open"
    can't pick a particular occurrence.
  - Errors are swallowed into `[]` for list and search.
- **Verdict:** adopt the idea (EventKit, epoch instants, refuse an unknown calendar, confirm an
  event exists before claiming to open it). Verify two things: the 35 s against 4 s measurement,
  and permission attribution for osascript against the Swift helper. The helper stays the plan
  unless JXA proves equivalent.
- **Scenarios:**
  - [acceptance] `creating an event` — `given a calendar name that does not exist, refuses and names the calendars there are`
  - [acceptance] `opening an event` — `given an id that matches no event, reports it was not found instead of opening the app`
  - [contract] `an event store` — `given a recurring event, returns one occurrence per repeat inside the range`
  - [contract] `an event store` — `given calendar access is denied, fails with a named permission failure`

### C8 Reminders are read in bulk, and a new reminder keeps its list, notes and due time

- **Kind:** fix
- **Context:** reminders
- **Symptom:** Listing and search returned nothing, and a created reminder lost its list, notes
  and due date while the tool reported them saved (upstream #26, #53, #64).
- **Root cause:** Stubs at `utils/reminders.ts:140-217` and `:348-380`, and `createReminder`
  ignoring its arguments (`:249-262`), as described in boutquin C3 and C4.
- **Technique:**
  - **Reading:** one Apple Event per property over a range:
    `name of reminders 1 thru N of targetList`, the same for body, due date, completed and id.
    Capped at 100 per list and 300 in total, with a stderr note when the cap is hit. Due dates
    come out as `rDue as «class isot» as string` (local, no offset; measured:
    `2026-09-17T11:40:05`).
  - **Search:** reads everything, then filters name and body in TypeScript.
  - **Create:**
    - The list is found by exact name, and **created** if missing.
    - The due date is built as `set day to 1`, then year, month and day, then
      `set time to <seconds into day>`. That order is overflow-safe (measured: starting from
      31 January it gives 10 February 17:30).
    - It returns the store's id and the actual list name.
- **Evidence:** `1d47e74`. Upstream #26, #53, #64, #10.
- **Quality of the fix:** partial.
  - "First 100 per list" is the first 100 in storage order, completed ones included, so open
    reminders beyond position 100 are invisible.
  - The truncation is only logged, never reported to the agent.
  - Lists are addressed by name, so duplicate names across accounts collide.
  - An agent-supplied list name creates a new list: a write with side effects.
  - The due date isn't read back.
  - Date-only input is read as UTC.
- **Verdict:** adopt the idea (bulk reads, overflow-safe dates, the real id). Reject creating a
  list as a side effect. EventKit remains the plan.
- **Scenarios:**
  - [acceptance] `creating a reminder` — `given a list that does not exist, refuses rather than creating one`
  - [acceptance] `listing reminders` — `given a list longer than the limit, reports that the result was cut short`
  - [domain] `a due time` — `given a date on the 31st, keeps its day and month`

### C9 Finding a contact no longer returns an unrelated person

- **Kind:** fix
- **Context:** contacts
- **Symptom:** A long query could match a short contact name inside it and return the wrong
  person's number. Listing returned `{}` (upstream #58, #47).
- **Root cause:** Upstream `utils/contacts.ts:309-313` matches when either string contains the
  other. Record flattening is at `:106-109`.
- **Technique:**
  - **Bulk reads:** `name of every person` and `value of phones of every person` (two events
    instead of a `tr` process per person).
  - **Merging:** people who share a name have their numbers merged under that name.
  - **Matching strategies,** tried in order, where the first strategy with a hit wins:
    1. exact
    2. whole-name prefix (≥2 chars)
    3. whole word (≥3)
    4. word prefix (≥3)
    5. the query contains the contact name as a word (name ≥5)
    6. repeated letters collapsed
  - **Phone lookup:** matches the last 10 digits when the input has ≥7 digits.
- **Evidence:** `1d47e74`. Upstream #47, #58.
- **Quality of the fix:** partial.
  - Merging same-named people gives one person's name another person's numbers, the same
    "ghost" risk as #48.
  - The first matching contact wins silently even when several match.
  - Contacts still has phones only, with no emails (#75).
- **Verdict:** adopt the idea (word-boundary matching, most precise match first). Reject merging
  and silent first-match: return every candidate and let ambiguity be visible.
- **Scenarios:**
  - [domain] `a contact name match` — `given a query that merely contains a short name as letters inside a word, does not match it`
  - [acceptance] `finding a contact` — `given two people with the same name, reports both separately`
  - [acceptance] `finding a contact` — `given several matches, reports all of them rather than choosing one`

### C10 Searching notes finds text in the whole note

- **Kind:** fix
- **Context:** notes
- **Symptom:** Content search stopped working, and results were 200-character previews (upstream
  #67). Past the 50th note, nothing was ever found.
- **Root cause:** `utils/notes.ts:140-200`: a per-note loop capped at `MAX_NOTES` 50 over all
  notes (not over matches), `searchText.toLowerCase()` spliced unescaped, and record flattening.
- **Technique:** One script reads `name of every note` and `plaintext of every note`, tests
  `contains` inside AppleScript and stops after 25 matches or 400 000 output characters. Search
  returns full bodies, while listing returns 200-character previews of up to 200 notes. The term
  isn't lowercased, because `contains` already ignores case.
- **Evidence:** `1d47e74`. Upstream #67.
- **Quality of the fix:** partial. `plaintext of every note` pulls the whole library across on
  every search. Hitting the character cap truncates silently. Folder and account aren't reported,
  and notes in Recently Deleted are included (verify).
- **Verdict:** adopt the idea (search whole contents, cap matches rather than notes scanned).
  Whether Notes is read via JXA or `NoteStore.sqlite` is still plan.md's open verify.
- **Scenarios:**
  - [acceptance] `searching notes` — `given text that appears only deep in a note's body, finds the note`
  - [acceptance] `searching notes` — `given more matches than the limit, reports the first ones and says more exist`

## Noise

- Built `dist/index.js` committed alongside the real changes, so the fork installs from GitHub
  without a build: `1e95e41`, `13fd400`, `1d47e74`, `e766bc9`.
- Lockfile churn: `1e95e41`.
- A type cast in `tests/integration/reminders.test.ts` to satisfy strict indexing: `1d47e74`.

## Glossary candidates

- **note body:** the HTML projection of a note that scripting reads and writes. It's lossy.
- **note document / payload:** the gzip-compressed protobuf in `ZICNOTEDATA.ZDATA`, which is the
  source of truth.
- **attribute run:** a span of note text sharing one paragraph style and character attributes.
- **paragraph style:** Title (0), Heading (1), Subheading (2), Monostyled (4), Bulleted (100),
  Dashed (101), Numbered (102), Checklist (103).
- **checklist item:** a paragraph with checklist style. Its done state has no HTML form.
- **attachment (note):** an object linked to a note that has a type UTI (image, PDF, table,
  drawing, link card).
- **lossy rewrite:** replacing a note's body in a way that drops something the payload held.
- **blocker:** the name of something that makes a note unsafe to rewrite.
- **send allowlist:** the explicit set of addresses and numbers the server may send to.
- **draft:** an outgoing message saved to Mail's Drafts without sending.
- **occurrence:** one dated instance returned by an EventKit range query. It shares its event
  identifier with its siblings.
- **default calendar:** EventKit's `defaultCalendarForNewEvents`, used when none is named.

## Open questions

- Does `set body` rename a note when the new first line differs? That decides whether C3 can
  report false success.
- Does the Notes UI give a new note's first line Title style by default? That decides whether the
  guard refuses most real notes.
- Are inline attachments (hashtags, mentions, note links) rows with `ZTYPEUTI` set, or only
  `ZTYPEUTI1`? Are block quotes, indentation, highlights, and bold, italic and links lost by a
  body round trip on macOS 26?
- Does reading the Notes group container from the server need Full Disk Access, or the macOS 14+
  "access data from other apps" prompt, and which app does macOS attribute it to?
- Does JXA's `requestAccessToEntityTypeCompletion` still grant calendar access on macOS 14+
  without `requestFullAccessToEventsWithCompletion`? Is 35 s against under 4 s reproducible?
- Does Mail treat a `to recipient` address string holding two comma-separated addresses as two
  recipients? That is the C5 bypass.
