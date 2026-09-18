# `native/` — the helper

The helper is the Swift process that holds every macOS permission and reaches every store
([ADR-0002](../docs/adr/0002-helper-owns-every-protected-access.md)). The Node server holds no
permission of its own and opens no protected file; it starts the helper and talks to it.

So far it answers for the calendar, with its calendars, the events in a range and one event in
full; for the reminders, with the reminder lists and the reminders in them; for the contacts; and
for the messages, with the newest chats and a chat's messages. Each has its own permission.

## What it does

**It disclaims responsibility at startup.** macOS attributes a permission prompt — and the grant
behind it — to whichever process it holds *responsible*, which by default is whatever started the
helper: a Homebrew `node` shared with every other node-based server, or a terminal that would
extend the grant to everything run there. So the helper relaunches itself once through
`posix_spawn` with `responsibility_spawnattrs_setdisclaim`, and the child serves the session. The
child knows it is the child by the `APPLE_NATIVE_MCP_RESPONSIBILITY_DISCLAIMED` variable its parent
sets, so it relaunches exactly once. If disclaiming turns out to be impossible, the helper says so
on stderr and serves anyway rather than leaving the user with nothing.

**It speaks versioned JSON lines over stdio.** One JSON request per line in, one JSON response per
line out, and nothing else ever reaches stdout: a single stray line of text breaks a stdio session
for good. Anything meant for a human goes to stderr.

**It fails by name, never by crashing.** Every failure is a stable code, one sentence, and the
outside evidence verbatim.

| Code | When |
|---|---|
| `protocol_version_unsupported` | the request named a version the helper does not speak |
| `request_malformed` | the line was not a request the helper could read |
| `request_unknown` | the line named a request the helper does not answer |
| `calendar_permission_missing` | macOS has not allowed the helper to read the calendar; the sentence names the setting and where it is, or, while nobody has been asked, says to run `npx apple-native-mcp setup` |
| `calendar_unreadable` | one calendar would not answer; reported beside the events rather than instead of them, so one offline subscription does not take the whole read with it |
| `reminders_permission_missing` | macOS has not allowed the helper to read the reminders; the sentence names the setting and where it is, or, while nobody has been asked, says to run `npx apple-native-mcp setup` |
| `reminder_list_unknown` | a request named a reminder list the helper cannot find, perhaps deleted since it was listed; nothing is read |
| `reminders_timed_out` | no reminder list answered within the time budget; reported instead of an empty answer that would read as "no reminders" |
| `message_store_permission_missing` | macOS has not allowed the helper to read the message store; the sentence names the Full Disk Access setting and where it is, which only the user can turn on |
| `message_store_not_found` | this Mac has no message store at all, which is not a missing permission |
| `message_store_unreadable` | the message store is there but would not be read; the evidence is what the store said |
| `chat_unknown` | a request named a chat the message store does not have; nothing is read |

## The protocol

Every request carries `protocolVersion` and a string `id`; every response carries the version the
helper speaks and the `id` it was asked under, or `null` when no identifier could be recovered.

**The calendar permission**

```json
{"protocolVersion":1,"id":"1","request":"calendar_permission"}
{"id":"1","protocolVersion":1,"result":{"state":"granted"}}
```

`state` is one of `undecided`, `restricted`, `refused`, `writeOnly` or `granted`. Every state but
`granted` and `undecided` also carries `setting`, the setting to enable and where it lives.

**The events in a range**

```json
{"protocolVersion":1,"id":"2","request":"events_in_range","range":{"start":"2026-09-22T00:00:00Z","end":"2026-09-23T00:00:00Z"}}
```

```json
{"id":"2","protocolVersion":1,"result":{
  "range":{"start":"2026-09-22T00:00:00Z","end":"2026-09-23T00:00:00Z"},
  "events":[{
    "eventIdentifier":"…","title":"Stand-up",
    "start":"2026-09-22T09:00:00Z","end":"2026-09-22T09:15:00Z","allDay":false,
    "location":"Room 2","notes":null,"originalStart":"2026-09-22T09:00:00Z",
    "calendar":{"identifier":"…","title":"Work","account":{"identifier":"…","title":"iCloud"}}
  }],
  "calendars":[{"identifier":"…","title":"Work","account":{"identifier":"…","title":"iCloud"}}],
  "unreadableCalendars":[]
}}
```

