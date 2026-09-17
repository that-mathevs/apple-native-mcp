# neektza/apple-mcp

- **Remote:** `fork-neektza`
- **Branches read:** `main` (3 commits). `fix-mail-search` and `index-safe-mode` are copies of
  upstream's branches with no commits of their own (checked with `git log upstream/<b>..fork-neektza/<b>`).
- **Commits accounted for:** 3 / 3
- **Last commit:** 2026-02-19
- **In one paragraph:** Nikica Jokic's afternoon of Notes work (all three commits on 2026-02-19,
  co-authored by Claude Opus 4.6 and Sonnet 4.6). It touches only the notes tool. Listing and
  search return real names and content, found by parsing sentinel-delimited text instead of the
  JS objects upstream expected. It adds a `get` operation for a note's full text and an `edit`
  operation that replaces a note's body and optionally renames it. Search becomes three tiers:
  a name `whose` filter, then a user-supplied regex, then bigram fuzzy matching.
  **Escaping, as the brief asks:** each of the three new scripts escapes `\` first and then `"`
  before splicing a title or search text into an AppleScript string literal. That order is
  correct and complete for AppleScript string literals, and the edit body travels through a temp
  file, never through the script text. Upstream's search injection goes away because that script
  is replaced. But the other upstream sites in the same file are untouched: `createNote` and
  `getNotesFromFolder` splice `folderName` in unescaped, and `createNote` escapes only `"` in the
  title (fork `utils/notes.ts:326-352`, `:368`, `:372`, `:440`). The edit itself is a lossy
  plain-text overwrite with no read-back, and it leaves the note's text in `/tmp` on failure.
  Worth learning from: the escaping order, the "set the name after the body" observation, and
  the integration tests as a list of edge cases.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Notes | AppleScript via `run-applescript` (unchanged), output as `<<<NOTE_START>>>name<<<NOTE_SEP>>>text<<<NOTE_END>>>` | Name lookups move from a loop over every note to `notes whose name contains/= "…"`. The edit body is read from a temp file with `read POSIX file … as «class utf8»`. |

## Changes

### C1 Listed and found notes carry their real name and text

- **Kind:** fix
- **Context:** notes
- **Symptom:** Listing or searching notes returned "Untitled Note" entries with no content, or
  nothing.
- **Root cause:** `run-applescript` returns stdout as a string. Upstream builds AppleScript
  records and then maps `Array.isArray(result) ? result : [result]`, so it reads `.name` and
  `.content` off a string (`utils/notes.ts:118-128`, `:190-200`).
- **Technique:** The script concatenates
  `<<<NOTE_START>>>` & name & `<<<NOTE_SEP>>>` & plaintext & `<<<NOTE_END>>>`, and JS splits it
  with a regex (`parseDelimitedNotes`).
- **Evidence:** `5766ff0`. Upstream #67, #22 (as far as notes came back empty).
- **Quality of the fix:** partial. A note whose text contains a sentinel breaks the parse.
  Listing still stops silently at `MAX_NOTES` (raised 50 → 100 in `5d0e84a`).
- **Verdict:** adopt the idea (structured output, never parsed display text). Reject sentinel
  strings. Return JSON.
- **Scenarios:**
  - [contract] `a note store` — `given a note whose text contains any characters, reports its name and text intact`
  - [acceptance] `listing notes` — `given more notes than the limit, reports the first page and says more exist`

### C2 Searching by title covers every note and can't be used to inject script

- **Kind:** fix, hardening
- **Context:** notes
- **Symptom:** Search missed notes beyond the first 50. A search term containing `"` broke the
  script or ran code.
- **Root cause:** Upstream `findNote` loops over `notes` and stops at `MAX_NOTES`. It splices the
  lower-cased search text into `set searchTerm to "${searchTerm}"` with no escaping
  (`utils/notes.ts:140-207`, `:151`, `:157`).
