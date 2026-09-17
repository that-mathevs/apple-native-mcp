# felkru/apple-mcp

- **Remote:** `fork-felkru`
- **Branches read:** `main` (4 commits). `HEAD` points at `main`. `fix-mail-search` and
  `index-safe-mode` are upstream copies with no commits of their own
  (`git log upstream/<b>..fork-felkru/<b>` is empty).
- **Commits accounted for:** 4 / 4
- **Last commit:** 2026-05-26
- **In one paragraph:** Felix Krueckel's personal fork, written with Claude Opus 4.6. The last
  commit says it was checked against a real 5-account Apple Mail setup. It stops scripting the
  apps for most reads:
  - **Mail search, attachments, links and HTML:** it builds a private SQLite FTS5 index of every
    `.emlx` file under `~/Library/Mail/V10`, parsed with `mailparser`.
  - **Reminders and calendar:** it reads Apple's `Calendar.sqlitedb` directly (`bun:sqlite`,
    read-only, prepared statements).

  The commit the brief highlights (`c769cc0`) fixes three real upstream mail failures. Accounts
  and mailboxes were hard-coded placeholders that were then thrown away, "latest" didn't even
  compile, and a cold Mail.app is now launched and polled. Two things are **alarming**. The fork
  **relicenses the combined work to GPL-3.0-or-later**, citing imdinu/apple-mail-mcp (GPL-3.0) as
  inspiration. And its index **copies the plain text and HTML of every email into an unencrypted
  `~/.apple-mcp/index.db`**, outside the data macOS protects. The fixes to account listing and
  "latest" are worth learning from. The direct-database readers are useful evidence about
  Apple's data model (occurrences, the `.emlx` layout, Apple epoch timestamps), but not code to
  follow.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Mail (accounts, mailboxes, latest) | AppleScript via `run-applescript`. `System Events` checks whether Mail is running, then `tell application "Mail" to launch` and polling of `count of accounts` | Results are parsed from osascript's `a, b, c` list text, or from U+241F/U+241E glyph-delimited records. |
| Mail (search_body, attachments, links, HTML) | Walks `~/Library/Mail/V10/**/*.emlx` with `node:fs`, parses the MIME with `mailparser`, and stores the results in FTS5 at `~/.apple-mcp/index.db` (`bun:sqlite`) | Needs Full Disk Access. Indexing is manual (`rebuild_index`, `sync_index`). Attachments are written to `~/.apple-mcp/attachments/`. |
| Reminders (list, search) | `bun:sqlite` read-only on `~/Library/Group Containers/group.com.apple.calendar/Calendar.sqlitedb`, `Store.type = 6` | Create and open still use upstream AppleScript. |
| Calendar (list, search) | Same database: `OccurrenceCache` joined to `CalendarItem` and `Calendar` | Create and open still use upstream AppleScript. |

## Changes

### C1 Mail accounts and mailboxes list what is really configured

