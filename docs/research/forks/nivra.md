# nivra/apple-mcp

- **Remote:** `fork-nivra`
- **Branches read:** `main` (3 commits). `HEAD` points at `main`. There are no other branches.
- **Commits accounted for:** 3 / 3
- **Last commit:** 2026-01-24 (pushed 2026-01-25)
- **In one paragraph:** One person's local install ("Arielle's Parlor"), fixed over two evenings
  with Claude Opus 4.5 as co-author so the server would work from Claude Desktop. Each commit
  also adds a session-notes Markdown file. The fork's story is "the `run-applescript` and
  `@jxa/run` packages don't trigger permission prompts, so call `osascript` directly". The code
  doesn't support that story. `run-applescript` 7.x already runs
  `execFile('osascript', ['-e', script])`, with no shell. What actually changed is that the
  fork **parses the text osascript prints**, where upstream expected JS arrays and objects it
  never got. That is why accounts, mailboxes, contacts and latest mail start returning data.
  The fork also ran `tccutil reset AppleEvents` in the same session. **To answer the brief:** the
  fork passes an **interpolated string through a shell**:
  ``execSync(`osascript -e '${escaped}'`)``, where `escaped` only rewrites `'` as `'\''`. That
  quoting is sound for `sh`, so it adds no new shell injection. But it adds a shell where upstream
  had none, and it blocks Node's event loop for up to 60 s. The AppleScript is still built by
  splicing in strings, and upstream's injection sites in mail are all still there. Worth learning
  from only as evidence that upstream's result parsing was dead code.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Mail | `execSync` of `osascript -e '<script>'` through `/bin/sh`, whole script single-quoted, 30–60 s timeout | Replaces `run-applescript` for every mail function (`2860fb6`). The AppleScript is still built by splicing strings together. |
| Contacts | Same `execSync` helper, 60 s timeout for the bulk read | AppleScript loop over `people`. Output is `name|phone,phone|||…`. |
| Maps | Same `execSync` helper | `open location "maps://?q=…"`. JXA dropped. Nothing is read back. |

## Changes

### C1 Mail accounts, mailboxes and contacts come back instead of an empty list

- **Kind:** fix
- **Context:** cross-cutting (mail, contacts)
- **Symptom:** "No accounts found" or a single fake "Default Account", "No mailboxes found", and
  contact lookups that never found anyone.
- **Root cause:** `run-applescript` returns osascript's stdout as one trimmed **string**.
  Upstream checks `Array.isArray(result)`, which is never true, so it always returns `[]`:
  mailboxes at `utils/mail.ts:360-362`, per-account mailboxes at `utils/mail.ts:455-457`, and the
  contacts bulk read at `utils/contacts.ts:106-116`. That bulk read wraps the string in an array
  and then reads `.name` off it. `getAccounts` never lists accounts at all. It returns the
  literal `{"Default Account"}` whenever the count is above zero (`utils/mail.ts:378-412`,
  `:391`).
- **Technique:** Accounts come from `name of accounts`. Accounts and mailboxes are parsed by
  splitting osascript's human-readable list on `", "`. Contacts are built in AppleScript as
  `name|phone1,phone2|||name|…` and split in JS. Stderr is thrown as the error message instead of
  being swallowed (mail only).
- **Evidence:** `0b616cd` (accounts, contacts), `2860fb6` (mailboxes). Upstream #58 (no
  contacts), #69/#58 (no mail found) and #75 (phones only) are unchanged, since the fork still
  reads phones only.
- **Quality of the fix:** partial. Splitting on `", "` breaks any account or mailbox name that
  contains a comma and a space. The contacts format breaks on `|` or `,` inside a name or phone
  label. Contacts without a phone are still dropped, and the loop stops at
  `CONFIG.MAX_CONTACTS` (1000) without saying so. The session note reports 506 of 1234 contacts
  found. Failures in `getAccounts` still end up as `[]` (`catch` returns an empty list), so a
  permission failure still reads as "no accounts".
- **Verdict:** adopt the idea: never parse AppleScript's human-readable output. Scripts return
  JSON (JXA `JSON.stringify`) or the data comes from a typed API, and a failure is never turned
  into an empty result. Reject the delimiter technique.
