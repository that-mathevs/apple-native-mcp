# sicdigital/apple-rest-mcp

- **Remote:** `fork-sicdigital`
- **Branches read:** `main` (25 commits). `HEAD` points at `main`. There are no other branches
  and no merge commits.
- **Commits accounted for:** 25 / 25
- **Last commit:** 2026-07-21
- **In one paragraph:** One person's (Mike Chacon, SIC Digital) one-day conversion of upstream
  into a network service for a self-hosted agent called "Hermes". It follows a written design
  spec and implementation plan. It adds MCP over Streamable HTTP, a REST API at `/api/v1` with an
  OpenAPI 3.1 spec, two bearer tokens (full and "read-only"), and a LaunchAgent installer. Of
  upstream's `utils/`, only `utils/reminders.ts` changed. That rewrite is the part worth learning
  from. Upstream's reminder list, search and list-by-id were stubs that always returned `[]`, and
  create ignored the list, notes and due date. The fork makes them work with bulk AppleScript
  property fetches and returns the real reminder id. It also adds date-range filters on due and
  creation date, and converts AppleScript's localized date strings to ISO 8601 at the REST
  boundary. The date conversion only works for English locales. It has `bun:test` specs for the
  HTTP layer (auth, fail-closed config, scope guard, route shapes with mocked utils), but none for
  the reminders rewrite. **Alarming:** the server binds to `0.0.0.0` over plain HTTP by default.
  The "read-only" token only blocks sending mail and messages, and every other `utils/` file is
  still upstream's injectable code. So a holder of the read-only token can reach unescaped
  AppleScript through `GET /api/v1/contacts?name=`, `GET /api/v1/notes?folder=`,
  `GET /api/v1/mail?q=` and the MCP `calendar` create operation. With `do shell script`, that
  means running code on the Mac from the LAN (see C6).

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Reminders | AppleScript via `run-applescript`, still built from strings | Reads are one script that loops over lists and fetches each property in bulk (`name of (reminders of L whose completed is false)`) as a delimited string, zipped by index in JS. Values are escaped for `\` and `"`. The fork says per-item access hangs, and its docs say queries take about 25–35 s (*verify*). |
| Transport | stdio (default), or `MCP_TRANSPORT=http`: Hono on `Bun.serve` / `@hono/node-server`, stateless `WebStandardStreamableHTTPServerTransport` at `/mcp`, REST at `/api/v1/*` | Default `HOST=0.0.0.0`, port 3737, no TLS, CORS `*`. Needs MCP SDK 1.29.0 (upstream pinned `^1.5.0`, which has no Streamable HTTP). See C6 and C7. |

## Changes

### C1 Listing and searching reminders returns the reminders

- **Kind:** fix
- **Context:** reminders
- **Symptom:** Listing reminders, searching them or listing one list by id always reported
  nothing, on every account.
- **Root cause:** Upstream's three reads are placeholders. `getAllReminders` counts lists and
  returns `[]` (`utils/reminders.ts:147-170`). `searchReminders` returns `[]` without searching
  (`utils/reminders.ts:195-210`). `getRemindersFromListById` returns `[]`
  (`utils/reminders.ts:358-373`). The comments say real AppleScript queries were "too slow and
  unreliable".
- **Technique:** For each list (optionally only the one whose name or id matches), one script
  evaluates `name of (reminders of L whose completed is false)`, then `id of …`,
  `due date of …` and `creation date of …`. Search adds `completed of …` and filters with
  `whose name contains "<term>"` across all lists. Each property list is coerced to text with
  `AppleScript's text item delimiters` set to `character id 31`. Sections are separated by
  `id 30` and lists by `id 29`. JS splits the text and zips the pieces by index into
  `{name, id, body: "", completed, dueDate, creationDate, listName}`, turning
  `"missing value"` into `null` (`parseReminderGroups`). The commit says per-item access and
  bulk access on a captured variable "hang or error", so only inline specifiers are used.
- **Evidence:** `791f5f2`, `3cfb29d` (adds `creationDate`). Upstream #53, #26, #10 (listing
  fails or times out).
- **Quality of the fix:** partial.
  - Listing returns only incomplete reminders, and there's no option to include completed ones.
  - The result stops at 50 reminders (`MAX_REMINDERS`) without saying so.
  - `body` is always `""`, and search matches titles only, not notes.
  - Each property is fetched with its own `whose` query. If a reminder is added or completed
    between two queries, the lists have different lengths and a title gets paired with another
    reminder's id.
  - A title containing a control character 29–31 corrupts the parse.
  - Dates come back as localized text (see C4).
  - It's still a script built from strings.
