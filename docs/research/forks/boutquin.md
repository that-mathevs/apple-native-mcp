# boutquin/apple-mcp

- **Remote:** `fork-boutquin`
- **Branches read:** `main` (5 commits: 4 non-merge plus merge `1fe8124` of
  `fix/calendar-time-and-reminders-visibility`). `HEAD` points at `main`. There are no other
  branches.
- **Commits accounted for:** 5 / 5
- **Last commit:** 2026-01-27
- **In one paragraph:** One person's (Pierre Boutquin) two-day repair of upstream, co-written
  with Claude Opus 4.5 and never tested beyond "build succeeds". It fixes two real upstream
  failures. First, `run-applescript` hands back text, so every list of AppleScript records
  arrived as one flat string and every caller fell back to placeholders. The fork frames records
  with `|||` and `:::` instead. Second, it replaces upstream's stubs for listing and searching
  events and reminders with real AppleScript loops, and makes reminder creation honour the list,
  notes and due date. Its most useful contribution is to the date question behind upstream #34
  and #64. Upstream built dates with `date "${d.toLocaleString()}"`, and on this Mac AppleScript
  drops the time from that string: it gives midnight. The fork sets date fields one at a time
  instead, but in an order that moves the date by a month when today is the 29th to 31st
  (measured below). It also keeps every quote-only escape from upstream and adds new injectable
  sinks, including one `do shell script` per item searched. Learn from the diagnosis, not the code.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Calendar | AppleScript via `run-applescript`, `every event of cal whose start date >= … and start date <= …` per calendar | Replaces upstream's dummy-event stub. Dates are built by setting `year`/`month`/`day`/`hours` of `current date`. Lowercases titles with `do shell script "echo … \| tr"` once per event. |
| Reminders | AppleScript, `reminders of aList whose completed is false`, one Apple Event per property per reminder | Replaces upstream's stubs. Search spawns a shell per reminder (twice when the body is checked). |
| Notes, Contacts, Mail | AppleScript as upstream | Only the output framing changed (`|||` / `:::`, plus `[COLON]` / `[PIPE]` substitution inside bodies). |

## Changes

### C1 Lists of notes, contacts, emails, reminder lists and events come back whole

- **Kind:** fix
- **Context:** cross-cutting
- **Symptom:** A listing or search returned at most one item, often a placeholder
  ("Untitled Note", "Untitled List"), or nothing at all, even when the app had plenty.
- **Root cause:** `run-applescript` returns osascript's stdout as a string. An AppleScript list of
  records turns into `name:A, id:1, name:B, id:2` with the braces gone. Every caller cast that
  string to `any` and read `.name` off it, or tested `Array.isArray(result)`, which is always
  false: `utils/notes.ts:118-121` and `:190-193`, `utils/contacts.ts:106-109`,
  `utils/reminders.ts:118-121`, `utils/calendar.ts:121-124`. Several functions had given up and
  returned a count or `[]`: `utils/mail.ts` getUnreadMails and searchMails return
  `"SUCCESS:" & count` and then `[]`, and `utils/notes.ts:418` returns `notes: []`.
- **Technique:** Each script builds one string. Records are joined with `|||`, fields with `:::`
  and phone numbers with `;;;`. TypeScript splits on those. For mail and note bodies only, the
  script first replaces `:::` with `[COLON]` and `|||` with `[PIPE]` using `text item delimiters`,
  and TypeScript restores them.
- **Evidence:** `2894ab6`. Upstream #58 ("finds zero emails"), #67 (notes content search), #26.
- **Quality of the fix:** partial. Framing is the right idea, but the delimiters are printable
  text that can occur in data. Only bodies are protected. A subject, note title, list name, event
  title or location that contains `:::` or `|||` shifts every later field. A body that already
  contains the literal text `[COLON]` comes back altered. There is no field count check, so a
  shifted record is returned silently. Contact phones are joined into a `{name: phones[]}` map,
  so two people with the same display name overwrite each other.
- **Verdict:** adopt the idea. Results cross the process boundary as structured data. In the
  rebuild that means JSON from JXA or the Swift helper, never text with sentinel delimiters.
- **Scenarios:**
  - [contract] `an automation script result` — `given a title containing separator-like text, returns the title whole and every other field intact`
  - [contract] `an automation script result` — `given many records, returns every record, not a single flattened one`
  - [acceptance] `listing contacts` — `given two people with the same name, reports both with their own details`

### C2 Created events keep their time of day

- **Kind:** fix
- **Context:** calendar
- **Symptom:** An event asked for at 17:30 was created at midnight, or on the wrong day, or the
  create call failed with a date error.
