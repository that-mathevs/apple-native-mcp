# mjmcg/apple-mcp

- **Remote:** `fork-mjmcg`
- **Branches read:** `main` (18 commits). `HEAD` points at `main`. There are no other branches.
- **Commits accounted for:** 18 / 18
- **Last commit:** 2026-05-10
- **In one paragraph:** One person's (Matt McGarry) working copy, written over three days with
  Claude Sonnet as co-author. They used it as a LAN-reachable tool server behind a LiteLLM gateway.
  It rips out upstream's reminders and calendar code, which mostly didn't work (lists and searches
  returned `[]` or a dummy event, and create ignored the list and due date). In its place it
  shells out with `execFile` to two third-party EventKit CLIs: `remindctl` for reminders and
  `accli` (joargp/accli) for calendar. It splits both into one tool per operation, sorted by risk,
  and adds an HTTP transport. Contacts, notes, messages, mail and maps are untouched. The code
  itself is thin glue with no tests, and it hands date parsing and permission handling to the
  CLIs. Its value is as evidence: EventKit-backed reminders and calendar work in practice, the
  JSON field shapes are useful data-model notes, and it lists concrete edge cases (large
  libraries, completed-item flooding, lookups by list name, clearing a due date). Its HTTP mode
  is **alarming**: it listens on every interface, and auth is off unless env vars are set. That
  puts upstream's injectable messages/mail send on the network.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Reminders | `execFile` of the external `remindctl` CLI (EventKit), `--json --no-input`, 15 s timeout, 50 MB buffer | Binary not declared in `package.json`. Path from `REMINDCTL_PATH` or `$PATH`. No AppleScript and no shell, so there is no script injection, but values are still passed as positional argv (see C15). |
| Calendar | `execFile` of the external `accli` CLI (EventKit), `--json`, 15 s timeout, 50 MB buffer | One process per calendar, run in parallel for listing. Calendars are addressed **by name**. Path from `ACCLI_PATH`. |
| Transport | stdio (unchanged) or stateless Streamable HTTP when `MCP_HTTP_PORT` is set | See C14. |

## Changes

### C1 Listing and searching reminders actually returns reminders

- **Kind:** fix
- **Context:** reminders
- **Symptom:** Asking for reminders gave "0 reminders", timed out, or did nothing. Search never
  found anything.
