# chrischall/apple-mcp

- **Remote:** `fork-chrischall`
- **Branches read:** `main` (23 commits: 22 plus 1 merge, `8d10035`), `task/enhance` (41
  commits, 41 not on main). `HEAD` points at `main`. The two branches split at `upstream/main`
  and never merge: `task/enhance` (2026-03-30 to 04-02) is a bigger rewrite that `main` never took.
  `main` (2026-04-03 to 04-21) is the line that got released.
- **Commits accounted for:** 64 / 64
- **Last commit:** 2026-04-21 (`fa6c6fe`, main)
- **In one paragraph:** Chris Hall's personal fork, written almost entirely with Claude Code
  (Opus 4.6 co-author trailers, `docs/superpowers`-style spec and plan files). **`main`**, the
  released line, has version bump bots, GitHub Releases with `.mcpb` and `.skill` files, a ClawHub
  publish and a Claude plugin manifest. Past the CI, it holds three real functional fixes:
  - Calendar list/search and mail unread/search return real data through `@jxa/run`, with values
    passed as JSON through an environment variable. Upstream returned a dummy event or `[]`.
  - Creating an event no longer drops silently into the first calendar.
  - Events can be updated, and moved by copy + delete.

  **Re-verified:** on `main`, `utils/message.ts` is byte-for-byte upstream, so the Messages send
  recipient is still spliced unescaped (`utils/message.ts:77`). Calendar create still splices
  `location` and `notes` unescaped in the `if "…" ≠ ""` guards (fork `utils/calendar.ts:422,426`,
  upstream `:286,290`). Every other escape on `main` is quote-only, so a backslash defeats it.
  **`task/enhance`** fixes those lines with a proper backslash+quote escaper, drops the shell
  from the sqlite3 call, and adds 58 per-operation tools (a large mail surface, free/busy, reminders
  that actually work). But it deletes upstream's runtime type guards, so numeric and boolean
  arguments such as `limit` and `isAllDay` go into AppleScript raw. That is a **new injection
  path**. It also adds dangerous mail capabilities: attach any file on disk and send it, save an
  attachment anywhere under `$HOME`, batch-delete 100 messages. The release pipeline has real
  supply-chain weaknesses (see C10). Worth learning from: the JXA-with-JSON-args technique and its
  per-calendar fan-out, the "no silent default calendar" rule, the atomic `set properties` update,
  the batched property fetch in Reminders, the free-slot arithmetic, and the backslash-quote
  bypass as a hostile-input test case. The rest is a list of things not to do.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Calendar (read, `main`) | JXA via `@jxa/run`. A function is serialised with `toString()` and piped to `/usr/bin/osascript -l JavaScript` over stdin. Arguments arrive as `JSON.stringify(args)` in the `OSA_ARGS` env var (checked in `@jxa/run@1.4.0` `lib/run.js`) | Injection-safe by construction. One osascript process per calendar, run in parallel. Filtered with `cal.events.whose({_and:[startDate>start, endDate<end]})`. No timeout: `@jxa/run` sets none, and the only limit is a 100 MB `maxBuffer`. |
| Calendar (write, `main`) | String-built AppleScript via `run-applescript` | Quote-only escaping. `location`/`notes` guards unescaped. Dates go through `Date#toLocaleString()`. |
| Mail (read, `main`) | JXA via `@jxa/run`, looping over accounts, then mailboxes, then `messages.whose(...)` | Unread uses `whose({readStatus:false})`. Search uses `whose({_and:[subject _contains term, dateSent > since]})`. `unread` with an `account` still uses upstream's string AppleScript in `index.ts` and a regex "parser". |
| Calendar, Notes, Reminders, Mail, Contacts (`task/enhance`) | String-built AppleScript with `escapeAppleScriptString` (backslash, then quote). Results come back as text joined with `|||` and `|||ITEM|||` | Every value is still spliced into source. Non-string arguments aren't escaped or validated (C13). Any field containing the delimiter corrupts or forges records (C14). |
| Messages read (`task/enhance`) | `spawn('sqlite3', ['-json', dbPath, query])`: no shell, but the SQL is still built as a string | Phone numbers are cut down to `[0-9+]` before being spliced in. |
| Messages send (both) | AppleScript `send "…" to buddy "…"` | `main`: recipient unescaped. `task/enhance`: escaped. Neither checks the outcome. |
| Notes create (both) | Body written to `/tmp/note-content-<ms>.txt`, then read by AppleScript `read file POSIX file … as «class utf8»` | Carried over from upstream. The temp path is predictable. |

## Changes

### C1 Listing and searching calendar events returns real events

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Asking for this week's events returned one fake event, "No events available -
  Calendar operations too slow". Searching always returned nothing.
- **Root cause:** Upstream gave up on reading. `getEvents` builds a hard-coded dummy record
  (`utils/calendar.ts:97-119`). `searchEvents` runs a script that returns `{}`
  (`utils/calendar.ts:173-179`).
- **Technique:** `main` reads through JXA with arguments passed as JSON:
  - `queryCalendarEvents` looks up the calendar with `Calendar.calendars.whose({name})`, then
    `cal.events.whose({_and:[{startDate:{_greaterThan:start}},{endDate:{_lessThan:end}}]})`.
  - It reads each property in its own `try` (summary, location, description, uid, startDate,
    endDate, alldayEvent, url) and returns ISO strings.
  - Search is a case-insensitive substring test on title + location + notes, done inside JXA.
  - With a `calendarName`, only that calendar is queried. Without one (or with `"all"`), it lists
    the calendar names and runs one osascript per calendar in parallel through
    `Promise.allSettled`. Calendars whose call rejects are dropped.
  - A new `calendars` operation lists the names.
  - The tool description tells the agent to scope by calendar, citing about 8 s for one calendar
    against 60-90 s fanned out.
- **Evidence:** `25d47cc` (also `05e1ed7` tests, `3bb2b01` listCalendars); upstream #74, #25, #6.
- **Quality of the fix:** partial.
  - The strict `startDate > start AND endDate < end` drops events that start exactly at the range
    start (all-day events at midnight when `fromDate` is a date), events ending exactly at the range
    end, and any event that overlaps a boundary.
  - The default `fromDate` is *now*, not the start of today.
  - Recurring events: `whose` on `startDate` most likely matches only the master event's first
    occurrence (verify).
  - The limit (at most 20) is filled in calendar-enumeration order, so results are neither
    chronological nor the earliest.
  - A calendar that errors or times out is dropped without a word, so the result claims to be
    complete when it isn't.
  - Calendar identity is by name, so two calendars with the same name are ambiguous.
