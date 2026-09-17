# The long tail: forks with 1–2 commits of their own

- **Remote:** none. Read through the GitHub API only:
  `gh api repos/supermemoryai/apple-mcp/compare/main...<owner>:<repo>:main` (`.commits[]`,
  `.files[].patch`), plus `repos/<owner>/<repo>/commits/<sha>` and raw `contents?ref=` where a
  patch was too large to be returned (built `dist/index.js` bundles). Nothing was cloned or run.
- **Branches read:** each fork's `main` only.
- **Commits accounted for:** 16 / 16 (four forks × 2, eight forks × 1)
- **Last commit:** 2026-09-17 (amandeeptherockstar, see **L6: malware**)
- **In one paragraph:** Eleven of the twelve are personal tweaks. Five hold a real fix or idea:
  - reminder creation that keeps notes and due date (Heming-Zhong, brunnoaraujo)
  - calendar reads that survive a hanging calendar (dewdad)
  - calendar dates that don't go through `toLocaleString()`, with create reporting the times
    actually stored (amandeepjutla)
  - mail unread, search, accounts and mailboxes that return data and surface failures
    (zaclohrenz)
  - contact-name matching that no longer resolves "dad" to "Trinidad" (tomsr73)

  The rest is CI config, badges, a demo script, and an 18 MB audio file committed by accident.
  **One fork is a supply-chain attack:** `amandeeptherockstar/apple-mcp` carries a commit
  spoofed as Dhravya Shah. On server start it downloads JavaScript and `eval`s it, and it
  auto-runs obfuscated JavaScript disguised as a font when the folder is opened in VS Code.

## Forks at a glance

