# brightline/apple-mcp

- **Remote:** `fork-brightline`
- **Branches read:** `main` (18 commits). `HEAD` points at `main`. There are no other branches.
- **Commits accounted for:** 18 / 18
- **Last commit:** 2026-02-08 (pushed 2026-02-09)
- **In one paragraph:** A two-day rescue by one person ("jp", jp@bli.la, Brightline Interactive),
  with Claude Opus 4.6 as co-author on most commits. They were running the server from Claude
  Desktop (the DXT build) against a real Mac with several large mail accounts, and they fixed what
  broke in the order they hit it. Commit messages narrate each failure. Mail is the core of the
  fork. Upstream's mail reads could never return anything (see C1), and the fork got them working
  in five steps. It stopped throwing results away, walked each account's mailboxes instead of the
  app's local ones, scanned by index instead of `whose`, narrowed the scan to `INBOX`, and finally
  ran one script per account in sequence with a 3 s pause between them. It also moves calendar
  reads to an EventKit Swift script, with good permission diagnostics. It adds AppleScript
  escaping everywhere, removes the shell from the `sqlite3` calls, adds a timeout wrapper, and
  adds a "confirm before write" gate built on MCP sampling. There are no tests. It's worth
  learning from as a **field report**: which Mail scripting shapes time out or hang Mail on large,
  multi-account setups, and what the permission failure modes look like from Claude Desktop. Its
  code shapes aren't worth copying. Everything is still string-built AppleScript, the throttle is
  a sleep, and the scan quietly misses mail. The "security cleanup" also misses an injection
  site that upstream already had (C6).

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Mail (read) | AppleScript via `run-applescript`, **one `osascript` per account, in sequence, with a 3 s sleep between accounts**, each call raced against a 30 s timer | Only `mailbox "INBOX" of account`, only messages 1–100 by index, one Apple Event per property per message. Output is tab-separated text parsed in TS. |
| Mail (accounts, mailboxes) | AppleScript that walks `accounts` and `mailboxes of acct`, joined with linefeeds | Replaces upstream's hard-coded placeholder lists. |
| Calendar (list, search, calendars) | `execFile("swift", ["helpers/calendar-helper.swift", ...args])`: EventKit, JSON on stdout, errors on stderr, 30 s timeout | The script is interpreted (compiled on every call) and needs the Xcode command line tools. Create and open are still AppleScript. |
| Messages (read) | `execFile("sqlite3", ["-json", db, query])`: no shell, but still a string-built SQL query | Upstream used `exec` with a shell string. |
| All AppleScript | `runAppleScriptWithTimeout` = `Promise.race(runAppleScript, timer)` | Doesn't kill `osascript` when the timer wins (C5). |

## Changes

### C1 Reading mail returns messages at all