- **Scenarios:**
  - [contract] `a mail store` — `given two configured accounts, reports each by its real name`
  - [contract] `a mail store` — `given a mailbox whose name contains a comma, reports it as one mailbox`
  - [acceptance] `listing mail accounts` — `given Mail refuses the request, reports the failure rather than an empty list`
  - [contract] `a contact store` — `given a contact whose name contains punctuation, reports the name intact`

### C2 "Latest mail" returns messages instead of nothing

- **Kind:** fix
- **Context:** mail
- **Symptom:** "No latest emails found" for an account that clearly has mail.
- **Root cause:** Upstream's script calls `my sortMessagesByDate`, whose body is
  `sort messagesList by date sent` (`utils/mail.ts:493`, `:533-536`). AppleScript has no such
  command, so the script errors. The `on error` handler returns an `"Error: …"` string, and the
  JS side then regex-parses record text that never arrives (`utils/mail.ts:538-575`).
- **Technique:** Drops the sort. It walks `mailboxes of targetAccount` in order and takes up to
  10 messages from each until `limit` is reached, emitting
  `subject|sender|date|mailbox|content|||`. In content it replaces `|` with `[pipe]` and CR/LF
  with a space, and truncates to 300 characters. `NONE` and `ERROR:` sentinels come back as `[]`.
- **Evidence:** `2860fb6`. Upstream #69, #30, #19 (mail retrieval fails).
- **Quality of the fix:** partial. The result isn't the latest mail. It's the first ten
  messages of whichever mailboxes come first, in the order Mail returns them, with no sort by
  date. Subject, sender and mailbox are not delimiter-escaped, so a `|` in a subject shifts
  every field. Dates are locale strings. `ERROR:` becomes `[]`, so a failure reads as "no mail".
  Unread and search still return `[]` unconditionally (upstream `utils/mail.ts:141-146`,
  `:240-245`, untouched by the fork), even though the session note marks them "should work".
- **Verdict:** adopt the idea (latest means most recently received, across the account's
  mailboxes). Reject the technique.
- **Scenarios:**
  - [acceptance] `reading the latest mail` — `given messages across several mailboxes, reports the most recently received first`
  - [contract] `a mail store` — `given a subject containing a delimiter character, reports the subject intact`
  - [acceptance] `reading the latest mail` — `given the store fails, reports the failure rather than no mail`

### C3 Scripts run through a shell-quoted `osascript -e` string

- **Kind:** refactor (presented as a fix)
- **Context:** cross-cutting
- **Symptom:** Claimed: when Claude Desktop spawned the server, no permission prompt appeared
  and calls failed with -1743.
- **Root cause:** The claimed cause ("`run-applescript` doesn't trigger permission prompts")
  doesn't hold. `run-applescript` 7.x calls `execFile('osascript', ['-e', script])` (checked in
  the 7.1.0 source), so both paths start the same binary from the same parent process. The
  observed recovery fits two other things: C1/C2 (parsing) and `tccutil reset AppleEvents`,
  which the session note records running (`SESSION-FIXES-2026-01-23.md`).
- **Technique:** A `runAppleScriptDirect` helper copied into `mail.ts`, `contacts.ts` and
  `maps.ts` runs ``execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {timeout})``.
  **It passes an interpolated string through `/bin/sh`, not argv.** Every value still reaches
  the AppleScript by string splicing:
  - `searchMails` puts the search term in unescaped (fork `utils/mail.ts:197`, upstream `:182`).
  - `sendMail` subject and recipients, and the account names in `getMailboxesForAccount` and
    `getLatestMails`, escape `"` but not `\` (fork `utils/mail.ts:314-319`, `:436`, `:494`). So
    `\" & do shell script "…" & "` still breaks out.
  - The mail body still goes through a predictable `/tmp/email-body-<ms>.txt` (fork
    `utils/mail.ts:300`).
- **Evidence:** `0b616cd`, `2860fb6`.
- **Quality of the fix:** wrong. It adds a shell layer, turns every call synchronous (a
  60 s mail read freezes the whole server) and leaves the AppleScript injection untouched. The
  `sh` quoting itself is correct, and Maps' `encodeURIComponent` keeps `"` and `\` out of its
  one string literal.