| Owner | Commits | SHAs | What it does | Kind | Verdict |
|---|---|---|---|---|---|
| VraoNOVA (`apple-mcp-AO`) | 2 | `6714752`, `096db2e` | Adds a weekly npm Dependabot config twice, the second time at a mistyped path `` `.github/dependabot.yml `` | infra | noise |
| Heming-Zhong | 2 | `2dc6104`, `8f4cd41` | Reminder creation sets notes (`body`) and due date. The second commit only deletes a comment. | fix | adopt the idea (L1) |
| dewdad | 2 | `31ac622`, `6503136` | Calendar list/search really read events, one calendar at a time with a 3 s cap each. Commits a built `dist/index.js` for `bunx github:` | fix, infra | adopt the idea (L2). Bundle is noise. |
| amandeepjutla | 2 | `027ba85`, `28c91b7` | Commits a built bundle, then fixes calendar dates, list, search and open **in the bundle only** (no TS source). Create reads back the stored times. | fix | adopt the idea (L3) |
| zaclohrenz | 1 | `277aac7` | Mail unread, search, latest, accounts and mailboxes return parsed data. Failures become `isError` results. | fix | adopt the idea (L4) |
| tomsr73 | 1 | `35e211d` | Rebrands as `nora-apple-mcp` and keeps only contacts, messages and reminders. Contact matching goes from substring to word-prefix. | fix, refactor | adopt the idea (L5). Strip-down is noise. |
| NYO2008 | 1 | `80a4404` | Replaces `package.json` with a "Kilo Code" demo package and adds scripts that spawn `bunx @dhravya/apple-mcp@latest` | other: demo | noise |
| JoshOsullivan-au | 1 | `ec13b9e` | Adds a Gitleaks secret-scanning GitHub workflow | infra | adopt the idea (cheap CI step for Phase 0) |
| fastmcp-me | 1 | `1cd276b` | Adds "Add to Cursor/VS Code/Claude…" badges pointing at fastmcp.me to the README | noise | noise |
| brunnoaraujo | 1 | `d8f5f19` | Reminder creation honours the list (creating it if missing), notes and due date plus an alert. Pins dependency versions. | fix | adopt the idea, reject list auto-creation (L1) |
| amandeeptherockstar | 1 | `b1fffed` | **Malware.** Remote-code `eval` on startup, and a VS Code auto-run task executing obfuscated JS hidden as font files | malicious | reject: supply-chain attack (L6) |
| adynt8 | 1 | `0a53c3e` | Commit "m" adds `untitled folder/project1.flac` (18,167,395 bytes) | noise | noise |

## Changes

### L1 A new reminder keeps its notes, due date and list

- **Kind:** fix
- **Context:** reminders
- **Symptom:** A reminder created "in Groceries, due Friday 5 pm, with a note" landed in the
  first list with only a title. The tool still echoed the requested due date back as if it had
  been saved.
- **Root cause:** Upstream `createReminder` uses `first item of allLists`, sets only `name`, and
  ignores `listName`, `notes` and `dueDate`. It then returns the fake id `"created-reminder-id"`
  and the *requested* `dueDate` (`utils/reminders.ts:227-290`, `:252-258`, `:273-280`).
- **Technique:**
  - **Heming-Zhong** (`2dc6104`): adds `body:"<notes>"` to the properties. Builds the due date in
    AppleScript component by component (`set year/month/day/hours/minutes of current date`) from
    `new Date(dueDate)` read in server-local time, and sets `due date`. The list is still the
    first one.
  - **brunnoaraujo** (`d8f5f19`), the same plus:
    - looks the list up by name in a `repeat` loop
    - if the list isn't there, runs `make new list` with that name, falling back to `default list`
    - sets both `due date` and `remind me date` (an alert) to the due time
    - returns the name of the list actually used
- **Evidence:** Heming-Zhong `2dc6104` (`8f4cd41` comment removal). brunnoaraujo `d8f5f19`.
  Upstream #64 (no time on creation), #34 (wrong time parsing). Same symptom as mjmcg C2.
- **Quality of the fix:** partial.
  (a) Both still escape only `"` (no `\`), and now also splice `notes` into the script, which
  adds an injection site.
  (b) A date-only `"2025-12-25"` is parsed by JS as UTC midnight, so `getDate()` in any zone
  west of UTC gives 24 December.
  (c) A date-only due date still gets 00:00 instead of being due that day with no time.
  (d) An unparseable `dueDate` is silently dropped.
  (e) The fake id and the echoed `dueDate` are unchanged, so the result still doesn't come from
  the store.
  (f) brunnoaraujo creates a new list when a name is misspelled, or when the default `"Reminders"`
  doesn't exist on a non-English system, and adds an alert nobody asked for.
- **Verdict:** adopt the idea (list, notes and due date reach the store, and the result reports
  what was saved). Reject list auto-creation and the implicit alert.
- **Scenarios:**
  - [acceptance] `creating a reminder` — `given notes and a due time, reports the reminder with both as the store saved them`
  - [acceptance] `creating a reminder` — `given a list that does not exist, refuses and names the lists that do`
  - [domain] `a due date` — `given a date without a time, is due that day in the user's time zone with no time`
  - [domain] `a due date` — `given a due date that cannot be read, refuses rather than creating an undated reminder`

### L2 One slow calendar doesn't hang the whole calendar read

- **Kind:** fix
- **Context:** calendar
- **Symptom:** The calendar tool hung indefinitely when a subscribed or remote calendar was stuck
  syncing (per the commit). Before that, upstream returned only a dummy event.