- **Verdict:** adopt the idea (read in bulk with typed arguments, scope by calendar, fan out per
  calendar so a slow subscribed calendar can't block the rest). The plan's EventKit helper
  replaces the mechanism. Reject the boundary predicate and the silent dropping.
- **Scenarios:**
  - [acceptance] `listing events` — `given events in several calendars, reports them in start order with their calendar named`
  - [acceptance] `listing events` — `given an all-day event on the first day of the range, includes it`
  - [domain] `a date range` — `given an event that starts before the range and ends inside it, counts it as overlapping`
  - [domain] `a date range` — `given no start, begins at the start of today in the user's time zone`
  - [acceptance] `listing events` — `given one calendar that cannot be read, reports the others and names the calendar that was skipped`
  - [contract] `an event store` — `given a recurring event, returns each occurrence in the range, not only the first`
  - [acceptance] `searching events` — `given text found only in an event's location, finds the event`

### C2 Unread and searched mail return real messages

- **Kind:** fix
- **Context:** mail
- **Symptom:** "unread" and "search" always said no emails were found, even with a full inbox.
- **Root cause:** Upstream builds a result list inside AppleScript, returns only
  `"SUCCESS:<count>"`, then throws the count away and returns `[]` (`utils/mail.ts:138-149`,
  `:237-248`). Its search also splices `searchTerm` into the script unescaped
  (`utils/mail.ts:182`).
- **Technique:** JXA through `@jxa/run`:
  - Unread loops `Mail.accounts()`, then `account.mailboxes()`, then
    `box.messages.whose({readStatus:false})()`.
  - Search uses `whose({_and:[{subject:{_contains:term}},{dateSent:{_greaterThan:since}}]})`.
  - Each message's subject, sender, `dateSent` (ISO), readStatus and content go into
    individual `try` blocks. Content is cut to a preview length.
  - Results are labelled `account — mailbox`.
  - The search term travels as JSON, which closes upstream's injection on that path.
- **Evidence:** `25d47cc`; upstream #69, #58, #30, #19.
- **Quality of the fix:** partial.
  - Search matches the subject only.
  - Results fill the limit in account → mailbox order, not newest first.
  - Unread includes Junk, Trash and Sent.
  - Mailboxes that error are skipped without a word.
  - An unparseable `sinceDate` turns into `Invalid Date`. The `whose` then throws inside every
    mailbox's `try`, so the answer is "no emails found" instead of an error.
  - Whether `account.mailboxes()` includes nested mailboxes is unverified.
  - The `unread` + `account` branch in `index.ts:492-608` is still upstream's AppleScript: quote-only
    escaping, and a `/\{([^}]+)\}/` regex that splits records on commas and colons, so subjects
    containing either are mangled.
- **Verdict:** adopt the idea (read mail in bulk with typed arguments, walk accounts explicitly).
  The mechanism is still *verify* in plan.md.
- **Scenarios:**
  - [acceptance] `listing unread mail` — `given unread messages in two accounts, reports them newest first with account and mailbox named`
  - [acceptance] `listing unread mail` — `given unread messages in Junk or Trash, leaves them out unless asked for`
  - [acceptance] `searching mail` — `given a search date that cannot be read as a date, refuses: a silent empty result looks like no mail`
  - [contract] `a mail store` — `given a search term containing quotes and backslashes, matches it literally`

### C3 Mail search is bounded by a date window and can be scoped to an account and mailbox

- **Kind:** fix (performance)
- **Context:** mail
- **Symptom:** A mail search across a Gmail-heavy setup took minutes or timed out.
- **Root cause:** Upstream iterates every message of every mailbox in AppleScript
  (`utils/mail.ts:185-235`). C2's first version had the same problem, with a subject `whose` and no
  date bound.
- **Technique:**
  - A `dateSent > since` clause goes into the `whose`. The default is 90 days back, with a
    `sinceDate` override.
  - Optional `account` and `mailbox` filter the enumeration by exact name in JS before any
    `whose` runs.
  - The tool description tells the agent to narrow its searches.
  - The commit claims about 24 s against 280 s for a 90-day window.
- **Evidence:** `e23e11e`.
- **Quality of the fix:** partial. It trades completeness for speed: mail older than 90 days is
  unsearchable unless the agent knows to widen the window, and the result doesn't say a window was
  applied. Filtering names in JS still costs one Apple event per account and mailbox.
- **Verdict:** verify: "adding `dateSent > since` to a Mail `whose` clause cuts search time about
  10× on a large IMAP account". Adopt the idea that a search result states the window it covered.
- **Scenarios:**
  - [acceptance] `searching mail` — `given no date window, searches the last 90 days and says so in the result`
  - [contract] `a mail store` — `given a mailbox of 50,000 messages, answers a 30-day search within the time budget`

### C4 Creating an event refuses to guess the calendar

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Events landed in whichever calendar came first (for this author,
  "Test-Claude-Calendar") whenever the named calendar was missing or misspelt, and the tool still
  reported success.
- **Root cause:** Upstream defaults `calendarName` to `"Calendar"` and, on any lookup error,
  `set targetCal to first calendar` (`utils/calendar.ts:266-280`).
- **Technique:** The target is the explicit `calendarName`, else the `APPLE_MCP_DEFAULT_CALENDAR`
  env var (exposed as `user_config.default_calendar` in `manifest.json`), else nothing. With no
  target, the tool fails with the list of available calendar names. The AppleScript fallback is
  gone, and an AppleScript error is paired with the list of names.
- **Evidence:** `3bb2b01` (manifest `user_config`, tests in `tests/unit/calendar.test.ts:481-540`).
- **Quality of the fix:** complete for the silent fallback. The calendar name is quote-escaped
  only. On `task/enhance` the same fork does the **opposite**: `createEvent` falls back to
  `first calendar whose writable is true` (`utils/calendar-actions.ts:28-34`).
- **Verdict:** adopt the idea.
- **Scenarios:**
  - [acceptance] `creating an event` — `given no calendar named and no default configured, refuses and lists the writable calendars`
  - [acceptance] `creating an event` — `given a calendar name that does not exist, refuses rather than writing to another calendar`
  - [acceptance] `creating an event` — `given no calendar named and a default configured, writes to the default`

### C5 Updating an event changes start and end together

- **Kind:** feature
- **Context:** calendar
- **Symptom:** Upstream couldn't edit events (only search, open and create). Moving a meeting
  later failed with "start date must be before end date".
- **Root cause:** Upstream has no update. Setting `start date` and `end date` one after the other
  passes through an invalid state whenever the new start is after the old end.
- **Technique:**
  1. Find the event's calendar by looping calendars with `every event of cal whose uid is …`.
  2. Build a single `set properties of targetEvent to {summary:…, start date:date "…", …}`
     record inside that calendar only.
  3. Validate dates and end > start before running.
- **Evidence:** `05e1ed7`, restructured in `c9727ec`; tests `tests/unit/calendar-update.test.ts`.
  `task/enhance` has its own update (`29af0a2`, `60f9977`) that sets fields one line at a time and
  so still hits the invalid-intermediate-state error.
- **Quality of the fix:** partial.
  - String-built with quote-only escaping.
  - Dates go through `toLocaleString()`.
  - Success means the script didn't throw. Nothing is read back.
  - For a recurring event, the uid lookup edits the series.
  - Finding the event scans every calendar in turn.
- **Verdict:** adopt the idea (an update is one atomic change of the fields given). EventKit's
  `save(_:span:)` makes the span explicit.
- **Scenarios:**
  - [acceptance] `rescheduling an event` — `given a new start later than the old end, moves the whole event`
  - [acceptance] `updating an event` — `given only a new title, leaves its times, location and notes as they were`
  - [acceptance] `updating an event` — `reports the event as it reads back from the calendar after the change`
  - [acceptance] `updating a recurring event` — `given no span, refuses: it must say whether one occurrence or the series changes`

### C6 Moving an event to another calendar by copy and delete

- **Kind:** feature
- **Context:** calendar
- **Symptom:** Asking to move an event to another calendar failed. Calendar.app refuses
  `set calendar of event`.
- **Root cause:** Calendar's scripting dictionary doesn't allow changing an event's calendar.
- **Technique:** When `calendarName` differs from the source calendar:
  1. Read the source fields in AppleScript.
  2. Make a new event in the destination with the given or copied summary, dates, all-day flag,
     location and notes.
  3. `delete srcEvent`, then return the new uid.

  The success message admits that attendees, alarms and recurrence rules aren't copied.
- **Evidence:** `c9727ec`.
- **Quality of the fix:** wrong for a general move.
  - It silently destroys attendees, alarms, URL and recurrence.
  - Deleting a recurring source event probably removes the whole series while only one plain event
    is recreated (verify).
  - The event's identity (uid) changes, so any reference the agent holds breaks.
  - Invitations from other organisers can't be recreated at all.
- **Verdict:** reject: silent data loss. With EventKit, `EKEvent.calendar` is settable, so a move is
  a single save.
- **Scenarios:**
  - [acceptance] `moving an event to another calendar` — `keeps its attendees, alarms and recurrence`
  - [contract] `an event store` — `given an event moved to another calendar, keeps the same identifier`

### C7 Tool arguments are validated by schema at the MCP edge

- **Kind:** hardening
- **Context:** cross-cutting
- **Symptom:** Upstream's hand-written type guards (`index.ts:1330-1660`) were easy to leave
  behind. Wrongly typed arguments came back as "Invalid arguments" with no detail (#8, #15).
- **Root cause:** A low-level `Server` with `setRequestHandler` does no validation of its own.
- **Technique:** Moves to `McpServer.registerTool` with zod 4 `inputSchema` per tool. The tool
  surface is otherwise upstream's (one tool per app with an `operation` enum, plus `update` and
  `calendars` on calendar and `sinceDate` on mail). `tools.ts` is emptied.
- **Evidence:** `7c36fdc` (with dependency bumps: SDK 1.29, zod 4, mcp-proxy 6).
- **Quality of the fix:** partial. The fields are typed, but "required for operation X" is
  still described in prose and checked by hand with `!` non-null assertions (e.g. `searchText!`,
  `name!`, `title!` in `index.ts:789,817,968`). On `task/enhance`, which kept the low-level `Server`,
  the guards are gone and arguments are only cast (see C13).
- **Verdict:** adopt the idea (already in plan.md: zod at `mcp/`). Model per-operation required
  fields as separate tools (Decision 2 B) so the schema carries them.
- **Scenarios:**
  - [acceptance] `any tool` — `given an argument of the wrong type, refuses and names the argument and the type expected`

### C8 Unit tests that mock the script runner

- **Kind:** infra
- **Context:** cross-cutting
- **Symptom:** Upstream's only tests drive the real apps.
- **Root cause:** No seam: the utilities call `runAppleScript` directly.
- **Technique:** `bun:test` `mock.module("run-applescript")` and `mock.module("@jxa/run")`, with
  canned results per call. 4,000+ lines across every util. CI runs them on `ubuntu-latest`.
- **Evidence:** `05e1ed7`, updated in `25d47cc`, `e23e11e`, `3bb2b01`, `c9727ec`; CI tolerance
  `87b1ae3`.
- **Quality of the fix:** poor as a specification. Most tests pin upstream's stubs as intended
  behaviour ("should return empty array (performance stub)",
  `tests/unit/reminders.test.ts:137,216,394`). They also pin upstream's test-gaming code, where
  `openEvent` fails for any id containing `"12345"` (`tests/unit/calendar.test.ts:699`). Almost
  every name is "should …". The JXA tests never run the JXA function, so the query logic
  (C1/C2 predicates) is untested.
- **Verdict:** reject: mocks at the script-string level test the call graph, not behaviour. The
  plan's fake ports plus contracts against the real adapter replace them.
- **Scenarios:** none (infra).

### C9 The released skill and plugin point at software the fork doesn't ship

- **Kind:** fix (a defect this fork introduced)
- **Context:** other:distribution
- **Symptom:** A user who installs the ClawHub skill or follows `SKILL.md` runs upstream's archived
  npm package, injection holes included, not this fork. A user who installs the Claude plugin gets a
  server that can't start.
- **Root cause:** `SKILL.md` (published to ClawHub and zipped into the `.skill` release asset) says
  `"command": "npx", "args": ["-y", "apple-mcp"]` and links npmjs `apple-mcp`. That name belongs to
  upstream's author, and `docs/submissions/README.md` itself says the fork isn't on npm.
  `.mcp.json` launches `${CLAUDE_PLUGIN_ROOT}/dist/bundle.js`, but only `dist/index.js` is
  committed on `main`. `plugin.json` and `marketplace.json` are stuck at version 2.0.3 while the
  package is 2.0.5.
- **Technique:** n/a (a defect).
- **Evidence:** `b3909e9`, `a731f24`, `8d10035`; the bot bumps don't touch the plugin files.
- **Quality of the fix:** wrong.
- **Verdict:** reject. Lesson for Phase 4: every install path in docs and registries has to be
  checked against the artefact actually published.
- **Scenarios:** none (infra).

### C10 Release pipeline: tag, bump, GitHub Release, ClawHub

- **Kind:** infra
- **Context:** other:distribution
- **Symptom:** n/a (the fork wanted one-click releases).
- **Root cause:** n/a.
- **Technique (main):**
  - **`tag-and-bump.yml`** (manual dispatch): runs CI, checks out with `secrets.RELEASE_PAT`, tags
    the current version, `npm version patch`, `sed`s the version into `index.ts`, rewrites
    `manifest.json`, runs `bun run build`, then `git add -A`, commits as `github-actions[bot]` and
    pushes `main` and the tag.
  - **`release.yml`** (on `v*` tag): runs CI, builds, zips `SKILL.md` into
    `apple-mcp-<v>.skill`, `bun run bundle`, `bunx @anthropic-ai/mcpb pack` → `.mcpb`, then
    `npx --yes clawhub login --token "$CLAWHUB_TOKEN"` and `npx --yes clawhub publish .`
    (`continue-on-error`, failures swallowed), then `softprops/action-gh-release` uploads both
    files.
- **What exactly it publishes:**
  - **GitHub Release:** a `.skill` zip holding only `SKILL.md`, and a `.mcpb` built from the CI
    workspace with `.mcpbignore` (which excludes `utils/` and `tests/`, so the bundle carries
    `dist/` built in CI).
  - **ClawHub:** `clawhub publish .` uploads the **whole repository root**. `clawhub` 0.9.0's
    `listTextFiles` keeps every file with a text extension (`js`, `ts`, `json`, `md`, `yml`, `sh`,
    `env`, …) that isn't in `.git/`, `node_modules/` or `.gitignore`. That covers all source, tests,
    workflows, `CLAUDE.md`, the CI-mutated `manifest.json`, and `dist/index.js` and `dist/bundle.js`
    (both un-ignored by `!dist/…` in `.gitignore`). So the ClawHub "skill" ships a
    minified bundle built in CI that nobody reviewed. The CLI version isn't pinned, so the upload
    rules are whatever `npx` resolves on the day (0.23.x by now).
- **Supply-chain findings:**
  - **Actions pinned by mutable tag, not SHA:** `actions/checkout@v6.0.2`,
    `actions/setup-node@v6.3.0`, `softprops/action-gh-release@v3.0.0`, and
    `oven-sh/setup-bun@v2`, a floating major.
  - **Unpinned toolchain:** `bun-version: latest` in every job, and `npx --yes clawhub` with no
    version while it holds `CLAWHUB_TOKEN`.
  - **Token on argv:** `clawhub login --token "$CLAWHUB_TOKEN"` puts the token in the process
    arguments. Masked in logs, but visible to anything in the job that lists processes.
  - **PAT exposure:** `tag-and-bump` checks out with `RELEASE_PAT` and the default
    `persist-credentials: true`. The PAT then sits in `.git/config` for `bun install`, the build and
    `npm version`, so anything those run can push to the repo. Bun doesn't run dependency lifecycle
    scripts by default, which narrows this. PAT scope unknown.
  - **Unreviewed build output committed to `main`:** the bot's `git add -A` commits whatever
    the build produced (`01c1e71` added the 1,045-line minified `dist/index.js`). Later human commits
    (`25d47cc`, `e23e11e`, `3bb2b01`, `c9727ec`) hand-edit the same file in their diffs, so
    the committed bundle is never checked against the source.
  - **Failures hidden:** the ClawHub step has `continue-on-error` plus `|| true` and `|| echo`, so a
    failed or partial publish looks green.
  - **Tags push-trigger releases:** anyone with push rights can cut a release by pushing a `v*`
    tag. The release job has `contents: write`.
  - **No provenance, no checksum or signature** on the `.mcpb`.
  - **No secrets committed on `main`.** No telemetry found in `dist/index.js`: the only URLs are
    JSON-schema and ajv references.
- **Evidence:** `056c109`, `87b1ae3`, `b3909e9`, `b4dec96` (dropped npm publish, `private: true`),
  `7c36fdc` (workflow rename and action upgrades), `781b52c`, `1bed392`, `a731f24`, `8d10035`,
  `49d61fe`, `fa6c6fe`; bot commits `bbbafa6`, `f502364`, `01c1e71`, `31240a0`, `28ce002`.
- **Quality of the fix:** works, but it's insecure and publishes more than intended.
- **Verdict:** reject the pipeline. Adopt its lessons for Phase 4:
  - pin actions by SHA and pin every CLI version;
  - `persist-credentials: false`;
  - never commit build output;
  - publish an explicit allowlist of files;
  - fail loudly;
  - attach checksums or provenance.
- **Scenarios:** none (infra).

### C11 Contacts: searching matches email addresses and returns emails as well as phones

- **Kind:** feature
- **Context:** contacts
- **Symptom:** The contacts tool returns phone numbers only, and can't find a person by email
  (#75, #47).
- **Root cause:** Upstream's contact scripts read only `phones` (`utils/contacts.ts`).
- **Technique:** `task/enhance` `mail_search_contacts` runs AppleScript
  `(every person whose name contains q) & (every person whose value of emails contains q)`,
  de-duplicates by person `id`, and returns name, all email values and all phone values.
  `utils/contacts.ts` itself only gains the escaper (`2e06954`).
- **Evidence:** `0860cf8` (`task/enhance`); upstream #75, #47.
- **Quality of the fix:** partial. It's buried in the mail tools. Labels (home or work) are dropped.
  A `,` inside a value corrupts the split. It uses the `|||` protocol (C14).
- **Verdict:** adopt the idea. Contacts.framework via the helper per plan.md.
- **Scenarios:**
  - [acceptance] `finding a contact` — `given part of an email address, finds the person it belongs to`
  - [acceptance] `finding a contact` — `reports every email address and phone number with its label`

### C12 AppleScript strings escape backslashes as well as quotes

- **Kind:** hardening
- **Context:** cross-cutting
- **Symptom:** Upstream's quote-only escaping (`s.replace(/"/g,'\\"')`) is bypassed by `\"`: the
  escaper turns it into `\\"`, a literal backslash followed by a closing quote. Many fields weren't
  escaped at all: Messages recipient, notes search term and folder name, contacts name, mail search
  term, calendar location and notes guards.
- **Root cause:** `utils/message.ts:77`, `utils/notes.ts:157,249-275`, `utils/contacts.ts:140-146`,
  `utils/mail.ts:182`, `utils/calendar.ts:276,286,290`.
- **Technique:** `utils/applescript-utils.ts` `escapeAppleScriptString` replaces `\` → `\\`, then
  `"` → `\"`. A duplicate `escapeAS` in `mail-core.ts` does the same. Applied to every string field
  in the rewritten calendar, notes, reminders, messages, mail and contacts code. Tests cover the
  classic bypass, `end tell` breakout, comment breakout, unicode and newlines
  (`tests/unit/applescript-utils.test.ts`, `tests/unit/script-injection.test.ts`).
- **Evidence:** `2e06954`, then the rewrites `18660e4`, `88b58d0`, `bf6dc37`, `29af0a2`, `60f9977`,
  `91e0101`, `6831a90`, `1a358d6`, `fa61e37` (all `task/enhance`). **Not on `main`**: `main` still
  has the upstream holes (re-verified: `utils/message.ts:77`, `utils/calendar.ts:422,426` at
  `fork-chrischall/main`).
- **Quality of the fix:** partial.
  - For string literals, backslash + quote escaping is sufficient.
  - But the approach still builds source code from input, and only string-typed fields get escaped
    (C13).
  - `script-injection.test.ts` calls `mail.searchMails` and the positional
    `notes.createNote(title, body, folder)`. The branch's rewritten modules no longer export or
    accept those, so the injection tests are stale at the branch tip.
- **Verdict:** reject the technique (plan.md: static scripts, JSON arguments). Adopt the attack
  strings as hostile-input fixtures for every contract.
- **Scenarios:**
  - [contract] `a message sender` — `given a recipient containing a backslash followed by a quote, treats it as part of the recipient and runs nothing else`
  - [contract] `a note store` — `given a folder name that closes the string and adds a command, creates a folder with that literal name`
  - [acceptance] `creating an event` — `given location and notes containing quotes and backslashes, stores them exactly as given`

### C13 Numeric and boolean arguments reach AppleScript unvalidated (new injection path)

- **Kind:** hardening (regression introduced by the fork)
- **Context:** cross-cutting
- **Symptom:** None visible. It's an exploit path: a prompt-injected tool call with
  `"limit": "0 then exit repeat\n do shell script \"…\"\n if false"` runs a shell command.
- **Root cause:** Upstream checked argument types with guards (`index.ts:1338-1384` and so on).
  `task/enhance` replaces the handlers with `args as { limit?: number }` casts (e.g.
  `index.ts:277,338,770,806`) on the low-level `Server`, which doesn't validate against
  `inputSchema`. The values are then interpolated raw:
  - `if evtCount >= ${limit}` (`utils/calendar-core.ts:210,285`)
  - `if nCount >= ${limit}` (`utils/notes.ts:57,109`)
  - `if rCount >= ${limit}` (`utils/reminders.ts:104,173`)
  - `allday event:${isAllDay}` (`utils/calendar-actions.ts:43`)
  - `msgRead = "${isRead}"` and `msgFlagged = "${isFlagged}"` (`utils/mail-core.ts:176-177`)

  Mail's `scanLimit` arithmetic yields `NaN` and fails before the loop, which protects the mail
  paths only by accident.
- **Technique:** n/a (a defect).
- **Evidence:** `9efd4ef`, `add4b64`, `209f3a4` (handlers), `bf6dc37`, `29af0a2`, `91e0101`,
  `6831a90`, `18660e4` (interpolation). `task/enhance` only.
- **Quality of the fix:** wrong.
- **Verdict:** reject. Confirms non-negotiable 1: escaping string fields isn't enough when code is
  built from input.
- **Scenarios:**
  - [acceptance] `any tool` — `given a limit that is not a whole number, refuses before touching any app`
  - [contract] `the automation runner` — `given arguments of any type, passes them as data and never as script source`

### C14 Results come back as text joined with `|||` delimiters

- **Kind:** refactor
- **Context:** cross-cutting
- **Symptom:** Upstream's AppleScript-record results came back as unparseable strings, which is why
  so much of upstream returned `[]`.
- **Root cause:** `run-applescript` returns AppleScript records as text, and upstream never
  parsed them.
- **Technique:** Every rewritten script concatenates fields with `|||` and records with
  `|||ITEM|||`, then JS splits them. Dates are rebuilt from a
  `year-month-day-hours-minutes-seconds` string built in AppleScript (`AS_DATE_STR`) so the locale
  doesn't matter.
- **Evidence:** `18660e4`, `bf6dc37`, `91e0101`, `6831a90`, `0860cf8` (`task/enhance`).
- **Quality of the fix:** wrong for hostile data.
  - A note body, email subject, event title or attendee name containing `|||ITEM|||` forges an
    extra record with attacker-chosen id, dates and calendar. One containing `|||` shifts fields.
  - Notes and mail `get` rejoin tails to soften this, but list and search don't.
  - The date reconstruction treats AppleScript's wall-clock date as local time, which is right for
    the machine's time zone but carries no time zone.
  - `main`'s JXA path returns JSON and has none of these problems.
- **Verdict:** reject (use structured JSON out of JXA, or a typed helper). Adopt the
  locale-independent date insight: never parse a locale-formatted date string.
- **Scenarios:**
  - [contract] `a note store` — `given a note whose body contains the record separator, returns exactly one note`
  - [contract] `an event store` — `given an event title containing field separators, returns the title unchanged`

### C15 Reading Messages without a shell

- **Kind:** hardening
- **Context:** messages
- **Symptom:** Upstream runs `sqlite3` through `exec` with the query inside double quotes in a
  shell command (`utils/message.ts:244,308,434`). Any `"`, `$` or backtick in the SQL is
  shell-interpreted.
- **Root cause:** `execAsync(\`sqlite3 -json "${db}" "${query}"\`)`.
- **Technique:** `runSqlite` uses `spawn('sqlite3', ['-json', dbPath, query])` with no shell.
  Phone input is reduced to `[0-9+]` before being spliced into `WHERE h.id IN (…)`. `messageId`
  comes from the database. Retry, schedule and the AppleScript fallbacks are removed. The
  `attributedBody` regex decoder is moved to `utils/phone-utils.ts` unchanged, with tests.
- **Evidence:** `2e06954`, `fa61e37`, `f1f2bb1` (`task/enhance`); tests `tests/unit/phone-utils.test.ts`.
- **Quality of the fix:** partial.
  - SQL is still a string. It's safe only because of the digit filter and `Math.min(limit, 50)`
    coercion.
  - Still depends on the `sqlite3` binary on `PATH`.
  - Normalisation is US-only: anything not matching the `+1`/10-digit patterns gets `+1` prepended
    (a UK `+44…` becomes `+1+44…`), and email handles can't be read at all.
  - The regex `attributedBody` decoder remains.
- **Verdict:** adopt the idea (no shell). Plan already goes further: `node:sqlite` prepared
  statements. Reject the normalisation rules.
- **Scenarios:**
  - [domain] `a handle` — `given a phone number with an international prefix, keeps its country code`
  - [domain] `a handle` — `given an email address, is used as the handle unchanged`
  - [acceptance] `reading a chat` — `given the other person uses an iMessage email address, reports their messages`

### C16 Sending a message reports a boolean with no retry or scheduling

- **Kind:** refactor
- **Context:** messages
- **Symptom:** Upstream's send retried blindly, "scheduled" sends with an in-process `setTimeout`
  that died with the server, and reported "Message sent" no matter what happened.
- **Root cause:** `utils/message.ts` (upstream) retry wrapper and `scheduleMessage`.
- **Technique:** `sendMessage` returns `true` if the AppleScript didn't throw, `false` otherwise.
  The tool maps that to `isError`. The schedule operation is removed.
- **Evidence:** `fa61e37`, `209f3a4` (`task/enhance`).
- **Quality of the fix:** partial. "No AppleScript error" isn't "delivered": `buddy "…"` doesn't
  check the service (the `targetService` variable is set and never used), and nothing reads
  `chat.db` afterwards. There's no confirmation and no known-recipient check.
- **Verdict:** reject as a success signal (non-negotiable 3). Adopt the removal of the fake
  in-process scheduler.
- **Scenarios:**
  - [acceptance] `sending a message` — `given the send raised no error but no outgoing message appears in the store, reports the outcome as unconfirmed`
  - [acceptance] `scheduling a message` — `refuses when the schedule would not survive the server stopping`

### C17 One tool per operation (58 tools)

- **Kind:** refactor
- **Context:** cross-cutting
- **Symptom:** A single tool with an `operation` enum hides which arguments each operation needs
  and how risky it is.
- **Root cause:** Upstream's `tools.ts` design.
- **Technique:** `task/enhance` defines 58 flat tools: `notes_*` (5), `reminders_*` (5),
  `messages_*` (3), `calendar_*` (10), `mail_*` (33), plus `contacts` and `maps`. Each has its own
  JSON Schema with `required` fields. No tool annotations.
- **Evidence:** `038ce2e`, `9efd4ef`, `0703ad1`, `473181a`, `add4b64`, `815f121`, `209f3a4`
  (`task/enhance`).
- **Quality of the fix:** partial. The schemas are declared but never enforced (C13). No
  `readOnlyHint` or `destructiveHint`. Destructive tools (`mail_delete`, `mail_batch_delete`,
  `calendar_delete`, `mail_disable_rule`) sit next to reads with no gate.
- **Verdict:** adopt the idea (supports Decision 2 option B), with annotations and write gating.
- **Scenarios:**
  - [acceptance] `the tool list` — `given write capabilities are not enabled, offers no tool that changes data`
  - [acceptance] `the tool list` — `marks every tool that deletes data as destructive`

### C18 Calendar: free/busy and finding open slots

- **Kind:** feature
- **Context:** calendar
- **Symptom:** No way to ask "when am I free for 30 minutes on Thursday?".
- **Root cause:** Not in upstream.
- **Technique:** `getFreeBusy` lists events with `start date >= rangeStart and start date <= rangeEnd`
  per calendar, skipping calendars with more than 150 events unless one is named.
  `findAvailableSlots` is pure JS:
  1. Clip busy blocks to the range and sort by start.
  2. Walk a cursor forward, emitting gaps of at least `durationMinutes`.
  3. Advance the cursor to `max(cursor, blockEnd)`, which merges overlaps.
- **Evidence:** `d1c60f3`, `4f327fd` (`task/enhance`).
- **Quality of the fix:** partial.
  - The gap arithmetic is right.
  - The input is wrong: filtering on start date misses a meeting that began before the range and is
    still running, so that time is reported free.
  - Big calendars (most real work calendars) are silently skipped without a name.
  - Recurring occurrences are probably missed (verify).
  - All-day and "free"-availability events count as busy.
  - Declined invitations count as busy.
- **Verdict:** adopt the idea (the slot finder is a pure domain rule). Reject the busy-block source.
- **Scenarios:**
  - [domain] `finding open slots` — `given busy blocks that overlap, treats them as one busy period`
  - [domain] `finding open slots` — `given a gap shorter than the duration asked for, does not offer it`
  - [domain] `finding open slots` — `given a meeting that began before the range, treats the start of the range as busy until it ends`
  - [domain] `finding open slots` — `given an event marked as free, does not count it as busy`
  - [acceptance] `finding open slots` — `given a calendar too large to scan, refuses to answer rather than reporting its time as free`

### C19 Calendar: get, delete and open an event by uid; list calendars with colour and writability

- **Kind:** feature
- **Context:** calendar
- **Symptom:** Upstream's `openEvent` just activates Calendar and fakes failure for ids containing
  `12345` (`utils/calendar.ts:329-346`). It has no get and no delete.
- **Root cause:** Upstream stubs.
- **Technique:**
  - `getEvent`, `deleteEvent` and `openEvent` loop every calendar with
    `events of cal whose uid is targetUID`. `openEvent` uses `show`.
  - `8c12640` removes the size guard from `getEvent` so any event returned by a list can be fetched
    again.
  - `listCalendars` returns name, colour and `writable`.
  - `createEvent` returns only ok or fail, not the new uid.
- **Evidence:** `bf6dc37`, `8c12640`, `29af0a2`, `60f9977` (`task/enhance`).
- **Quality of the fix:** partial.
  - Delete by uid on a recurring event deletes the series, with no span choice.
  - Create doesn't return the identifier, so the agent can't follow up.
  - Delete reports "ok" without checking the event is gone.
  - Create silently falls back to the first writable calendar (contradicts C4).
- **Verdict:** adopt the idea (get by identifier, writable flag on calendars). Delete is out of the
  first write slice.
- **Scenarios:**
  - [acceptance] `creating an event` — `reports the new event's identifier so it can be opened or changed later`
  - [acceptance] `listing calendars` — `says which calendars can be written to`
  - [acceptance] `deleting a recurring event` — `given no span, refuses: it must say whether one occurrence or the series goes`

### C20 Mail reads: search with filters, list a mailbox, get a message, unread count, accounts and mailboxes

- **Kind:** feature
- **Context:** mail
- **Symptom:** Upstream has no way to open one message, count unread mail or list mailboxes with
  counts.
- **Root cause:** Not in upstream.
- **Technique:** String AppleScript with `|||` records (all `task/enhance`):
  - **`searchMessages`:**
    - Opens `mailbox "<name>"` (default `INBOX`) in one account. With no account named, that's the
      *first* account only.
    - Scans only `messages 1 thru min(limit*2, 30)`.
    - Applies optional filters on subject/sender contains, recipients, read and flagged status, and
      `date "<raw string>"` bounds.
  - **`listMessages`:** the first `limit` messages, or up to 50 scanned for unread.
  - **`getMessage`:** numeric id checked by `/^\d+$/`. Every mailbox of every account is looped
    with `whose id is N`. Returns subject, `content`, and `source` as "htmlContent".
  - **`getUnreadCount`:** sums `unread count` over the mailboxes.
  - **`listAccounts`:** name, first email address, enabled.
  - **`listMailboxes`:** name, unread count and message count, for the first account unless one
    is named.
- **Evidence:** `18660e4`, `88b58d0`, `0860cf8` (`task/enhance`).
- **Quality of the fix:** partial to wrong.
  - "Search" looks at no more than 30 messages of one mailbox of one account, so older mail is
    never found, and the result doesn't say so.
  - `date "<caller string>"` depends on the locale.
  - `source` is the raw MIME message (headers and base64 attachments), not HTML.
  - Whether `messages 1 thru N` are the newest is unverified.
  - Mail message ids are looked up across every mailbox, which is slow.
  - The numeric id check is a good small idea.
- **Verdict:** adopt the ideas: the numeric message identifier, unread count per mailbox, and
  accounts with their email addresses. Reject the scan-30 "search". Mechanism per plan.md
  (*verify*).
- **Scenarios:**
  - [acceptance] `reading a message` — `given an identifier that is not a message identifier, refuses before touching Mail`
  - [acceptance] `searching mail` — `given no account named, searches every account and names the account of each result`
  - [acceptance] `searching mail` — `given a match older than the most recent messages, still finds it`
  - [acceptance] `counting unread mail` — `reports the count for each mailbox of each account`

### C21 Mail actions: mark, flag, move, delete, reply, forward, draft, batches of up to 100

- **Kind:** feature
- **Context:** mail
- **Symptom:** Upstream can only send.
- **Root cause:** Not in upstream (#51 asked for management).
- **Technique:**
  - `findMsgScript` finds a message by numeric id across all mailboxes and runs an operation on
    it: `set read status`, `set flagged status of msg to true`, `delete msg`, or `move msg to
    mailbox … of account …` (defaults to `account 1`).
  - Reply and forward use `reply msg with opening window`, prepend the body, then `send`
    immediately.
  - The draft makes an invisible `outgoing message` and never saves it.
  - Batch operations run up to 100 single operations concurrently with `Promise.all`, each one
    re-scanning every mailbox.
- **Evidence:** `1a45550`, `bfa14df`, `9a62bc9`, `c9f9c48` (`task/enhance`).
- **Quality of the fix:** partial.
  - Success means "the script returned ok", with no read-back.
  - Reply and forward send without confirmation.
  - Batches launch up to 100 concurrent osascript processes against Mail.
  - The move defaults to account 1.
  - Whether the draft persists is unverified (it's probably discarded when the handle is released).
  - `set flagged status … to true` depends on a coercion to 1.
- **Verdict:** out of v1 scope for delete, move, flag and batch. Reply and draft belong to the later
  mail slice, behind confirmation. Verify: "an `outgoing message` made with `visible:false` and
  never saved appears in Drafts".
- **Scenarios:**
  - [acceptance] `replying to a message` — `given the user has not confirmed this reply, refuses to send it`
  - [acceptance] `creating a draft` — `reports success only once the draft is found in the Drafts mailbox`

### C22 Mail attachments: send any file on disk; save an attachment under the home folder

- **Kind:** feature
- **Context:** mail
- **Symptom:** Upstream can't attach or save attachments.
- **Root cause:** Not in upstream.
- **Technique:**
  - `sendEmail({attachments})` accepts any absolute path that exists and adds it with
    `make new attachment with properties {file name:POSIX file "…"}`, then sends immediately.
  - `saveAttachment` checks `attachmentName` for `/`, `\`, NUL and `..`. It resolves `savePath`
    and requires the final path to start with `$HOME/`, `/tmp/`, `/private/tmp/` or `/Volumes/`,
    then `save att in POSIX file`.
- **Evidence:** `18660e4`, `0860cf8`, `d401ca1` (`task/enhance`).
- **Quality of the fix:** wrong.
  - **Exfiltration:** one prompt-injected call can mail `~/.ssh/id_ed25519`, the Messages
    `chat.db` or keychain exports to any address with no confirmation.
  - **Persistence:** an attacker's email attachment named `x.plist` can be saved into
    `~/Library/LaunchAgents`, or dropped at any dotfile path, because all of `$HOME` is allowed.
  - The prefix check doesn't resolve symlinks.
- **Verdict:** reject. Attachments are out of v1 scope. If added later: outgoing attachments only
  from a user-configured folder, saves only into a dedicated downloads folder, both confirmed.
- **Scenarios:**
  - [acceptance] `sending an email` — `given an attachment outside the folders the user allowed, refuses: a tool call must not mail arbitrary files`
  - [acceptance] `saving an attachment` — `given a destination outside the configured download folder, refuses`

### C23 Mail rules toggling and local email templates

- **Kind:** feature
- **Context:** mail
- **Symptom:** n/a (convenience).
- **Root cause:** Not in upstream.
- **Technique:**
  - `listRules`, `enableRule` and `disableRule` go through AppleScript `rules`.
  - Templates are CRUD in a plain JSON file at `~/.apple-mcp-templates.json`. They aren't Mail's
    own stationery.
- **Evidence:** `0860cf8`, `0703ad1` (`task/enhance`).
- **Quality of the fix:** partial. Disabling a rule (e.g. a phishing filter) is a quiet, harmful
  action. Templates aren't Mail data.
- **Verdict:** out of v1 scope.
- **Scenarios:**
  - [acceptance] `the tool list` — `offers no way to change the user's mail rules`

### C24 Notes: search full note text, list by folder, get a note, create in a named folder

- **Kind:** fix
- **Context:** notes
- **Symptom:** Notes search didn't find text in the body (#67). Folder names with quotes broke
  scripts. There was no way to fetch one note or list folders.
- **Root cause:** Upstream's search reads `body` or `name` in a loop with the search term spliced
  unescaped (`utils/notes.ts:150-200`). Its folder handling splices `folderName` unescaped
  (`:249-275`).
- **Technique:**
  - `searchNotes` loops `notes` (or `notes of folder "…"`), reads `plaintext of n`, and tests
    `name contains q or plaintext contains q`. It returns name, folder (`name of container`) and a
    200-character preview.
  - `getNote` does an exact name match and returns the full plaintext.
  - `listFolders` returns folder names.
  - `createNote` finds the folder by name, creates it if missing, and writes the body with the
    upstream temp-file trick.
- **Evidence:** `91e0101`, `68dc2b7` (`task/enhance`); upstream #67, #22.
- **Quality of the fix:** partial.
  - Every note's full plaintext is fetched, one Apple event per note, so it's slow on large
    libraries.
  - Folders are identified by name, across accounts, so iCloud "Notes" and On My Mac "Notes"
    collide.
  - `getNote` by name returns the first of several notes with the same name.
  - A folder is created silently when the name is misspelt.
  - The temp file lives at a predictable `/tmp/note-content-<ms>.txt` (symlink race).
  - The plain-text body goes into the HTML `body`, so formatting is lost.
- **Verdict:** adopt the idea (search the plain text; report the folder). Mechanism *verify* per
  plan.md.
- **Scenarios:**
  - [acceptance] `searching notes` — `given text that appears only in a note's body, finds the note`
  - [acceptance] `creating a note` — `given a folder name that does not exist, refuses and lists the folders rather than creating one`
  - [acceptance] `reading a note` — `given two notes with the same name, refuses and asks which one: names are not identities`

### C25 Reminders: lists, listing, search, create with list, notes and due date, complete by id

- **Kind:** fix
- **Context:** reminders
- **Symptom:** Listing and searching reminders returned nothing. Creating ignored the list, notes
  and due date (#64, #59). Listing timed out on big lists (#53).
- **Root cause:** Upstream's `getAllReminders` and `searchReminders` are stubs returning `[]`
  (`utils/reminders.ts:140-217`). `createReminder` always uses the first list and only sets `name`
  (`:249-262`).
- **Technique:**
  - **Batched property fetches:** one Apple event per property for the whole filtered set, e.g.
    `set ids to id of (reminders of l whose completed is false)`, then `name of …`, `due date of …`,
    `priority of …`, zipped by index. Body is left out as too slow.
  - **Search** puts the filter into the `whose`
    (`whose completed is false and name contains "q"`) so a miss costs almost nothing.
  - **Lists with more than 200 reminders** are skipped unless one is named.
  - **Create** targets `first item of (lists whose name is "…")` (an error if missing, so it
    returns false), then sets `body` and a due date from `formatDateForAppleScript`.
  - **Complete** loops every list with `whose id is "…"`.
  - `1a358d6` removes `activate` from reads. Create and complete still activate the app.
- **Evidence:** `6831a90`, `1a358d6`, `b6a4ec6`, `2846497` (`task/enhance`); upstream #53, #64, #59,
  #26, #10.
- **Quality of the fix:** partial.
  - The batched fetch is a real performance insight.
  - Big lists are skipped silently.
  - Search covers names of incomplete reminders only, not notes.
  - Due dates come back as `as string` (locale-formatted).
  - The due date goes in via an en-US `date "March 30, 2026 at 2:30:00 PM"` string. The comment
    calls this locale-independent, but AppleScript parses date strings with the *system* locale
    (verify).
  - Success isn't read back.
- **Verdict:** adopt the ideas (fetch properties in bulk and filter in the store; create honours
  list, notes and due time). EventKit per plan.md makes the date problem moot.
- **Scenarios:**
  - [acceptance] `creating a reminder` — `given a list, notes and a due time, stores all three and reports them as read back`
  - [acceptance] `creating a reminder` — `given a list that does not exist, refuses and lists the reminder lists`
  - [acceptance] `listing reminders` — `given a list too large to read within the time budget, says which list was not read`
  - [domain] `a due time` — `given a due time without a time zone, reads it in the user's time zone`
  - [contract] `a reminder store` — `given a system locale that is not US English, stores the due time exactly as given`

### C26 Branch packaging: `.mcpb` bundles and the npm publish of a name it doesn't own

- **Kind:** infra
- **Context:** other:distribution
- **Symptom:** n/a.
- **Root cause:** n/a.
- **Technique:**
  - `task/enhance` adds its own CI, `bump-version.yml` (PAT, `npm version`, push with tags) and
    `release.yml`.
  - `release.yml` runs `npm publish --access public --provenance` with `secrets.NPM_TOKEN` for
    package `apple-mcp`, which belongs to upstream's author. It would fail or, worse, publish if the
    token had rights.
  - Built `apple-mcp.mcpb` and `apple-mcp.skill` are committed to the branch.
  - The first `.mcpb` (39 MB, `2e06954`) zips the working tree: `node_modules/`, upstream's
    `apple-mcp.dxt`, and the author's **`.claude/settings.local.json`** (local username and Claude
    Code permission allowlist, no credentials).
  - `1d96a0f` adds `.mcpbignore` (down to 195 KB) and pins the SDK (1.29.0), `@types/bun` and
    `esbuild`.
  - `44a6344` deletes upstream's 27 MB `apple-mcp.dxt` and replaces the full `.gitignore` with an
    8-line one.
- **Evidence:** `2e06954`, `599505f`, `1d96a0f`, `44a6344` (`task/enhance`).
- **Quality of the fix:** wrong (committed artefacts with personal config, publishing to a name the
  fork doesn't own).
- **Verdict:** reject. Phase 4: never commit bundles; build them from a clean checkout with an
  explicit file allowlist.
- **Scenarios:** none (infra).

### C27 Integration tests against the real apps for the rewrite

- **Kind:** infra
- **Context:** cross-cutting
- **Symptom:** n/a.
- **Root cause:** n/a.
- **Technique:** `tests/integration/notes-reminders-messages.test.ts` and rewritten
  `calendar.test.ts` and `mail.test.ts` call the utilities against the real apps and assert shapes:
  "returns array", "returns boolean", "returns false for non-existent id", with long timeouts.
  `c1bf44b` raises the timeouts for not-found scans. Stale upstream integration tests are deleted
  (`68dc2b7`, `b6a4ec6`, `f1f2bb1`). The `messages_send` test really sends.
  `main` also adds `tests/integration/calendar.test.ts` (`05e1ed7`).
- **Evidence:** `0bd664e`, `c1bf44b`, `18660e4`, `1a45550`, `c9f9c48`, `0860cf8`, `bf6dc37`,
  `29af0a2`, `d1c60f3`, `68dc2b7`, `b6a4ec6`, `f1f2bb1` (`task/enhance`); `05e1ed7` (main).
- **Quality of the fix:** poor. Type-shape assertions on real user data specify nothing, and the
  send test messages a real person.
- **Verdict:** reject. The plan's contract suites replace these. Record the "not-found scan needs a
  long timeout" observation as a performance contract.
- **Scenarios:**
  - [contract] `an event store` — `given an identifier that matches no event, answers not found within the time budget`

## Noise

- Version bumps by the bot: `bbbafa6`, `f502364`, `01c1e71`, `31240a0`, `28ce002`
  (supply-chain aspects in C10).
- Dependency and lockfile updates, `CLAUDE.md` rewrite: `056c109` (and the dependency part of
  `7c36fdc`).
- `.gitignore` adds `.claude/`: `1c129c8`.
- README build and pack commands: `758d4a5`.
- Merge commit: `8d10035`.
- Superpowers-style design specs and implementation plans (docs only, no code): `628a89c`,
  `a003966`, `8ded6d8`, `8c4a3f8`, `55ec296`, `448966a` (`task/enhance`).
- `SKILL.md` and manifest tool list for the branch: part of `599505f` (`task/enhance`).

## Glossary candidates

- **calendar name:** how both branches identify a calendar. Not unique: two accounts can each
  have a "Calendar" or "Work".
- **event uid:** Calendar.app's `uid`, used as the event identifier for get, update, delete and
  open. It changes when `main`'s copy + delete "move" recreates the event. It's shared by every
  occurrence of a recurring event.
- **writable calendar:** a calendar whose `writable` is true (subscriptions and holidays aren't).
  `task/enhance` exposes this.
- **default calendar:** the user-configured calendar used when a create names none
  (`APPLE_MCP_DEFAULT_CALENDAR`). Never "whichever calendar comes first".
- **busy block:** an event's title, start, end and calendar, as input to slot finding.
- **available slot:** a gap between merged busy blocks, inside a range, at least the requested
  duration long.
- **account (Mail):** has a *name* (e.g. "iCloud", "Google") used for scoping, and one or more
  *email addresses*. `sender` must be set to an address, not the account name.
- **mailbox:** named within an account (`INBOX`, labels). The same name exists in several
  accounts.
- **message id (Mail):** Mail's numeric `id`. `task/enhance` treats it as globally findable by
  scanning every mailbox.
- **handle (Messages):** `handle.id` in `chat.db`, a phone number in E.164 or an email address.
- **attributedBody:** the archived rich-text blob holding a message's text when `message.text` is
  empty.
- **reminder list:** has an `id` and a `name`. Reminders are addressed by their own `id`.
- **note folder:** addressed by name, and the `container` of a note. Folders exist per account.
- **plaintext (note):** the note body without HTML, what search should match.
- **template (mail):** a fork-local JSON record (name, subject, body, to, cc), not Mail data.
- **rule (mail):** a Mail.app rule with a name and an enabled flag.

## Open questions

- Does Calendar.app's scripting `whose startDate … endDate …` (AppleScript or JXA) return each
  occurrence of a recurring event in the range, or only the master event? Both branches depend on
  it. Moot with EventKit, but it explains upstream #25 "missing events".
- Does `delete` on a recurring event's master (C6 move, C19 delete) remove the whole series?
- In Mail's scripting model, are `messages 1 thru N of mailbox` the newest N (C20)? Does JXA
  `account.mailboxes()` include nested mailboxes and Gmail labels (C2)?
- Does AppleScript `date "March 30, 2026 at 2:30:00 PM"` parse correctly on a Mac whose region is
  not US (C25, and the `task/enhance` calendar)? `main` uses `Date#toLocaleString()` in Node's
  locale instead. Which one breaks where? (Upstream #34 "wrong time parsing".)
- Is an `outgoing message` made with `visible:false` and never `save`d kept as a draft (C21)?
- `bun build --minify` rewrites the functions passed to `@jxa/run` before they're `toString()`ed.
  Can minification ever inject a helper reference that doesn't exist inside osascript? `main`'s
  released bundle depends on it.
- What scopes does `RELEASE_PAT` have, and which `clawhub` CLI version did the last release run
  with? That decides exactly what files went to ClawHub (C10). No tags were fetched for this remote,
  so it's also unconfirmed which versions were actually released.
- Was `task/enhance` ever built or released? Its `.mcpb` and npm steps suggest it was tried
  (`2e06954` commits a built `.mcpb`), but `main` never merged it.