- **Verdict:** adopt the idea (reads must return real data with id, list, due date, creation
  date and completion). The mechanism is replaced by EventKit, as plan.md already chooses. The
  fork's evidence that AppleScript needs about 30 s for this supports that choice.
- **Scenarios:**
  - [acceptance] `listing reminders` — `given incomplete reminders in several lists, reports each with its list, due date and creation date`
  - [acceptance] `listing reminders` — `given more reminders than the result holds, says more exist instead of presenting a partial list as complete`
  - [acceptance] `searching reminders` — `given a term that matches completed and incomplete reminders, reports both and marks which are completed`
  - [contract] `a reminder store` — `given a reminder that changes while a list is being read, reports every field of a reminder from that same reminder`

### C2 Reminder lists come back as separate lists, not one "Untitled List"

- **Kind:** fix
- **Context:** reminders
- **Symptom:** Listing reminder lists showed a single "Untitled List" with id "unknown-id".
- **Root cause:** `runAppleScript` returns the script's stdout as **text**, not structured
  records. Upstream wraps the string in an array and reads `.name` and `.id` from it, which are
  `undefined` (`utils/reminders.ts:118-126`). Calendar has the same flaw:
  `Array.isArray(result) ? result : []` is always `[]` (`utils/calendar.ts:121`).
- **Technique:** Fetches `name of lists` and `id of lists` as two delimited strings and zips them
  by index. Still stops at 20 lists (`MAX_LISTS`) without saying so.
- **Evidence:** `791f5f2`
- **Quality of the fix:** partial. The lists are right now, but a 21st list is dropped without
  notice, and a failure still returns `[]` instead of an error.
- **Verdict:** adopt the idea: a script's result must reach TypeScript as structured data. In
  plan.md's JXA runner that means JSON out, never parsing AppleScript's printed records.
- **Scenarios:**
  - [contract] `the automation runner` — `given a script that returns a list of records, hands back structured values rather than the text AppleScript prints`
  - [acceptance] `listing reminder lists` — `given lists that share a name, reports each one with its own id`

### C3 Creating a reminder uses the requested list, notes and due time, and reports the real id

- **Kind:** fix
- **Context:** reminders
- **Symptom:** A new reminder always landed in the first list, lost its notes and due date, and
  the result gave the id `"created-reminder-id"`, so the agent couldn't refer to it afterwards.
- **Root cause:** Upstream's create picks `first item of allLists`, sets only `name`, and
  returns a hard-coded id while echoing back the input `dueDate` as if it had been saved
  (`utils/reminders.ts:248-280`). Upstream #64 (no time on creation), #66 (false success).
- **Technique:** Loops over the lists to find one whose name equals `listName`, and falls back to
  the first list if none does. Sets `{name, body}`. Builds the due date field by field from the
  JS `Date`'s local parts: `set day of dd to 1` first, then year, month, day, hours, minutes,
  seconds. Setting the day first avoids month overflow, such as the 31st rolling into the next
  month. This works because AppleScript can't parse ISO strings. Returns
  `id of newReminder` and the list's real name. Contrast upstream calendar, which splices
  `start.toLocaleString()` into `date "…"` (`utils/calendar.ts:270`), so the script depends on
  Node's locale and AppleScript's locale agreeing.
- **Evidence:** `d5d5df0`
- **Quality of the fix:** partial.
  - If the list name matches no list, the reminder silently goes to the first list. Only the
    returned `listName` hints that this happened.
  - Lookup by name picks the first of several lists with the same name.
  - A date-only input such as `"2026-08-01"` is parsed by JS as midnight UTC. West of UTC the
    reminder becomes due the day before.
  - It can't create an all-day reminder.
  - The returned `dueDate` is the input converted to UTC, not a value read back from the store.
    Notes aren't checked either, and `creationDate` is `null`.