- **Root cause:** Upstream list and search are stubs (`utils/calendar.ts:96-117`, `:170-178`),
  and `runAppleScript` has no timeout at all (upstream's `CONFIG.TIMEOUT_MS` is never used).
- **Technique (`31ac622`):**
  - Gets calendar names (`name of cal`, split on `", "`).
  - For each calendar, runs a separate script that walks **every** event
    (`repeat with evt in (events of targetCal)`), keeps those starting inside the range, and
    emits `|||`-joined fields.
  - Wraps each call in `Promise.race` with a 3 s timer. A calendar that times out is logged to
    stderr and skipped.
  - Sorts the merged events by start. Search lists up to 50 events and filters title, location
    and notes in JS.
  - Dates are coerced with `date "January 28, 2026"` (en-US long format).
- **Evidence:** dewdad `31ac622`. Upstream #74, #25, #70.
- **Quality of the fix:** partial.
  (a) `Promise.race` doesn't stop `osascript`: the timed-out process and Calendar.app's work keep
  running, and pile up with every call.
  (b) Walking every event of a calendar is the slowest possible read. Big calendars will routinely
  hit 3 s and be **silently dropped**, and the result looks complete.
  (c) The date coercion depends on the locale.
  (d) The end date is midnight at the start of the last day.
  (e) Splitting the AppleScript list on `", "` breaks any title containing a comma.
  (f) Calendar names escape only `"`.
  (g) Search sees only the first 50 events in the range.
- **Verdict:** adopt the idea (each calendar gets its own time budget, and a partial result names
  what was left out). Reject the technique. EventKit makes the per-calendar split mostly
  unnecessary, so verify whether it is still needed: *with a subscribed calendar whose server is
  unreachable, an EventKit range query returns promptly for the other calendars.*
- **Scenarios:**
  - [acceptance] `listing events` — `given one calendar does not answer in time, reports events from the others and names the calendar left out`
  - [contract] `the native helper` — `given a query that runs out of time, stops the work rather than leaving it running`

### L3 Event times survive the trip into Calendar, and create reports what was stored

- **Kind:** fix
- **Context:** calendar
- **Symptom:** "time/date bug": created events got the wrong time or failed, and list and search
  returned a dummy event or nothing.
- **Root cause:** Upstream coerces `date "${start.toLocaleString()}"`
  (`utils/calendar.ts:270-271`), and list and search are stubs (`:96-117`, `:170-178`). A likely
  specific trigger: since ICU 72 (Node 20+), en-US `toLocaleString()` puts a U+202F narrow
  no-break space before "AM/PM", and AppleScript's date parser may reject it (verify).
- **Technique (`28c91b7`, visible only in the minified bundle):**
  - A helper formats `M/D/YYYY h:mm:ss AM` from local date components with an ordinary space.
  - Another helper escapes `\` then `"` for calendar names, titles, location, notes and search
    text.
  - List and search: `every event of cal whose start date ≥ … and start date ≤ …`, `|||` fields
    joined by newlines. Search lower-cases each title, location and notes through
    `do shell script "echo " & quoted form of … & " | tr …"`.
  - Create **reads back `start date` and `end date` of the new event** and reports "Event
    scheduled from X to Y".
  - Open finds the event with `whose uid is "<escaped>"`.
- **Evidence:** amandeepjutla `28c91b7` (on top of `027ba85`, which only commits the upstream
  bundle). Upstream #34, #74, #25.
- **Quality of the fix:** partial.
  (a) The date text is still US month-first, so it breaks on day-first locales. arr2036's
  component-by-component form is sturdier.
  (b) A shell per field per event just to lower-case text AppleScript `contains` already compares
  case-insensitively: slow, and it adds a shell.
  (c) Delimiter parsing breaks on `|||` or newlines in notes.
  (d) The TS source isn't committed, so the change can't be reviewed or rebuilt except from the
  minified bundle.
- **Verdict:** adopt the idea (the create result reports the times the store actually saved).
  Reject the technique. Verify: *on macOS 26 with Node 20+, `date "<toLocaleString() output>"`
  fails because of the U+202F before AM/PM.*
- **Scenarios:**
  - [acceptance] `creating an event` — `reports the start and end the store saved, so a misread time is visible at once`

### L4 Mail unread, search, accounts and mailboxes return data, and failures say so

- **Kind:** fix
- **Context:** mail
- **Symptom:** Unread and search always came back empty. Accounts showed "Default Account".
  Mailboxes were never found. Errors looked like "no mail".
- **Root cause:**
  - Upstream unread and search return `[]` "for now" (`utils/mail.ts:141-146`, `:240-245`).
  - Search splices the term unescaped (`:176-182`).
  - Mailbox lists test `Array.isArray` on a string (`:360-362`, `:455-457`).
  - Accounts return a literal `"Default Account"` (`:391`).
  - Latest mail calls a non-existent `sort` (`:493`, `:533`).
- **Technique (`277aac7`):**
  - Unread and search walk `messages of inbox` and emit `subject||sender||date||content||mailbox`
    records joined by `@@`.
  - Search escapes `"` and matches subject or content.
  - Accounts and mailboxes (`Account - Mailbox`) are joined with `|` through AppleScript text
    item delimiters.
  - Latest mail uses the first mailbox whose name contains "INBOX"/"Inbox", or else the first
    non-empty mailbox.
  - The access check runs `activate` and `count of mailboxes`.
  - Errors are rethrown, and `index.ts` wraps accounts, mailboxes and latest in `try/catch`
    returning `isError: true`.
- **Evidence:** zaclohrenz `277aac7`. Upstream #69, #58, #30, #19.
- **Quality of the fix:** partial.
  (a) Search still escapes only `"`, so a `\"` breakout remains.
  (b) Unread and search look at the inbox only.
  (c) Search fetches `content` of every inbox message in order, which is slow on large inboxes,
  and nothing is sorted by date.
  (d) Delimiters collide with message text.
  (e) Zero mailboxes is reported as "no access", mixing up "not set up" and "denied".
  (f) `activate` brings Mail to the front on every access check.
- **Verdict:** adopt the idea (accounts and mailboxes are real, and a failed read is an error,
  never an empty result). Reject the technique. It overlaps brightline, felkru and gene-jelly.
- **Scenarios:**
  - [acceptance] `searching mail` — `given Mail refuses the request, reports the failure rather than no results`
  - [acceptance] `searching mail` — `given a matching message outside the inbox, finds it`
  - [acceptance] `listing mailboxes` — `names each mailbox together with its account`
  - [acceptance] `listing mail accounts` — `given Mail has no accounts set up, says so rather than reporting a permission failure`

### L5 A contact name matches whole words, not fragments of other names

- **Kind:** fix
- **Context:** contacts (feeds messages)
- **Symptom:** Asking for "dad" resolved to a contact named "Trinidad", so a message could go to
  the wrong person.
- **Root cause:** Upstream `findNumber` tries a series of fuzzy strategies. Several match
  substrings in both directions: `cleanName(personName).includes(searchName)`,
  `searchName.includes(cleanName(personName))`, per-word `includes` both ways, and a final
  fallback doing the same (`utils/contacts.ts:252-254`, `:281-282`, `:312-313`). The first hit
  wins.
- **Technique (`35e211d`):** All substring tests are replaced by a word-prefix test
  (`word === term || word.startsWith(term)` over whitespace-split words), including the
  reversed "nickname" direction and the fallback.
- **Evidence:** tomsr73 `35e211d`. Upstream #48 ("ghost" contacts), plan.md non-negotiable 4.
- **Quality of the fix:** partial. "Trinidad" no longer matches "dad", but the first match still
  wins: "Al" resolves to whichever of Alice or Alan comes first, and nobody is told there was a
  choice. Prefix matching still turns short inputs into confident answers.
- **Verdict:** adopt the idea (resolving a recipient never matches inside a word, and ambiguity is
  refused rather than guessed).
- **Scenarios:**
  - [domain] `resolving a recipient by name` — `given "dad", does not match a contact named Trinidad: names match whole words only`
  - [domain] `resolving a recipient by name` — `given a name that fits two contacts, refuses and names both`

### L6 amandeeptherockstar/apple-mcp is malware

- **Kind:** malicious (supply-chain attack)
- **Context:** other: repository security
- **What the commit is:** `b1fffed`, message "Update README.md", author and committer spoofed as
  `Dhravya Shah <dhravyashah@gmail.com>`, dated 2026-09-17T03:53:15Z. It sits on an old upstream
  base (`94349ac`, 50 commits behind), so at a glance it looks like an upstream commit.
- **Payloads (read as data, never fetched or run):**
  1. **Remote code execution on server start.** `index.ts` gains `import 'dotenv/config'` and an
     async IIFE: `atob(process.env.AUTH_API_KEY)`, fetch it with `node-fetch`, `eval` the
     response. The IIFE appears twice. The committed `.env` sets `AUTH_API_KEY` to base64 of
     `https://files.catbox.moe/w8aq85.js`. `package.json` adds `dotenv` and `node-fetch`.
  2. **Code execution when the folder is opened in VS Code.**
     - `.vscode/tasks.json` defines a hidden background task (`runOn: folderOpen`,
       `reveal: never`, labelled "eslint-check") that runs
       `node ./utils/public/fonts/fa-solid-400.woff2`.
     - That "font" is obfuscated JavaScript (`global['!']='9-9821-5';var _0x514f9b=…`).
     - `.vscode/settings.json` sets `task.allowAutomaticTasks: true` so the task runs without a
       prompt.
  3. **A second hidden payload.** `public/fonts/fa-solid-500.woff2` is one line padded with
     hundreds of leading spaces in front of more obfuscated JavaScript
     (`global.i='A10-*050';const _0x32ebc7=…`).
  4. **Decoys.** Genuine-looking Font Awesome files under `public/fonts/` and
     `utils/public/fonts/`, and a `.vscode/launch.json` copied from an unrelated project
     (`AWS_PROFILE: flo-ct-flo360`).
- **Verdict:** reject: supply-chain attack. Nothing from this fork enters the findings. Don't clone
  it, open it in an editor or install it.
- **Scenarios:** none for the product. For Phase 0: keep "ideas, not code, move across"
  (non-negotiable 6). Give `.vscode/` automatic tasks and committed `.env` files a
  repository-level check in CI, alongside the Gitleaks idea from JoshOsullivan-au.

## Noise

- Dependabot config, twice, second at a mistyped path: VraoNOVA `6714752`, `096db2e`
- Comment deletion: Heming-Zhong `8f4cd41`
- Built `dist/index.js` bundles committed for `bunx`/`npx github:` installs: dewdad `6503136`,
  amandeepjutla `027ba85`
- Rebrand and strip-down to three tools (other than the L5 matching change): tomsr73 `35e211d`
- Demo package replacing `package.json`: NYO2008 `80a4404`
- Install badges: fastmcp-me `1cd276b`
- Accidental 18 MB audio file: adynt8 `0a53c3e`
- Exact-version dependency pins and `bun.lockb` (inside brunnoaraujo `d8f5f19`)

## Glossary candidates

- **due date (reminder):** the day, and optionally the time, a reminder is due. The forks always
  attach a time, even to a date-only input.
- **alert / remind me date:** a separate reminder property that triggers a notification.
  brunnoaraujo sets it equal to the due date.
- **default list:** Reminders' `default list`, brunnoaraujo's fallback when creating a list fails.
- **inbox:** Mail's unified `inbox`. zaclohrenz limits unread and search to it.
- **recipient resolution:** turning a spoken name into a contact's handle. tomsr73 shows substring
  matching resolving to the wrong person.

## Open questions

- Should `amandeeptherockstar/apple-mcp` be reported to GitHub as malware? That's the user's call.
  The repo is live, and the spoofed author makes it look like an upstream commit.
- Did the same attacker touch any other fork? Two checks found nothing:
  - The twelve `main` branches here: no `.vscode/`, font or `.env` files outside L6, and no
    `eval` in the committed bundles.
  - Every Appendix A remote branch (`git diff upstream/main...<branch>`): no `.vscode/`,
    `.woff`/`.woff2` or `.env` files, and no added `catbox`, `allowAutomaticTasks`, `folderOpen`
    or `eval(`. The only `atob(` hits are JWT and base64 helpers in bundles and faces-sh code.

  Forks created after the 2026-09-17 snapshot haven't been checked.
- amandeepjutla's TS source for `28c91b7` isn't public, so the bundle diff is the only evidence.
