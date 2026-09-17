# Upstream: supermemoryai/apple-mcp issues and pull requests

- **Repo:** `supermemoryai/apple-mcp` (formerly `Dhravya/apple-mcp`), archived, last push 2025-08-11.
- **Read:** all 46 issues (bodies and every comment), all 15 unmerged PRs (description, comments,
  reviews and full diff), and the 13 merged PRs (description and file list, plus diffs where they
  explain today's code). Issue numbers #18 and #20 return 404 (deleted).
- **Baseline for line cites:** `upstream/main` (`08e2c53`, v1.0.0). Many issues were filed against
  v0.2.7, the code before the "total revamp" (`70172d6`, 2025-08-09). Those cites say
  `50c7738:<path>:<line>` (the last commit before the revamp).
- **Two facts that explain most issues, checked on this Mac:**
  - `run-applescript` returns `osascript`'s stdout as a **string**. `osascript` prints a list of
    records flat, with no braces: `return {{name:"a, x", content:"b"},{name:"c", content:"d"}}`
    prints `name:a, x, content:b, name:c, content:d`. Every `Array.isArray(result)` in v1.0.0 is
    therefore false, and every `/\{([^}]+)\}/g` parse finds nothing.
  - The v1.0.0 revamp replaced most reads with stubs that return nothing or a placeholder, and
    kept the success wording.

## Summary

### Counts

| Kind | Count | Issues |
|---|---|---|
| Bug | 27 | #74 #25 #64 #34 #53 #59 #26 #75 #65 #47 #35 #62 #48 #24 #67 #44 #22 #69 #58 #30 #19 #66 #70 #8 #15 #10 #45 |
| Feature request | 8 | #6 #3 #27 #51 #5 #72 #38 #42 |
| Setup or client problem | 8 | #55 #50 #36 #33 #29 #17 #14 #2 |
| Noise (spam, duplicate) | 2 | #31 #43 |
| Research request | 1 | #71 |

| Context (as placed below) | Issues | Verdicts |
|---|---|---|
| calendar | 3 | 3 scenario |
| reminders | 5 | 5 scenario (1 also verify) |
| contacts | 4 | 4 scenario (1 also verify) |
| messages | 4 | 3 scenario (1 also verify), 1 reject |
| notes | 5 | 4 scenario (1 also verify), 1 reject (duplicate) |
| mail | 5 | 4 scenario, 1 out of v1 scope |
| cross-cutting | 6 | 5 scenario, 1 reject |
| setup-and-clients | 9 | 9 install-docs (2 also scenario) |
| out-of-scope | 5 | 3 out of v1 scope, 2 reject |
| **Total** | **46** | 28 scenario, 9 install-docs, 4 out of v1 scope, 5 reject |

Pull requests: 28 in total. 13 merged, 15 unmerged (2 open, 13 closed). Of the unmerged ones, 4 are
noise (three badge PRs and a demo script), 2 are duplicates of other PRs, 1 is already on `main`
by another route, 3 are out of v1 scope (photos twice, music) and 5 carry ideas worth a scenario.

### The five most important lessons

1. **"Nothing found" was almost never true, and almost never a permissions problem.** In v1.0.0,
   calendar list and search, reminders list and search, mail unread, search, accounts and
   mailboxes, and notes by folder are stubs or dead parsers. They return `[]` or a placeholder
   while the tool reports "No events found" with `isError: false` (#58, #66, #67, #69, #70, #74).
   The maintainer blamed permissions twice. The rebuild must never map "didn't read" to "empty":
   an empty result is only reported after the store was actually read, and anything else is a
   named failure. Parse typed data (JSON), never human-readable `osascript` output.
2. **Scripting the apps object by object doesn't scale, and a timed-out script keeps running.**
   Reading every reminder, note, contact or message one Apple event per property hangs Reminders
   and Notes, pegs CPU, and outlives the MCP timeout (#22, #53, #59, #17, #19). The maintainer's
   own words: "Couldn't figure out a reliable way to make the applescripts query work in under
   10 seconds" (#58). This is the evidence for EventKit and Contacts.framework, bounded page sizes,
   and a runner that kills the child when the time budget runs out.
3. **Permission failures were invisible.** The access checks ask for `name` of the application
   (`utils/calendar.ts:29-32` and the same in every module), which doesn't read any data, so no
   prompt appears (#65, #69, #74) and the check passes even when reads will fail. Errors are then
   swallowed into `[]`. "Application isn't running (-600)" shows up for Notes and Contacts (#44,
   #65). Each missing grant needs its own named failure, raised by a check that touches the data.
4. **The recipient was whatever string the model sent.** The send path puts the "phone number"
   straight into `buddy "…"` (`utils/message.ts:77`). Models passed names, which created
   lowercase "ghost" conversations (#48) or failed while reporting success (#24). Number handling
   assumes the US and prefixes `+1` to anything else, including `+44…` (#35). Recipients must
   resolve to a handle the user already has, through a region-aware normaliser.
5. **Writes ignored what they were given and then reported it back as done.** Creating a reminder
   uses the first list and only the name. It drops the list, notes and due date, then echoes the
   requested due date and an invented id `created-reminder-id` (`utils/reminders.ts:252-280`; #64,
   #26). Scheduling a message with an unparseable time sends it immediately
   (`utils/message.ts:522-536`). A write reports what the store holds afterwards, not what was
   asked for.

Also worth carrying forward: 9 of 46 issues are install friction (bun, `bunx` not on a GUI app's
`PATH`, Smithery), and injection sites exist beyond the three already known (see #48, #74, #67).

## Issues by context: calendar

### #74 Can't find any calendar entries (open)

- **Symptom:** The agent finds no calendar entries although the calendar has them. No permission
  prompt ever appears. A second user granted the terminal permissions and saw the same thing.
- **Environment:** Not given. Filed 2025-11-19, so v1.0.0.
- **Error text:** None.
- **Root cause:** The list and search operations in v1.0.0 never read Calendar.
  - `getEvents` runs a script that builds one hard-coded "No events available - Calendar operations
    too slow" record (`utils/calendar.ts:97-119`). Its string output then fails `Array.isArray`
    and becomes `[]` (`utils/calendar.ts:121-124`).
  - `searchEvents` returns an empty list by design (`utils/calendar.ts:173-179`).
  - The access check reads only `name` of Calendar (`utils/calendar.ts:29-32`), which doesn't
    touch calendar data, so no prompt is triggered (verify).
  - The tool answers "No events found from today to next 7 days." with `isError: false`
    (`index.ts:1029-1047`).
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent listing events` — `given events in the requested range, returns each occurrence with its calendar named`
  - [acceptance] `an agent listing events` — `given calendar access has not been decided, asks macOS for it before reading`
  - [acceptance] `an agent listing events` — `given calendar access was denied, fails naming the setting to change rather than reporting no events`

### #25 Not seeing all events in my calendar (closed)

- **Symptom:** Only events from the personal calendar come back. Events from other calendars in
  Calendar.app are missing.
- **Environment:** Claude Desktop (from the log format). Filed 2025-04-03, v0.2.x.
- **Error text:** Logs loop on `{"jsonrpc":"2.0","id":139,"error":{"code":-32601,"message":"Method not found"}}`
  in reply to `prompts/list`.
- **Root cause:** In v0.2.x, `getEvents` walks calendars in order and stops as soon as the result
  holds `limit` events, default 10 (`50c7738:utils/calendar.ts:331-338`). The first calendar fills
  the quota and the rest are never read. The `whose` filter asks for `startDate > from` and
  `endDate < to` (`50c7738:utils/calendar.ts:342-346`), which drops events that overlap either
  edge of the range. Calendar scripting also returns a recurring event's master, not its
  occurrences in the range (verify). The `prompts/list` noise is harmless: the server declares
  only `tools` (`index.ts:188-192`).
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent listing events` — `given events in several calendars, returns them merged in start order before applying the limit`
  - [domain] `an event range` — `given an event that starts before the range and ends inside it, includes it`
  - [domain] `an event range` — `given a recurring event, yields each occurrence that falls in the range`
  - [acceptance] `an agent listing events` — `given more events than the limit, says the list was cut short`

### #6 Calendar integration (closed)

- **Symptom:** Feature request by the maintainer, with no body. Closed by merged PR #21.
- **Environment:** n/a.
- **Error text:** None.
- **Root cause:** n/a. The feature was added, and later stubbed out again in v1.0.0 (see #74).
- **Verdict:** scenario (the calendar slice of Phase 3 covers it)
- **Scenarios:**
  - [acceptance] `an agent searching events` — `given text that appears in an event's title, location or notes, finds that event`

## Issues by context: reminders

### #64 no time set when creating a remainder (open)

- **Symptom:** A reminder created with a stated time gets no time.
- **Environment:** Not given. Filed 2025-08-12, v1.0.0.
- **Error text:** None.
- **Root cause:** `createReminder` takes `dueDate` and `notes` but the script sets only `name` on
  the first list (`utils/reminders.ts:248-266`). It then returns the requested `dueDate` as if it
  had been stored, with the invented id `created-reminder-id` (`utils/reminders.ts:273-280`), and
  the tool answers `Created reminder "…" in list "…"` (`index.ts:888-907`).
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent creating a reminder` — `given a due time, stores it and reports the due time read back from Reminders`
  - [acceptance] `an agent creating a reminder` — `given notes, stores them with the reminder`
  - [contract] `a reminder store` — `given a reminder saved with a due time, returns the same due time when fetched by its identifier`

### #34 Incorrect Time Parsing for Reminder Creation (closed)

- **Symptom:** "Remind me at 5:30 p.m. today" (the prompt was in Chinese, 下午5点半) produced a
  reminder at 6:25 p.m., 55 minutes late. Closed the same day by the reporter, without a fix.
- **Environment:** macOS Sequoia 15.3.1, Cursor 0.48.8. v0.2.x.
- **Error text:** None.
- **Root cause:** Unproven. In v0.2.x the tool took an ISO string, and JXA ran
  `reminderProps.dueDate = new Date(dueDate)` (`50c7738:utils/reminders.ts:232-234`). A 55-minute
  gap isn't a time zone offset, so the model probably produced the wrong string. The server gave
  it nothing to catch that with: the reply didn't echo the stored time in local terms.
- **Verdict:** scenario, and verify: how JXA's `new Date()` reads an ISO string with no offset
- **Scenarios:**
  - [domain] `a due time` — `given a wall-clock time with no offset, reads it in the user's time zone`
  - [domain] `a due time` — `given text that isn't a date and time, refuses it rather than guessing`
  - [acceptance] `an agent creating a reminder` — `reports the stored due time in the user's local time, so a wrong time is visible at once`

### #53 Listing Reminders causes "Request timed out" error (closed)

- **Symptom:** Listing reminders always times out. Adding reminders and the other apps work.
- **Environment:** Claude Desktop 0.10.14, macOS Sequoia 15.5, Claude Sonnet 4. v0.2.7.
- **Error text:** `No result received from client-side tool execution.` and
  `{"jsonrpc":"2.0","method":"notifications/cancelled","params":{"requestId":25,"reason":"Error: MCP error -32001: Request timed out"}}`
- **Root cause:** The `list` operation calls `getAllLists()` and then `getAllReminders()` with no
  list name (`50c7738:index.ts:707-710`). That reads every reminder in every list, completed ones
  included, with one Apple event per property per reminder (`50c7738:utils/reminders.ts:106-145`).
  On a large store it runs past the client's timeout. In v1.0.0 the operation is a stub that
  returns `[]` (`utils/reminders.ts:147-170`), so it no longer times out but never returns
  anything either.
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent listing reminders` — `given no list is named, returns incomplete reminders only`
  - [acceptance] `an agent listing reminders` — `given thousands of completed reminders, answers within the time budget`
  - [contract] `a reminder store` — `given a predicate for incomplete reminders, fetches them in one request rather than one per reminder`

### #59 Can't interact with Apple reminders (closed)

- **Symptom:** Listing or adding reminders does nothing. Reminders.app becomes "basically
  impossible to use" and stays slow after the MCP server is closed, until a reboot. Two more users
  confirm. One reproduced it with `@jxa/run` alone, just listing reminders.
- **Environment:** Warp terminal (Claude under the hood), launched with
  `"command": "bunx", "args": ["@dhravya/apple-mcp@latest"]`. v0.2.7.
- **Error text:** Only the requests, with no reply:
  `{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"reminders","arguments":{"operation":"list"}}}`
- **Root cause:** Same as #53 (`50c7738:utils/reminders.ts:106-145`). The server also never kills
  the `osascript` child when the client gives up, so Reminders keeps serving the flood of Apple
  events after the client has moved on. The create hung because it queued behind that work.
- **Verdict:** scenario
- **Scenarios:**
  - [contract] `the automation runner` — `given a script that runs past its time budget, kills it and reports a timeout`
  - [acceptance] `an agent listing reminders` — `given the request is cancelled by the client, stops the work it started`

### #26 reminders coudn't be fetch (closed)

- **Symptom:** Creating a reminder "works", but listing always returns 0. A commenter pinned it
  down: a reminder asked for in the "Shopping" list lands in the default "Reminders" list, while
  the model confirms it went to Shopping.
- **Environment:** Not given. v0.2.x.
- **Error text:** None.
- **Root cause:** In v0.2.x the reminder was made with `list.make({new: "reminder", …})` without
  `at: list`, so it went to the default list. Merged PR #54 fixed this
  (`50c7738:utils/reminders.ts:237-241`). v1.0.0 regressed further: it ignores `listName` entirely
  and uses `first item of allLists` (`utils/reminders.ts:252-258`), while the reply claims the
  requested list (`index.ts:901`). Listing is a stub (`utils/reminders.ts:147-170`). The v0.2.x
  code also quietly created any list it couldn't find (`50c7738:utils/reminders.ts:211-221`).
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent creating a reminder` — `given a named list that exists, puts the reminder in that list and reports the list it is in`
  - [acceptance] `an agent creating a reminder` — `given a list name that matches no list, refuses and names the lists that exist`
  - [acceptance] `an agent listing reminders` — `given a reminder just created, includes it`

## Issues by context: contacts

### #75 Contact retrieves only phone numbers not emails, etc (open)

- **Symptom:** Asked to email a friend, the agent looked the contact up and got three phone
  numbers and no email address.
- **Environment:** Not given. v1.0.0.
- **Error text:** None.
- **Root cause:** The contacts module reads only `phones` (`utils/contacts.ts:74-96`,
  `:163-196`). It drops every contact with no phone (`utils/contacts.ts:92-97`) and the tool
  schema offers nothing else (`tools.ts:3-15`). Emails, postal addresses, organisation and labels
  are never read.
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent finding a contact` — `given a contact with email addresses and phone numbers, returns both with their labels`
  - [acceptance] `an agent finding a contact` — `given a contact with only an email address, still finds them`
  - [acceptance] `an agent finding a contact` — `given an email address, finds the contact who owns it`

### #65 Contacts Permissions Not Requested (open)

- **Symptom:** The apple-mcp process never triggers the Contacts permission prompt, and the
  Contacts pane in Privacy & Security has no manual add button. The reporter's own debugging:
  scripting Contacts fails with "Application isn't running".
- **Environment:** Not given. Claude Code was used for the debugging. v1.0.0.
- **Error text:** `osascript -e 'tell application "Contacts" to get every person'` →
  `Error: 35:47: execution error: Contacts got an error: Application isn’t running. (-600)`
- **Root cause:** Two things.
  - The access check reads only `name` (`utils/contacts.ts:11-27`), which doesn't read contact
    data, so it prompts for nothing and passes even when the data is unreachable (verify).
  - All contact reads go through Automation of Contacts.app. The Contacts privacy permission then
    belongs to Contacts.app, not to the caller, so there is no entry for the user to add. -600
    means Contacts.app couldn't be reached from the calling process (verify under which parent
    processes this happens: Claude Code's sandbox, a background launch).
- **Verdict:** scenario, and verify: whether a Contacts.framework helper started by Claude Desktop
  or Claude Code gets its own prompt, and which app macOS credits it to (Decision 3)
- **Scenarios:**
  - [acceptance] `an agent finding a contact` — `given contacts access has not been decided, triggers the macOS prompt`
  - [acceptance] `an agent finding a contact` — `given contacts access was denied, fails naming Privacy & Security > Contacts and the app to allow`
  - [contract] `the native helper` — `reports the contacts authorisation status without reading any contact`

### #47 Contact API Fails to Return Details in apple-mcp (closed)

- **Symptom:** Searching by name finds the contact, but never with any phone numbers or email
  addresses, for every contact, every time. A later commenter still sees it.
- **Environment:** macOS Sequoia 15.5, Claude Desktop, apple-mcp 0.2.7 installed with the
  Smithery CLI.
- **Error text:** None.
- **Root cause:** In v0.2.7 the JXA code maps `(phone as {value: string}).value`, a method it never
  calls (`50c7738:utils/contacts.ts:31`, `:60-61`). Every value crosses the bridge as `undefined`.
  Unmerged PR #49 found it and calls `phone.value()`. v1.0.0 rewrote this in AppleScript, but
  listing all contacts now parses the string output as an array and yields `{}`
  (`utils/contacts.ts:106-118`), which becomes "No contacts found in the address book"
  (`index.ts:233-243`).
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent finding a contact` — `given a contact with a phone number, returns the number as written in Contacts`
  - [contract] `a contact store` — `given a contact with several phone numbers, returns every one with its label`

### #35 contacts and messages (closed)

- **Symptom:** It can't find the right contact, and sends to the wrong number ("using the country
  [code] twice"), so messages never arrive. Commenters: the contact is found with "empty fields
  for phone, email", even when the exact case-sensitive name is given.
- **Environment:** Not given (a screenshot of Claude). v0.2.x.
- **Error text:** Model output: "I found Michael Czeiszperger in your contacts, but the contact
  entry appears to have empty fields for phone, email, and other details."
- **Root cause:**
  - The empty fields are the `.value` bug from #47.
  - Number handling assumes the US. `normalizePhoneNumber` keeps `+1XXXXXXXXXX`, and otherwise
    prefixes `+` or `+1`, so `+447700900000` becomes `+1+447700900000`
    (`utils/message.ts:39-70`). That normaliser is used for reading. On send, the raw string goes
    into the script (`utils/message.ts:77`), so a number written with a national trunk prefix
    ("+44 (0)…") can also double up.
  - Maintainer: "Apple-mcp right now uses list/contacts and then searches uses regex if the
    applescript search itself fails."
  - The fuzzy fallback returns the **first** match's numbers (`utils/contacts.ts:289-297`), so a
    short name can resolve to the wrong person.
  - Lookup by phone matches when either number *contains* the other (`utils/contacts.ts:364`), so
    a short number matches many contacts.
- **Verdict:** scenario
- **Scenarios:**
  - [domain] `a phone number` — `given a number with a country code and a national trunk prefix, normalises to one E.164 number`
  - [domain] `a phone number` — `given a national number, applies the user's region rather than assuming the US`
  - [domain] `a phone number` — `given two numbers where one merely contains the other, does not treat them as the same`
  - [acceptance] `an agent finding a contact` — `given a name that matches several contacts, returns all of them rather than picking one`

## Issues by context: messages

### #62 Unable to read text messages (closed)

- **Symptom:** Title only, with no body or comments. Closed by the maintainer's sweep on
  2025-08-10.
- **Environment:** Not given. Filed 2025-08-02, v0.2.7.
- **Error text:** None.
- **Root cause:** Several reasons in the code, any one of which gives "No messages found".
  - The read query matches `handle.id IN (…)` only against `+1` forms of the input
    (`utils/message.ts:269-297`), so email handles (iMessage by Apple ID) and non-US numbers
    never match.
  - It inner-joins `handle` on `message.handle_id` (`utils/message.ts:296`), which drops messages
    whose `handle_id` is 0 (verify: the user's own messages, group chats).
  - It shells out to `sqlite3`, which needs Full Disk Access for the *host* app. Any failure is
    logged and turned into `[]` (`utils/message.ts:381-388`).
  - Text that only exists in `attributedBody` is decoded with regexes that return
    `[Message content not readable]` for most modern messages (`utils/message.ts:153-232`).
- **Verdict:** scenario, and verify: `handle_id` for sent messages in 1:1 and group chats, and
  whether `chat_message_join` is the right way to scope a conversation
- **Scenarios:**
  - [acceptance] `an agent reading a conversation` — `given a person reached by email address, returns their messages`
  - [acceptance] `an agent reading a conversation` — `includes the messages the user sent, not only those received`
  - [domain] `an attributed body` — `given a typedstream blob, decodes the message text exactly`
  - [acceptance] `an agent reading a conversation` — `given the Messages store can't be opened, fails naming Full Disk Access and the app to grant it to`

### #48 Messages Sent to Unstable "Ghost" Contacts in apple-mcp (closed)

- **Symptom:** "Send a message to [Name]" is confirmed by the agent, but Messages shows a new
  conversation addressed to a lowercase "name". The conversation disappears or misbehaves when
  clicked. It happens with or without special characters.
- **Environment:** macOS Sequoia 15.5, Claude Desktop (latest as of May 2025), apple-mcp 0.2.7
  via Smithery.
- **Error text:** None. The agent reported success.
- **Root cause:** The send script does `set targetBuddy to buddy "${phoneNumber}"` and
  `send … to targetBuddy` (`utils/message.ts:74-79`). It looks up `targetService` and never uses
  it. Nothing checks that the value is a phone number or email address, although the parameter is
  called `phoneNumber` (`tools.ts:60-63`). When the model passes a name, Messages makes a buddy
  whose handle is that name. The value is also **not escaped** (`utils/message.ts:77`), and the
  body escapes `"` but not `\` (`utils/message.ts:73`). Both are injection sites. The tool
  answers `Message sent to …` without checking anything (`index.ts:384-393`).
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent sending a message` — `given a recipient that is a name rather than a handle, refuses and lists the contacts that name matches`
  - [acceptance] `an agent sending a message` — `given a handle the user has never messaged, refuses: recipients must be known`
  - [acceptance] `an agent sending a message` — `given a body containing quotes, backslashes and script syntax, delivers it verbatim and runs nothing`
  - [acceptance] `an agent sending a message` — `given the send was accepted, reports it sent only once the message appears in the Messages store`

### #24 Message Sending Functionality Issue (closed)

- **Symptom:** Asked to send to a phone number, the tool used the recipient's name instead, and
  the message never arrived "(although Claude says it worked)". Searching contacts by name also
  fails, while listing all contacts works.
- **Environment:** Cursor IDE. OS "darwin 24.4.0" (macOS 15.4). v0.2.x.
- **Error text:** None.
- **Root cause:** Same send path as #48. Name search in v0.2.x used
  `Contacts.people.whose({name: {_contains: name}})` and then the `.value` bug
  (`50c7738:utils/contacts.ts:57-62`). Maintainer: "probably solvable by always looking up the
  contact first using applescripts if we're not sending it to a number or email".
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent sending a message` — `given a contact name that matches exactly one contact with one messaging handle, sends to that handle and names it in the reply`
  - [acceptance] `an agent sending a message` — `given the send could not be confirmed in the store, reports the outcome as unconfirmed rather than sent`

### #3 Add support for iMessage resource routes (closed)

- **Symptom:** Feature request by the maintainer: expose messages as MCP resources, for prompts
  like "summarise my last conversation with my girlfriend". Closed the next day when PR #4 added
  contact lookup and unread messages as tool operations. No resources exist on `main`.
- **Environment:** n/a.
- **Error text:** None.
- **Root cause:** n/a. The server declares only `tools` (`index.ts:188-192`). Client logs in #25
  and #49 show clients probing `prompts/list` and `resources/list` and getting -32601.
- **Verdict:** reject: resources aren't needed. Tools cover the use case, and tools can carry
  per-operation annotations and read-only enforcement.
- **Scenarios:**
  - [acceptance] `an agent reading a conversation` — `given a contact name, returns the most recent messages with that person in time order`

## Issues by context: notes

### #67 [Bug] Notes app content search not working in latest version (open)

- **Symptom:** In the previous version, searching notes by title returned their content. In the
  latest version the content can't be read. (A commenter's calendar remark was off-topic, and the
  reporter said so.)
- **Environment:** gemini-cli. v1.0.0.
- **Error text:** None.
- **Root cause:** `findNote` matches in AppleScript, but the result is `osascript`'s flat string.
  `Array.isArray` fails, so the whole string becomes one record with no fields, which maps to
  `{name: "Untitled Note", content: ""}` (`utils/notes.ts:190-200`). Even when it parses, content
  is cut to 200 characters (`utils/notes.ts:172-176`) and only the first 50 matches are kept. The
  search term is also put into the script **unescaped** (`utils/notes.ts:157`), another injection
  site.
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent searching notes` — `given text that appears only in a note's body, finds that note`
  - [acceptance] `an agent opening a note` — `returns the note's full text, not a preview`
  - [acceptance] `an agent searching notes` — `given more matches than the page size, says how many more there are`

### #44 Notes functionality errors: "Application isn't running" and "whose is not a function" on certain macOS versions (closed)

- **Symptom:** Listing or creating notes fails with "Application isn't running". Searching fails
  with `whose is not a function`, although Notes is open, Full Disk Access is granted and Script
  Editor can script Notes. Notes doesn't appear under Automation. Calendar and Contacts work. The
  reporter's workaround, "tested on macOS Sonoma": fetch all notes and filter them in JavaScript.
- **Environment:** Notes 4.12.6. macOS version not stated beyond "certain" versions (Sonoma for the
  workaround). v0.2.7.
- **Error text:**
  - `Error accessing notes: Command failed: /usr/bin/osascript -l JavaScript execution error: Error: Error: Application isn't running. (-600)`
  - `Error: TypeError: Application("Notes").notes.whose is not a function. (In 'Application("Notes").notes.whose({ _or: [ { name: { _contains: searchText } }, { plaintext: { _contains: searchText } } ] })', 'Application("Notes").notes.whose' is undefined) (-2700)`
- **Root cause:** v0.2.7 searched with `Notes.notes.whose({_or: …})` (`50c7738:utils/notes.ts:31-43`).
  Probably both errors are one failure: when JXA can't reach Notes (-600, Automation never
  granted, since Notes isn't in the list), the element collection has no `whose`. v1.0.0 swapped
  in AppleScript loops (`utils/notes.ts:153-188`), which hides the error message but not the
  reachability problem.
- **Verdict:** scenario, and verify: reproduce -600 and "whose is not a function" on macOS 14, 15
  and 26 with Automation for Notes denied, not yet decided, and granted. This decides the Notes
  mechanism in plan.md.
- **Scenarios:**
  - [acceptance] `an agent searching notes` — `given Automation of Notes has not been allowed, fails naming Privacy & Security > Automation and the app to allow`
  - [contract] `a note store` — `given text to search for, finds matching notes without depending on the scripting bridge's query support`

### #43 Notes功能在某些macOS版本上出现"Application isn't running"和"whose is not a function"错误 (closed)

- **Symptom:** The same report as #44, in Chinese, by the same author 30 minutes earlier. Closed
  by the author.
- **Environment:** As #44.
- **Error text:** As #44.
- **Root cause:** As #44.
- **Verdict:** reject: duplicate of #44
- **Scenarios:** none beyond #44.

### #22 Notes Issue (closed)

- **Symptom:** Any Notes request launches Notes and then never finishes. Notes sits at about 40%
  CPU and reopens when quit or force-quit, until a reboot. A second user (macOS 15.3.2, M1 Pro)
  sees Reminders and Notes hang at `operation: list`.
- **Environment:** Claude Desktop, bun from Homebrew, macOS 15.3.2. v0.2.x.
- **Error text:** None.
- **Root cause:** `getAllNotes` reads `name()` and `plaintext()` of every note with one Apple event
  each (`50c7738:utils/notes.ts:16-29`). Search fell back to that as well
  (`50c7738:utils/notes.ts:45-53`). The server doesn't kill `osascript` when the client gives up,
  so the script keeps driving Notes, which relaunches it. The maintainer: "This usually happens
  when the app itself takes a lot of time to run a tool. For eg, list all notes." PR #28 tried a
  cache (see below).
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent listing notes` — `returns a page of titles, folders and modification dates without note bodies`
  - [contract] `the automation runner` — `given the client cancels a request, terminates the script it started so the app is left alone`

### #27 Notes/Reminders Integration Issue - Creating New Items Instead of Editing Existing Ones (closed)

- **Symptom:** Asked to edit an existing note or reminder (a shopping list, a due date), the agent
  creates a duplicate with the changes instead.
- **Environment:** Claude (Desktop implied). v0.2.x.
- **Error text:** None.
- **Root cause:** Feature gap. Neither tool has an update operation (`tools.ts:26`, `:142`). The
  maintainer: "right now this doesn't have support for editing notes and reminders".
- **Verdict:** scenario (as a feature, behind the write setting)
- **Scenarios:**
  - [acceptance] `an agent updating a reminder` — `given the reminder's identifier, changes that reminder and creates nothing new`
  - [acceptance] `an agent updating a note` — `given a change that would drop formatting or attachments, refuses rather than rewrite the note lossily`
  - [acceptance] `an agent updating a note` — `given only a title, refuses: a note is changed by its identifier`

## Issues by context: mail

### #69 Cannot find any mails (open)

- **Symptom:** Mail searches find nothing, with the DXT or with the standalone server, and no
  permission prompt appears. Two more users. One has Full Disk Access and Mail access granted and
  can list accounts with AppleScript from the command line, but not through the tool.
- **Environment:** Claude Desktop (DXT) and standalone, "regardless of installation method and
  client". v1.0.0.
- **Error text:** "calendar/mail are not working, you are spoiling people time with this project..."
- **Root cause:** v1.0.0 reads can't return mail.
  - `getUnreadMails` and `searchMails` build results in AppleScript, return only a count, and then
    `return []` (`utils/mail.ts:138-149`, `:237-248`).
  - `getAccounts` returns the literal `{"Default Account"}` and `getMailboxes` returns
    `{"Inbox", "Sent", "Drafts"}` (`utils/mail.ts:345-358`, `:385-398`). Both are then lost to
    `Array.isArray` on a string (`utils/mail.ts:360-366`, `:400-406`).
  - The access check reads `name` only (`utils/mail.ts:25-40`), so no prompt.
  - Search matches the subject only (`utils/mail.ts:205`), and its term is put into the script
    unescaped (`utils/mail.ts:182`).
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent listing mail accounts` — `returns the account names configured in Mail`
  - [acceptance] `an agent searching mail` — `given text that appears in a message's subject or sender, finds that message`
  - [acceptance] `an agent searching mail` — `given Mail can't be reached, fails naming the reason rather than reporting no messages`

### #58 Unable to access any emails or contacts (open)

- **Symptom:** Reading mail finds zero messages in every account, while sending works. Contacts
  are found by name with no numbers or addresses. Messages can send but not read. Calendar works
  for this reporter. Commenters (June to December 2025) add that most tools time out, contacts
  give only names, and the "latest" mail was from April. After closing it as completed, the
  maintainer asked for v1.0.0. A commenter pointed at the `return []` stubs. The maintainer: "my
  bad - I removed it because it was quite unstable before. Couldn't figure out a reliable way to
  make the applescripts query work in under 10 seconds".
- **Environment:** macOS Sequoia 15.5, MacBook Pro M4, Claude (screenshots). Also Cline. v0.2.7,
  then v1.0.0.
- **Error text:** Model output via Cline: "the `contacts` tool consistently times out or fails to
  retrieve phone numbers, and the `messages` tool cannot find any messages." Model output: "I found
  one email in your account, but it's from April 2nd, not today."
- **Root cause:** Several.
  - Mail stubs as in #69. In v0.2.7, `latest` couldn't compile because
    `sort messagesList by date sent` isn't AppleScript (`utils/mail.ts:533-536`, unchanged since).
    Search used `whose … content contains`, which loads every message body
    (`50c7738:utils/mail.ts:332`).
  - The contacts `.value` bug from #47.
  - The messages handle matching from #62.
  - Unread messages look up the contact for *each* message by running the 1,000-contact
    AppleScript loop (`index.ts:452-470`, `utils/contacts.ts:340-381`), so "unread" times out.
  - An old "latest" email means no sorting: mailbox order isn't date order.
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent listing recent mail` — `given a mailbox, returns its newest messages first`
  - [acceptance] `an agent listing unread messages` — `names each sender from Contacts without one lookup per message`
  - [contract] `a mail store` — `given a mailbox with thousands of messages, returns the newest page within the time budget`

### #30 apple mail search fails (closed)

- **Symptom:** Searching and listing always fail. Even "list the latest 5 messages of an account"
  doesn't work. The model tries `"*"` as the search term, but the search takes no wildcards.
- **Environment:** Not given. v0.2.x.
- **Error text:** None. A commenter points at the branch's `if (bcc and typeof bcc !== "string") return false;`
  (a syntax error introduced by PR #32's branch; `index.ts:1491` on `main` has `&&`).
- **Root cause:** There was no way to list without a term, so models invented wildcard syntax. The
  maintainer added `latest` directly on `main` (`0620f65`, `a6d4a4c`, the content of PR #32), and
  it never works: the invalid `sort` (`utils/mail.ts:533-536`) and a brace-matching parse of
  brace-less output (`utils/mail.ts:545`). Maintainer: "This is mostly solvable by adding more
  specific tools for different mail tasks."
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `an agent listing recent mail` — `given an account and no search text, returns that account's newest messages`
  - [domain] `a mail search query` — `given characters such as an asterisk, matches them literally rather than as a wildcard`

### #19 Apple Mail - Failed retrieval (closed)

- **Symptom:** Sending works, but any lookup ("what is the last thing I have sent") times out, in
  every folder, on an Exchange/Office 365 account. A second user gets a JXA `TypeError`.
- **Environment:** Exchange/O365 account in Mail. Client not stated. v0.1.x (March 2025).
- **Error text:** `Error with mail operation: Error searching mail: Command failed: /usr/bin/osascript -l JavaScript execution error: Error: TypeError: console.error is not a function. (In 'console.error(\`Searching for "${searchTerm}" in mailboxes...\`)', 'console.error' is undefined) (-2700)`
- **Root cause:** Commit `33f98fb` replaced every `console.log` with `console.error`, including
  inside functions `@jxa/run` serialises into JXA, where `console.error` doesn't exist. Fixed by
  removing them. The timeouts come from scanning every mailbox of a remote Exchange account with
  `whose` over content.
- **Verdict:** scenario
- **Scenarios:**
  - [contract] `the automation runner` — `given a script that throws, reports a named script failure carrying the script's message`
  - [contract] `each automation script` — `runs under osascript with only the arguments it declares, on the Mac it ships for`
  - [acceptance] `an agent searching mail` — `given an account that answers slowly, searches the other accounts and says which one didn't answer`

### #51 Suggestion: email management (closed)

- **Symptom:** Feature request: move messages between mailboxes, create mailboxes, mark as
  read/unread, flag or label, create rules and delete. The reporter notes "this is dangerous, and
  maybe should have checks around it". A commenter points to a personal fork (`sebbaker/apple-mcp`)
  with drafts, replies, list and read, list mailboxes, move and copy, archive and trash.
- **Environment:** n/a.
- **Error text:** None.
- **Root cause:** n/a.
- **Verdict:** out of v1 scope. Drafts are already in plan.md Phase 3. Moving, flagging and
  deleting are destructive and wait until the write settings and confirmation are proven on
  sends. `sebbaker/apple-mcp` isn't in Appendix A: check it in the fork re-listing.
- **Scenarios:**
  - [acceptance] `an agent moving mail` — `given moves are not enabled in settings, refuses and says which setting enables them`

## Issues by context: cross-cutting

### #66 False Success of Calls (open)

- **Symptom:** "The MCP seems to confidently return false information, rather than fail." Asked for
  tomorrow's events, it says there are none (there are), when the reporter expected a permissions
  failure. A commenter says the same of map search.
- **Environment:** Claude (screenshot). v1.0.0.
- **Error text:** None.
- **Root cause:** Three patterns, repeated in every module.
  - Stubs return `[]` (`utils/calendar.ts:97-124`).
  - Every `catch` returns `[]` (`utils/calendar.ts:138-141`, `utils/mail.ts:150-155`,
    `utils/message.ts:381-388`, `utils/notes.ts:129-134`).
  - The handlers turn `[]` into "No events found…" with `isError: false`
    (`index.ts:1044-1047`).
  - `openEvent` "succeeds" for any id that doesn't contain `non-existent` or `12345`, a test hook
    left in the product (`utils/calendar.ts:337-343`).
- **Verdict:** scenario (plan.md non-negotiable 3)
- **Scenarios:**
  - [acceptance] `a tool result` — `given the store could not be read, is a failure naming why, never an empty success`
  - [acceptance] `an agent opening an event` — `given an identifier that matches no event, reports that no such event exists`
  - [contract] `each store port` — `given an empty store, reports empty; given an unreachable store, reports a named failure`

### #70 Not able to get reminders , calendar, mail working (open)

- **Symptom:** Nothing listed in Reminders. Commenters: Mail contents invisible, only Messages
  visible, "it can send messages, but can not read anything", no calendar entry created.
- **Environment:** Not given. Several reporters, September to November 2025, v1.0.0.
- **Error text:** None.
- **Root cause:** The v1.0.0 read stubs, all at once: reminders (`utils/reminders.ts:147-170`),
  calendar (#74), mail (#69). The "no calendar entry created" report fits `createEvent` building
  `date "${start.toLocaleString()}"` (`utils/calendar.ts:270-271`), which AppleScript parses by
  the system's date format, so it fails outside US-style locales (verify). It then silently falls
  back to `first calendar` (`utils/calendar.ts:274-280`).
- **Verdict:** scenario (covered by the per-context scenarios above, plus these)
- **Scenarios:**
  - [acceptance] `an agent creating an event` — `given a start and end with offsets, creates the event at those instants whatever the Mac's date format`
  - [acceptance] `an agent creating an event` — `given a calendar name that matches no calendar, refuses and names the calendars that exist`

### #8 apple-mcp server is receiving an array where it expects an object (closed)

- **Symptom:** The tools work, but a Zod error appears in the logs every time Claude opens.
- **Environment:** Claude Desktop. v0.1.x (February 2025).
- **Error text:** `[ { "code": "invalid_union", "unionErrors": [ { "issues": [ { "code": "invalid_type", "expected": "object", "received": "array", "path": [], "message": "Expected object, received array" } ], "name": "ZodError" }, … ], "path": [], "message": "Invalid input" } ]`
- **Root cause:** The client validates each line from the server's stdout as a JSON-RPC message
  (a union of 4 shapes) and got a JSON array. The server logged to stdout (`console.log`) at the
  time. `33f98fb` moved logging to stderr and later `index.ts:1308-1317` filtered string writes
  not starting with `{`. That filter is a patch: it doesn't catch a line that starts with `{` or
  `[` and isn't protocol.
- **Verdict:** scenario
- **Scenarios:**
  - [contract] `the stdio server` — `writes nothing but protocol messages to stdout, and all diagnostics to stderr`

### #15 Error message not displayed correctly in Cline (closed)

- **Symptom:** When a call has bad arguments, the error isn't shown to the model in Cline, so it
  can't correct itself.
- **Environment:** Cline. v0.1.x.
- **Error text:** Screenshot only.
- **Root cause:** Handlers threw, which the SDK turns into JSON-RPC errors that Cline didn't show.
  Fixed (maintainer, 2025-03-12). On `main`, bad arguments give a tool result, but only
  `Error: Invalid arguments for mail tool` (`index.ts:510-512`, `:1286-1295`), with no field or
  rule named.
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `a tool call with invalid input` — `is answered with a tool error naming each invalid field and the rule it broke`

### #10 Reminders crashing (closed)

- **Symptom:** Launching apple-mcp makes Reminders.app crash.
- **Environment:** Not stated (the reporter, `nbonamy`, appears to be Witsy's author, so probably
  Witsy). v0.1.x (March 2025).
- **Error text:** Screenshot of a crash dialog.
- **Root cause:** At the time, the server touched the apps at startup. Maintainer: "This is fixed
  with our dynamic loading now." On `main`, startup imports modules but runs no scripts
  (`index.ts:107-172`).
- **Verdict:** scenario
- **Scenarios:**
  - [acceptance] `starting the server` — `touches no app and no store until a tool is called`

### #71 Request: Review auto-generated MCP permission manifest for Apple_Native_Tools (open)

- **Symptom:** University of St. Gallen researchers auto-generated a sandbox permission manifest
  and asked for review: `mcp.ac.system.exec`, `filesystem.read`, `filesystem.write`,
  `filesystem.delete`, `system.env.read`, `network.client`. A user replied that sending mail and
  creating notes work, but setting events and finding contacts don't. The researcher knew of no
  working Apple-native MCP server.
- **Environment:** n/a.
- **Error text:** None.
- **Root cause:** n/a. The manifest matches upstream: `exec` (osascript, sqlite3, `do shell script`
  at `utils/contacts.ts:159`), filesystem write and delete (temp files at `utils/notes.ts:239-243`
  and `utils/mail.ts:285-289`, in `/tmp` under a guessable name), and network (web search via
  Safari).
- **Verdict:** reject: not a defect. Use it as input to `docs/security.md`. The rebuild should
  publish its own manifest: spawning the native helper and `osascript`, reading `chat.db`, and no
  filesystem writes, deletes or network.
- **Scenarios:**
  - [acceptance] `the server` — `makes no network connection in any operation`

## Issues by context: setup-and-clients

### #55 Starting Apple MCP with Claude integration fails with "Missing API Key" on Mac Mini M4 (closed)

- **Symptom:** Starting through Smithery fails. The maintainer suggested `npx install-mcp apple-mcp
  --client claude --yes`, and it then worked after adding symlinks for `bun` and `bunx`.
- **Environment:** Mac Mini M4, Claude Desktop, Smithery CLI.
- **Error text:** `[Runner] Error: Failed to fetch server connection: Registry request failed with status 401: Invalid API key`
- **Root cause:** Smithery's registry began requiring an API key. The server also needed `bun` on
  the GUI app's `PATH`.
- **Verdict:** install-docs (no registry dependency; the command runs a local binary by absolute
  path)
- **Scenarios:** none.

### #50 Facing issue while configuring Claude Desktop (closed)

- **Symptom:** Configuring Claude Desktop fails (screenshots only). A commenter says none of the
  three documented methods work out of the box. Fixes that worked: symlink `bun` into
  `/usr/local/bin`, or clone and run `bun run index.ts` locally and **launch Claude from a
  terminal** (`/Applications/Claude.app/Contents/MacOS/Claude`). Messages still didn't work;
  Calendar did.
- **Environment:** Claude Desktop. bun installed by Reflex under `~/Library/Application Support`.
- **Error text:** Screenshots.
- **Root cause:** GUI apps don't inherit the shell's `PATH`, so `bunx` wasn't found. Launching
  Claude from a terminal fixes `PATH` and also changes which process macOS asks for permissions
  (verify).
- **Verdict:** install-docs (use an absolute command path. Say which app receives the Full Disk
  Access, Automation, Calendars, Reminders and Contacts grants when launched from Claude Desktop
  versus a terminal.)
- **Scenarios:** none.

### #36 Initialization issue with python mcp client (closed)

- **Symptom:** Clients built on the official Python SDK (oterm, a bare `ClientSession`, mcpo) time
  out during `initialize` or `list_resources`. The server logs "Server connected successfully!"
  and hangs. It works with the MCP Inspector and Claude Desktop but not Witsy or SkyDeck AI. A
  commenter replaced bun with Node plus `tsx`, and it worked: "the issue was likely related to
  bun's stdio handling, when bun runs as a child process".
- **Environment:** Python MCP SDK, `command="bunx", args=["--no-cache", "apple-mcp@latest"]`.
  Labelled "help wanted".
- **Error text:** Log ends at `Connecting transport to server... Server connected successfully!`
- **Root cause:** bun's stdin handling when it runs as a child process (commenter's diagnosis).
  There's also a possible double start: if module loading takes over 5 s, the timeout calls
  `initServer()`, and a successful load calls it again, attaching two servers to one stdin
  (`index.ts:87-105`, `:136-142`; verify).
- **Verdict:** install-docs (the runtime is Node, per plan.md), plus a scenario
- **Scenarios:**
  - [contract] `the stdio server` — `given a client built on the official Python SDK, completes initialisation and lists its tools`

### #33 How to interactively test from terminal? (closed)

- **Symptom:** A would-be contributor can't exercise the dev server: `bun run index.ts` holds stdio,
  and a CLI client hangs.
- **Environment:** `mcp-client-cli`, bun.
- **Error text:** Log ends at `Server connected successfully!`
- **Root cause:** No developer docs. Also the bun stdio issue in #36.
- **Verdict:** install-docs (CONTRIBUTING: MCP Inspector, and the acceptance specs with fake ports
  as the primary way to exercise behaviour)
- **Scenarios:** none.

### #29 macOS 12 vscode cline mcp install error (closed)

- **Symptom:** The server crashes on connect in VS Code Cline on macOS 12, with a bun internal
  stack. A second user hits a Smithery CLI crash dump and exit code 1.
- **Environment:** macOS 12 Monterey, VS Code + Cline, bun. Smithery CLI via npx.
- **Error text:** `Failed to initialize MCP server: 1 | (function (stream,autoAllocateChunkSize){"use strict";var nativeType=@getByIdDirectPrivate(stream,"bunNativeType")…`
  and `连接状态: 错误 Process exited with code 1` ("connection status: error").
- **Root cause:** The runtime doesn't support that macOS version (bun streams, then an old Node for
  the Smithery CLI). There was no version check.
- **Verdict:** install-docs (state minimum macOS and Node. Make the server check both at startup.)
- **Scenarios:** none beyond the startup check, which Decision 4 settles.

### #17 Very cool! Sad doesn't work with cursor? (closed)

- **Symptom:** The Smithery installer rejects `--client cursor`. After configuring the run command
  by hand, tool calls time out.
- **Environment:** Cursor, Smithery CLI.
- **Error text:** `Invalid client "cursor". Valid options are: claude, cline, windsurf, roo-cline, witsy, enconvo`
- **Root cause:** Smithery CLI limitation (Cursor later adopted the standard config). The timeouts:
  maintainer, "the get all notes and get all contacts are pretty slow" (#22 pattern).
- **Verdict:** install-docs, plus a scenario
- **Scenarios:**
  - [acceptance] `an agent listing contacts` — `returns a bounded page and says how to fetch the next, rather than reading every contact`

### #14 Doesn't work with bun installed from bun website. (closed)

- **Symptom:** With bun installed by the `curl … | bash` script, the server fails to start. It works
  with Homebrew's bun.
- **Environment:** Claude Desktop, bun in `~/.bun/bin`.
- **Error text:** `[error] [apple-mcp] spawn bunx ENOENT` then `Server transport closed unexpectedly, this is likely due to the process exiting early.`
- **Root cause:** Claude Desktop's `PATH` doesn't include `~/.bun/bin`. Homebrew's `/opt/homebrew/bin`
  happened to be found.
- **Verdict:** install-docs (don't rely on `PATH` lookup from GUI clients; nvm-managed Node has the
  same trap)
- **Scenarios:** none.

### #5 FR: NPM Support (closed)

- **Symptom:** Feature request: install via npm (no body). The maintainer answered with the Smithery
  command.
- **Environment:** n/a.
- **Error text:** None.
- **Root cause:** n/a.
- **Verdict:** install-docs (the npm name `apple-mcp` is taken, Decision 1)
- **Scenarios:** none.

### #2 does not work! (closed)

- **Symptom:** The server won't start from Claude Desktop.
- **Environment:** Claude Desktop (client `claude-ai` 0.1.0).
- **Error text:** `env: bun: No such file or directory`, and for another user
  `[apple-mcp] [error] spawn bunx ENOENT {"context":"connection","stack":"Error: spawn bunx ENOENT\n    at ChildProcess._handle.onexit (node:internal/child_process:285:19)…`
- **Root cause:** bun missing, or not on the GUI `PATH` (see #14). The published entry had a bun
  shebang. The maintainer: "Bun should not be needed anyways".
- **Verdict:** install-docs
- **Scenarios:** none.

## Issues by context: out-of-scope

### #72 CharGPT developer mode (open)

- **Symptom:** Asks whether ChatGPT developer mode will be supported.
- **Environment:** ChatGPT.
- **Error text:** None.
- **Root cause:** ChatGPT's developer mode connects to remote MCP servers over HTTP. This is a
  local stdio server over personal data.
- **Verdict:** out of v1 scope (serving personal data over a network transport needs its own
  threat model)
- **Scenarios:** none.

### #45 Apple Maps search always fails (closed)

- **Symptom:** Every Maps search answers `No locations found for "tea"` (also cited in #66).
- **Environment:** macOS 15.5.
- **Error text:** `{"content":[{"type":"text","text":"No locations found for \"tea\""}],"isError":true}`
- **Root cause:** Maps has no scripting interface that returns results. The code opens a
  `maps://?q=` URL and tries `Maps.search()` (`utils/maps.ts:124-140`), neither of which can hand
  results back.
- **Verdict:** out of v1 scope (Maps is dropped, Decision 5)
- **Scenarios:** none.

### #38 Add Photos module with screenshot search functionality (closed)

- **Symptom:** A PR description posted as an issue: a JXA Photos module (albums, search by
  text or date, favourites, memories, people, export, and screenshot finding). The code is PR #39.
- **Environment:** n/a.
- **Error text:** None.
- **Root cause:** n/a.
- **Verdict:** out of v1 scope (Photos is a later candidate)
- **Scenarios:** none (see PR #39).

### #42 i didn't see it in readme - (closed)

- **Symptom:** A request for access to the system console to diagnose why the Mac is slow.
- **Environment:** n/a.
- **Error text:** None.
- **Root cause:** n/a.
- **Verdict:** reject: not the user's data in a native app, and reading every system log is far
  broader than the product's purpose
- **Scenarios:** none.

### #31 Glow cocktail mbti (closed)

- **Symptom:** A Korean cocktail personality-quiz HTML page pasted as an issue.
- **Environment:** n/a.
- **Error text:** n/a.
- **Root cause:** n/a.
- **Verdict:** reject: spam
- **Scenarios:** none.

## Unmerged pull requests

### #76 feat: Add tool annotations for improved LLM tool understanding (open)

- **Kind:** hardening
- **Context:** cross-cutting
- **Symptom:** Clients can't tell a read-only tool from one that sends mail, so they can't warn or
  auto-approve accordingly.
- **Root cause:** No `annotations` on any tool (`tools.ts:3-292`), and the SDK is pinned at
  `^1.5.0` (`package.json`).
- **Technique:** Adds `annotations` to all 7 tools and bumps the SDK to `^1.7.0`. Contacts gets
  `readOnlyHint: true, openWorldHint: true`. The first commit set `destructiveHint: true` on
  notes, messages, mail, reminders, calendar and maps. A follow-up flipped all of them to
  `destructiveHint: false` "because none of them support DELETE operations". Every tool gets
  `openWorldHint: true` and a `title`. The diff adds a 1,531-line `package-lock.json` to a bun repo.
- **Evidence:** PR #76 (branch `feat/add-tool-annotations`, `tools.ts +36/-1`), generated with
  Claude Code.
- **Quality of the fix:** wrong in part. One tool per app mixes reads and sends, so no single set
  of hints is true: `messages` both reads and sends. With `readOnlyHint` absent (so false) and
  `destructiveHint: false`, clients are told sending a message is a harmless additive update.
  `openWorldHint: true` on a local contacts lookup says the opposite of what it is.
- **Verdict:** adopt the idea. One tool per operation (Decision 2) is what makes accurate
  annotations possible. Deciding how to annotate a send is an open question below.
- **Scenarios:**
  - [acceptance] `the tool list` — `marks every operation that only reads as read-only`
  - [acceptance] `the tool list` — `marks sending a message or an email as neither read-only nor idempotent, and as reaching other people`
  - [acceptance] `the tool list` — `lists no write operation whose capability is disabled in settings`

### #73 Fix macOS Mail problems (open)

- **Kind:** fix
- **Context:** mail
- **Symptom:** Mail finds nothing: unread, search, mailboxes, accounts and latest (#58, #69, #70).
- **Root cause:** The v1.0.0 stubs and literals and the string-as-array parsing
  (`utils/mail.ts:138-149`, `:237-248`, `:345-366`, `:385-406`, `:533-545`).
- **Technique:**
  - Access check: `count of mailboxes` (reads data, so it can prompt) and `activate` first.
  - Accounts and mailboxes: really walks `accounts` and `mailboxes of eachAccount` and names each
    mailbox "Account - Mailbox".
  - Unread and search: walk `messages of inbox` (the unified inbox only), read `content` of every
    message to match subject **or content**, and stop at the limit.
  - Latest: picks the first mailbox whose name contains "INBOX"/"Inbox", or else the first with
    messages, and takes messages in mailbox order.
  - Results: joined with `||` between fields and `@@` between messages and split in TypeScript.
    `index.ts` wraps mailboxes, accounts and latest so failures return `isError: true`.
- **Evidence:** PR #73 (`zaclohrenz/main`, `index.ts +96/-60`, `utils/mail.ts +367/-226`); fixes
  #58, #69 in intent.
- **Quality of the fix:** partial.
  - Any subject or body containing `||` or `@@` corrupts the parse.
  - Search reads the full body of every inbox message, so it is slow on large mailboxes (the #19
    pattern).
  - Search and unread look only at the unified inbox, not sent mail or folders.
  - "Latest" assumes mailbox order is date order (verify).
  - The search term escaping still ignores backslashes, so injection remains. The PR says
    "someone should test".
- **Verdict:** adopt the idea: list real accounts and mailboxes, fail instead of returning empty,
  scope reads to one account's inbox. Reject: delimiter-joined text and reading bodies to search.
- **Scenarios:**
  - [acceptance] `an agent listing mailboxes` — `names each mailbox together with the account it belongs to`
  - [contract] `a mail store` — `given a subject or body containing any delimiter characters, returns the fields intact`
  - [acceptance] `an agent listing unread messages` — `given no account is named, returns unread messages from every account's inbox`

### #68 feat: Add draft email functionality (closed)

- **Kind:** feature
- **Context:** mail
- **Symptom:** The only way to compose mail is to send it immediately. There's no review step.
- **Root cause:** `sendMail` always ends with `send newMessage` (`utils/mail.ts:307`).
- **Technique:** Adds a `draft` operation: the `sendMail` script without the `send`, leaving a
  `visible:true` compose window open. Same quote-only escaping and `/tmp` body file.
- **Evidence:** PR #68 (`feat/add-draft-email-functionality`, `utils/mail.ts +81`, `index.ts +21`),
  generated with Claude Code. Closed by its author two days later: "rethinking the approach".
- **Quality of the fix:** partial. It opens a window rather than saving a draft, and nothing checks
  that a message reached the Drafts mailbox. Recipient and subject escaping misses backslashes.
- **Verdict:** adopt the idea (a draft is the safe default for composing mail), and verify: does
  an unsent `outgoing message` persist in Drafts without the window being closed or saved, and can
  it be created without a visible window?
- **Scenarios:**
  - [acceptance] `an agent drafting an email` — `saves the draft to the account's Drafts mailbox and reports it only once it is found there`
  - [acceptance] `an agent drafting an email` — `sends nothing, even when sending is enabled`

### #49 Fix/contacts search fix (closed)

- **Kind:** fix
- **Context:** contacts
- **Symptom:** Contacts are found without numbers (#47), search misses the right contact (#35), and
  lookups are slow.
- **Root cause:** `(phone).value` never called (`50c7738:utils/contacts.ts:31`, `:61`), a `whose`
  query that took the first of many matches, and a full reload of all contacts for each fallback.
- **Technique:**
  - Calls `phone.value()`.
  - Passes the search name to JXA as a function argument instead of interpolating it.
  - Falls back to an AppleScript that emits `name|phone` lines when JXA returns nothing.
  - Adds `ContactCache` (TTL, memory cap, cleanup) and `ValidationUtils` (name and phone
    sanitising, escaping for logs).
  - Phone lookup is cache-first, then a JXA scan comparing normalised variants.
  - Adds long troubleshooting text to the access failure.
- **Evidence:** PR #49 (`fix/contacts-search-fix`; `utils/contacts.ts +469/-50`,
  `utils/ContactCache.ts +339`, `utils/ValidationUtils.ts +76`); "Solves #47 and #35". The
  maintainer closed it: "the same functionality in this PR will be added in the next version". v1.0.0
  instead has the AppleScript rewrite.
- **Quality of the fix:** partial. It still reads phones only, and the fuzzy fallback still takes the
  first name that contains the text. The cache serves stale contacts for its TTL. Normalisation
  still hard-codes `+1`. `console.log` inside JXA is the #19 hazard (it happens to exist in JXA).
  The `|` line format breaks on names containing `|`.
- **Verdict:** adopt the idea: arguments as data, never interpolated, and reading the value rather
  than a function reference. Reject: the cache, since Contacts.framework reads are fast and a cache
  would hide edits.
- **Scenarios:**
  - [acceptance] `an agent finding a contact` — `given a contact edited a moment ago, returns the edited details`
  - [domain] `a contact name query` — `given text in a different case or with diacritics, matches the same contact`

### #40 Fix reminders list creation (closed)

- **Kind:** fix
- **Context:** reminders
- **Symptom:** A reminder asked for in a named list lands in the default list (#26).
- **Root cause:** `list.make({new: "reminder", …})` without `at: list` (pre-#54 `utils/reminders.ts`).
- **Technique:** `Reminders.make({new: "reminder", at: list, withProperties})`. The branch also
  carries the whole Photos module from #39 (`utils/photos.ts +941`).
- **Evidence:** PR #40 (`fix-reminders-list-creation`). Its diff equals #39 plus a 3-line
  reminders change. The maintainer asked for one combined PR (#41), then said he'd copy it by
  hand. The same fix was merged as PR #54.
- **Quality of the fix:** complete for v0.2.x. It's moot on `main`, where v1.0.0 ignores the list
  again (`utils/reminders.ts:252-258`).
- **Verdict:** adopt the idea (already covered by #26's scenarios)
- **Scenarios:** see #26.

### #41 Feature 01 (closed)

- **Kind:** noise
- **Context:** other:photos, reminders
- **Symptom:** n/a.
- **Root cause:** n/a.
- **Technique:** The same diff as #40, byte for byte (#39 plus the reminders fix), resubmitted at
  the maintainer's request. It got "please fix the merge conflicts" and was closed at the revamp.
- **Evidence:** PR #41 (`feature-01`); `cmp` of the #40 and #41 diffs shows them identical.
- **Quality of the fix:** see #39 and #40.
- **Verdict:** reject: duplicate of #39 and #40
- **Scenarios:** none.

### #39 feat(photos): implement comprehensive Photos module with screenshot search (closed)

- **Kind:** feature
- **Context:** other:photos
- **Symptom:** No access to the Photos library (#38).
- **Root cause:** n/a.
- **Technique:** A JXA module (`utils/photos.ts`, 941 lines) using `Photos.albums.whose`,
  `mediaItems.whose` with filename, description and keyword matching, favourites, memories,
  people, recent items, `openPhoto` and `exportPhoto`. Screenshots are found by filename pattern,
  album and PNG type.
- **Evidence:** PR #39 (`add-photos-module`); closes #38; demo video in comments.
- **Quality of the fix:** wrong where it matters. `exportPhoto` runs
  `app.doShellScript(\`mkdir -p "${folderPath}"\`)` with a folder derived from the agent-supplied
  `outputPath`, which is **shell injection**, and it writes anywhere on disk. `whose` over every
  media item doesn't scale to real libraries.
- **Verdict:** out of v1 scope
- **Scenarios:**
  - [acceptance] `an agent exporting a photo` — `given a destination outside the allowed export folder, refuses`

### #52 Adding Apple Music support (closed)

- **Kind:** feature
- **Context:** other:music
- **Symptom:** No Music control.
- **Root cause:** n/a.
- **Technique:** `utils/music.ts` (470 lines): AppleScript `every track whose name/album/artist
  contains`, `every playlist whose name contains`, play a track by name and artist, current track,
  and play/pause/next/previous through JXA.
- **Evidence:** PR #52 (`babanikrishna/main`); the maintainer requested changes for merge
  conflicts, then it was closed.
- **Quality of the fix:** partial. Queries escape `"` but not `\`, and the `type` argument goes into
  the script with no escaping at all (`"${type}" is "tracks"`), so injection is possible. It only
  searches the local library.
- **Verdict:** out of v1 scope
- **Scenarios:**
  - [acceptance] `an agent searching music` — `given a query containing script syntax, treats it as text to match`

### #37 Fix email search (closed)

- **Kind:** fix
- **Context:** mail
- **Symptom:** Search fails and there's no way to list recent mail in an account or mailbox (#30).
- **Root cause:** Search took only a term and scanned every mailbox (`50c7738:utils/mail.ts:300-437`).
- **Technique:**
  - Removes the `list` operation: an empty `searchTerm` lists instead.
  - Adds optional `account`, `mailbox`, `fromDate`, `toDate` and `maxMailboxes`.
  - AppleScript: resolves the mailboxes in scope, then
    `messages of box whose subject contains or content contains or sender contains`. An empty term
    becomes `" "`. It stops after `limit*2` candidates and tries to sort with
    `tell application "System Events" to sort … by date sent`.
  - JXA fallback: `whose` on subject or sender only (content removed for speed). Date range is
    filtered after fetching. Sorted by date in JavaScript. A date-only `toDate` is extended to the
    end of that day.
- **Evidence:** PR #37 (`fix-email-search`, `utils/mail.ts +267/-62`), "vibe coded". The maintainer
  closed it: "doing a ~ major rewrite of apple mcp in which I will be including these changes!" The
  rewrite didn't include them.
- **Quality of the fix:** partial.
  - The System Events `sort` isn't a real command, so its `try` swallows the failure and results
    come back unsorted.
  - Stopping after `limit*2` candidates means "newest" isn't the newest across mailboxes.
  - Searching `content` in the AppleScript path is the slow case again.
  - A space as the empty term misses messages without spaces.
  - Escaping is quote-only.
- **Verdict:** adopt the idea: scope a search by account, mailbox and date range, and treat a
  date-only end date as the whole day. Reject: the empty-term-means-list overload, since listing
  is its own operation.
- **Scenarios:**
  - [acceptance] `an agent searching mail` — `given an account, a mailbox and a date range, returns only messages inside all three`
  - [domain] `a date range` — `given an end date with no time, includes the whole of that day in the user's time zone`
  - [acceptance] `an agent searching mail` — `given more matches than the limit, returns the newest ones across every mailbox searched`

### #32 Fix mail search to list latest messages (closed)

- **Kind:** feature
- **Context:** mail
- **Symptom:** No way to list the latest mail in an account (#30).
- **Root cause:** No operation for it.
- **Technique:** Adds a `latest` operation and `getLatestMails`: per mailbox of the account,
  `sort messagesList by date sent`, take `limit`, and parse `{…}` records from the output.
- **Evidence:** PR #32 (`fix-mail-search`, Copilot Workspace). Its commits `0620f65` and `a6d4a4c`
  are on `upstream/main`, pushed directly, and the code is `utils/mail.ts:473-582` today. The PR
  itself was closed.
- **Quality of the fix:** wrong. `sort … by date sent` doesn't compile as AppleScript (see the
  brightline research, `osacompile` -2741). The brace regex can't match `osascript`'s output. The
  branch also had `bcc and typeof bcc` (#30).
- **Verdict:** reject: already on `main` and broken. The idea is covered by #30's scenarios.
- **Scenarios:** see #30.

### #28 notes: listByFolder, byDateRange, recentByFolder, temporary cache (closed)

- **Kind:** feature
- **Context:** notes
- **Symptom:** Notes listing pegs CPU (#22), and there's no way to scope notes by folder or date.
- **Root cause:** `getAllNotes` reads every note's body one Apple event at a time
  (`50c7738:utils/notes.ts:16-29`).
- **Technique:**
  - Adds `listByFolder`, `recentByFolder` (sorted by creation date) and `byDateRange`
    (`creationDate` `whose`, with a JavaScript re-check).
  - A module-level 60 s folder cache and 30 s per-folder notes cache. `getAllNotes` truncates
    content to 100 characters and folder listings to 500.
  - `parseLocalDate` reads `YYYY-MM-DD` as local midnight, or local 23:59:59.999 for an end date.
  - The author noted "timestamps need to be adjusted for UTC vs localtime" and "excess memory &
    cpu usage … need to investigate".
- **Evidence:** PR #28 (`jdchibuk/main`, `utils/notes.ts +556/-89`); referenced from #22 ("~30-40%
  reduction in CPU usage, WIP"). Closed at the revamp.
- **Quality of the fix:** wrong.
  - `getNotesFromFolder` calls `getNotesFromCache`, which on a miss calls `getNotesFromFolder`
    again: unbounded recursion on the first request for any folder.
  - The folder cache stores JXA object specifiers returned across the `osascript` boundary, which
    don't survive serialisation.
  - Folders are keyed by name, so same-named folders in different accounts collapse.
  - "Recent" sorts by creation date, not modification date.
- **Verdict:** adopt the idea (list notes in a folder, by date, most recently changed first; a
  date-only range bound means local day bounds). Reject: the cache.
- **Scenarios:**
  - [acceptance] `an agent listing notes` — `given a folder, returns only that folder's notes, most recently modified first`
  - [acceptance] `an agent listing notes` — `given two accounts that each have a folder with the same name, tells the folders apart`
  - [domain] `a date range` — `given a start date with no time, begins at local midnight of that day`

### #56 feat: (closed)

- **Kind:** noise
- **Context:** other:demo
- **Symptom:** n/a.
- **Root cause:** n/a.
- **Technique:** Adds `apple-mcp-comprehensive-demo.js` (spawns the server with `bunx` and calls
  each tool) and `test-apple-mcp.js`. It rewrites `package.json` into a different package
  (`apple-mcp-demonstration`) and adds a `package-lock.json`.
- **Evidence:** PR #56 (`NYO2008/main`), empty description. Closed at the revamp.
- **Quality of the fix:** n/a
- **Verdict:** reject: not a change to the server, and it would have replaced the package metadata
- **Scenarios:** none.

### #46, #57, #61 Add MseeP.ai badge (closed)

- **Kind:** noise
- **Context:** other:readme
- **Symptom:** n/a.
- **Root cause:** n/a.
- **Technique:** Adds a third-party "Security Score: 100/100, Risk Level: low" badge to the README.
  Three near-identical PRs from the directory's founder (2025-05-14, 2025-06-17, 2025-07-17).
- **Evidence:** PRs #46, #57, #61 (`README.md +2` each).
- **Quality of the fix:** n/a. The "100/100" score coexists with the unescaped `buddy
  "${phoneNumber}"` injection, so automated scores like this are worthless as evidence.
- **Verdict:** reject: marketing
- **Scenarios:** none.

## Merged pull requests

- **#1** Dockerfile and `smithery.yaml` for Smithery deployment (README install notes). Superseded;
  the files aren't on `main`.
- **#4** Messages read via `sqlite3` on `chat.db` with regex `attributedBody` decoding, unread
  messages, contact-name lookup by phone. This is the origin of `utils/message.ts` and the `+1`
  normaliser.
- **#7** Apple Mail integration (unread, search, send, mailboxes, accounts) with AppleScript and a
  JXA fallback. The origin of `utils/mail.ts`.
- **#9** "Safe mode": eager module loading with a 5 s timeout that falls back to lazy loading
  (`index.ts:12-172`).
- **#11** Web search tool (Safari scraping Google) and moved tool schemas into `tools.ts`. Web
  search was later unregistered: `utils/web-search.ts` is dead code on `main`.
- **#12** Fixed `getAllNotes` return type.
- **#13** Smithery badge and local-install instructions.
- **#16** Glama directory badge.
- **#21** Calendar tool: search, open, list, and later create (JXA `whose` over calendars). Replaced
  by stubs in v1.0.0.
- **#23** Create note (default folder "Claude") and the Apple Maps tool (`utils/maps.ts`), plus
  `CLAUDE.md`.
- **#54** Reminder created in the requested list via `Reminders.make({at: list})`. Regressed in
  v1.0.0.
- **#60** Mail `latest` operation and search fixes (the #32 content), tool enum updates.
- **#63** README: missing closing brace in the JSON config example.

## Corrections to plan.md Appendix B

- **#70** isn't a calendar or reminders issue. It's a "no reads work in v1.0.0" report across
  reminders, mail and calendar → **cross-cutting** (results tell the truth).
- **#58** is **mail + contacts + messages**, not mail and contacts. It holds the maintainer's
  admission that mail reads were stubbed because AppleScript couldn't finish in 10 s.
- **#35** is **contacts + messages**: US-only phone normalisation and wrong-number sends, not only
  contact search.
- **#24** is **messages + contacts** (a name sent as the handle; name search broken).
- **#27** is a **feature request** (no update operation) for notes and reminders, not a bug. Keep it
  in both contexts, behind the write setting.
- **#10** belongs in **cross-cutting**: the Reminders crash came from the server touching apps at
  startup.
- **#22** and **#17** are also **performance and process-lifetime** evidence (a timed-out script
  keeps driving Notes). #17 is half setup (Smithery/Cursor) and half contacts and notes listing
  timeouts.
- **#3** is a **feature request for MCP resources**. Reject resources; the messages read
  scenario covers the need.
- **#65, #69, #74** share one root cause: an access check (`name` of the app) that never prompts
  and never fails. Group them under a **cross-cutting permission** theme as well as their contexts.
- **#71** isn't a cross-cutting bug. It's a research request and belongs in **security docs input**.
- **#72** (ChatGPT developer mode) is **out of v1 scope** (remote transport), not install docs.
- **#43** is a **duplicate** of #44. **#31** is **spam**, not an out-of-scope feature. **#38** is
  the PR #39 description posted as an issue.
- **#62** has no body. Its root causes are inferred from code.
- **#59** is correctly under reminders: it's the Reminders hang, the same as #53.
- **Outside Appendix B:** plan.md says upstream has 8 tools including `webSearch`. On
  `upstream/main`, `tools.ts:294` registers **7** (contacts, notes, messages, mail, reminders,
  calendar, maps). `utils/web-search.ts` is never imported.
- **Outside Appendix B:** besides the three injection sites already known, these values also go
  into scripts **unescaped**: contact search name `utils/contacts.ts:146`, notes search term
  `utils/notes.ts:157`, note folder name `utils/notes.ts:249-275`, mail search term
  `utils/mail.ts:182`, calendar name `utils/calendar.ts:276`. The temp files at
  `utils/notes.ts:239` and `utils/mail.ts:285` use guessable `/tmp` paths.
- **Outside Appendix B:** `sebbaker/apple-mcp` (mail drafts, move, archive, trash; see #51) should be
  checked when the forks are re-listed.

## Glossary candidates

- **handle**: an address one person is reached at in Messages (a phone number in E.164 or an email
  address). `handle.id` in `chat.db`. Upstream wrongly treats it as "phone number".
- **buddy**: Messages' scripting word for a handle on a service. Asking for a buddy with a
  non-handle string creates a ghost conversation (#48).
- **service**: iMessage or SMS, the transport a handle is reached over.
- **chat / conversation**: a thread in Messages (1:1 or group), joined to messages through
  `chat_message_join`.
- **attributed body**: the typedstream blob holding a message's text when `message.text` is empty.
- **known recipient**: a handle the user has already exchanged messages with (plan.md
  non-negotiable 4).
- **send confirmation**: the user's explicit approval of one specific send.
- **unconfirmed outcome**: a write that was attempted but couldn't be verified in the store.
- **mail account**: a configured account in Mail (iCloud, Exchange). Mailboxes belong to one.
- **mailbox**: a folder of messages within an account (INBOX, Sent, Drafts, user folders). Names
  repeat across accounts.
- **unified inbox**: Mail's app-level `inbox`, spanning all accounts.
- **draft**: an unsent message saved in an account's Drafts mailbox.
- **reminder list**: a named list of reminders (Reminders' "list"), belonging to an account.
- **due date / due time**: when a reminder is due. It may be date-only or have a time, and is read
  in the user's time zone.
- **completed reminder**: a reminder marked done. It is excluded from listings by default.
- **calendar**: a named calendar (personal, work, subscribed) holding events.
- **event**: a calendar entry with a start and end, or all-day. Identified by its uid.
- **occurrence**: one instance of a recurring event within a range.
- **note folder**: a folder of notes within a notes account. Names repeat across accounts.
- **note**: title plus body. Plaintext and formatted body differ, and a lossy rewrite loses
  formatting.
- **contact**: a person or company card with labelled phone numbers, email addresses and more.
- **Automation permission**: Privacy & Security > Automation, granting one app control of another.
- **Full Disk Access**: required to open `~/Library/Messages/chat.db`.
- **responsible app**: the app macOS attributes a permission prompt to (Claude, Terminal), not
  necessarily the process that asked.
- **time budget**: the longest an operation may run before it is stopped and reported as timed
  out.

## Open questions

1. Does asking an application for `name` (or `version`, `running`) resolve inside AppleScript
   without sending an Apple event? If so, that explains why no prompt ever appeared (#65, #69, #74),
   and a real access check must read data. Verify on macOS 14, 15 and 26.
2. What exactly produces "Application isn't running (-600)" for Notes (#44) and Contacts (#65)
   when the app is running: Automation denied, a sandboxed parent, or launching from a background
   process?
3. In `chat.db`, what is `message.handle_id` for messages the user sent, in 1:1 chats and in group
   chats? This decides whether reads must go through `chat_message_join` (#62).
4. How does JXA's `new Date()` interpret an ISO string with no offset, and could that explain the
   55-minute error in #34? The gap doesn't match any time zone offset, so the model may simply have
   produced the wrong time.
5. Is `messages of mailbox` in Mail ordered by date, by arrival or by id? PR #73's "latest" and the
   "email from April" report (#58) depend on it.
6. Does an `outgoing message` created without `send` persist as a draft if its window is never
   closed, and can it be saved with `visible:false` (PR #68)?
7. How should a send be annotated? The MCP spec defines `destructiveHint` as "may perform
   destructive updates", while sending is additive but irreversible and reaches other people.
   `readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true` is the
   cautious reading. PR #76's author argued the opposite.
8. When the Swift helper is spawned by Claude Desktop versus by Claude Code in a terminal, which app
   appears in the Calendars, Reminders and Contacts prompts and panes (#50's "launch Claude from the
   terminal" workaround hints this matters)? This is the check Decision 3 asks for.
9. Should creating a reminder in a list that doesn't exist refuse (proposed above) or create the
   list, as v0.2.x did? Refusing is safer and matches "failures say how to fix them".
10. Upstream's README promised mail attachments and scheduled emails that were never built. Should
    the rebuild's README be generated from the printed spec so it can't overclaim?
11. Scheduled message sends lived in a `setTimeout` inside the server process
    (`utils/message.ts:517-552`). They were lost on exit, couldn't be listed or cancelled, and fired
    at once for an invalid date. Does v1 keep scheduling at all, and if so where does the schedule
    live?