- **Verdict:** reject: it adds a shell and blocks the event loop, and doesn't touch injection.
  plan.md's "static script, values as JSON argv, no shell" already covers this. Verify:
  *macOS shows the same Automation prompt, attributed to the same responsible app, whether
  osascript is started with `execFile` or through `sh -c` from a Claude Desktop child process.*
- **Scenarios:**
  - [contract] `the automation runner` — `given a value containing quotes, backslashes and shell metacharacters, delivers it to the script unchanged`
  - [contract] `the automation runner` — `given a script still running, keeps answering other requests`
  - [acceptance] `automation permission` — `given the user has not allowed control of Mail, reports a permission failure naming the setting to change`

### C4 Longer timeouts for large contact lists and mail reads

- **Kind:** fix
- **Context:** cross-cutting (contacts, mail)
- **Symptom:** Contact lookups on a 1,234-contact library timed out.
- **Root cause:** Upstream loops over `people` one at a time in AppleScript
  (`utils/contacts.ts:53-127`), which is slow. Upstream declares `CONFIG.TIMEOUT_MS = 10000` but
  never uses it (`utils/contacts.ts:8`, `utils/mail.ts:10`), so the time limit in practice was
  the MCP client's own.
- **Technique:** A real timeout through `execSync`: 60 s for the contacts bulk read and for mail
  unread, search and latest, and 30 s otherwise.
- **Evidence:** `0b616cd`, `2860fb6`.
- **Quality of the fix:** partial. A timeout is better than none, but 60 s blocks the process,
  and the contact read still scales with library size.
- **Verdict:** adopt the idea (every store call has a time budget and a named timeout failure).
  Reject raising the budget as the fix. Contacts moves to Contacts.framework in the plan.
- **Scenarios:**
  - [contract] `a contact store` — `given a library of thousands of contacts, answers a lookup within the time budget`
  - [acceptance] `looking up a contact` — `given the store does not answer in time, reports a timeout rather than no match`

### C5 Maps search opens Maps and reports a placeholder location

- **Kind:** refactor
- **Context:** maps
- **Symptom:** The JXA search returned empty or made-up results.
- **Root cause:** Upstream's JXA `searchLocations` can't read Maps results. It returns the query
  echoed back as a "location" (`utils/maps.ts:110-218`).
- **Technique:** AppleScript `open location "maps://?q=<encoded>"`, then success with one
  placeholder location, "View results in Maps app".
- **Evidence:** `0b616cd`.
- **Quality of the fix:** wrong. It still reports success with a made-up location.
- **Verdict:** out of v1 scope
- **Scenarios:**
  - [acceptance] `searching for a place` — `given results cannot be read back, says it only opened Maps rather than reporting a location`

## Noise

- README notice advertising the fork: `625cca3`
- Session-notes Markdown files (`SESSION-FIXES-2026-01-23.md`, `SESSION-FIXES-2026-01-24.md`)
  and `bun.lockb` churn, inside `0b616cd` and `2860fb6`

## Glossary candidates

- **account (Mail):** a configured mail account, identified only by its display `name`. Mailboxes
  and messages are looked up through `first account whose name is …`.
- **mailbox:** a named container inside an account (`mailboxes of account`). "Latest" mail is
  gathered mailbox by mailbox.
- **responsible app (TCC):** the app macOS attributes an Automation request to. Per the session
  notes that is Claude Desktop, not Terminal, when Claude Desktop spawns the server.
- **-1743 / -600:** Apple Event errors seen in the notes: "not authorised to send Apple events"
  (Automation denied) and "application isn't running".

## Open questions

- Did any Automation prompt actually change between `run-applescript` and `execSync`, or did the
  `tccutil reset` alone fix permissions? Only a real Mac can settle this (C3 verify).
- The session notes say messages, reminders, calendar and notes were "Working" without code
  changes. Upstream's calendar and reminder reads are stubs, so "working" probably meant "no
  error".