- **Root cause:** Upstream gave up on reading reminders. `getAllReminders` runs a script that
  only counts lists and then always returns `[]` (`utils/reminders.ts:140-176`).
  `searchReminders` returns `[]` without searching (`utils/reminders.ts:184-217`).
  `getRemindersFromListById` returns `[]` (`utils/reminders.ts:348-380`). `getAllLists` stops at
  20 lists (`utils/reminders.ts:8,100`). Earlier upstream versions iterated reminders through
  AppleScript, which is slow enough to time out (#53) and was reported to crash Reminders.app (#10).
- **Technique:** All reads go through EventKit via `remindctl`: `remindctl list` for lists and
  `remindctl show <filter>` for reminders. Search loads `show all` (every reminder, completed
  ones included) and filters title and notes in JS with a case-insensitive substring match. Each
  reminder is mapped to
  `{id, title, notes, isCompleted, completionDate, dueDate, listID, listName, priority}`.
- **Evidence:** `bde3e31`, `804b77d`. Upstream #53, #26, #10, #59 and the reminders half of #70
  (#59's body shows `list` and `add` calls that "do nothing").
- **Quality of the fix:** partial. Reads really happen now, but search pulls the whole library,
  completed history included, into memory on every call. It has no limit and no paging, and any
  library larger than the 15 s timeout allows fails outright. The "crash" part of #10 is only
  sidestepped by not scripting Reminders.app.
- **Verdict:** adopt the idea (EventKit for reads, as plan.md already chooses). Reject
  load-everything-then-filter search: push the predicate and a limit into the store query.
- **Scenarios:**
  - [acceptance] `listing reminders` — `given reminders exist in several lists, reports them with their list, due date and completion state`
  - [acceptance] `searching reminders` — `given a reminder whose notes contain the text, finds it even though its title does not`
  - [acceptance] `searching reminders` — `given more matches than the limit, reports the first matches and says more exist`
  - [contract] `a reminder store` — `given a library of thousands of reminders, answers a search within the time budget`

### C2 A new reminder keeps the list, due date, notes and priority it was given

- **Kind:** fix
- **Context:** reminders
- **Symptom:** A reminder created "for 5 pm tomorrow in Groceries" landed in some other list with
  no time. The tool still said it was created in the list asked for and echoed the due date back.
- **Root cause:** Upstream `createReminder` always uses `first item of allLists`
  (`utils/reminders.ts:252-254`). It sets only `name` (`:258`) and ignores `dueDate` and `notes`.
  It then returns a fake id `"created-reminder-id"` and the requested `dueDate`, as if it had been
  saved (`:273-280`).
- **Technique:** `remindctl add --title <t> --list <l> [--notes] [--due] [--priority]`. The
  result is mapped from the reminder `remindctl` returns, so the id, list and due date come from
  the store rather than the request. `dueDate` is passed through as-is, and the tool text invites
  "ISO format or natural language e.g. 'tomorrow'", so `remindctl` does the parsing. The list
  defaults to the literal name `"Reminders"`.
- **Evidence:** `bde3e31`, `804b77d` (priority, bare-object response). Upstream #64. Upstream #34
  only as far as parsing is delegated.
- **Quality of the fix:** partial.
  (a) #64 is addressed: the due date now reaches the store.
  (b) #34 (5:30 pm became 6:25 pm) is not demonstrably addressed. The time is whatever
  `remindctl`'s parser decides for an ISO string with `Z` or an offset, or for natural language.
  Nothing states the time zone rule.
  (c) The `"Reminders"` default breaks for users whose default list has another name (localised,
  renamed). EventKit exposes the real default list.
  (d) The echo of the returned object is better than upstream but is not a re-read.
- **Verdict:** adopt the idea (report what the store holds). Verify: an ISO string with an offset
  passed as a due date is stored as that instant, and a local wall-clock time with no offset is
  stored in the user's time zone.
- **Scenarios:**
  - [acceptance] `creating a reminder` — `given a due time, reports the reminder with that due time as the store holds it`
  - [acceptance] `creating a reminder` — `given a list that does not exist, refuses: it names the lists that do`
  - [acceptance] `creating a reminder` — `given no list, puts it in the user's default reminder list`
  - [domain] `a due time` — `given a time with a UTC offset, keeps the instant rather than the wall-clock digits`
  - [domain] `a due time` — `given a wall-clock time with no offset, reads it in the user's time zone`

### C3 Editing a reminder changes that reminder instead of creating a new one

- **Kind:** feature
- **Context:** reminders
- **Symptom:** Asking to change a reminder's due date or details produced a duplicate reminder.
- **Root cause:** Upstream has no edit operation (the enum at upstream `tools.ts` is
  `list, search, open, create, listById`), so an agent could only create.
- **Technique:** `remindctl edit <id>` with `--title`, `--list` (move), `--due`, `--notes` (an
  empty string clears them), `--priority`, and `--clear-due`. It returns the edited reminder.
- **Evidence:** `804b77d`, `fed09d1`. Upstream #27 (reminders half).
- **Quality of the fix:** partial. It edits in place by id. Moving between lists and clearing the
  due date are handled explicitly, which is a good sign. But a `title` of `""` is silently ignored
  (truthiness check), `dueDate` and `clearDue` together are not rejected, and nothing confirms the
  change by re-reading.
- **Verdict:** adopt the idea
- **Scenarios:**
  - [acceptance] `editing a reminder` — `given a new due time, changes that reminder and leaves the reminder count unchanged`
  - [acceptance] `editing a reminder` — `given a request to clear the due date, reports the reminder with no due date`
  - [acceptance] `editing a reminder` — `given another list, moves the reminder there`
  - [acceptance] `editing a reminder` — `given both a due time and a request to clear it, refuses: the two contradict`
  - [acceptance] `editing a reminder` — `given an identifier no reminder has, refuses: nothing was changed`

### C4 Completing and deleting a reminder

- **Kind:** feature
- **Context:** reminders
- **Symptom:** An agent couldn't tick a reminder off or remove it.
- **Root cause:** Upstream has no such operations.
- **Technique:** `remindctl complete <id>` returns the completed reminder.
  `remindctl delete <id> --force` skips the CLI's own confirmation.
- **Evidence:** `bde3e31`, `804b77d` (map the complete response), `fed09d1`
- **Quality of the fix:** partial. Delete reports `"Reminder deleted."` whenever the runner
  doesn't throw. The runner (C15) doesn't throw on a non-zero exit if stdout is non-empty, so a
  JSON error on stdout reads as success. Complete doesn't check `isCompleted` on the returned item.
  Neither is read-only-by-default gated.
- **Verdict:** adopt the idea (behind the write setting, verified after the write)
- **Scenarios:**
  - [acceptance] `completing a reminder` — `given an open reminder, reports it completed only after the store shows it completed`
  - [acceptance] `deleting a reminder` — `given writes are not enabled, refuses: reminders are read-only by default`
  - [acceptance] `deleting a reminder` — `given the store still holds the reminder afterwards, reports the outcome as unconfirmed`

### C5 Reminders can be listed by due window, and by default old completed ones are left out

- **Kind:** feature
- **Context:** reminders
- **Symptom:** A plain "list my reminders" dumped thousands of historical completed reminders.
  An agent also had no way to ask "what's overdue" or "what's due this week".
- **Root cause:** Upstream had no filter (and returned nothing anyway, see C1).
- **Technique:** Exposes `remindctl show` presets `today | tomorrow | week | overdue | upcoming |
  completed | all`. The default changed from `all` to `upcoming` once `all` proved too large.
- **Evidence:** `804b77d`, `fed09d1`, `5ca5e55`
- **Quality of the fix:** partial. The presets are the CLI's, with its meaning of "week" and
  "upcoming" (undocumented here: calendar week or next 7 days? are undated reminders included?).
  The `filter` string isn't checked against the enum at runtime before it is put into argv.
- **Verdict:** adopt the idea (open reminders by default, windows defined in our own domain).
  Verify: what `upcoming` and `week` include in `remindctl`.
- **Scenarios:**
  - [acceptance] `listing reminders` — `given no window, reports only reminders that are not completed`
  - [acceptance] `listing reminders` — `given the overdue window, reports open reminders whose due time has passed`
  - [domain] `a due window` — `given "this week", spans the user's local days from today through the seventh day`
  - [domain] `a due window` — `given a reminder with no due date, excludes it from every dated window`

### C6 Listing one reminder list returns everything in it, completed items included

- **Kind:** fix
- **Context:** reminders
- **Symptom:** Asking for the Grocery list returned reminders from every list.
- **Root cause:** Not upstream. The commit says `remindctl show all --list <name>` ignores
  `--list`.
- **Technique:** When a list name is given, it calls `remindctl list <name>` instead and ignores
  the filter. That returns open and completed items, which the author considers right for
  checklist-style lists.
- **Evidence:** `5ca5e55`
- **Quality of the fix:** partial. It's a workaround for a CLI bug, and it changes semantics
  (filter silently ignored, completed included). Lists are addressed by title, which isn't unique.
- **Verdict:** adopt the idea (a scope by list must actually scope). Reject the silent
  filter-dropping. Verify: whether two reminder lists in different accounts can share a title.
- **Scenarios:**
  - [acceptance] `listing reminders` — `given a list, reports only reminders from that list`
  - [acceptance] `listing reminders` — `given a list and the overdue window, reports only overdue reminders from that list`
  - [acceptance] `listing reminders` — `given a list title two accounts share, refuses: it names both lists by account`

### C7 Reminder lists come with open and overdue counts

- **Kind:** feature
- **Context:** reminders
- **Symptom:** An agent couldn't tell which lists matter without listing everything. Upstream
  also stopped at 20 lists.
- **Root cause:** Upstream returns `{name, id}` only, capped by `MAX_LISTS: 20`
  (`utils/reminders.ts:8,84-133`).
- **Technique:** `remindctl list` returns `{id, title, reminderCount, overdueCount}`. The tool
  description was amended to say `reminderCount` counts **incomplete** reminders only.
- **Evidence:** `804b77d`, `fed09d1`, `78b536b`
- **Quality of the fix:** complete for what it does
- **Verdict:** adopt the idea
- **Scenarios:**
  - [acceptance] `listing reminder lists` — `reports every list with how many reminders are open and how many are overdue`
  - [domain] `a reminder list's open count` — `given completed reminders in the list, leaves them out of the count`

### C8 Large reminder and calendar libraries no longer break the response

- **Kind:** fix
- **Context:** reminders, calendar
- **Symptom:** Listing or searching a large reminder library failed with
  `Unterminated string at position 1048332`.
- **Root cause:** Not upstream. Node's default `execFile` `maxBuffer` is 1 MB, so the JSON was
  cut off.
- **Technique:** Raised `maxBuffer` to 50 MB for both CLIs.
- **Evidence:** `2743d84`
- **Quality of the fix:** partial. It moves the ceiling instead of bounding the result. The real
  problem is unbounded reads (C1 search loads everything).
- **Verdict:** adopt the idea (bounded results). Reject the bigger-buffer technique. The Swift
  helper's JSON-lines protocol needs a stated maximum response size and paging.
- **Scenarios:**
  - [acceptance] `listing reminders` — `given more reminders than one response holds, reports a page and how to get the next`
  - [contract] `the native helper` — `given a result larger than the response limit, answers with a page instead of a truncated response`

### C9 Reminders permission status is checked, but never used

- **Kind:** hardening
- **Context:** reminders
- **Symptom:** When access isn't granted, the user gets whatever `remindctl` writes to stderr.
- **Root cause:** Upstream checks Automation access to Reminders.app
  (`utils/reminders.ts:36-78`), which is the wrong permission for EventKit.
- **Technique:** `requestRemindersAccess()` calls `remindctl status` and reads
  `{authorized: boolean, status: string}`. Its message says to run `remindctl authorize`. The
  calendar version just tries `accli calendars`.
- **Evidence:** `bde3e31`, `804b77d`
- **Quality of the fix:** wrong as shipped. Neither access function is called by any tool
  handler (`index.ts` never references them), so there's no named permission failure. The data
  model is still useful: the status has a boolean and a separate status word (e.g. denied vs not
  determined vs write-only).
- **Verdict:** adopt the idea (a named permission failure built from EventKit's authorisation
  status). Verify: which process macOS attributes the Reminders/Calendar prompt to when a CLI
  helper asks (plan.md Decision 3).
- **Scenarios:**
  - [acceptance] `listing reminders` — `given reminders access was never granted, refuses: it names the Privacy & Security setting to change`
  - [domain] `a permission state` — `given write-only calendar access, reports reading events as not permitted`

### C10 Calendar events are really listed and searched, across every calendar

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Listing events returned one fake event, "No events available - Calendar operations
  too slow", and searching always found nothing.
- **Root cause:** Upstream `getEvents` builds a dummy event in AppleScript
  (`utils/calendar.ts:98-117`). `searchEvents` returns an empty list on purpose
  (`utils/calendar.ts:177`). `openEvent` only opens the app (`:332`).
- **Technique:** `accli calendars` returns names. Then one `accli events <name> --from YYYY-MM-DD
  --to YYYY-MM-DD --max N [--query q]` runs per calendar in parallel (`Promise.allSettled`). The
  results are merged, sorted by start and cut to N. Per-calendar failures are logged to stderr and
  skipped. Search is list with `--query` (title, location, description, case-insensitive per the
  tool text) and a 30-day default window. A `limit` of 0 or less means 10. Its first cut expected
  an `{ok, data}` envelope and was corrected to accli's flat `{calendars}` / `{events}`.
- **Evidence:** `d4ec06d`, `88e26b9`, `e85c620`, `4ca8065`, `7623d19`. Upstream #74, #25 and the
  calendar half of #70.
- **Quality of the fix:** partial.
  (a) The window is truncated to UTC calendar dates (`toISOString().split("T")[0]`), so near
  midnight "today" can be the wrong local day, and times within a day are dropped.
  (b) A calendar that fails is skipped silently from the agent's view, so the result looks
  complete when it isn't.
  (c) Calendars are addressed by name: same-named calendars in two accounts get queried twice,
  or can't be told apart.
  (d) Recurring events: whether accli expands occurrences is not visible here.
- **Verdict:** adopt the idea (EventKit, all calendars, merged and ordered). Reject the UTC-date
  truncation and the silent partial result.
- **Scenarios:**
  - [acceptance] `listing events` — `given events in several calendars, reports them in start order with each one's calendar named`
  - [acceptance] `listing events` — `given one calendar cannot be read, reports the others and names the calendar that was left out`
  - [acceptance] `searching events` — `given text found only in an event's location, finds that event`
  - [domain] `an event window` — `given "today" just after local midnight, spans the user's local day, not the UTC one`
  - [contract] `an event store` — `given a recurring event, reports each occurrence in the window separately`

### C11 Getting, changing and deleting one event, free/busy, and listing calendars

- **Kind:** feature
- **Context:** calendar
- **Symptom:** An agent couldn't open, move or cancel an event, check availability, or see which
  calendars exist and which it can write to.
- **Root cause:** Upstream has only `search | open | list | create`, and `open` just activates the
  app.
- **Technique:** `accli event <cal> <id>` (with no calendar, tries each calendar until one
  answers). `accli update <cal> <id> [--summary --start --end --location --description
  --all-day|--no-all-day]`. `accli delete <cal> <id>`. `accli freebusy --from --to --calendar ...`
  returns `{busy|slots: [{start,end,calendar}]}`. `accli calendars` returns
  `{name, source, id, writable}`. Create is `accli create <cal> --summary --start --end ...`, with
  default calendar `"Calendar"`.
- **Evidence:** `d4ec06d` (create), `17cba98`, `dcf1993`
- **Quality of the fix:** partial, with a time bug. Create, update and freebusy send
  `startDate.slice(0, 16)`, which **drops the `Z` or UTC offset**. `2026-05-08T14:00:00Z` becomes
  a wall-clock `14:00` that accli presumably reads as local time, which is the #34 class of shift.
  Updates and deletes need the calendar name as well as the id. `get` without a calendar is
  O(calendars) processes. Success comes from the exit status only (C15), with no re-read.
  `writable` is reported but not checked before a write. The `"Calendar"` default is a guess, not
  EventKit's default calendar.
- **Verdict:** adopt the idea (get / update / delete / availability / calendars-with-writable).
  Reject offset-dropping. Verify: whether accli's event id is stable across launches and whether
  it names a series or one occurrence.
- **Scenarios:**
  - [acceptance] `creating an event` — `given a start with a UTC offset, reports the event starting at that instant`
  - [acceptance] `creating an event` — `given a calendar that is not writable, refuses: it names the calendars that are`
  - [acceptance] `changing an event` — `given one occurrence of a recurring event, changes only that occurrence unless asked for the series`
  - [acceptance] `checking availability` — `given a time range, reports the busy periods without revealing event titles`
  - [acceptance] `listing calendars` — `reports each calendar with its account and whether it accepts new events`

### C12 Calendar and reminders become one tool per operation, sorted by risk

- **Kind:** refactor
- **Context:** cross-cutting
- **Symptom:** A gateway (LiteLLM) couldn't classify `reminders` / `calendar` by risk, because one
  tool mixed reads and deletes behind an `operation` argument.
- **Root cause:** Upstream's single-tool-plus-`operation` surface (`tools.ts`).
- **Technique:** Seven `reminders_*` tools (list, search, get_lists | create | edit, complete |
  delete) and eight `calendar_*` tools (list_events, search_events, get_event, list_calendars,
  freebusy | create_event | update_event | delete_event), each with its own focused schema.
  Other contexts keep the old shape. There are no MCP annotations, and the arguments are cast
  (`args as {...}`) with only a `typeof` check on required strings.
- **Evidence:** `dcf1993`, `fed09d1`
- **Quality of the fix:** partial (no annotations, no schema validation, half the surface still
  monolithic)
- **Verdict:** adopt the idea. It's independent evidence for plan.md Decision 2 option B: a
  real deployment needed per-operation tools to apply risk tiers.
- **Scenarios:**
  - [acceptance] `the tool list` — `marks every tool that only reads as read-only and every tool that deletes as destructive`

### C13 Reminders and calendar no longer build scripts from tool input

- **Kind:** hardening
- **Context:** reminders, calendar
- **Symptom:** A title containing `"` or `\` could break or inject into the generated AppleScript.
- **Root cause:** Upstream interpolates into AppleScript with quote-only escaping: reminder name
  `utils/reminders.ts:245,258`, event title `utils/calendar.ts:284`, calendar name
  `utils/calendar.ts:266-276`.
- **Technique:** No AppleScript at all in these two contexts. Values go as separate argv elements
  to `execFile` (no shell).
- **Evidence:** `d4ec06d`, `bde3e31`
- **Quality of the fix:** partial. There's no script or shell injection. **Argument injection
  remains**: positional values that start with `-` (`remindctl edit <id>`,
  `remindctl list <listName>`, `remindctl show <filter>`, `accli events <calendarName>`,
  `accli delete <cal> <id>`) are passed without a `--` separator or validation, so they could be
  read as flags. The consequence depends on the CLIs' parsers. Contacts, notes, messages and mail
  still use upstream's injectable scripts.
- **Verdict:** adopt the idea (values never spliced into a script). The rebuild's Swift helper
  takes JSON, not argv, which removes the flag-confusion class.
- **Scenarios:**
  - [acceptance] `creating a reminder` — `given a title full of quotes, backslashes and script syntax, stores that exact title`
  - [acceptance] `listing reminders` — `given a list name that looks like a command-line flag, treats it as a list name`

### C14 Serving tools over HTTP to other machines on the network

- **Kind:** feature
- **Context:** other:transport
- **Symptom:** The server could only be used by a local stdio client, not by a LAN gateway.
- **Root cause:** Upstream is stdio-only (`index.ts`).
- **Technique:** When `MCP_HTTP_PORT` is set, it starts a `node:http` server. Each `POST /mcp`
  gets a fresh `Server` and a stateless `StreamableHTTPServerTransport`. `createMcpServer()` is
  pulled out so both transports share handlers. Optionally, `MCP_ALLOWED_IP` checks the exact
  remote address (after stripping `::ffff:`) and `MCP_AUTH_TOKEN` checks `Authorization: Bearer`.
  The stdio safe-mode timer is cleared in HTTP mode, because it had also been starting a stdio
  transport after 5 s.
- **Evidence:** `a999c4b`, `039b646`, `ef2a44f`
- **Quality of the fix:** wrong as a default. **Alarming:**
  - `listen(port)` binds all interfaces.
  - Both checks are off unless their env vars are set.
  - The token comparison isn't constant-time.
  - There's no `Origin`/`Host` validation. With the allowlist at `127.0.0.1`, a browser page could
    reach the server through DNS rebinding.
  - It exposes upstream's messages send and mail send, which still have script injection, to the
    network.
- **Verdict:** out of v1 scope. If a network transport is ever added: loopback by default, a
  token required, `Origin` checked, and write capabilities still off by default.
- **Scenarios:**
  - [acceptance] `the network transport` — `given no access token is configured, refuses to start: tools would be open to the network`

### C15 Failures from the helper CLI surface their message, but a failing exit can pass as success

- **Kind:** hardening
- **Context:** cross-cutting
- **Symptom:** Upstream errors were swallowed into empty lists (`console.error` + `return []`),
  so "no reminders" and "couldn't read reminders" looked the same.
- **Root cause:** `catch { return [] }` throughout upstream `utils/reminders.ts` and
  `utils/calendar.ts` (e.g. `utils/reminders.ts:127-132`, `utils/calendar.ts:136-141`).
- **Technique:** `runRemindctl` / `runAccli`: on a non-zero exit, **if stdout is non-empty it is
  parsed and returned as the result**. Otherwise it throws with stderr or the error message.
  Empty stdout throws "produced no output". Tool handlers return `isError: true` with the message.
- **Evidence:** `88e26b9`, `d4ec06d`, `bde3e31`
- **Quality of the fix:** partial. Read failures now show up as errors instead of empty results,
  which is good. But treating stdout from a failing process as success breaks "results tell the
  truth": a write that exits 1 with JSON on stdout is reported as done, and
  `mapReminder({error: ...})` gives an `"Untitled"` reminder with id `""`.
- **Verdict:** adopt the idea (an unreadable store is a named failure, never an empty result).
  Reject exit-code laundering.
- **Scenarios:**
  - [acceptance] `listing reminders` — `given the store cannot be read, refuses rather than reporting no reminders`
  - [contract] `the native helper` — `given a request it could not complete, answers with a named failure and never with a partial success`

## Noise

- Debug logging added then removed: `6cd7564`, `c4a80c4`

## Glossary candidates

- **reminder list:** a named container of reminders, with an `id`, a `title`, an open-reminder
  count (`reminderCount`, incomplete only) and an `overdueCount`. The fork addresses it by title,
  and the title may not be unique across accounts.
- **reminder:** `id`, `title`, `notes`, `isCompleted`, `completionDate`, `dueDate`, `listID`,
  `listName`, `priority` (one of `none | low | medium | high`, a word rather than a number).
- **due window:** a named preset over due dates: `today`, `tomorrow`, `week`, `overdue`,
  `upcoming`, `completed`, `all`, or a specific date.
- **checklist-style list:** a list (e.g. Grocery) whose completed items are still worth showing.
  The fork's reason for including completed items when a list is named.
- **clear due:** removing a reminder's due date, distinct from leaving it unchanged.
- **calendar:** `name`, `source` (the account it belongs to, e.g. iCloud or Exchange), `id`,
  `writable`.
- **event:** `id`, `summary` (title), `location`, `description` (notes), `start`, `end`,
  `allDay`, `calendar` (by name).
- **busy period (free/busy):** a `{start, end, calendar}` span with no event details.
- **all-day event:** dates only (`YYYY-MM-DD`). A timed event is wall-clock `YYYY-MM-DDTHH:mm`
  in accli's input.

## Open questions

- Does `remindctl` read an ISO due date with `Z` or an offset as that instant, and a bare
  `YYYY-MM-DDTHH:mm` or "tomorrow 5pm" in the local zone? This decides whether #34 is fixed or
  just moved.
- Does `remindctl show all --list <name>` really ignore `--list` (the reason for `5ca5e55`), or
  was it a version-specific bug?
- Does `remindctl` / `accli` write JSON errors to stdout with a non-zero exit? If so, C15 makes
  failed writes report success today.
- Is accli's event `id` the EventKit `eventIdentifier` (shared by every occurrence of a series)
  or `calendarItemIdentifier`? Do `update` / `delete` hit one occurrence or the whole series?
- Does accli expand recurring events into occurrences within `--from/--to`?
- Is accli's `--to` date inclusive or exclusive? The fork passes date-only bounds.
- Can two calendars or two reminder lists share a name across accounts? The fork's name-based
  addressing assumes they can't.
- Which app does macOS attribute the Reminders/Calendar permission prompt to when an external CLI
  helper asks: the CLI, the terminal, or the MCP host?
- #59's body is truncated in what was read. Confirm it is the same "list and add do nothing"
  failure as #53/#26 rather than a Warp-specific launch problem.