- **Kind:** fix
- **Context:** mail
- **Symptom:** "Cannot find any mails" and "finds zero emails in every account", even with
  permission granted and while sending mail works (#69, #58). Listing the latest 5 messages of an
  account never worked (#30). Listing accounts said none were configured.
- **Root cause:** In upstream, every mail read path returns nothing no matter what Mail holds.
  Timeouts are a secondary problem.
  - `getUnreadMails` builds a list in AppleScript, returns only `"SUCCESS:" & count`, and then
    `return []` on both branches (`utils/mail.ts:138-149`, commented "For now, return empty
    array"). `searchMails` does the same (`utils/mail.ts:237-248`).
  - `getAccounts` never reads account names. It returns the literal `{"Default Account"}` when
    the count is above 0 (`utils/mail.ts:389-391`). `getMailboxes` returns the literal
    `{"Inbox", "Sent", "Drafts"}` (`utils/mail.ts:349-351`).
  - Even those literals are lost. `run-applescript` returns `osascript`'s stdout as a **string**,
    so `Array.isArray(result)` is never true, and `getAccounts`, `getMailboxes` and
    `getMailboxesForAccount` always return `[]` (`utils/mail.ts:362,402,457`). With no account,
    `latest` then throws "No email accounts found" (`index.ts:777-786`).
  - `getLatestMails` can't compile. `sort messagesList by date sent` isn't AppleScript
    (`utils/mail.ts:533-536`). Checked on this Mac (macOS 26.3): `osacompile` fails with "Expected
    end of line but found identifier" (-2741) inside `sortMessagesByDate`, and compiles once that
    handler is replaced. The error is swallowed and returns `[]` (`utils/mail.ts:578-581`).
  - The account-scoped `unread` path in `index.ts` (`index.ts:526-600`) parses results with
    `/\{([^}]+)\}/g` (`index.ts:605`). Human-readable `osascript` output flattens a list of
    records with **no braces**. Checked here: `{{subject:"Hi, there", sender:"a@b.c"}}` prints
    `subject:Hi, there, sender:a@b.c`. So the regex never matches, and on failure the code
    "falls back" to the method that always returns `[]` (`index.ts:649-654`).
- **Technique:** Every script builds one line per message, with fields joined by `tab` and lines
  by `linefeed`. A `cleanField` handler turns CR, LF and tab inside a value into spaces
  (`utils/mail.ts:24-42` at fork). `parseEmailResults` splits lines and fields in TS
  (`utils/mail.ts:48-62`). Account and mailbox listings now walk `accounts` and
  `mailboxes of acct` for real and return linefeed-joined names. Mailboxes come back as
  `account/mailbox`.
- **Evidence:** `be4becf`, `ba218e6` (account-prefixed mailbox names, inline `index.ts` script
  removed). Upstream #69, #58, #30.
- **Quality of the fix:** partial.
  - The delimiter protocol is homemade. A tab or newline inside a value is lost rather than
    escaped, and the account name in the mailbox column isn't cleaned (`utils/mail.ts:173`).
  - Dates are AppleScript's locale-formatted `date as string`, not ISO 8601.
  - Every failure inside the scan still turns into `[]` plus a `console.error`, so "no mail" and
    "couldn't read mail" still look the same to the agent.
- **Verdict:** adopt the idea (a mail read has to return typed, structured messages, and must
  never report an empty result when the read failed). Reject the technique: use JXA with
  `JSON.stringify` output, or a store read, instead of hand-delimited text.
- **Scenarios:**
  - `[acceptance] reading unread mail` — `given unread messages in an account's inbox, lists each
    one with its sender, subject, date and account`
  - `[acceptance] reading unread mail` — `given Mail could not be read, refuses to report an empty
    inbox and says what failed`
  - `[acceptance] listing mail accounts` — `lists every account by the name Mail shows for it`
  - `[contract] the mail store` — `reports sent dates as instants with a time zone, not as
    locale-formatted text`
  - `[contract] the mail store` — `given a subject containing tabs, newlines or commas, returns it
    unchanged`

### C2 Mail looks inside each account's mailboxes, not the app's local ones

- **Kind:** fix
- **Context:** mail
- **Symptom:** Even once results were returned (C1, `be4becf`), unread and search found only
  Outbox and "Send Later" and none of the real mail.
- **Root cause:** Upstream's unread and search loop over the application's `mailboxes` element
  (`utils/mail.ts:87`, `utils/mail.ts:185`). In Mail's dictionary the application's `mailbox`
  elements are the top-level local mailboxes ("On My Mac" plus special ones such as Outbox). Each
  account's server mailboxes are elements of that `account` (`sdef /System/Applications/Mail.app`:
  `application` → `element type="mailbox"`; `account` → `element type="mailbox"`; `mailbox` →
  nested `mailbox` and `message`). The commit message says the observed result was
  "only found SendLater/Outbox, missing all actual mail".
  - For users who have a large local "On My Mac" archive, upstream's
    `set allMessages to messages of currentMailbox` pulls one specifier for **every** message in
    the mailbox before looking at any of them. That is a timeout source in its own right.
- **Technique:** `repeat with acct in accounts` → `repeat with mb in mailboxes of acct`, with
  results labelled `acctName/mbName`. Later commits narrowed this to the inbox (C3).
- **Evidence:** `ba218e6`.
- **Quality of the fix:** complete for the reference bug. The iteration it introduced then timed
  out (C3).
- **Verdict:** adopt the idea. Mailboxes belong to accounts, and "all mail" means walking accounts.
  *verify:* the application-level `inbox` property ("The top level In mailbox", the unified inbox)
  exposes each account's inbox as a child mailbox, which would avoid guessing the inbox's name
  (see C3).
- **Scenarios:**
  - `[contract] the mail store` — `lists the mailboxes of each account, not only the mailboxes
    stored on this Mac`
  - `[domain] a mailbox` — `is identified by its account and its path within that account`

### C3 Mail reads only the newest 100 messages of each account's INBOX, by index

- **Kind:** fix (performance)
- **Context:** mail
- **Symptom:** On large mailboxes (the commit says "100k+ messages") unread and search timed out.
  With "5 accounts × 100+ mailboxes each", scanning every mailbox "caused timeouts after ~2
  accounts". `latest` returned nothing for some accounts, because it "hits small random folders
  first, times out before reaching INBOX" and those folders were empty or fully read. Upstream
  #19 (an Exchange/O365 account where every lookup times out) is the same kind of report, though
  it predates the current code.
- **Root cause:** Three costs add up in upstream's shapes, and each fork commit removed one:
  1. `messages of mb whose read status is false` (`index.ts:554`) and the fork's own first try at
     `whose subject contains` (`be4becf`). The fork found these time out on very large mailboxes.
     The code can't show whether Mail evaluates `whose` against its index or message by message,
     so this is a *verify*.
  2. Walking **every** mailbox of every account, with a `count of messages` on each
     (`ba218e6`). Cost grows with the number of mailboxes, not with the amount of mail wanted.
  3. Mailboxes arrive in folder order, not inbox first, so a message limit can be used up (or the
     time budget spent) before the inbox is reached.
  Every read is also very chatty: one Apple Event per property per message (`message i`,
  `read status`, `subject`, `sender`, `date sent`, `content`), so about 200–700 round trips per
  100 messages. And `content` can force Mail to fetch or parse a body it hasn't cached (IMAP,
  Exchange). The fork kept that pattern.
- **Technique:** `buildScanScript` (`utils/mail.ts:122-188` at fork) targets
  `mailbox "INBOX" of (first account whose name is …)` directly, with no mailbox listing and no
  `count`. It loops `repeat with i from 1 to 100`, gets `message i of mb`, filters in the script
  (`read status is false`, or `subject contains term`), and `exit repeat` on the first error
  ("Past end of messages"). `latest` is the same scan with no filter. Unread takes an optional
  `mailbox` in place of `INBOX`. The per-script timeout went from 10 s to 30 s.
- **Evidence:** `ba218e6` (scan by index, 100 per mailbox), `0833904` (INBOX only for unread and
  search), `d2eef83` (INBOX only for latest). Related to upstream #19, #30.
- **Quality of the fix:** partial. It trades timeouts for results that are quietly incomplete,
  which breaks "results tell the truth":
  - Unread only sees unread messages among the **newest 100** (assuming `message 1` is the
    newest; see Open questions). An inbox whose unread mail is older reports "No unread emails
    found".
  - Search only matches **subjects**, in the **INBOX**, among the newest 100 messages per account.
    It ignores the `account` and `mailbox` arguments (`index.ts` search case calls
    `searchMails(searchTerm, limit)`), yet its reply text still says "in account X and mailbox Y".
  - The inbox is found by the literal name `"INBOX"`. An account with no mailbox of that name is
    skipped without a word ("Skip accounts that don't have this mailbox").
  - Any error on a single message (not only running past the end) ends the scan of that account.
  - `latest` without an account still reads only the first account (`index.ts`, `accounts[0]`).
- **Verdict:** adopt the idea (never enumerate every mailbox or every message to answer "what's
  new". Go straight to the inbox, bound the work, and fetch properties in bulk). Reject the
  technique of a silent fixed window. *verify:* on a mailbox with more than 100k messages,
  (a) `whose read status is false` times out where (b) a bulk property fetch over a range
  (`subject of messages 1 thru 100 of mb`, or JXA `mb.messages.subject()` sliced) finishes in
  under 2 s, and (c) `message 1` is the most recently received message for IMAP, iCloud and
  Exchange accounts.
- **Scenarios:**
  - `[acceptance] reading unread mail` — `given more mail than it will look through, says how far
    back it looked instead of reporting there is no unread mail`
  - `[acceptance] searching mail` — `given an account and a mailbox, searches only that mailbox`
  - `[acceptance] searching mail` — `reports which parts of a message it searched: subject only,
    or subject and body`
  - `[acceptance] reading the latest mail` — `given no account, reads the latest mail across every
    account, newest first`
  - `[contract] the mail store` — `finds each account's inbox whatever the server calls it`
  - `[contract] the mail store` — `given a mailbox of a hundred thousand messages, returns the
    newest messages within its time budget`
  - `[contract] the mail store` — `given one unreadable message, still returns the others`

### C4 Mail is queried one account at a time, with a pause between accounts

- **Kind:** fix (performance, workaround)
- **Context:** mail
- **Symptom:** With several accounts, "a single AppleScript that loops through all accounts ...
  causes Mail.app to hang". After per-account scripts went in, Mail still became "unresponsive
  with multiple accounts".
- **Root cause:** Mail handles incoming Apple Events one at a time on its main thread. While a
  script runs, the UI and everything else queued behind it stall. One script covering every
  account means one long burst of hundreds of property gets per account (C3), `content` fetches
  included. The fork's timeout wrapper made this worse (C5). When the 30 s timer wins, TS gives
  up but `osascript` keeps running and Mail keeps working through its events. So the next request
  lands in a queue that is still busy, and a stuck account starves the rest.
- **Technique:**
  - `getUnreadMails` and `searchMails` fetch the account names (`getAccounts`), then `for` each
    account build a separate `buildScanScript` and `await` it before starting the next one
    (`84edc6b`).
  - Each account has its own 30 s budget and its own `try/catch`, so one failing account costs
    its own results and not everyone's.
  - The loop stops early once `limit` messages have been collected.
  - `await delay(3000)` runs before every account after the first (`304f384`,
    `INTER_ACCOUNT_DELAY_MS`), "giving Mail.app time to recover".
- **Evidence:** `84edc6b`, `304f384`. Related to upstream #19, #58 (the comments about timeouts).
- **Quality of the fix:** partial. The sequencing is sound. The sleep is a workaround with no
  signal behind it.
  - It's a fixed guess, not back-pressure. It doesn't wait for Mail to go idle, and it doesn't
    stop the earlier `osascript` that is still running.
  - It adds latency for every account whether or not Mail needs it. Five accounts cost 12 s of
    sleep plus up to 5 × 30 s of scanning, which can outlast the client's own request timeout
    (the MCP TypeScript SDK client defaults to 60 s). *verify* that Claude Desktop gives up
    first.
  - Each call also sends extra round trips before any scanning starts. `requestMailAccess` runs
    once in the operation and again inside `getAccounts`.
  - `latest` doesn't loop over accounts at all.
- **Verdict:** adopt the idea (one bounded query per account, run in sequence, where one
  account's failure is reported per account and doesn't wipe out the others). Reject the fixed
  sleep. Remove the cause instead: bulk property fetches, no body in list results, and cancelling
  the script on timeout. *verify:* with 5 accounts, sequential per-account bulk fetches with no
  pause leave Mail responsive. If they don't, the pause belongs in the automation adapter as a
  measured, configurable throttle and not in the use case.
- **Scenarios:**
  - `[acceptance] reading unread mail` — `given one account that cannot be read, still lists the
    other accounts' mail and names the account it could not read`
  - `[contract] the mail store` — `queries one account at a time, so Mail is never asked about
    every account in one request`
  - `[contract] the automation runner` — `given a script that outlives its time budget, stops the
    script before reporting the timeout`

### C5 Every AppleScript call has a time limit

- **Kind:** hardening
- **Context:** cross-cutting
- **Symptom:** The server hung forever when macOS hadn't granted Automation permission. A script
  blocked on an unseen consent prompt, and the tool call never returned.
- **Root cause:** `run-applescript` runs `execFile("osascript", ...)` with no timeout. Upstream
  declares a 10 s `CONFIG.TIMEOUT_MS` (`utils/mail.ts:10`) but never reads it.
  `run-applescript` 7.1 accepts an `AbortSignal`, and upstream never passes one.
- **Technique:** `runAppleScriptWithTimeout(script, ms)` races `runAppleScript(script)` against a
  `setTimeout` that rejects. The error text says: "This usually means macOS has not granted the
  required app permission. Check System Settings > Privacy & Security > Automation"
  (`utils/sanitize.ts:67-82` at fork). Every bare `runAppleScript` in all 7 modules is replaced.
- **Evidence:** `2bcee54`.
- **Quality of the fix:** partial.
  - When the race is lost, the `osascript` child isn't killed (no `signal`), so the work carries
    on inside the target app (see C4). The timer isn't cleared on success either.
  - The message **always** blames permissions, but for mail, per C3/C4, a timeout usually means
    a slow query. That points users at the wrong fix, which is the opposite of "failures say how
    to fix them".
- **Verdict:** adopt the idea (every call into an app has a deadline). Reject the error mapping.
  Tell "permission not granted" (a named failure, from the Automation error -1743 or a TCC
  preflight) apart from "the app did not answer in time".
- **Scenarios:**
  - `[acceptance] any tool reaching an app` — `given the app does not answer within its time
    budget, reports that the app timed out, not that permission is missing`
  - `[acceptance] any tool reaching an app` — `given Automation permission for the app is not
    granted, names the permission and where to grant it`

### C6 Tool input is escaped before it goes into AppleScript, and sqlite runs without a shell

- **Kind:** hardening
- **Context:** cross-cutting (messages, mail, notes, contacts, reminders, calendar, web-search)
- **Symptom:** A quote, backslash or newline in a message, subject, title or search term broke the
  script, or injected AppleScript. `process.env.HOME` and the SQL went through a shell.
- **Root cause:**
  - Upstream escapes only `"`, and in several places nothing at all: the message body and
    `buddy "${phoneNumber}"` in `utils/message.ts` `sendMessage`, the notes search term and folder
    name, and the contacts search strings.
  - It reads `chat.db` with `exec(\`sqlite3 -json "${HOME}/…" "${query}"\`)`, where the shell
    parses both the path and the SQL.
- **Technique:**
  - `sanitizeForAppleScript` strips NUL and escapes `\`, `"`, CR, LF and tab
    (`utils/sanitize.ts:15-23`). It is applied at about 30 interpolation sites.
  - `execSqliteQuery` uses `execFile("sqlite3", ["-json", db, query])`.
  - `validateHomePath` rejects `HOME` values with shell metacharacters or outside
    `/Users/` or `/home/`.
  - `sanitizeForSQL` is defined but never used. `readMessages` still inlines phone variants with
    `'` doubled, as upstream did.
- **Evidence:** `859a9c8`.
- **Quality of the fix:** partial, and **still injectable**.
  - `createEvent` still does `if "${location || ""}" ≠ "" then` and `if "${notes || ""}" ≠ ""`
    **unescaped** (`utils/calendar.ts:249,253` at fork; `utils/calendar.ts:286,290` upstream).
    A location or notes value containing `"` ends the string and runs arbitrary AppleScript,
    including `do shell script`.
  - The approach is still splicing values into code. It relies on catching every site, and this
    one was missed.
  - SQL is still string-built, with `LIMIT ${maxLimit}` and `IN (${phoneList})`. It is safe here
    only because of `Math.min` and quote doubling.
- **Verdict:** reject: escaping is the wrong layer. Non-negotiable 1 (static scripts, JSON argv,
  prepared statements) makes the whole class impossible. Record the missed calendar site as proof
  that escaping-by-review fails.
- **Scenarios:**
  - `[acceptance] creating an event` — `given a location or notes containing quotes and script
    text, stores them verbatim and runs nothing`
  - `[contract] the automation runner` — `passes every value as data, never as script text`

### C7 Writes ask for confirmation through MCP sampling

- **Kind:** hardening
- **Context:** cross-cutting (messages send/schedule, mail send, notes/reminders/calendar create,
  maps writes)
- **Symptom:** An agent could send messages and mail or create items with no human in the loop.
- **Root cause:** Upstream has no confirmation or write gating at all.
- **Technique:** `requestConfirmation(server, description, details)` (`utils/confirmation.ts`):
  1. It auto-approves when `APPLE_MCP_SKIP_CONFIRMATION=true`.
  2. Otherwise, if the client advertises `sampling`, it calls `server.createMessage`, asking
     "Do you approve? Reply with "yes" or "no"" with `maxTokens: 10`, and approves if the reply
     text `includes("yes")` or `includes("approve")`.
  3. Otherwise it refuses, with a hint about the env var.

  Handlers return `isError: true` on refusal. `WRITE_OPERATIONS` / `isWriteOperation` in
  `utils/config.ts` are imported into `index.ts` but never called.
- **Evidence:** `859a9c8`.
- **Quality of the fix:** wrong as a safety control.
  - Sampling asks **a model**, not the user. Whether a human sees it depends on the client. And
    the model answering has the same possibly prompt-injected context that asked for the write.
  - Substring matching accepts "no, I would not say yes".
  - The only unattended way to make writes work is a global env switch that turns off every
    confirmation.
  - It does confirm *before* the write. It never checks the store *after* (non-negotiable 3).
- **Verdict:** adopt the idea (writes are gated, and a refused write is an error that says why).
  Reject the mechanism. Use per-capability write enablement plus user confirmation through MCP
  elicitation (or the client's own tool-approval UI), never model sampling or substring
  matching.
- **Scenarios:**
  - `[acceptance] sending mail` — `given sending is not enabled, refuses: sending mail is off
    until the user turns it on`
  - `[acceptance] sending mail` — `given the user has not confirmed this send, refuses and sends
    nothing`
  - `[domain] a confirmation` — `counts only an explicit approval from the user, never a model's
    reply`

### C8 Message bodies go through private temp files with random names

- **Kind:** hardening
- **Context:** mail, notes
- **Symptom:** Mail and note bodies were written to `/tmp/email-body-<Date.now()>.txt`, which is
  predictable and readable by other local users, and could be raced or pre-created.
- **Root cause:** `utils/mail.ts:285-289` and the `utils/notes.ts` `createNote` temp file, both
  upstream.
- **Technique:** `createSecureTempFile` writes `os.tmpdir()/<prefix>-<randomUUID>.txt` with mode
  `0600` (`utils/sanitize.ts:56-62`). The path is still spliced into the script unescaped
  (`utils/mail.ts:330` at fork), which is safe only because the fork controls it.
- **Evidence:** `859a9c8`.
- **Quality of the fix:** complete for what it targets.
- **Verdict:** reject: not needed. Values reach static scripts as JSON arguments, so no body ever
  touches disk. Keep the underlying rule: user content is never written to a shared, predictable
  path.
- **Scenarios:**
  - `[contract] the automation runner` — `given a message body of any size or content, delivers it
    to the script without writing it to disk`

### C9 Calendar events are read through EventKit instead of Calendar's AppleScript

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Listing events returned one fake event titled "No events available - Calendar
  operations too slow", and search always returned nothing (#74, #25). The fork's first
  AppleScript rewrite got 0 events from CalDAV and Exchange calendars.
- **Root cause:** Upstream's `getEvents` returns a hard-coded dummy event
  (`utils/calendar.ts:96-118`). `searchEvents` returns an empty list without querying
  (`utils/calendar.ts:173-179`). The fork's AppleScript rewrite used
  `every event of cal whose start date >= startDate and start date <= endDate` (`be4becf`). Per
  `6bc977a`'s message, on CalDAV and Exchange calendars that "silently returns 0 events".
  Recurring events are also absent from Calendar's scripting results, because `whose` sees the
  master event, not the occurrences. That part is an inference, not in the commit.
- **Technique:** `helpers/calendar-helper.swift`, run as `swift <file> <command> --flag value`
  through `execFile` with a 30 s timeout. It has three commands:
  - `list-events` uses `predicateForEvents(withStart:end:calendars:)`, which expands occurrences,
    sorts by start and applies `prefix(limit)`.
  - `search-events` runs the same query, then a case-insensitive substring match on title, notes
    and location.
  - `list-calendars` returns name, type (local, calDAV, exchange, subscription, birthday) and
    hex colour.

  Output is JSON with ISO 8601 dates and `eventIdentifier` as the id. Defaults are today to
  +7 days for list and +30 days for search, with date-only input read in the local time zone.
  Create and open stay AppleScript. `bc8e4a1` had first tried one AppleScript per calendar in
  parallel with `Promise.allSettled`, and the EventKit helper replaced that the same evening.
- **Evidence:** `be4becf` (calendar half, superseded), `bc8e4a1` (superseded), `6bc977a`.
  Upstream #74, #25.
- **Quality of the fix:** partial.
  - Reads are right, but create still goes through AppleScript, with the injection hole from C6
    and `date "${toLocaleString()}"` parsing.
  - Running `swift file.swift` compiles on every call, which is seconds of latency and needs
    Xcode tools on the user's Mac.
  - Flags are parsed by `firstIndex(of:)`, so a search text equal to `--limit` or `--calendar` is
    taken as a flag.
  - Calendars are matched by title, which isn't unique.
- **Verdict:** adopt the idea. It is independent confirmation of plan.md's EventKit choice for
  calendar, and the reason is recorded: scripting `whose` date filters miss CalDAV and Exchange
  events. Reject running the Swift source directly. Use a long-lived compiled helper speaking a
  versioned protocol.
- **Scenarios:**
  - `[acceptance] listing events` — `given events on a CalDAV or Exchange calendar in the range,
    lists them alongside local ones`
  - `[acceptance] listing events` — `given a recurring event, lists each occurrence in the range`
  - `[acceptance] searching events` — `matches the search text against title, notes and location,
    ignoring case`
  - `[domain] an event range` — `given only dates, spans whole days in the user's time zone`

### C10 Events can be narrowed to one calendar, and calendars can be listed

- **Kind:** feature
- **Context:** calendar
- **Symptom:** No way to ask "what's on my work calendar" or to find out which calendars exist.
- **Root cause:** Upstream's list and search take no calendar argument, and there is no calendars
  operation.
- **Technique:** An optional `calendarName` on `list` and `search` (exact title match in the
  helper; an unknown name gives "Calendar 'X' not found"). There is a new `calendars` operation
  that returns names. The helper also returns type and colour, and the TS side throws those
  away.
- **Evidence:** `bc8e4a1`, `882140f`, `6bc977a`.
- **Quality of the fix:** partial. It filters by title, not by id, so two calendars with the same
  name (common across accounts) can't be told apart.
- **Verdict:** adopt the idea. Calendars are listed with an id, account and type, and filtering
  uses the id.
- **Scenarios:**
  - `[acceptance] listing calendars` — `lists each calendar with the account it belongs to`
  - `[acceptance] listing events` — `given a calendar, lists only that calendar's events`
  - `[acceptance] listing events` — `given a calendar that does not exist, refuses and lists the
    calendars that do`

### C11 Calendar permission failures say which state access is in and how to fix it

- **Kind:** hardening
- **Context:** calendar
- **Symptom:** Missing calendar permission showed up as an empty list (upstream #65's pattern, on
  calendar).
- **Root cause:** Upstream catches every error in reads and returns `[]`
  (`utils/calendar.ts:139-141`, `utils/calendar.ts:199-201`). The fork's first helper did the
  same.
- **Technique:** Before doing anything, the helper reads `EKEventStore.authorizationStatus(for:
  .event)`:
  - `denied`: a message with numbered steps (System Settings > Privacy & Security > Calendars,
    enable the app, relaunch).
  - `restricted`: blames an MDM or system policy.
  - `writeOnly`: says to change "Add Events Only" to "Full Access".
  - `notDetermined`: calls `requestFullAccessToEvents` (macOS 14+) or `requestAccess(to:)`.

  It exits 1 with the message on stderr. `runSwiftHelper` rethrows the helper's stderr, and the
  TS read functions no longer catch it, so the message reaches the agent.
- **Evidence:** `4fb39a3`. Upstream #65 (same failure class, contacts).
- **Quality of the fix:** complete for calendar reads.
- **Verdict:** adopt the idea. Each authorization state is its own named failure, and write-only
  access is distinct from denied.
- **Scenarios:**
  - `[acceptance] listing events` — `given calendar access was denied, names the setting to change
    and where it is`
  - `[acceptance] listing events` — `given access to add events only, explains that reading needs
    full access`
  - `[acceptance] listing events` — `given calendar access is restricted by policy, says the user
    cannot grant it themselves`
  - `[contract] the native helper` — `given access has never been asked for, asks once before
    reading`

### C12 "Authorized but no calendars" is reported as a permission problem of the host app

- **Kind:** hardening
- **Context:** calendar
- **Symptom:** Launched from Claude Desktop, the helper reported access as authorized but saw
  zero calendars, so every read quietly came back empty.
- **Root cause:** The commit message explains it. macOS attributes the TCC request to the
  *responsible* process (Claude Desktop, the parent of `node`, the parent of `swift`), not to the
  terminal that granted access. A status that reads as authorized in one context can yield no
  data in another. The code can't show the mechanism, so this is a *verify*.
- **Technique:** After the status check, `store.calendars(for: .event).isEmpty` exits with
  "Calendar access appears granted but no calendars were returned ... the parent app (e.g. Claude
  Desktop) needs calendar permission separately from the terminal", plus the fix steps. The fix
  steps include `tccutil reset Calendar com.anthropic.claudedesktop` and a suggestion to toggle
  Full Disk Access. It logs the status and calendar count to stderr for remote diagnosis.
- **Evidence:** `91b6cab`.
- **Quality of the fix:** partial. A user who really has no calendars gets a false permission
  error. The Full Disk Access advice is folklore, and the bundle id is unchecked.
- **Verdict:** verify: when the server is started by Claude Desktop and Claude Desktop hasn't been
  granted Calendars, EventKit in a child process reports an authorized status but returns no
  calendars, and the prompt (if any) names Claude Desktop. This feeds plan.md Decision 3
  (permission attribution for the helper). Adopt the idea of logging status and count for
  diagnosis.
- **Scenarios:**
  - `[acceptance] listing events` — `given access reported as granted but no calendars visible,
    says which app needs calendar permission`

### C13 The server stops rewriting its own stdout

- **Kind:** fix
- **Context:** cross-cutting
- **Symptom:** "client transport closed" in Claude Desktop (the commit says on Intel Macs).
- **Root cause:** Upstream monkey-patches `process.stdout.write` to drop any string chunk that
  doesn't start with `{`, returning `true` without calling the callback (`index.ts:1307-1316`).
  The commit says it "was corrupting multi-chunk MCP responses". Reading the SDK's
  `StdioServerTransport` (one `write` per serialized message), a valid message shouldn't be split
  across `write` calls. The skipped callback, or a non-string chunk path, is a more plausible
  cause. This can't be settled from code.
- **Technique:** The filter is deleted. `process.on("uncaughtException")` and
  `on("unhandledRejection")` handlers are added. They only log, which keeps a possibly broken
  process alive.
- **Evidence:** `985444b`.
- **Quality of the fix:** complete for the filter. The global handlers are wrong: swallowing
  uncaught exceptions hides crashes that should restart the server.
- **Verdict:** adopt the idea (stdout belongs to the protocol, all logging goes to stderr, and
  nothing patches the stream). Reject the log-and-continue handlers. *verify:* upstream's filter
  drops or stalls responses on large results under Claude Desktop.
- **Scenarios:**
  - `[acceptance] the server` — `given a result larger than a pipe buffer, delivers it whole`
  - `[contract] the server process` — `writes nothing but protocol messages to stdout`

## Noise

- README install options (npx, `claude mcp add`, pinning `github:brightline/apple-mcp#<sha>`):
  `967b090`, `86e3953`.
- DXT bundle rebuilds and build script, manifest author and repo changed to Brightline,
  `.dxtignore`, `.npmignore`, `.gitignore` tweaks, committed `dist/index.js` (rebuilt in most
  later commits): `598ce4e`, `985444b` (DXT/manifest part), `0d1032a`. Note: from `0d1032a` the
  manifest's `mcp_config` runs `npx -y apple-mcp@latest`, which is the **npm** package (upstream's
  published build), not this fork's code. So the DXT the fork ships doesn't run its own fixes,
  and the bundled Swift helper is never used by it.
- `bun.lockb` churn: `be4becf`.

## Glossary candidates

- **account** (Mail): a named receiving account (POP, IMAP, iCloud; the dictionary's
  `TypeOfAccount` has no Exchange value) whose `mailboxes` hold its server mail. The fork
  addresses it by display name (`first account whose name is …`).
- **mailbox** (Mail): a container of messages that can nest. It belongs either to an account or
  to the app itself ("On My Mac" and special mailboxes such as Outbox). The fork names it
  `account/mailbox`.
- **inbox**: the fork treats it as the mailbox literally named `INBOX` in each account. Mail also
  has an application-level unified `inbox`.
- **message index**: a message's position in a mailbox (`message i of mb`). The fork assumes 1 is
  the newest.
- **read status**: Mail's per-message unread flag. "Unread mail" in the fork means unread among
  the scanned window.
- **scan window**: the fork's bound of 100 newest messages per mailbox. Not a domain word, but the
  rebuild needs a truthful name for "how far back we looked".
- **calendar** (EventKit): a named source of events with a type (local, calDAV, exchange,
  subscription, birthday) and colour. Titles aren't unique.
- **event / occurrence**: `EKEvent` from a date-range predicate, where recurring events come back
  one per occurrence and `eventIdentifier` is the id.
- **authorization status**: the EventKit access state: notDetermined, restricted, denied,
  writeOnly, fullAccess (authorized before macOS 14).
- **responsible app**: the app macOS charges a permission to (Claude Desktop or the terminal),
  which may not be the process asking.
- **confirmation**: the fork's word for approving a write before it runs.

## Open questions

- Is `message 1 of mailbox` the most recently received message for IMAP, iCloud, Gmail and
  Exchange accounts, or the order the mailbox happens to be stored in? The whole scan window
  (C3) depends on it.
- Does `mailbox "INBOX" of account` resolve for Exchange accounts (whose inbox Mail shows as
  "Inbox") and for POP accounts? The fork skips accounts where it doesn't, silently.
- Why does `whose read status is false` time out on large mailboxes? Is Mail evaluating per
  message, or is the cost in returning thousands of specifiers? Would `count of (messages of mb
  whose read status is false)` or a bulk property fetch be fast?
- How much of the "Mail hangs" symptom is caused by the `content` fetch for each message in
  every list result, and how much by the timed-out `osascript` processes that keep running?
  Does the 3 s pause still matter once both are removed?
- Is reading Mail's Envelope Index (SQLite) a better read path than scripting for unread, search
  and latest? This fork never tried it. plan.md lists it as a *verify* for mail.
- What does Claude Desktop do with a `sampling/createMessage` request: does a human see and
  answer it, or does the model?
- Upstream's stdout filter: what exactly closed the transport on Intel Macs (C13)?