- **Root cause:** `utils/calendar.ts:270-271` builds `set startDate to date "${start.toLocaleString()}"`.
  Node's `toLocaleString()` formats for the server process's ICU locale. On this Mac (Node 23.3,
  en-US, macOS 26.3) it gives `1/27/2026, 5:30:00 PM`. AppleScript's `date "…"` parses that string
  with the user's region settings, and the comma makes it drop the time:
  `date "1/27/2026, 5:30:00 PM"` returns `Tuesday, January 27, 2026 at 12:00:00 AM`, while
  `date "1/27/2026 5:30:00 PM"` returns 5:30 PM (both measured with `osascript`). Any other locale
  or region pairing fails differently. For example, `date "2026-01-27 17:30:00"` gives the year
  12195 (also measured).
- **Technique:** JS reads the local fields (`getFullYear`, `getMonth()+1`, `getDate`, `getHours`,
  `getMinutes`, `getSeconds`) and splices them into the script as integers. The script then does
  `set startDate to current date`, `set year of startDate to …`, `set month …`, `set day …`,
  `set hours …`, `set minutes …` and `set seconds …`. The same pattern is used for reminder due
  dates (C3) and for the start and end of the range when listing or searching (C4, C5). A
  `formatDateForAppleScript` helper is defined too, but never called.
- **Evidence:** `8a5d2e0`. Upstream #34, #64 (see C3 for the reminder half).
- **Quality of the fix:** wrong in a way that is easy to miss. The date is still off in four
  ways:
  1. **Month overflow.** The fields are set year, then month, then day, starting from today. If
     today is the 31st and the target month has 30 days, `set month` rolls into the following
     month before `set day` runs. Measured with `osascript`: starting from 31 January, setting
     month 2 and then day 10 gives **10 March**. The error hits on the 29th, 30th and 31st of
     any month. `fork-KassebaumEngineering` (`1d47e74`) sets `day` to 1 first, which is the
     correct form.
  2. **Date-only input is read as UTC midnight.** `new Date("2026-01-27")` is 00:00 UTC. In
     America/New_York that is 26 January at 19:00 (measured: `getDate()` 26, `getHours()` 19).
     An all-day event or a "due tomorrow" reminder lands on the previous day west of Greenwich.
  3. **"Today" is the UTC date.** The default range start is
     `today.toISOString().split('T')[0]` (kept from upstream `utils/calendar.ts:94`, `:170`).
     After 19:00 in New York, "today" is already tomorrow, so the evening's events are left out
     of a default listing.
  4. **Range bounds lose time and offset.** The list and search scripts read only
     `text 1 thru 10` of `fromDate`/`toDate` and pin the bounds to 00:00:00 and 23:59:59.
     `2026-01-27T22:00:00-08:00` is read as 27 January, although in local time it is already the
     28th.
  The instant is only right when the Node process's time zone matches the Mac's. A `TZ` env var
  on the MCP server breaks it silently. Event times are returned as local wall time with no
  offset and no seconds (`2026-01-27T17:30:00`), where upstream promised ISO in UTC.
- **Verdict:** adopt the idea (never hand a formatted date string to an app). Reject the
  technique. Pass an instant (epoch or ISO with offset) to EventKit through the helper, and
  settle date-only input and "today" in a domain rule that uses the user's time zone.
- **Scenarios:**
  - [acceptance] `creating an event` — `given a start of 17:30 local time, stores and reports an event starting at 17:30 local time`
  - [domain] `a requested date` — `given a date with no time and no offset, means that whole day in the user's time zone, not midnight UTC`
  - [domain] `a requested date` — `given a local time on the 31st, keeps its day and month: filling fields into today's date rolls months over`
  - [domain] `a default range` — `given no range late in the evening west of UTC, starts today in the user's time zone`
  - [domain] `a requested range` — `given bounds with a time and an offset, keeps them to the second rather than widening to whole days`
  - [contract] `an event store` — `given an event saved at an instant, returns it at the same instant with an explicit offset`

### C3 A new reminder goes to the requested list, with its notes and due time

- **Kind:** fix
- **Context:** reminders
- **Symptom:** Upstream #64: "no time set when creating a reminder". The reminder also showed up
  in whichever list came first, and without its notes, while the tool reported the requested
  list and due date.
