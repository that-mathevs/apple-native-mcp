# `native/` — the helper

The helper is the Swift process that holds every macOS permission and reaches every store
([ADR-0002](../docs/adr/0002-helper-owns-every-protected-access.md)). The Node server holds no
permission of its own and opens no protected file; it starts the helper and talks to it.

So far it answers for the calendar, with its calendars, the events in a range and one event in
full, and for the reminders, with the reminder lists and the reminders in them. Each has its own
permission.

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
| `calendar_permission_missing` | macOS has not allowed the helper to read the calendar; the sentence names the setting and where it is |
| `calendar_unreadable` | one calendar would not answer; reported beside the events rather than instead of them, so one offline subscription does not take the whole read with it |
| `reminders_permission_missing` | macOS has not allowed the helper to read the reminders; the sentence names the setting and where it is |
| `reminder_list_unknown` | a request named a reminder list the helper cannot find, perhaps deleted since it was listed; nothing is read |

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
  "identifier":"…","title":"Bins out","notes":null,"completed":false,
  "due":{"date":"2026-09-25"},
  "reminderList":{"identifier":"…","title":"Errands","account":{"identifier":"…","title":"iCloud"}}
}]}}
```

Both fields are required: the server says which reminder lists and whether completed reminders are
wanted, and the helper chooses neither. Completed reminders are left out by EventKit's own fetch.
No reminder lists means no reminders, never those of every one, which is how EventKit would read an
empty set. `due` is `null`, a due date as `{"date":"2026-09-25"}` with no time of day, or a due time
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

`Disclaiming.relaunch()` cannot be specified without spawning a real process, so what is specified
is the decision it serves: `startingChoice(environment:)`, which says whether this process should
relaunch itself or serve the session. That the spawn attribute works at all was established by a
probe on `research/permission-prompt-probe`, recorded in issue #4. The session loop and the EventKit
adapter are likewise thin enough to hold no rules, and belong to the port's contract suite run on a
real Mac.

## Layout

| Path | Holds |
|---|---|
| `Sources/HelperCore/` | the protocol, the calendar and reminders rules, the named failures, `CalendarStore` and `ReminderStore` |
| `Sources/Helper/` | the executable: the disclaimed relaunch, the stdio session, the EventKit adapters |
| `Tests/HelperCoreTests/` | the scenarios, and the fake Mac they run against |