The range's start is inside it and its end is the first instant outside it, so two ranges laid end
to end neither overlap nor leave a gap. An event that was already under way when the range began is
in it. A series is expanded into its occurrences, each carrying the series' event identifier and
the `originalStart` that addresses it within the series; an event belonging to no series has
`originalStart: null`. Events come back in the order they start. The helper never invents a range:
deciding what "this week" means belongs to the server, which knows the user's time zone.

Each entry of `unreadableCalendars` is a named failure carrying the `calendar` that would not
answer. A range longer than four years is refused as `range_too_long`: EventKit would read only its first
four years and say nothing. `calendars` is every calendar that was asked, including one holding nothing in the range. The
server counts the calendars the user's settings keep from an agent, and it counts calendars rather
than events so that the count says nothing about when an excluded calendar is busy.

Two more requests read the calendar. `calendars` answers with every calendar, readable or not,
each with `acceptsNewEvents`, which a subscription or the birthdays calendar lacks:

```json
{"protocolVersion":1,"id":"3","request":"calendars"}
```

`event` answers with the one event an identifier names, or `"event":null` when there is none:
not finding it is an answer, and the server decides how to say so. Every occurrence of a series
shares the series' identifier, so `originalStart` says which occurrence is meant, and the answer
carries that occurrence's own start and end. It is looked for in the one calendar its series
belongs to: on the day it should be, and then, for one the user moved, two years either side. An
identifier no event has answers at once and reads nothing. Without `originalStart` the answer is
the event itself, or whichever occurrence of a series the store thinks of first. An
`originalStart` that is not an instant is refused rather than dropped.

```json
{"protocolVersion":1,"id":"4","request":"event","eventIdentifier":"…","originalStart":"2026-09-22T09:00:00Z"}
```

**The reminders permission**

`reminders_permission` and `reminders_permission_request` answer exactly as their calendar
counterparts do, naming the Reminders setting instead.

**The reminder lists**

```json
{"protocolVersion":1,"id":"3","request":"reminder_lists"}
{"id":"3","protocolVersion":1,"result":{"reminderLists":[
  {"identifier":"…","title":"Groceries","account":{"identifier":"…","title":"iCloud"}}
]}}
```

**The reminders in some reminder lists**

```json
{"protocolVersion":1,"id":"4","request":"reminders","reminderLists":["…"],"includeCompleted":false}
```

```json
{"id":"4","protocolVersion":1,"result":{"reminders":[{
  "identifier":"…","title":"Bins out","completed":false,
  "due":{"date":"2026-09-25"},
  "reminderList":{"identifier":"…","title":"Errands","account":{"identifier":"…","title":"iCloud"}}
}],"unreadReminderLists":[]}}
```

Both fields are required: the server says which reminder lists and whether completed reminders are
wanted, and the helper chooses neither. Completed reminders are left out by EventKit's own fetch.
No reminder lists means no reminders, never those of every one, which is how EventKit would read an
empty set.

Every reminder list is fetched at once, and together they have two seconds. A reminder list that
has not answered by then is cancelled and named in `unreadReminderLists`, so one large list never
holds up the rest and a short answer never reads as the whole. When none answers in time, the
answer is `reminders_timed_out`; one deleted since it was listed is `reminder_list_unknown`. With
`"matching":"text"`, only the reminders whose title or notes mention the text, ignoring case, come
back; the text is compared and never interpreted, and empty text is refused. A
reminder's notes are never sent: an index keeps to small fixed fields (ADR-0006). `due` is `null`, a due date as `{"date":"2026-09-25"}` with no time of day, or a due time
as `{"time":"2026-09-25T21:00:00Z"}`, an instant the server shows in the user's time zone.

Two requests write. `default_calendar` answers with the calendar the user set in Calendar for new
events, or `"calendar":null`: the helper never picks one for them. `create_event` names its
calendar and its title and says when the event is in exactly one way, a `start` and an `end` or a
`firstDay` and a `lastDay`. An all-day event's days stay days until EventKit is handed them, in
this Mac's own time zone, so it cannot slide onto the day before. Every piece of text becomes a
property of the event and nothing is assembled into a script.

```json
{"protocolVersion":1,"id":"5","request":"create_event","calendarIdentifier":"…","title":"Lunch","start":"2026-09-22T12:30:00Z","end":"2026-09-22T13:30:00Z","location":"…","notes":"…"}
```