- **Root cause:** In upstream `utils/reminders.ts:249-262`, `createReminder` uses
  `first item of allLists` (`:254`) and sets only `name`. The `listName`, `notes` and `dueDate`
  arguments are escaped and then never used. The function returns the caller's `dueDate` and
  `body` as if they were saved (`:272-279`), and `index.ts:901` says
  `Created reminder … in list "<requested>"`. On #34 ("5:30 PM became 6:25 PM", filed 2025-04-11):
  the code at that time (`2cbfb58`) was JXA doing `reminderProps.dueDate = new Date(dueDate)`,
  which converts a correct ISO instant correctly. A 55-minute error can't come from a time zone
  offset, since offsets are whole hours, half hours or 45 minutes. So the model most likely sent
  the wrong timestamp. The schema only says "ISO format" (`tools.ts:173`), doesn't say whether an
  offset is required, and doesn't give the model the current time. The code alone can't settle
  it. See Open questions.
- **Technique:** Loops over `lists` comparing `name` and falls back to the first list when none
  matches. Creates the reminder with `name`, then sets `body`, then sets `due date` using the
  component technique from C2. Returns `id of newReminder` and the name of the list actually used.
- **Evidence:** `8a5d2e0`. Upstream #64, #34.
- **Quality of the fix:** partial. List, notes and due time are now written, and the real id is
  returned. But:
  - It inherits C2's month overflow and its UTC reading of date-only input.
  - An unknown list silently becomes the first list, and `index.ts:901` still reports the
    requested list, so the result lies.
  - Nothing reads the reminder back.
  - Escaping covers `"` and `\n` but not `\`, so name, notes and list name remain injectable
    (see C6).
- **Verdict:** adopt the idea (honour list, notes and due time, and return the real id). Reject
  the silent fallback. Refuse an unknown list and name the lists that exist.
- **Scenarios:**
  - [acceptance] `creating a reminder` — `given a due time, stores that time and reports it as read back from the store`
  - [acceptance] `creating a reminder` — `given a list that does not exist, refuses and names the lists there are`
  - [acceptance] `creating a reminder` — `given notes, stores them on the reminder`

### C4 Listing and searching reminders returns real reminders

- **Kind:** fix
- **Context:** reminders
- **Symptom:** "List my reminders" reported lists but zero reminders. Search never found
  anything (upstream #26, #53).
- **Root cause:** Upstream stubs. `getAllReminders` returns
  `"SUCCESS:found_lists_but_reminders_query_too_slow"` and then `[]`
  (`utils/reminders.ts:140-176`). `searchReminders` returns `[]` without searching (`:184-217`).
- **Technique:** For each list (optionally `lists whose name is "<list>"`), the script gets
  `reminders of aList whose completed is false`. Then, per reminder, it reads name, id,
  completed, body and due date in a `try`, one Apple Event each, and stops after
  `MAX_REMINDERS` (50) in total. For search it runs `do shell script "echo " & quoted form of
  name & " | tr '[:upper:]' '[:lower:]'"` on every reminder's name, and again on its body when
  the name doesn't match, then tests `contains`. Due dates are formatted as local
  `YYYY-MM-DDTHH:MM:00`.
- **Evidence:** `8a5d2e0`. Upstream #26, #53.
- **Quality of the fix:** partial.
  - Only incomplete reminders are ever returned, so completed ones can't be seen or found.
  - The 50-item cap is shared by all lists, the first lists fill it, and nothing says the result
    was cut short.
  - Per-reminder property reads and a shell per item are the slow path that made upstream give up
    (#53). The shell-out is pointless, because AppleScript's `contains` already ignores case
    (measured: `"ABC" contains "abc"` is `true`), and `tr` lowercases only ASCII anyway.
  - `echo` under macOS `/bin/sh` interprets backslash escapes, so a name with `\c` is cut short
    before matching.
  - Errors on a reminder or list are swallowed (`on error -- Skip`), so a permission or timeout
    failure looks like "no reminders".
- **Verdict:** adopt the idea (real reads, open reminders by default). Reject the technique in
  favour of EventKit predicates with a limit, as plan.md already chooses.
- **Scenarios:**
  - [acceptance] `listing reminders` — `given open and completed reminders, reports the open ones unless completed ones are asked for`
  - [acceptance] `listing reminders` — `given more reminders than the limit, reports the first ones and says more exist`
  - [acceptance] `searching reminders` — `given text that matches a reminder's notes in a different case, finds it`
  - [acceptance] `listing reminders` — `given the store cannot be read, fails and says why instead of reporting none`

### C5 Listing and searching events returns real events

- **Kind:** fix
- **Context:** calendar
- **Symptom:** Listing events returned one fake event titled "No events available - Calendar
  operations too slow". Search always returned nothing (upstream #74, #25, #66).
- **Root cause:** `utils/calendar.ts:100-116` builds a hard-coded dummy record, and `:175-178`
  returns an empty list. Even if they had returned real records, the result would have hit C1's
  flattening.
