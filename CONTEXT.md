# apple-native-mcp

An MCP server that gives an agent access to the user's own data in the native macOS apps:
Calendar, Reminders, Contacts, Messages, Notes and Mail. These are the project's words. Every
scenario name and every exported identifier uses them, and a scenario that needs a word this file
lacks stops until the word is agreed.

Terms whose meaning is still open name the ticket that settles them.

## Language

### Across the server

**Store**:
The place one context's data lives, reached through a port: the event store, the contact store, the
message store, the note store, the mail store.
_Avoid_: database, backend, provider

**Capability**:
Something the user switches on before the server will do it. A **write capability** covers one
operation that changes a store or reaches another person, and is named after its tool, such as
`send_message`. It is off until the settings name it, and switching one on never switches on
another.
_Avoid_: scope, permission (that word is macOS's), toggle, app switch

**Settings**:
What the user set for this server in the client's configuration: which write capabilities are on,
and which calendars, accounts, folders and chats are kept from the agent, each by identifier. An
**allowlist** keeps in only what it names; anything **excluded** is kept out, and excluding wins.
Settings are never read from a file or from anything an agent sends, and settings that don't parse
switch every write capability off.
_Avoid_: config, options, preferences, environment, hidden (that word is Calendar's)

**Confirmation**:
The user's explicit approval of one specific send, showing the resolved recipient and the full body.
Never a model's reply.
_Avoid_: approval, consent, verification

**Known recipient**:
A handle the user has real traffic with, which is the only kind a send may reach. A contact card
alone doesn't make a handle known.
_Avoid_: allowed recipient, trusted contact

**Send allowlist**:
An optional setting listing who may be sent to. It narrows the known-recipient rule and never widens
it.
_Avoid_: whitelist, safe list

**Named failure**:
A failure carrying a code, one sentence saying what didn't happen, and the evidence verbatim. A
**permission failure** is the named failure for a missing macOS grant, and says which setting to
change and where.
_Avoid_: error message, access denied, failure envelope

**Unconfirmed outcome**:
A write that was attempted but that the store couldn't confirm. It is never reported as success.
_Avoid_: probably sent, best effort

**External content**:
Text written by someone other than the user, such as an email, a message or an invitation. It is
carried as data and never treated as instructions.
_Avoid_: user content, input text

**Range**:
The start and end instants a read covers. Date-only bounds mean whole days in the user's time zone.
_Avoid_: window, period, search window, timeframe

**Coverage**:
How far a read actually reached, such as how many items were scanned or how far back it looked.
A result that stopped at a limit is **truncated**, and says so.
_Avoid_: partial, incomplete, scan window

**Index and detail**:
An index lists many items briefly; a detail read returns one item in full. Both are records, never
prose.
_Avoid_: summary, preview (except a note preview), listing

**Helper**:
The Swift process that holds every macOS permission and reaches every store. See
[ADR-0002](docs/adr/0002-helper-owns-every-protected-access.md).
_Avoid_: daemon, bridge, sidecar

**Setup**:
The command that installs the helper and asks for macOS permissions. Tools never do either.
_Avoid_: install step, onboarding

**Shipped helper and installed helper**:
The shipped helper is the one carried inside an install, such as the npm package or the `.mcpb`,
and is never launched. The installed helper is the one at its fixed per-user path, the only one ever
launched, at the fixed path, and is replaced only by a newer one. See
[ADR-0003](docs/adr/0003-signed-helper-at-a-fixed-path.md).
_Avoid_: bundled helper, embedded helper, the binary

**Fixed path**:
The one per-user place the installed helper lives,
`~/Library/Application Support/apple-native-mcp/apple-native-mcp`. It is the same for every install
channel, so every update keeps the user's grants.
_Avoid_: install location, helper dir

**Helper file**:
One helper as it sits on disk, its path and its version, read before anything launches it.
_Avoid_: binary, executable, copy

**Code requirement**:
The signing identity, an identifier plus a team, that a helper must meet before it is copied or
launched.
_Avoid_: signature check, codesign check

**Developer setting**:
The setting in the client's configuration that names a development build of the helper to launch in
place of the installed helper.
_Avoid_: dev mode, debug flag

### Calendar

**Calendar account**:
The source a calendar belongs to: iCloud, CalDAV, Exchange or local.
_Avoid_: source, provider, account (unqualified)

**Calendar**:
A container of events with a stable identifier, a title, a type and a calendar account. Titles
repeat across accounts, so the identifier addresses it. A **writable calendar** accepts new events;
subscriptions and birthdays don't. The **default calendar** is the one the user set in Calendar for
new events.
_Avoid_: calendar name as an identifier, system calendar, read-only calendar

**Excluded calendar**:
A calendar the settings keep from the agent. A **hidden calendar** is a different thing: one the user
unticked in Calendar.
_Avoid_: blacklisted, disabled, filtered

**Event**:
An entry in a calendar with a title, a start and end or all-day dates, a location and notes,
addressed by its event identifier. An **all-day event** occupies whole days in the user's time zone,
not an instant range.
_Avoid_: appointment, meeting, entry

**Series and occurrence**:
A series is a recurring event as a whole; an occurrence is one dated instance of it. Every occurrence
shares the series' event identifier, so an occurrence is addressed by the series plus its original
start. A **span** says how far a change reaches: this occurrence, or this and later ones.
_Avoid_: master event, instance, repeat (that word is Reminders'), recurrence

**Event reference**:
What a read returns so a later operation can act on exactly that event: its event identifier, and
its original start when it is an occurrence of a series. Events are never addressed by title.
_Avoid_: event address, event id alone for an occurrence

**Availability**:
Whether an event counts as busy or free. A **busy period** is a stretch when the user is busy, with
no event details; an **open slot** is a gap between busy periods long enough for a requested
duration.
_Avoid_: free slot, available slot, busy block

**Duplicate**:
An event whose title matches another overlapping the same time. Creating one is refused unless the
user asks for it anyway.
_Avoid_: twin, copy, clash

### Reminders

**Reminder list**:
A container of reminders belonging to one account, with an identifier and a title. Titles repeat
across accounts. The **default reminder list** is the one the store names for new reminders, which
isn't necessarily the list called "Reminders".
_Avoid_: list (bare), calendar, folder

**Reminder**:
An item in a reminder list with a title, notes, a completion state, an optional due date and a
priority. It is **open** until it is **completed**. Which of EventKit's identifiers addresses it
waits on the verification REM-V6 in `findings.md`.
_Avoid_: task, to-do, incomplete, done, body, description

**Due date and due time**:
A due date is the day a reminder is due, with no time of day. A due time is a due date with a time,
read in the user's time zone unless it carries an offset. An **alert** is a separate notification
time. A reminder whose due time has passed is **overdue**.
_Avoid_: deadline, dueDate for both, reminder time

**Duplicate**:
A create whose title matches an open reminder in the same list. Refused unless the user asks for it
anyway.
_Avoid_: twin, copy

### Contacts

**Contact**:
A person or company in Contacts, with a stable contact identifier, names, and labelled details:
phone numbers, email addresses, postal addresses and URLs, each with a **label**.
_Avoid_: person, card, address book entry

**Contact note**:
The free-text note field on a contact, which needs an Apple-granted entitlement and which this
server never reads. It appears only in the scenario where asking for it fails cleanly.
_Avoid_: comment, description

**Normalised phone number**:
A phone number in E.164. A phone number becomes a **handle** only once it matches one in the message
store.
_Avoid_: formatted number, raw number

### Messages

**Handle**:
One address a person is reached at in Messages: a phone number, an email address or an alphanumeric
sender id. A **known handle** is one already stored in the message store.
_Avoid_: phone number as a synonym, address, buddy

**Chat**:
A thread with participants, addressed by its identifier, and either a **one-to-one chat** or a
**group chat** by the chat's own kind, not by how many participants it has. A **participant** is a
handle belonging to a chat; the user is never listed as one.
_Avoid_: conversation, thread, group

**Message**:
One item in a chat, with its text, its direction, its timestamp and its service. A **reaction** is a
message row that records a tapback rather than text the user wrote.
_Avoid_: text, SMS, tapback, email (that word is Mail's)

**Service**:
The transport carrying a chat: iMessage, SMS or RCS. v1 sends over iMessage only.
_Avoid_: protocol, channel

**Real traffic**:
An incoming message, or an outgoing one the store shows as sent or delivered. It is what makes a
handle a known recipient. A **ghost chat** holds only failed sends, and never counts.
_Avoid_: genuine contact, history, conversation history

**Sent and delivered**:
Sent means the message left with no error; delivered means the store shows it reached the recipient.
A **delivery error** is the code the store records when it couldn't.
_Avoid_: success, ok

**Wrong number**:
A never-used address belonging to someone the user reaches on another handle. A send to it is
refused, naming the contact rather than the handle.
_Avoid_: mismatch, bad number

**Name resolution**:
What a name comes to: one person, several, unknown, or unavailable when Contacts can't be read. A
send needs exactly one; anything else is refused.
_Avoid_: lookup, matching

### Notes

**Notes account**:
A top-level Notes container such as iCloud, On My Mac or Exchange. It owns note folders.
_Avoid_: source, account (unqualified)

**Note folder**:
A container of notes inside a notes account, identified by its account and name together. Folders
nest, and names repeat across accounts.
_Avoid_: directory, category, group

**Note**:
An item in a note folder, addressed by its note identifier. Its **title** is the name the store reports, which
the server reads and never computes. Its **text** is the plain-text view that search matches, and
its **document** is what the store holds: paragraphs, styles and attachments.
_Avoid_: item, record, content, payload

**Lossy rewrite**:
An update that would drop something the note's document held, such as a checklist or a table. Refused,
saying what would be lost.
_Avoid_: blocker, unsupported content

**Locked note**:
A password-protected note whose text can't be read. A **shared note** is one shared through iCloud,
whose folder and account can't always be read.
_Avoid_: encrypted note, protected note

**Recently Deleted**:
The folder holding deleted notes until they are purged. Reads leave it out unless asked.
_Avoid_: trash, bin

### Mail

**Mail account**:
A configured account in Mail, with a display name and one or more email addresses, owning its
mailboxes. Display names aren't unique.
_Avoid_: account (unqualified), provider, mail source

**Mailbox**:
A folder of emails inside one mail account, identified by its account and its path. Mailboxes nest,
and names repeat across accounts. A **role mailbox** is one Mail knows by its job: Inbox, Drafts,
Sent, Junk, Trash or Archive, whose displayed names vary by provider and language.
_Avoid_: folder, label, INBOX as a name

**Email**:
One item in Mail, with a subject, correspondents, a date, a read state and a body. Always "email",
never "message": that word belongs to Messages.
_Avoid_: message, mail item, letter

**Email reference**:
What a read returns so a later operation can act on exactly that email: its Message-ID, its account
and its mailbox path. Emails are never addressed by subject.
_Avoid_: email id, handle (that word is Messages')

**Draft**:
An unsent email saved in an account's Drafts mailbox. It is not a compose window, and the server
never sends one.
_Avoid_: compose, unsent message

**Latest mail**:
The most recently received emails, newest first, which is not the same as the first ones in mailbox
order.
_Avoid_: recent mail, top of the inbox

**Attachment**:
A part of an email with a file name, a content type and a size. Keep it apart from something
attached to a note.
_Avoid_: file, enclosure

## Words we don't use in scenarios

These are real, and they belong in adapter code and in the helper. They never appear in a scenario
name, a tool name or a result field.

| Word out there | What we say |
| --- | --- |
| `attributedBody`, typedstream, bookkeeping string | the message's text |
| buddy, `services`, `chat id` | handle, chat |
| `chat.db`, `NoteStore.sqlite`, Envelope Index, `.emlx` | the message store, the note store, the mail store |
| `calendarIdentifier`, `eventIdentifier`, `calendarItemIdentifier` | calendar identifier, event identifier, reminder identifier |
| `EKCalendar` for a reminder list | reminder list |
| Apple epoch, Core Data timestamp, nanoseconds since 2001 | a timestamp |
| Apple Event error, OSStatus, `-1743`, `-600` | a named failure, with the code as evidence |
| Full Disk Access, Automation, authorisation status, responsible app | a permission failure that says what to enable, and where |
| DXT, MCPB, `npx`, Developer ID | how the server is installed |
| whitelist, blacklist | allowlist, excluded |
| mail rule, mail template, triage, scheduled send | (out of v1; not our words) |