The answer is the event as the store holds it and `confirmed`, which is false when the store took
the event and then could not show it. That is an answer and not a failure, because a failure would
have the caller create it again. For the same reason the server sends a write exactly once: a
helper that dies with a write in hand may have done it first, so the server reports that outcome
as unconfirmed too, where a read would simply be asked again. A calendar the store lacks is `calendar_not_found`, one that
refuses new events is `calendar_not_writable`, and a save EventKit refused is `event_not_saved`
with what it said. Writing needs a full or a write-only calendar permission.

Contacts are read through Contacts.framework, never by scripting the Contacts app, so a read never
launches it and never asks for an Automation consent. `contacts_permission` and
`contacts_permission_request` work as the calendar's do. `contacts` answers with every contact,
unified across accounts, each with every part of its name, its nickname, organisation and job title,
and every phone number, email address, postal address and URL it has. A fetch that fails, or stops
partway, is `contacts_unreadable` with what the framework said: it is never an answer of nobody. A label is exactly what the store holds, Apple's own
included (`_$!<Mobile>!$_`): which contacts a query finds, and how a label is said, are the
server's rules.

```json
{"protocolVersion":1,"id":"7","request":"contacts"}
```

A contact has no note here. macOS keeps that field for apps Apple has entitled, and asking the
framework for it without the entitlement fails the whole fetch, so the helper never does:
`"include":["note"]` is understood and refused as `contact_note_unavailable`.

**The chats**

```json
{"protocolVersion":1,"id":"8","request":"chats","limit":20}
{"id":"8","protocolVersion":1,"result":{"chats":[{"identifier":"iMessage;+;chat001","kind":"group","lastTimestamp":"2026-09-18T09:01:00Z","participants":["+15551230001","ben@example.com"]}],"truncated":false}}
```

The newest chats with real traffic, up to `limit`, which is required and at most 500. A chat whose
only messages are the user's own failed sends is a ghost chat and is left out. `kind` is the chat's
own, `one-to-one` or `group`, never counted from its participants, and the user is never a
participant. `truncated` says there were more.

**A chat's messages**

```json
{"protocolVersion":1,"id":"9","request":"chat_messages","chat":"iMessage;+;chat001","limit":50,"range":{"start":null,"end":null}}
{"id":"9","protocolVersion":1,"result":{"messages":[{"chat":"iMessage;+;chat001","delivery":null,"direction":"incoming","handle":"ben@example.com","identifier":"…","service":"iMessage","text":"Wall at 6?","timestamp":"2026-09-18T09:00:00Z"}],"truncated":false}}
```

The chat's newest messages, oldest first. `range` may leave either bound open with `null` or by
leaving it out; a bound that is written but is not an instant is refused, and so is a range that
does not move forwards. `delivery` says how far one of the user's messages got, `sent`,
`delivered` and the delivery `error` the store recorded, and is `null` for an incoming one: a send
that failed is not real traffic, and never reads as one that left. Reactions and group
events such as a rename are left out: nobody wrote them to the chat. `handle` is where an incoming
message came from, and `null` for the user's own. `text` is `null` when the store keeps no text the
helper can read yet.

The store is opened read-only, by path, and every value in a query is bound, never written into it.
Before it is opened, the file is opened for reading once, because macOS refuses a protected file
before SQLite sees it and only the error number tells a refusal from a store that is not there:
`EPERM` is macOS's refusal, `ENOENT` a store that is not there, and anything else, the file's own
access mode included, is unreadable. Without Full Disk Access, macOS may refuse even a path with no
store behind it, since the folder itself is protected, so a missing permission is reported first
(MSG-V13, unverified). A read waits a second for Messages' write lock, then fails rather than
holding the session.