- **Kind:** fix
- **Context:** mail
- **Symptom:** "No email accounts found. Make sure Mail app is configured with at least one
  account." (`index.ts:769`) on a Mac with several accounts, so "latest" without an account
  failed too. The mailbox list was always Inbox, Sent, Drafts (upstream #69, #58).
- **Root cause:** Two faults stacked:
  - The scripts return hard-coded lists: `utils/mail.ts:351` `{"Inbox", "Sent", "Drafts"}` and
    `:391` `{"Default Account"}`.
  - The callers keep the result only when `Array.isArray(result)` (`:362`, `:402`). But
    `run-applescript` always returns stdout as a string, so both functions always return `[]`,
    even the placeholders.

  The commit message blames Mail not running. The code shows the functions returned `[]` whether
  or not Mail was running.
- **Technique:**
  - `getAccounts`: `repeat with acct in accounts` → `set end of acctList to name of acct`.
  - `getMailboxes`: for each account, `"<account> / <mailbox>"` over `mailboxes of acct`, plus
    `"On My Mac / <mailbox>"` over the application's own `mailboxes`.
  - `parseAppleScriptList` strips braces, splits on `/, +/` and strips quotes.
- **Evidence:** `c769cc0`. Upstream #69, #58.
- **Quality of the fix:** partial.
  - Names containing ", " are split in two.
  - Account names are display names, which need not be unique.
  - Both scripts swallow errors per item, so a missing Automation permission still reads as "no
    accounts".
  - Whether `mailboxes of acct` includes nested mailboxes is unverified.
  - The labelling does show the data model correctly: accounts own mailboxes, and the
    application separately owns local "On My Mac" mailboxes.
- **Verdict:** adopt the idea. Return accounts, and mailboxes grouped by account, as structured
  data, and make a failed read a failure rather than an empty list.
- **Scenarios:**
  - [acceptance] `listing mail accounts` — `given three configured accounts, reports all three by name`
  - [acceptance] `listing mailboxes` — `given two accounts that both have an inbox, reports each inbox under its own account`
  - [acceptance] `listing mailboxes` — `given local mailboxes on this Mac, reports them apart from any account`
  - [acceptance] `listing mail accounts` — `given Mail cannot be scripted, fails naming the Automation permission instead of reporting no accounts`

### C2 A read launches Mail and waits until its accounts are loaded

- **Kind:** hardening
- **Context:** mail
- **Symptom:** On a cold start, the first mail read after login returned nothing.
- **Root cause:** Right after launch, Mail answers Apple Events before its accounts have loaded
  (verify). Upstream `checkMailAccess` (`utils/mail.ts:25-40`) runs
  `tell application "Mail" to return name`. That already launches Mail but doesn't wait.
- **Technique:**
  - `isMailRunning` asks `System Events` for `name of processes contains "Mail"`.
  - `ensureMailRunning(15000)` sends `tell application "Mail" to launch` if Mail isn't running,
    then polls `count of accounts` every 500 ms until it is > 0.
  - `requestMailAccess` calls it only when `checkMailAccess` has **failed**.
- **Evidence:** `c769cc0`.
- **Quality of the fix:** partial, and probably doesn't cover the case it targets.
  - **Not reached on a cold start.** `checkMailAccess` launches Mail and succeeds, so the
    polling never runs, and the next query can still find zero accounts.
  - **When it does run, it misleads.** The first check failing usually means Automation
    permission was denied. The server then polls for 15 s and returns the generic "grant
    Automation" text.
  - **No accounts.** A Mac with no Mail accounts waits 15 s and is told to fix permissions.
  - **Extra permission.** The `System Events` check needs its own Automation permission.
  - **Side effect.** A read starts Mail, and with it account sync, which the user may not expect.
- **Verdict:** adopt the idea (a read waits until the app is ready, within a budget). Verify the
  "accounts load late" claim. Reject treating every failure the same: the permission failure,
  the "Mail has no accounts" failure and the "not ready in time" failure are three named
  outcomes.
- **Scenarios:**
  - [acceptance] `reading mail` — `given Mail was not running, reports messages once Mail is ready, within the time budget`
  - [acceptance] `reading mail` — `given Mail has no accounts, fails saying so rather than asking for a permission`
  - [acceptance] `reading mail` — `given Mail is not ready within the time budget, fails saying it timed out`

### C3 "Latest mail" runs instead of failing to compile

- **Kind:** fix
- **Context:** mail
- **Symptom:** Asking for the latest emails always failed or returned nothing.
- **Root cause:** Upstream `utils/mail.ts:533-536` defines `on sortMessagesByDate(messagesList)`
  with `set sortedMessages to sort messagesList by date sent`. Mail has no `sort` command, and
  the handler sits outside the `tell` block. Measured with `osacompile`:
  "Expected end of line but found identifier (-2741)". The whole script fails to compile, and
  the regex parser at `:548-575` could never have matched osascript's brace-less output anyway.
- **Technique:** Drops the sort and takes items 1…limit of `messages of mb` for each mailbox of
  the account, stopping once `limit` rows are collected. Each row is subject, sender,
  `date sent as string`, mailbox and a 500-character content preview, joined with U+241F and
  U+241E glyphs (not the ASCII control characters).
- **Evidence:** `c769cc0`.
- **Quality of the fix:** partial.
  - "Latest" really means "the first N messages of the first mailbox that has any", in
    dictionary order. That could be Archive or Drafts, and message order within a mailbox is
    unverified.
  - `isRead` is hard-coded `false`.
  - Dates are locale strings with no offset.
  - The account name is escaped for `"` only (backslash injection).
  - The commit message says it renamed the AppleScript locals `line` and `result`, but no such
    rename appears in the diff.
- **Verdict:** adopt the idea (latest means newest by date across the account's inboxes, and
  every script is compiled as part of the build). Reject the ordering assumption.
- **Scenarios:**
  - [acceptance] `reading the latest mail` — `given newer mail in one account's inbox than in its archive, reports the inbox mail first`
  - [acceptance] `reading the latest mail` — `given read and unread messages, reports each one's real read state`
  - [contract] `the automation scripts` — `given the shipped scripts, every one compiles`

### C4 Email bodies are searchable through a private full-text index

- **Kind:** feature
- **Context:** mail
- **Symptom:** Upstream search looked only at subjects and returned nothing (#30, #19). Text in
  a message body couldn't be found.
- **Root cause:** Upstream `utils/mail.ts:161-255` loops over subjects only, and its results are
  thrown away.
- **Technique:** `utils/mail-index.ts`:
  - **Index build:** `rebuild_index` deletes everything, recursively lists
    `~/Library/Mail/V10/**/*.emlx`, and caps each `<uuid>/<Name>.mbox` at 5 000 files in
    directory order.
  - **Parsing:** an `.emlx` file is `<byte count>\n<MIME bytes><plist footer>`. The fork slices
    the MIME bytes and runs `mailparser.simpleParser`.
  - **Storage:** `emails(emlx_path UNIQUE, subject, sender, date_sent, body_text, body_html,
    attachment_names, mailbox, account)` with an external-content FTS5 table (`unicode61`) kept
    in step by triggers. `sync_index` adds paths it hasn't seen yet.
  - **Querying:** `search_body` strips FTS syntax characters, quotes each term, optionally
    prefixes a column (`subject:` etc.), and runs a prepared `MATCH ? ORDER BY rank`, falling
    back to a `LIKE` query.
- **Evidence:** `22aa354`. Upstream #30, #19, #69.
- **Quality of the fix:** wrong as shipped.
  - **Privacy.** Every message body, text and HTML, is copied into a plaintext database in the
    home folder. A process without Full Disk Access can read what Mail's storage deliberately
    protects.
  - **Column-name bug.** The FTS query selects `emlx_path`, `date_sent` and `attachment_names`
    unaliased, while the formatter reads `r.dateSent` and `r.attachmentNames`. Every successful
    search prints "Date: undefined" and "Attachments: none". Only the LIKE fallback aliases the
    columns.
  - **Scope.** In FTS5, `subject: "a" "b"` applies the column filter to `"a"` only.
  - **Staleness.** Moves and deletions are never removed (`sync_index` only adds), so results
    point at files that are gone. It's also stale until someone runs a sync by hand.
  - **Account is a UUID** directory name, not the account's name.
  - **Paths.** `V10` is hard-coded (verify on macOS 26). `.partial.emlx` bodies lack their
    attachments.
- **Verdict:** reject the private copy. Adopt the facts it relies on: the `.emlx` layout, the
  `Messages/<id>.emlx` and `Attachments/<id>/<part>/` structure, and body search needing more
  than scripting. Verify plan.md's option of querying Mail's own Envelope Index read-only, plus
  reading the `.emlx` file for one message on demand. Nothing is persisted.
- **Scenarios:**
  - [acceptance] `searching mail` — `given text that appears only in a message body, finds the message`
  - [acceptance] `searching mail` — `given a message that was deleted since the last search, does not report it`
  - [acceptance] `searching mail` — `never stores message contents outside Mail's own storage`
  - [domain] `an emlx file` — `given its byte-count header, separates the message from Apple's trailing metadata`

### C5 Attachments can be listed and saved to disk

- **Kind:** feature
- **Context:** mail
- **Symptom:** The agent couldn't see or open attachments.
- **Root cause:** Not in upstream.
- **Technique:** `utils/mail-attachments.ts`:
  - **Listing:** `listAttachments` parses the MIME and returns the filename, content type and
    size of each part.
  - **Extracting:** `extractAttachment(emailId, filename)` looks for a part whose name matches,
    trying three strategies in order:
    1. trimmed and lowercased, whitespace collapsed
    2. URL-decoded (RFC 2231)
    3. every character outside `[a-z0-9.]` stripped
  - **Partial messages:** when nothing matches inside the MIME, it searches
    `../Attachments/<msgId>/**` for a `.partial.emlx`.
  - **Saving:** writes to `~/.apple-mcp/attachments/<timestamp>_<basename>`, with a 25 MB cap and
    a `resolve()` prefix check, and returns the path.
- **Evidence:** `22aa354`. The commit says it fixes a comma-in-filename bug in
  imdinu/apple-mail-mcp.
- **Quality of the fix:** partial.
  - Strategy 3 can match the wrong file: `a,b.pdf` and `ab.pdf` both become `ab.pdf`, and the
    first one found wins.
  - Untrusted attachment content is written to a predictable directory and never cleaned up.
  - The MIME type of a partial-message attachment is guessed from its extension.
  - Addressing is by index row id, so a rebuild invalidates every id the agent holds.
- **Verdict:** adopt the idea (list attachments with name, type and size, as Messages does in
  upstream #62/#3). Saving attachments to disk is out of scope for the first mail slices. Match
  attachments by MIME part, never by a fuzzy name.
- **Scenarios:**
  - [acceptance] `reading a message` — `given attachments, reports each one's name, type and size`
  - [acceptance] `opening an attachment` — `given two attachments whose names differ only in punctuation, opens the one asked for by its part`

### C6 Links and a cleaned HTML body can be read from a message

- **Kind:** feature
- **Context:** mail
- **Symptom:** Agents got 300–500 character plain-text previews and couldn't follow links or read
  rich mail.
- **Root cause:** Upstream truncates `content of` (`utils/mail.ts:106-111`).
- **Technique:**
  - `get_links` loads the HTML with `cheerio` and returns deduplicated
    `a[href]` entries, skipping `mailto:`, `javascript:`, `data:` and `tel:`, and dropping any
    URL longer than 200 characters as "tracking".
  - `get_html` replaces base64 `<img>` tags with `[image: alt]`, removes base64 CSS
    `url()` values, falls back to `<pre>`-escaped text, and truncates at 50 KB.
- **Evidence:** `22aa354`.
- **Quality of the fix:** partial.
  - Dropping long URLs silently loses real links, such as signed download links.
  - Raw sender-controlled HTML is handed to the agent, the prompt-injection surface in plan.md's
    threat model, with no marking of it as untrusted content.
  - Truncation can cut inside a tag.
- **Verdict:** adopt the idea (links as structured data). Returning raw HTML is out of scope for
  the first mail slices: return text plus links, and label message content as untrusted.
- **Scenarios:**
  - [acceptance] `reading a message` — `given an HTML message, reports its links with their text`
  - [acceptance] `reading a message` — `given a link longer than usual, still reports it`

### C7 Reminders are read straight from the Calendar database

- **Kind:** fix (performance)
- **Context:** reminders
- **Symptom:** Listing reminders timed out on a library of over 1 900 items (upstream #53).
- **Root cause:** Upstream stubs (`utils/reminders.ts:140-217`) and, before them, per-item
  AppleScript.
- **Technique:** `utils/reminders-db.ts` opens `Calendar.sqlitedb` read-only, with prepared
  statements only:
  - **Lists:** `Calendar` joined to `Store` where `Store.type = 6`, with a count of items where
    `completion_date IS NULL`.
  - **Reminders:** `CalendarItem` joined to `Calendar` and `Store` (type 6), open ones only by
    default, `ORDER BY creation_date DESC LIMIT ?`, and optionally filtered by list title.
  - **Search:** `summary LIKE ? OR description LIKE ?`.
  - **Timestamps:** Apple epoch seconds + 978307200.
  - The `list` and `search` handlers now format real rows.
- **Evidence:** `12ad33f`. Upstream #53, #26.
- **Quality of the fix:** partial.
  - **iCloud reminders may be missing.** Reminders upgraded since macOS 10.15 live in a separate
    Core Data store (`group.com.apple.reminders/Container_v1/Stores/Data-*.sqlite`), so this
    reader may only see CalDAV, Exchange or local lists (verify).
  - **Private schema** that can change between releases.
  - **Full Disk Access** is needed, and the error only guesses at that.
  - **Floating times.** All-day and floating due dates are converted as if they were UTC
    instants.
  - **Unstable ids.** `ROWID` ids can't be passed to the AppleScript create or open operations.
  - **Silent drops.** `LIKE` treats `%` and `_` in the query as wildcards. `limit` truncates
    silently.
- **Verdict:** reject the mechanism (plan.md uses EventKit). Keep it as evidence that direct
  reads are fast enough, and verify where reminders are actually stored on macOS 14+.
- **Scenarios:**
  - [acceptance] `listing reminders` — `given an iCloud list and a CalDAV list, reports reminders from both`
  - [acceptance] `searching reminders` — `given a percent sign in the search text, matches it literally`

### C8 Calendar events are read from the occurrence cache

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Calendar lists and searches came back empty or fake (upstream #74, #25, #66).
- **Root cause:** Upstream dummy and stub (`utils/calendar.ts:100-116`, `:175-178`).
- **Technique:** `utils/calendar-db.ts`:
  - **Query:** `OccurrenceCache` joined to `CalendarItem` (`oc.event_id`) and `Calendar`, where
    `oc.day >= from AND oc.day < to`, `ORDER BY occurrence_start_date LIMIT ?`.
  - **Occurrences:** each row is one occurrence, so recurring events are expanded.
  - **Defaults:** the range is now to +7 days for listing, and −30 to +90 days for search.
  - **Location:** the `location` column is removed from the SQL by `String.replace` and always
    returned empty.
  - **Handlers:** `index.ts` now calls `getEventsFast` and `searchEventsFast` and drops the
    event id from the text it prints.
- **Evidence:** `631d4d1`. Upstream #74, #25, #6.
- **Quality of the fix:** partial.
  - **Today dropped.** `day` appears to be the start of an occurrence's day. With the default
    `from = now`, today's remaining events have `day < now` and are left out (verify).
  - **Floating times.** All-day occurrences are stored in floating time, so `toISOString()` can
    move them to the previous day west of UTC (verify).
  - **Missing fields.** Location is always blank. Attendees and time zone are absent.
  - **Silent limit.** A `LIMIT` over `DISTINCT` rows truncates silently.
- **Verdict:** reject the mechanism (EventKit via the helper). Adopt the data-model insight: a
  listing returns occurrences, each with its own start and end, linked to one stored event.
- **Scenarios:**
  - [acceptance] `listing events` — `given no range and an event later today, reports it`
  - [acceptance] `listing events` — `given an all-day event, reports it on its own calendar day in every time zone`
  - [acceptance] `listing events` — `given an event with a location, reports the location`

### C9 The combined work is relicensed to GPL-3.0-or-later

- **Kind:** infra
- **Context:** other:licensing
- **Symptom:** None for users. For reuse, anything taken from this fork carries GPL terms.
- **Root cause:** The author credits imdinu/apple-mail-mcp (GPL-3.0) as the inspiration for the
  mail search, attachment and link features.
- **Technique:** Replaces the MIT `LICENSE` with a GPL-3.0 notice plus attribution (the original
  MIT copyright is kept as a notice). `package.json` gets `"license": "GPL-3.0-or-later"` and
  adds the `cheerio`, `mailparser` and `@types/mailparser` dependencies.
- **Evidence:** `22aa354`.
- **Quality of the fix:** not applicable. Note that the full MIT text is removed, while MIT
  requires the permission notice to be kept.
- **Verdict:** reject: no code crosses over. Non-negotiable 6 (ideas, not code) matters doubly
  here. Credit felkru for the ideas only, and read imdinu/apple-mail-mcp as its own source if its
  ideas are wanted.
- **Scenarios:** none (not a behaviour).

## Noise

- Lockfile churn: `22aa354`. The rest of that commit is C4–C6 and C9.

## Glossary candidates

- **account (mail):** a configured Mail account, listed by display name. It owns mailboxes. On
  disk it's a UUID directory under `~/Library/Mail/V10`.
- **mailbox:** a folder inside an account (`<Name>.mbox` on disk). **Local mailbox**: one that
  belongs to the application ("On My Mac") rather than to an account.
- **emlx:** Mail's per-message file: a byte count, the RFC 822 message, then a property-list
  footer. **Partial emlx**: a message whose attachments are stored separately under
  `Attachments/<id>/<part>/`.
- **attachment:** a MIME part with a filename, content type and size.
- **occurrence:** one dated instance of an event (an `OccurrenceCache` row), with its own start
  and end, pointing at the stored event.
- **store (calendar database):** a source of calendars and lists (iCloud, CalDAV, local).
  `type = 6` is taken to mean Reminders.
- **Apple epoch:** seconds since 2001-01-01 UTC (offset 978307200 from Unix time).
- **cold start:** the moment after Mail launches, before it has loaded its accounts.

## Open questions

- Right after `launch`, does Mail answer `count of accounts` with 0 for a while? And does
  `tell application "Mail"` in upstream's access check already cover the cold start?
- On macOS 14–26, are iCloud reminders present in `Calendar.sqlitedb` at all, or only in the
  Reminders Core Data store?
- Is `OccurrenceCache.day` the local start of the day, a UTC day, or the occurrence start? That
  decides whether today's events are dropped.
- Is the Mail data directory still `V10` on macOS 26? Is the Envelope Index a better read path
  than walking `.emlx` files?
- Does `mailboxes of account` include nested mailboxes?