- **Technique:** `notes whose name contains "<escaped>"`, where `escaped` is
  `searchText.replace(/\\/g, "\\\\").replace(/"/g, '\\"')`. Notes does the filtering, with no
  cap. AppleScript's `contains` is case-insensitive by default.
- **Evidence:** `5d0e84a`.
- **Quality of the fix:** partial. The escaping is complete for a string literal (backslash
  first, then quote), and a raw newline inside a literal is legal AppleScript. But the tier has
  no limit: a one-letter search fetches the full `plaintext` of every matching note, one Apple
  Event each, before truncating in AppleScript. It matches names only.
- **Verdict:** adopt the idea (let the store filter, never scan a capped prefix). Reject spliced
  escaping in favour of JSON argv (plan.md non-negotiable 1).
- **Scenarios:**
  - [acceptance] `searching notes` — `given a matching note beyond the first hundred, finds it`
  - [contract] `a note store` — `given a search text containing quotes, backslashes and newlines, matches it literally`
  - [acceptance] `searching notes` — `given a very common term, reports at most the limit and says more exist`

### C3 Search falls back to regex and fuzzy matching, and loses plain-text body search

- **Kind:** feature
- **Context:** notes
- **Symptom:** Wanted: typo tolerance ("Seach Test") and pattern search.
- **Root cause:** Upstream search is a plain substring match over the first 50 notes
  (`utils/notes.ts:140-207`).
- **Technique:** If the name `whose` filter finds nothing, it loads up to 100 notes
  (`getAllNotes`, 200-character previews). Then:
  - If the text contains any regex metacharacter, it runs `new RegExp(searchText, "i")` over name
    and preview.
  - Otherwise it scores names with a token/Dice-bigram `fuzzyScore`, keeps scores ≥ 0.3 and
    returns the top 5.
- **Evidence:** `5d0e84a`. Integration tests: "regex pattern (tier 2)", "bigram similarity for
  typos (tier 3)", "case-insensitively".
- **Quality of the fix:** wrong.
  (a) **A regression for upstream #67.** A plain word that appears only in a note's body, with no
  metacharacters, is never searched in the body any more. Tier 1 is names only, tier 2 is
  skipped, and tier 3 scores names only.
  (b) The regex comes straight from tool input, so a catastrophic-backtracking pattern stalls the
  server thread (ReDoS).
  (c) Regex and fuzzy tiers see only the first 100 notes and only their 200-character previews.
  (d) Fuzzy hits come back looking exactly like real matches.
  (e) The upstream test "should find notes by content search" still passes, because it only
  asserts that an array came back.
- **Verdict:** reject: user-supplied regex lets hostile input stall the server, and approximate
  hits are presented as matches. Adopt the narrower idea: when nothing matches, near matches may
  be offered but must be labelled as suggestions.
- **Scenarios:**
  - [acceptance] `searching notes` — `given a word that appears only in a note's body, finds that note`
  - [domain] `a note search query` — `treats the text literally, so no query can make the search run away`
  - [acceptance] `searching notes` — `given no match but a similar title, offers it as a suggestion rather than a result`

### C4 Reading a note's full text by title

- **Kind:** feature
- **Context:** notes
- **Symptom:** An agent could only ever see a 200-character preview of a note.
- **Root cause:** Every upstream read truncates to `MAX_CONTENT_PREVIEW` (`utils/notes.ts:99-105`,
  `:168-176`), and there is no single-note read.
- **Technique:** `get` operation. `notes whose name = "<escaped>"` (escaping as C2), `item 1`,
  full `plaintext`, with a `<<<NOT_FOUND>>>` sentinel.
- **Evidence:** `5d0e84a`. Integration tests: full content beyond the preview, missing title
  gives `null`, a title containing `"Chars"` round-trips.
- **Quality of the fix:** partial. Titles are not unique, and the first match wins silently.
  Plaintext drops checklists, tables and attachments without saying so. Any error (including a
  permission failure) is caught and returned as `null`, which the tool reports as
  `Note "…" not found`.
- **Verdict:** adopt the idea (a whole-note read). Address notes by their store id, and treat a
  title as a search that can be ambiguous.