Notes has no framework, so it is reached through **static scripts**: JavaScript for Automation
compiled into the helper, each chosen by name. Whatever varies travels beside a script as one JSON
argument, never as part of its text, and a script's answer is JSON or is refused. Scripts run
inside the helper's own process through OSAKit, so the Apple Events are the helper's and so is the
permission to control the app; nothing is handed to `osascript` and nothing is written to disk.
They run on the helper's main thread, which runs the main run loop while the session is served
from a thread of its own: sent from a worker thread while the main thread sat blocked, an Apple
Event sometimes never got its reply, and against Mail one run in a dozen hung (#44).
One request's scripts share a time budget of eight seconds, each getting what is left of it. A
script that outlives it is given up on as `-1712`, and because nothing can cancel a script in
flight, the helper runs nothing more, answers, and stops, and the server starts a fresh one.

`notes_permission` and `notes_permission_request` report and ask for the permission to control
Notes, starting Notes in the background when it is not running, since macOS can only say for an app
that is. A Notes that will not start is a failure that says so, never a missing permission. No
script is ever run while the permission is undecided: the first Apple Event is what makes macOS
prompt, and only `setup` asks.

```json
{"protocolVersion":1,"id":"9","request":"note_folders"}
{"protocolVersion":1,"id":"10","request":"notes_mentioning","text":"boiler","noteFolders":["…"]}
{"protocolVersion":1,"id":"11","request":"note","identifier":"…","noteFolders":["…"]}
```

`note_folders` names every note folder with its notes account: every account has one called Notes.
`notes_mentioning` searches only the note folders it is given, compares the search text and never
interprets it, and answers with the notes found, each once, with the identifier of the note folder
it was read from and never its text, so a search hands nobody a library of notes. A note folder
that will not be read, or that the time budget never reached, is named in `unreadNoteFolders` with
why, and the rest are searched anyway; `notesUnread` counts the notes whose text would not come
back, which cannot be said not to mention anything. `note` answers with one note in full, or
`"note":null` when it is not kept in any of the `noteFolders` it may be read from, which is settled
before any of its text is read. A locked note is said to be locked and its `text` is null; so is
the text of a note that would not be read, with `textUnread` true.

A note's folder cannot be asked of the note (its `container` is broken in Notes 4.13), so notes are
read a note folder at a time. A folder's columns are each one Apple Event, and only position ties
one to the next, so the identifiers are read before and after and an answer whose columns may have
slipped is refused rather than pairing one note's title with another's text.

## Building it

```sh
swift build -c release
```

The bundle identifier and the EventKit usage strings live in `Info.plist` and are linked into the
executable's `__TEXT,__info_plist` section, so a bare executable still carries an identity macOS can
attribute a prompt to. `Package.swift` passes the linker's `-sectcreate` for this; releases are
signed, hardened and notarised in CI
([ADR-0003](../docs/adr/0003-signed-helper-at-a-fixed-path.md)).

## Running a development build

By default the server launches only the installed helper at
`~/Library/Application Support/apple-native-mcp/apple-native-mcp`, and only after it meets the
code requirement ([ADR-0008](../docs/adr/0008-codesign-checks-the-code-requirement.md)). A build
from `swift build` is ad-hoc signed and never meets it. To run one, name it with the developer
setting in the `env` block of the server's entry in the client's configuration:

```json
"env": { "APPLE_NATIVE_MCP_HELPER": "/absolute/path/to/native/.build/release/apple-native-mcp" }
```

## Running its specs

```sh
swift test
```

They need no permission, no prompt and no real calendar or reminders, and they run on any Mac and
in hosted CI. EventKit is reached only through `CalendarStore` and `ReminderStore`, and everything
above them — the protocol, the range and occurrence rules, the failure mapping — is specified
against the fakes in `Tests/HelperCoreTests/CalendarOnAFakeMac.swift` and
`RemindersOnAFakeMac.swift`.

Printing the scenario names is how the suite is read as a specification:

```sh
swift test 2>&1 | grep '✔ Test "'
```

## What a spec does not cover

The child ends when its parent does, watched on a queue of its own, so the server can stop even a
stuck helper by ending the process it launched. That is a real process too, so it was checked by
hand: ending the parent leaves no child behind (#61).

`Disclaiming.relaunch()` cannot be specified without spawning a real process, so what is specified
is the decision it serves: `startingChoice(environment:)`, which says whether this process should
relaunch itself or serve the session. That the spawn attribute works at all was established by a
probe on `research/permission-prompt-probe`, recorded in issue #4. The session loop and the EventKit
adapter are likewise thin enough to hold no rules, and belong to the port's contract suite run on a
real Mac.

## Layout

| Path | Holds |
|---|---|
| `Sources/HelperCore/` | the protocol, the calendar, reminders, contacts and messages rules, the named failures, the store ports, and `SQLiteMessageStore`, which reads a SQLite file and so is specified against ones the scenarios build |
| `Sources/Helper/` | the executable: the disclaimed relaunch, the stdio session, the EventKit adapters |
| `Tests/HelperCoreTests/` | the scenarios, and the fake Mac they run against |