- **Verdict:** adopt the idea (honour list, notes and due time, and return the store's id).
  Reject the silent fallback to the first list (plan.md non-negotiables 3 and 5).
- **Scenarios:**
  - [acceptance] `creating a reminder` — `given a list that exists, puts the reminder in that list and reports the id the store gave it`
  - [acceptance] `creating a reminder` — `given a list name that matches no list, refuses and names the lists that exist`
  - [acceptance] `creating a reminder` — `given a due time, reports the due time read back from the store`
  - [domain] `a due date` — `given a date with no time, is an all-day date in the user's time zone, not midnight UTC`

### C4 Timestamps are ISO 8601 instead of localized text

- **Kind:** feature
- **Context:** cross-cutting (reminders, mail)
- **Symptom:** Dates came back as `"Thursday, July 30, 2026 at 12:00:00 AM"`, which an agent
  can't compare, sort or filter reliably.
- **Root cause:** Upstream coerces AppleScript dates with `as string`, which formats them in the
  Mac's locale (`utils/mail.ts:109`, `:207`, `:503`). Upstream mail also puts the current time in
  when a message has no date: `dateSent: email.date || new Date().toString()`
  (`utils/mail.ts:565`), which is a made-up value.
- **Technique:** `http/rest/dates.ts` strips a leading `Word, `, replaces ` at ` with a space, and
  passes the rest to `new Date()` in the server's time zone. An unparseable value becomes `null`.
  The route then calls `toISOString()`, which gives UTC with a `Z`. This is applied to the
  reminders `dueDate`/`creationDate` fields and the mail `dateSent` field in REST responses only.
  MCP tool results still carry the localized text.
- **Evidence:** `3c13e0d`. `tests/http/rest.test.ts` pins it for English strings only.
- **Quality of the fix:** wrong for anything but an English (US or GB) locale. Node reads
  `"Donnerstag, 30. Juli 2026 um 00:00:00"` and `"jeudi 30 juillet 2026 à 00:00:00"` as `null`,
  checked with the fork's regex under Node 23. So on a German or French Mac every date
  disappears, and C5's filters exclude every reminder. All-day dates turn into UTC instants that
  land on the previous day east of UTC. Parsing leans on the engine's lenient `Date` parser. Bun
  (JavaScriptCore) may behave differently from V8, for example on macOS's narrow no-break space
  before "AM" (*verify*). The made-up mail date passes through as if it were real.
- **Verdict:** adopt the idea (every timestamp at the boundary is ISO 8601). Reject the
  technique: never round-trip dates through localized text. Take them from the store as
  instants or components (EventKit `NSDate`, or JXA `Date`, which serializes to ISO), and keep
  date-only values as dates.
- **Scenarios:**
  - [domain] `a timestamp` — `given an instant from the store, reports it as ISO 8601 with the user's UTC offset`
  - [contract] `a reminder store` — `given a Mac set to a non-English locale, reports the same due dates as on an English one`
  - [acceptance] `reading mail` — `given a message with no sent date, reports the date as unknown rather than inventing one`

### C5 Reminders can be filtered by due date and creation date

- **Kind:** feature
- **Context:** reminders
- **Symptom:** No way to ask for "reminders created in June" or "reminders due this week".
- **Root cause:** Upstream has no reminder filters, and its reads were stubs anyway (see C1).
- **Technique:** Stripe-style query parameters `due[gte|gt|lte|lt]` and
  `created[gte|gt|lte|lt]`. Each bound goes through `new Date(raw)`, and a bad bound gives
  `400` with the parameter named. After fetching, the route keeps a reminder only if the date
  exists and meets every bound. Due and creation filters combine with AND. The docs note that
  "most reminders have no dueDate, so prefer `created[...]`".
- **Evidence:** `3cfb29d`. `tests/http/rest.test.ts` ("filters by created/due date ranges").
- **Quality of the fix:** partial.
  - The filter runs after C1's 50-reminder cap, so matches beyond the first 50 are missed.
  - A date-only bound is midnight **UTC**. So `created[lte]=2026-06-30` means 30 June 00:00 UTC
    and leaves out almost all of 30 June.
  - Any date C4 can't parse makes the reminder vanish instead of causing an error.
  - Nothing is filtered inside the store. It only works in REST, not MCP.
- **Verdict:** adopt the idea (filter reminders by due and creation date, pushed into the store
  query).
- **Scenarios:**
  - [domain] `a date range` — `given whole days, covers them from midnight to midnight in the user's time zone`
  - [acceptance] `listing reminders` — `given a due-date range, reports only reminders due inside it and leaves out reminders with no due date`
  - [acceptance] `listing reminders` — `given a range bound that is not a date, refuses and says which bound`

### C6 The server can be reached over the network (Streamable HTTP MCP and REST)

- **Kind:** feature
- **Context:** other:transport
- **Symptom:** An agent on another machine couldn't use the Mac's apps. Upstream is
  stdio-only.
- **Root cause:** Not a bug: upstream only had stdio, and its MCP SDK `^1.5.0` has no Streamable
  HTTP transport.
- **Technique:**
  - Upgrades the SDK to 1.29.0 with zod 3.25.76.
  - `MCP_TRANSPORT=http` starts Hono with an unauthenticated `/healthz` and `/openapi.yaml`, then
    bearer auth, then `/mcp` and the REST routes.
  - `/mcp` builds a new stateless `WebStandardStreamableHTTPServerTransport` and MCP server for
    each request.
  - The REST routes are GET contacts, notes, mail (+accounts, mailboxes), calendar events and
    reminders. POST notes, reminders and calendar events need the full token.
  - Serving uses `Bun.serve` with `idleTimeout: 255` so SSE streams aren't cut after 10 s, and
    falls back to `@hono/node-server`.
  - `HOST` defaults to `0.0.0.0`, and the LaunchAgent template hard-codes that too.
- **Evidence:** `509e617`, `91d7447`, `d261523`, `eef6636`, `f0994c9`, `d4888a0`, `5f6bd19`,
  `3f1fad3`, `dd291b9`. Tests are `tests/http/mcp.test.ts` (health is public, REST and MCP need
  auth, the spec is served, POST gives 401 without a token and 403 with the read token) and
  `tests/http/env.test.ts`.
- **Quality of the fix:** wrong as a security posture, even though the auth code itself is
  careful.
  - **Network-reachable injection.** Every util except reminders is upstream's code, and the
    routes pass request values straight into it. `?name=` reaches `set searchText to "${searchName}"`
    with no escaping (`utils/contacts.ts:146`). `?folder=` reaches
    `if name of currentFolder is "${folderName}"` with no escaping (`utils/notes.ts:363`). `?q=` on
    mail reaches `set searchTerm to "${cleanSearchTerm}"`, which is only lowercased
    (`utils/mail.ts:182`). All three are GETs the read-only token may call. POST
    `/calendar/events` passes `location`, `notes` and `calendarName` into
    `utils/calendar.ts:276,286,290` unescaped. Only the full token can do that over REST, but the
    **read** token can do the same through the MCP `calendar` create operation. AppleScript
    has `do shell script`, so anyone with either token can run commands as the user.
  - **Exposure.** It listens on all interfaces over plain HTTP by default, so tokens cross the
    LAN in cleartext. CORS is `*`. There's no `Origin` check, which the MCP Streamable HTTP spec
    asks for against DNS rebinding (bearer auth mitigates this). There's no rate limit.
  - **Upstream stubs exposed as features.** `GET /calendar/events` always returns `[]`, because
    upstream's `getEvents` and `searchEvents` scripts return a dummy record or an empty list and
    the text result is never an array (`utils/calendar.ts:97-121`, `:177-183`). This is upstream
    #74. Yet the commit says "calendar was already ISO", and the OpenAPI spec documents working
    filters. Notes `from`/`to` are ignored, because `getNotesByDateRange` just returns the folder
    (`utils/notes.ts:466-478`). The OpenAPI description still says REST is read-only after
    `dd291b9` added POSTs.
  - Failed writes are uneven: a reminder create that throws becomes Hono's plain-text 500, while
    notes and calendar return JSON `{error}`.
- **Verdict:** out of v1 scope. plan.md's v1 is a local stdio server. Record the exposure
  findings in `docs/security.md` as the reason any future network mode needs its own threat
  model.
- **Scenarios:**
  - [acceptance] `a server reachable over the network` — `given no explicit address to listen on, listens only on the loopback interface`

### C7 A second token that can't send mail or messages

- **Kind:** hardening
- **Context:** cross-cutting
- **Symptom:** Giving an agent network access meant giving it the power to send email and
  iMessages as the user.
- **Root cause:** Upstream has no notion of permission. Every operation is always available.
- **Technique:**
  - `MCP_AUTH_TOKEN` gives scope `full` and `MCP_READONLY_TOKEN` gives scope `read`, compared
    with `timingSafeEqual`.
  - The server won't start in HTTP mode with no token, or with two identical tokens
    (fail-closed).
  - `createMcpServer({ allowMessaging })` checks each tool call against a **deny-list** of
    `(tool, operation)` pairs: `mail:send`, `messages:send`, `messages:schedule`. A denied call
    returns an MCP result with `isError: true` and the text "not permitted for this token
    (read-only)", not a transport error.
  - REST POSTs use `requireFullScope()`, which answers `403`.
  - The design doc says the read token deliberately still reads all mail and messages and
    creates notes, reminders and events.
- **Evidence:** `e066b89`, `fa5a728` (design spec), `c36da30` (guard), `398bcd5` (auth),
  `91d7447` (fail-closed config), `dd291b9` (`requireFullScope`). Tests are
  `tests/http/scope.test.ts` (read scope rejects the three operations, using an in-memory MCP
  client), `tests/http/auth.test.ts` and `tests/http/env.test.ts`.
- **Quality of the fix:** wrong in its model, though the mechanics are tidy.
  - It's a deny-list keyed on operation strings, so any write not on the list, now or later, is
    allowed.
  - "Read-only" isn't read-only: it creates events, notes and reminders, and through C6 it can
    run code.
  - Nothing is configured per capability, and nothing asks for confirmation before a send.
  - The comparison returns early on a length mismatch, which leaks the token length
    (negligible).
- **Verdict:** adopt the idea (check the capability at the call boundary, fail closed, and
  refuse with a readable tool error). Reject the deny-list. plan.md non-negotiable 2 calls for
  writes off unless configured, as an allow-list.
- **Scenarios:**
  - [acceptance] `a server whose writes are not enabled` — `given a request to create an event, refuses and names the setting that enables it`
  - [domain] `the capability settings` — `given a write capability nobody configured, treats it as off`
  - [acceptance] `a refused operation` — `reports the refusal as a tool error the agent can read, not a protocol failure`

### C8 Results come in pages with a common envelope

- **Kind:** feature
- **Context:** cross-cutting
- **Symptom:** Upstream returns free text of varying shape, with no way to page through large
  results.
- **Root cause:** Every upstream tool formats its own prose string (`index.ts`).
- **Technique:** REST responses are `{ data: [...], pagination: { limit, offset, count } }`.
  `limit` is clamped to 1–1000 (default 100) and `offset` is at least 0. The route slices
  after the util returns. Contacts come back as `{ name, phones[] }`.
- **Evidence:** `d261523`, `eef6636`. `tests/http/rest.test.ts` (pagination helpers, per-route
  shapes with mocked utils).
- **Quality of the fix:** partial.
  - `count` is the size of the page, not how many matched, and nothing says whether more exist.
  - Mail and calendar ask the util for only `limit` rows and then skip `offset` of them, so any
    `offset > 0` returns a short or empty page.
  - A non-numeric `limit` becomes `NaN` and gives an empty page with no error.
  - Reminders never go past 50 (C1).
  - Contacts still carry only phone numbers (upstream #75).
- **Verdict:** adopt the idea (structured results that say whether more exist). Reject the
  `count` and offset semantics.
- **Scenarios:**
  - [acceptance] `a page of results` — `given more matches than the page holds, says more exist and how to ask for the next page`
  - [acceptance] `a page of results` — `given a page size that is not a number, refuses and says what it accepts`

### C9 The MCP server is built separately from its transport, and starts once

- **Kind:** refactor
- **Context:** cross-cutting
- **Symptom:** Upstream could connect a second stdio transport. If loading the modules took
  longer than 5 s, the timeout started the server, and when the eager load finished later it
  started it again.
- **Root cause:** Both the timeout callback and the eager loader call `initServer()` with no
  guard (`index.ts:93-104`, `:138-142`, `:162-167` at upstream/main). The server and its
  handlers are also built inside the function that connects stdio.
- **Technique:** Moves the tool list and call handler into `mcp/server.ts`
  `createMcpServer(options)`, which never connects a transport. `index.ts` keeps upstream's
  eager/lazy loading, adds a `started` flag so `start()` runs once, and picks stdio or HTTP.
  This makes the in-memory MCP client test in `scope.test.ts` possible. It also un-ignores
  `/mcp/` in `.gitignore`, whose bare `mcp` rule was hiding the new directory.
- **Evidence:** `c36da30`
- **Quality of the fix:** complete for the race. The eager/lazy "safe mode" machinery itself is
  kept.
- **Verdict:** adopt the idea (the server is composed without a transport, and acceptance specs
  drive it through an in-memory client), which plan.md already implies. The loading-timeout
  design doesn't carry over.
- **Scenarios:**
  - [acceptance] `the server` — `given an in-memory client, offers the same tools as over stdio`

### C10 Runs persistently as a LaunchAgent in the user's session

- **Kind:** infra
- **Context:** other:deployment
- **Symptom:** The server stopped when the terminal closed and didn't come back after a reboot.
- **Root cause:** Upstream is launched by the MCP client, so it has no persistent mode.
- **Technique:** `deploy/install-launchagent.sh` fills in a plist template with `sed` (bun path,
  repo, port, both tokens) and loads it with `RunAtLoad` and `KeepAlive`. Logs go to
  `~/Library/Logs/apple-mcp.*.log`. The design notes say it must be a **LaunchAgent, not a
  LaunchDaemon**: AppleScript automation needs the logged-in GUI session and its TCC grants, and
  the Automation prompts must be approved once while logged in. Reading Messages may need Full
  Disk Access for `bun` or the terminal.
- **Evidence:** `3c8ec13`
- **Quality of the fix:** partial. Tokens are stored in plain text in the plist; `~/Library` is
  `700` by default. A token containing `|` or `&` breaks the `sed` substitution. `HOST=0.0.0.0`
  is hard-coded.
- **Verdict:** out of v1 scope. The session and TCC constraint belongs in the install docs and in
  Decision 3 (how permission prompts are attributed).
- **Scenarios:** none (the install-docs note above).

### C11 Reminder text is escaped for backslashes as well as quotes

- **Kind:** hardening
- **Context:** reminders
- **Symptom:** A reminder title or list name containing `\"` could break out of the AppleScript
  string.
- **Root cause:** Upstream escapes only `"` (`utils/reminders.ts:244-246`). Input `\"` becomes
  `\\"`, which AppleScript reads as an escaped backslash followed by a closing quote.
- **Technique:** `escapeAppleScript` replaces `\` with `\\` first, then `"` with `\"`. It's used
  for the name, notes and list name on create, the list filter, the search term and the list id.
  Numeric date parts are spliced in as JS numbers.
- **Evidence:** `791f5f2`, `d5d5df0`
- **Quality of the fix:** complete for the AppleScript string literals in `utils/reminders.ts`
  (raw newlines are legal inside them). The same pattern isn't applied to any other util (see
  C6).
- **Verdict:** reject: values reach scripts only as JSON arguments, never spliced (plan.md
  non-negotiable 1). Keep the input as a hostile-input example.
- **Scenarios:**
  - [contract] `the automation runner` — `given a value containing quotes, backslashes and AppleScript source, passes it to the script as data and never runs it`

## Noise

- Implementation plan document: `da0f965`
- README and USAGE docs: `98b4afe`, `73154b6`, `9849c70`, `cd15fe0`
- Package and manifest identity, version bump to 2.0.0, test script pointer: `6d3e786`, `ca978bd`

## Glossary candidates

- **reminder list:** a named container of reminders with its own id. Names aren't unique, so the
  fork looks lists up by name for create and by id for `listId`.
- **reminder:** `{name, id, body, completed, dueDate, creationDate, listName}`. A reminder
  belongs to exactly one list. Most have no due date, so creation date is the reliable time axis.
- **due date:** an optional date-time on a reminder. The fork always sets a time and can't tell
  an all-day due date from a timed one.
- **creation date:** when the reminder was created. The store sets it and it can't be set on
  create.
- **completed:** whether a reminder is done. Listing leaves completed reminders out, and search
  includes them.
- **scope / token:** what a network client may do. `full` means everything and `read` means
  everything except sending mail or messages. Not a v1 concept, but it shows "read-only" needs a
  precise definition.
- **envelope / page:** `{data, pagination:{limit, offset, count}}`, where `count` is the page
  size and not the total.
- **account (mail):** "latest mail" is per account. With no account given, the fork uses the
  first configured one.

## Open questions

- Does Reminders.app really hang on per-item property access and take about 25–35 s for bulk
  specifiers on a real library? This is *verify* evidence for EventKit, and bears on upstream
  #53.
- Does the scripting dictionary in current Reminders (macOS 26) still expose `creation date`,
  `due date` and `body` the way the fork uses them? The fork says "verified live against iCloud
  lists" but doesn't give a macOS version.
- Does Bun's JavaScriptCore `Date` parse macOS's `"… at 12:00:00 AM"` strings the same way as
  V8, including the U+202F narrow no-break space newer macOS puts before AM/PM?
- The `whose name contains` search is case-insensitive in AppleScript by default. Should search
  in the rebuild match titles only, or notes as well (upstream's doc comment claims both)?
- Upstream's calendar reads are stubs (`utils/calendar.ts:97-121`, `:177-183`). That is the
  likely root cause of #74 "no entries found". The fork doesn't fix it but documents it as
  working, so the Appendix B mapping for #74 should point here.