- **Technique:** For each calendar: `every event of cal whose start date >= filterStart and
  start date <= filterEnd`. Then per event: uid, summary, start date, end date, allday event,
  location and description, framed as in C1. Search lowercases the title, location and notes
  through `do shell script … tr`, one process per field per event.
- **Evidence:** `2894ab6` (list), `8a5d2e0` (search). Upstream #74, #25, #66.
- **Quality of the fix:** partial.
  - It filters on `start date` only, so an event that started before the range but is still
    running (a multi-day event) is missed.
  - Calendar's AppleScript `whose start date` matches the stored event, not its expanded
    occurrences, so recurring events outside their first date are likely missed (verify).
  - All of C2's range defects apply.
  - `limit` is capped at `CONFIG.MAX_EVENTS` with no truncation notice.
  - Errors inside a calendar are swallowed.
  - `fromDate` and `toDate` are spliced into the script raw (C6).
- **Verdict:** adopt the idea. For the technique, verify the recurring-event claim, then use
  EventKit (`predicateForEvents…` expands occurrences).
- **Scenarios:**
  - [acceptance] `listing events` — `given a weekly recurring event, reports each occurrence inside the range`
  - [acceptance] `listing events` — `given an event that began before the range and ends inside it, reports it`
  - [acceptance] `searching events` — `given text found only in an event's location, finds the event`

### C6 Injection holes kept and added (not fixed)

- **Kind:** hardening (missing)
- **Context:** cross-cutting
- **Symptom:** None visible. A crafted search term, list name or date can run arbitrary
  AppleScript, including `do shell script`.
- **Root cause:** Upstream escapes only `"` (`utils/calendar.ts:284-291`,
  `utils/reminders.ts:245-247`). An input ending in `\` turns `\"` into `\\"`, which closes the
  literal. `utils/calendar.ts:286` also splices `location` without any escaping at all.
- **Technique:** The fork keeps quote-only escaping and adds sinks:
  - search terms in `searchEvents` and `searchReminders`
  - `lists whose name is "<listName>"` in `getAllReminders`
  - the list name in `createReminder` (`"`/`\n` only)
  - `fromDate`/`toDate` spliced raw into `text 1 thru 4 of "<date>"`
  An input like `\" & (do shell script (character id {…})) --` closes the literal, runs a command
  and comments out the rest of the line, with no second quote needed. The `do shell script` calls
  it adds do use `quoted form of`, so those are safe.
- **Evidence:** `2894ab6`, `8a5d2e0`.
- **Quality of the fix:** wrong. It widens the attack surface.
- **Verdict:** reject. Non-negotiable 1 already covers this: static scripts, JSON arguments.
- **Scenarios:**
  - [acceptance] `searching reminders` — `given text that closes a string and runs a command, matches it literally and runs nothing`
  - [acceptance] `listing events` — `given a range bound that is not a date, refuses: only dates reach the store`

## Noise

- Lockfile churn: `0a826ab`.
- Contributing guide (Conventional Commits): `0c0a1fd`.
- Merge commit of the feature branch: `1fe8124`.

## Glossary candidates

- **reminder list:** a named container of reminders. The fork addresses it by display name,
  which isn't unique across accounts.
- **open reminder:** a reminder whose `completed` is false. It's the fork's default and only view.
- **due date:** a local wall-clock date and time on a reminder, returned without an offset.
- **event:** a Calendar item with uid, summary, start and end, all-day flag, location and
  description. The fork treats it as a single stored item, not as occurrences.
- **occurrence:** (implied by the gap in C5) one dated instance of a recurring event.
- **all-day event:** an event flagged `allday event`. Its date is a calendar day, not an instant,
  which is exactly what the UTC reading of date-only input breaks.
- **record framing:** how several structured results cross the osascript text boundary.

## Open questions

- #34's 55-minute shift: can it be reproduced when the model is given the current time and an
  explicit offset? If so, the cause is in the code path of the time (JXA `new Date` inside
  osascript). If not, it was the model's arithmetic. Either way, the rebuild should echo the
  stored due time back in the result.
- Does Calendar's AppleScript `every event whose start date …` return occurrences of recurring
  events after the first one on macOS 14+? The fork assumes it does. Upstream #25 "missing
  events" may be exactly this.
- Does `date "…"` with a comma lose the time only under en-US region settings, or under every
  region? We measured one Mac only.
- Performance of per-item Apple Events plus shell spawns on a library of hundreds of reminders
  (upstream #53 reported timeouts). This wasn't measured.