- **Scenarios:**
  - [acceptance] `reading a note` — `given a note longer than a preview, reports its whole text`
  - [acceptance] `reading a note by title` — `given two notes with that title, refuses to guess and names both`
  - [acceptance] `reading a note` — `given Notes access is denied, reports a permission failure rather than not found`
  - [acceptance] `reading a note` — `given content plain text cannot show, says what was left out`

### C5 Editing a note's body and renaming it

- **Kind:** feature
- **Context:** notes
- **Symptom:** Upstream can create notes but never change one.
- **Root cause:** No update path exists upstream (`utils/notes.ts` exports list/search/create
  only).
- **Technique:** `edit` operation with `noteTitle`, `newBody` and optional `newTitle`.
  - The body is written to `/tmp/note-edit-<ms>.txt` and read back in AppleScript as UTF-8, so
    it never goes through escaping.
  - `set body of theNote to noteContent`, then **always** `set name of theNote` to the new or
    original title. The commit says Notes otherwise re-derives the title from the body's first
    line.
  - Titles are escaped as in C2.
  - Returns `SUCCESS` once the `set`s run.
- **Evidence:** `f0ea5df`. Integration tests: content updated (read back through `get`),
  renamed, missing note gives failure.
- **Quality of the fix:** partial, with real hazards.
  (a) **Lossy.** `body` is HTML. Replacing it with plain text wipes formatting, checklists and
  attachments, and `<`/`&` in the new text are treated as markup (verify). Nothing refuses the
  rewrite (contrast KassebaumEngineering).
  (b) The target is the first note with that title.
  (c) The success claim is not checked against the store. Only the tests read it back.
  (d) The temp file sits at a predictable path with default permissions, and is removed only if
  `runAppleScript` returns. On a throw the note's new text is left in `/tmp`.
  (e) `require("fs")` inside an ES module (`"type": "module"`) works under Bun but throws under
  Node. This is copied from upstream `createNote` (`utils/notes.ts:241`).
  (f) Writing is always on, with no opt-in.
- **Verdict:** adopt the idea (edit a note in place, keeping its title). Reject the technique.
  Verify: *after `set body of` a note, Notes renames the note from the body's first line unless
  `name` is set afterwards.* Verify: *plain text assigned to `body` has its `<`, `&` and line
  breaks interpreted as HTML.*
- **Scenarios:**
  - [acceptance] `editing a note` — `given a note with formatting or attachments, refuses a rewrite that would lose them`
  - [acceptance] `editing a note` — `given a new body only, keeps the note's title`
  - [acceptance] `editing a note` — `reports the edit as done only after reading the note back`
  - [contract] `a note store` — `given text containing angle brackets and ampersands, stores it as text`
  - [contract] `a note store` — `leaves no copy of the note's text on disk`
  - [acceptance] `editing a note` — `given note writing is not enabled, refuses: writes are off by default`

## Noise

- Trailing-whitespace cleanup in `tests/integration/notes.test.ts` and `tools.ts`, and the
  `MAX_NOTES` bump, inside `5d0e84a`

## Glossary candidates

- **note:** a Notes item with a `name` (its title, not unique), a `body` (HTML) and a
  `plaintext` (derived, read-only view). The fork edits `body` and reads `plaintext`.
- **title:** the note's `name`. The fork's commit says Notes derives it from the body's first line
  unless set explicitly.
- **preview:** the first 200 characters of `plaintext`, as returned by list and search.
- **suggestion (near match):** a note that didn't match the search but whose title is similar.
  The fork returns these unlabelled.

## Open questions

- Does `notes whose name …` at application level include notes in "Recently Deleted"? If it
  does, `get`/`edit` by title could act on a deleted note.
- Is `whose name contains` fast on large libraries (thousands of notes, iCloud account), or does
  it still fetch every note's name over Apple Events?
- The fork's integration tests create real notes in the user's library (in
  `TEST_DATA.NOTES.folderName`) and never delete them. There is no cleanup hook.
