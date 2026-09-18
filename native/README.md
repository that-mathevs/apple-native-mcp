# `native/` — the helper

The helper is the Swift process that holds every macOS permission and reaches every store
([ADR-0002](../docs/adr/0002-helper-owns-every-protected-access.md)). The Node server holds no
permission of its own and opens no protected file; it starts the helper and talks to it.

This is the first slice of it: the calendar permission, and the events in a range.

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
answer. `calendars` is every calendar that was asked, including one holding nothing in the range. The
server counts the calendars the user's settings keep from an agent, and it counts calendars rather
than events so that the count says nothing about when an excluded calendar is busy.

## Building it

```sh
swift build -c release
```

The bundle identifier and the EventKit usage strings live in `Info.plist` and are linked into the
executable's `__TEXT,__info_plist` section, so a bare executable still carries an identity macOS can
attribute a prompt to. `Package.swift` passes the linker's `-sectcreate` for this; releases are
signed, hardened and notarised in CI
([ADR-0003](../docs/adr/0003-signed-helper-at-a-fixed-path.md)).

## Running its specs

```sh
swift test
```

They need no permission, no prompt and no real calendar data, and they run on any Mac and in
hosted CI. EventKit is reached only through `CalendarStore`, and everything above it — the protocol,
the range and occurrence rules, the failure mapping — is specified against a fake store in
`Tests/HelperCoreTests/CalendarOnAFakeMac.swift`.

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
| `Sources/HelperCore/` | the protocol, the calendar rules, the named failures, and `CalendarStore` |
| `Sources/Helper/` | the executable: the disclaimed relaunch, the stdio session, the EventKit adapter |
| `Tests/HelperCoreTests/` | the scenarios, and the fake Mac they run against |
