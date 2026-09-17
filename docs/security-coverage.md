# Threats mapped to scenarios

Every threat this server has to resist, and the scenarios in
[`research/findings.md`](research/findings.md) that resist it. `plan.md` Phase 4's `docs/security.md`
is written from this document: the threat model there states each threat in the reader's terms, and
this is the evidence that it is specified rather than merely intended.

The threats are `plan.md` Phase 4's three, expanded by what the decision tickets have since
established. A scenario appears under more than one threat when it resists more than one, so the
counts overlap.

| Threat | Scenarios |
|---|---|
| 1 Prompt-injected tool input | 37 |
| 2 A malicious body read back to the agent | 25 |
| 3 Over-broad permission grants | 27 |
| 4 Self-granting | 36 |
| 5 Exfiltration through results and refusals | 24 |
| 6 Sending without the user | 20 |
| 7 A false report | 81 |
| 8 Supply chain and helper integrity | 11 |

Thirty-four of these scenarios were written while this mapping was made, to cover gaps it found.
They are marked **new to the backlog** below and are now in `findings.md` like any other.

---

## Threat 1: prompt-injected tool input

Hostile text reaching a tool argument tries to make the server run code, read something out of
scope, or send. Non-negotiable 1 is the rule: nothing that reaches a tool is spliced into a script,
a shell command or a SQL string.

**37 scenarios.** This is the best-covered threat in the backlog: every context carries its own
injection scenario, because every fork had the hole in a different place.

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| X-16 | given arguments that fail validation, names each invalid argument and what it accepts | Input is checked at the boundary, not deep in an adapter | NN5 |
| X-17 | given arguments that fail validation, refuses before touching any app or store | Hostile input never reaches a store at all | NN1 |
| X-18 | given a limit that is not a positive whole number, refuses and names the argument: only a number may reach the store | Closes chrischall's numeric injection path | NN1 |
| X-19 | given an argument the tool does not declare, refuses the call: an ignored filter would make the reply lie | An unknown argument can't ride along | NN1, NN3 |
| X-43 | given a string containing quotes, backslashes, line breaks, «guillemets», dollar patterns, shell metacharacters or script source, delivers it to the script unchanged and runs nothing it contains | The runner's central anti-injection contract | NN1, X-C11 |
| X-44 | given arguments of any JSON type, passes numbers, booleans and lists as data and never as script source | No type escapes into source | NN1, X-C11 |
| X-56 | given the shipped scripts, every one compiles | Scripts are static files, not built strings | NN1 |
| X-57 | each one runs under osascript with only the arguments it declares, on every macOS version it ships for | A script takes arguments, not source | NN1 |
| X-58 | given a request with any string argument, receives that argument byte for byte | The helper protocol carries data, not code | NN1, ADR-0002 |
| CAL-19 | given a range bound that is not a readable date, refuses rather than choosing another range: only dates reach the store | A range bound is never free text | NN1, NN3 |
| CAL-30 | given search text containing shell or script syntax, matches it literally and runs nothing | Calendar search | NN1 |
| CAL-45 | given a title, location and notes containing quotes, backslashes, line breaks and script text, stores each exactly as given and runs nothing | Event create — the upstream hole | NN1 |
| REM-13 | given a list name that looks like a command-line flag, treats it as a list name | No argv confusion | NN1 |
| REM-28 | given text that closes a string and runs a command, matches it literally and runs nothing | Reminder search | NN1 |
| REM-29 | given a percent sign in the search text, matches it literally | No LIKE-pattern injection | NN1 |
| REM-36 | given a title full of quotes, backslashes and script syntax, stores that exact title | Reminder create | NN1 |
| REM-59 | given a field name outside the known reminder fields, refuses: field names never become calls | Field selection is not a call | NN1 |
| CON-14 | given a name containing quotes, backslashes and script syntax, searches for exactly that text and runs nothing | Contact search | NN1 |
| CON-27 | given a phone number, email address or URL containing text that looks like script or replacement patterns such as `$'`, stores exactly that text or refuses it, and runs nothing | Contact create — no tool in v1 (#18), kept in the backlog | NN1 |
| CON-28 | given a detail whose text looks like script or replacement patterns, stores exactly that text or refuses it, and runs nothing | Contact update — no tool in v1 (#18) | NN1 |
| MSG-33 | given a body containing quotes, backslashes, line breaks and script syntax, delivers exactly that text and runs nothing | The send body is the highest-value injection point | NN1 |
| MSG-34 | given a body containing text shaped like an internal reference, sends that text literally | A body can't address the server | NN1 |
| MSG-86 | opens the store read-only: no query can change it | The message store cannot be written through any argument | NN1, ADR-0002 |
| MSG-87 | given a handle containing quotes and SQL keywords, matches it literally and returns only that handle's messages | Prepared statements, now in Swift | NN1, ADR-0002 |
| MSG-88 | given a handle pattern with wildcard characters, matches them literally | No SQL wildcard injection | NN1 |
| MSG-94 | given a recipient containing a backslash followed by a quote, treats it as part of the recipient and runs nothing else | The escaping bug every fork shared | NN1 |
| **MSG-105** | **new to the backlog** — addresses an existing chat by its identifier or a service-scoped handle, never Messages' app-level name form: the name form creates ghost chats | How a send addresses its recipient inside the script | NN1, NN4, #17 |
| NOT-08 | given an account or folder name containing placeholder text, quotes or script syntax, looks it up as a literal name and runs nothing | Notes scoping | NN1 |
| NOT-21 | given search text full of quotes and backslashes, searches for that literal text and runs nothing else | Notes search | NN1 |
| NOT-32 | given a title containing quotes, a trailing backslash or script syntax, creates the note with exactly that title | Note create | NN1 |
| NOT-33 | given a note folder whose name contains quotes, backslashes or script syntax, files the note in exactly that folder and runs nothing | Note create, folder argument | NN1 |
| NOT-51 | treats the text literally, so no query can make the search run away | A query is not a program | NN1 |
| NOT-54 | given search text containing quotes, backslashes and newlines, matches it literally | Note store contract | NN1 |
| NOT-55 | given a folder name that closes a string and adds a command, looks up a folder with exactly that name and runs nothing | Note store contract | NN1 |
| MAIL-84 | given a search term containing quotes and backslashes, matches it literally and runs nothing | Mail search | NN1 |
| MAIL-92 | given an identifier that is not an email identifier, refuses before touching Mail | An email reference is typed, not free text | NN1 |
| MAIL-105 | given a subject containing a double quote, marks the email read and runs nothing else | No tool in v1 (#18, triage); kept in the backlog | NN1 |

**The gap this closed.** Nothing said how a send addresses its recipient inside the script. MSG-C10
recommends the chat identifier or a service-scoped handle and never Messages' app-level name form,
and #17 restates it; MSG-105 now pins it.

---

## Threat 2: a malicious body read back to the agent

A message, email, note or invitation whose text tries to pose as the server's words, forge a record,
or instruct the agent. ADR-0006 is the answer: results are records, external content is always a
field, the protection is structural and there is no banner to forge.

**25 scenarios.**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| X-46 | given a script that returns a list of records, hands back every record as structured values with its fields intact, not the text the script printed | Records, not printed prose | ADR-0006 (#22), X-C10 |
| X-47 | given a field containing separator-like text or text that imitates another record, returns it unchanged inside its own field: results are structured, not delimited | The forging attack, head on | ADR-0006 (#22) |
| X-48 | given output that is not the expected structure, refuses it rather than inventing an untitled item | A malformed body can't become a record | NN3, ADR-0006 |
| CAL-33 | given an invitation written by someone else, reports its title, location and notes as that event's fields and nothing more | An invitation is external content | ADR-0006 (#22) |
| CAL-89 | given an event title containing field separators, returns the title unchanged | Contract level | ADR-0006 |
| NOT-01 | reports a page of notes, each with its title, note folder, account, modification date and a short preview but never its whole body, and says how to read one in full | Index and detail: a list's size never depends on someone else's text | ADR-0006 (#22) |
| NOT-30 | given a note body that imitates the end of a result or another note, reports it inside that one note's body | Notes | ADR-0006 |
| NOT-53 | given a note whose title and body contain separator-like text, quotes or any other characters, returns exactly that one note with its title and text intact | Note store contract | ADR-0006 |
| NOT-62 | given text containing angle brackets and ampersands, stores it as text, not as markup | A note body isn't markup on the way in | ADR-0006 |
| MAIL-26 | returns no email bodies unless asked: bodies are untrusted text | The largest external-content surface stays closed by default | ADR-0006, #24 |
| MAIL-48 | given an email body that imitates the end of a result or another email, reports it inside that one email's body | The crafted email that forged ANierbeck's banner and sicdigital's `\|\|` | ADR-0006 (#22) |
| MAIL-81 | given a subject or body containing tabs, newlines, commas or other delimiter characters, returns every field intact | Mail store contract | ADR-0006 |
| MAIL-82 | given an email whose body contains text shaped like another result, returns it as one email | Mail store contract | ADR-0006 |
| MSG-70 | given a typedstream blob, decodes the message text exactly | The decoder reads a hostile format | #21 |
| MSG-71 | given accented text, non-Latin script and emoji, decodes it intact | #21's fixtures | #21 |
| MSG-72 | given a body longer than 127 bytes, reads its multi-byte length and decodes the full text | Rejects morquis' marker heuristic | #21 |
| MSG-73 | given an audio message, finds the transcript among the archive's own attribute names | Walks the structure rather than scanning | #21 |
| MSG-74 | given a length that overruns the blob, yields nothing rather than garbage | A hostile length field | #21 |
| MSG-75 | given plain text that is only the object-replacement placeholder, reads the text from the archive | Where the decoder is reached from | #21 |
| **MSG-100** | **new to the backlog** — given a truncated blob, reports no readable text as a named failure rather than crashing | The decoder is total | NN5, #21 |
| **MSG-101** | **new to the backlog** — given a cycle in the archive's back-references, stops rather than following it forever | Bounded, on hostile input | #21 |
| **MSG-102** | **new to the backlog** — given a declared length larger than the whole blob, reads nothing past the blob | No over-read | #21 |
| **MSG-103** | **new to the backlog** — never creates an object because the archive names its class: a stranger's message chooses nothing inside this process | Why `NSUnarchiver` is excluded | NN1, #21 |
| **MSG-104** | **new to the backlog** — given nesting deeper than the bound, stops at the bound and reports no readable text | Depth is bounded | #21 |
| MSG-91 | given a reaction to a message, does not list it as a message | A tapback row can't pose as text the sender wrote | CONTEXT.md **reaction** |

**The gap this closed.** #21 names five decoder fixtures the backlog didn't carry — a truncated blob,
a cycle in back-references, a declared length larger than the blob, a depth bound, and the rule that
the decoder never instantiates a class the archive names. MSG-100 to MSG-104 now carry them.

---

## Threat 3: over-broad permission grants

The server holding more macOS access than it needs, or a grant landing on a shared identity such as
`node` or a terminal. ADR-0002 and ADR-0003 are the answer.

**27 scenarios.**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| X-25 | given Automation permission for the app is not granted, reports a permission failure naming the app, the setting to change and where it is | A missing grant is named, not worked around | NN5, X-C19 |
| X-34 | never suggests anything it cannot know, such as trying again | A permission failure doesn't send the user hunting | NN5 |
| X-54 | given the target app refuses Apple Events, reports a missing Automation permission that names the app, told apart by error number rather than message text | Classification by OSStatus, not by text | NN5, X-C8 |
| X-65 | given access has never been asked for, asks once before reading | One prompt, at the helper | NN5, ADR-0002 |
| X-70 | given the native helper is not installed or cannot be reached, fails with a named failure that says how to fix it, never a scripted fallback: a fallback returns different data under a different permission | The single clearest statement of the rule: no second path under a second grant | NN3, NN5, ADR-0002 |
| **X-89** | **new to the backlog** — asks macOS for access under its own identity, so no grant lands on the process that launched it | ADR-0002's central claim, which nothing stated before | NN5, ADR-0002, #4 |
| **X-90** | **new to the backlog** — reads no protected store from the server process itself: every privacy-protected access goes through the helper | The Node server holds no privileged access of its own | NN1, NN5, ADR-0002 |
| CAL-20 | given calendar access has never been asked for, asks macOS for full access once and reports the outcome | One grant, asked for deliberately | NN5 |
| CAL-22 | given access to add events only, explains that reading needs full access | Write-only access isn't silently widened | NN5 |
| CAL-23 | given calendar access is restricted by policy, says the user cannot grant it themselves | A managed Mac | NN5 |
| CAL-24 | given access reported as granted but no calendars visible, names the helper as the identity that needs calendar access | The responsible-process trap of #4 | NN5, ADR-0002 |
| CAL-25 | needs calendar access only, never permission to control the Calendar app | Least privilege, stated as a behaviour | ADR-0002 |
| CAL-91 | given access has never been asked for, asks for full access once | Contract level | NN5 |
| CAL-92 | given calendar access is denied, fails with a named permission failure | Contract level | NN5 |
| CON-13 | never reports a contact note: macOS reserves that field for entitled apps | The server doesn't hold an entitlement it doesn't need | #18 |
| CON-15 | given the Contacts app is not running, answers without starting it | No Automation grant for a framework read | ADR-0002 |
| CON-16 | given contacts access has not been decided yet, asks macOS for access before reading | Upstream #65 | NN5 |
| CON-17 | given contacts access was denied, fails as a missing permission that names Privacy & Security > Contacts and what to enable there, rather than reporting no match | Upstream #65 | NN5 |
| CON-50 | given access is denied, fails with the missing-permission failure rather than an empty result | Contract level | NN5 |
| CON-51 | never asks for the contact note, and still returns every other field | The entitlement is never requested | #18 |
| CON-55 | reports the contacts authorisation status without reading any contact | Status is checked before work, not inferred from a failure | X-C8 |
| MSG-03 | given Full Disk Access is not granted, fails as a missing permission that names Full Disk Access and the app to grant it to, never as an empty result | FDA is named as its own grant | NN5, ADR-0002 |
| MSG-35 | given Automation control of Messages is denied, fails as a missing permission that names Automation > Messages | Sends need their own grant | NN5 |
| NOT-11 | given access to Notes has not been granted, fails with a permission failure that names the setting to change and the app to allow | Notes | NN5 |
| NOT-12 | given Notes is not running, lists the notes without bringing Notes to the front | No System Events grant, no stolen focus | X-C18 |
| MAIL-43 | given macOS has not granted the access that reading mail needs, fails naming the permission and where to grant it, rather than reporting no mail | Mail | NN5 |
| MAIL-91 | given Mail is not running, starts it without bringing it to the front | X-C18 | X-C18 |

**The gap this closed.** ADR-0002's central claim had no scenario: nothing said the grant lands on
the helper's own identity rather than on `node` or the terminal, and nothing said the Node server
holds no privileged access of its own. X-89 and X-90 now say both.

---

## Threat 4: self-granting

An agent enabling its own capabilities, or widening who counts as a known recipient. #19 (where
settings live and how they fail) and ADR-0005 (what makes a recipient known) are the answer.

**36 scenarios.**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| X-02 | given the default configuration, offers only tools that read | Off until configured | NN2, #19 |
| X-03 | given a capability that is not enabled, does not list its tools | The listing half of the two checks | NN2, #19 |
| X-13 | given a tool name the server has never had, refuses it as unknown rather than disabled | Disabled and non-existent stay apart | X-C1 |
| X-14 | given a capability that is not enabled, refuses the call as disabled and names the setting that enables it: hiding a tool from the list does not disable it | The dispatch half — a stale tool list buys nothing | NN2, NN5, #19 |
| X-29 | given a write capability nobody configured, treats it as off | Unset is off, never "on because nothing said otherwise" | NN2, #19 |
| X-30 | given the client's configuration cannot be read or does not parse, treats every write capability as off and says why | Fails closed | NN2, #19 |
| **X-79** | **new to the backlog** — given arguments naming a capability, a setting or a helper path, changes nothing about what is enabled: settings never come from tool input | #19's hardest sentence, including ADR-0003's developer setting | NN2, #19, ADR-0003 |
| **X-80** | **new to the backlog** — reads capabilities only from the client's configuration, so nothing the server itself can write can turn a write on | Why a settings file was rejected | NN2, #19 |
| CAL-17 | given an allowlist that matches no calendar, reports no events rather than all of them | An empty allowlist isn't "everything" | #19 |
| CAL-37 | given calendar writing is not enabled, refuses: writes are off by default | Per-capability | NN2, #19 |
| CAL-73 | given a calendar identifier that is both allowed and blocked, treats it as blocked | A block-list wins over an allow-list, by identifier | #19 |
| REM-47 | given writes are not enabled, refuses: reminders are read-only by default | Per-capability | NN2 |
| CON-24 | given contact writes are not enabled, refuses: writes are off by default | Superseded in v1 by CON-56, which is stronger | NN2, #18 |
| **CON-56** | **new to the backlog** — offers no tool that creates, changes or deletes a contact: a contact write would let injected input widen who counts as a known recipient | Why #18 removed the contact-write tools | NN4, #18 |
| MSG-02 | given a chat holding only the user's own failed sends, leaves it out: a failed send is not real traffic | A ghost chat never becomes history | NN4, ADR-0005 |
| MSG-22 | given sending messages is not enabled, refuses and says which setting enables it: writes are off by default | Per-capability | NN2, NN5 |
| MSG-24 | given a recipient the user has never messaged, refuses and names the contacts they probably meant | NN4 head on | NN4, ADR-0005 |
| MSG-25 | given a number that belongs to no contact and was never messaged, refuses: recipients must be known | Upstream #48 | NN4, ADR-0005 |
| MSG-26 | given a number never messaged that belongs to a contact the user reaches on another handle, refuses and names the contact, never the handle they write from | The wrong-number case, named the way ADR-0005 requires | NN4, ADR-0005, #16 |
| MSG-27 | refuses to reroute to another number on its own: a changed number would reach a phone the person no longer holds | The server never picks a different handle | NN4, ADR-0005 |
| MSG-28 | given contacts cannot be read, refuses to send to a number never messaged rather than allowing it | An unreadable check fails closed | NN4, ADR-0005 |
| MSG-32 | given a number not on the send allowlist, refuses and says which setting allows it | The allowlist narrows | NN4, NN5, #16, #19 |
| MSG-48 | given a chat with no real traffic in it, refuses | A chat row isn't traffic | NN4, ADR-0005 |
| MSG-54 | never returns a handle that is not already stored | The matcher can't invent a recipient | NN4, ADR-0005 |
| MSG-66 | given a contact with several numbers and no real traffic on any, refuses: the intended number is unknown | A contact card alone is not enough | NN4, ADR-0005 |
| MSG-67 | given only the user's own undelivered messages to a handle, counts that handle as never in touch | One wrong number sent to doesn't whitelist itself | NN4, ADR-0005 |
| **MSG-96** | **new to the backlog** — given a handle known only from a group chat the user has real traffic in, refuses to message that person privately: a group chat is a chat, not a licence | ADR-0005's group-chat clause | NN4, ADR-0005, #16 |
| **MSG-97** | **new to the backlog** — given several names that no single existing chat holds exactly, refuses and creates no chat: the server never creates a chat | ADR-0005's "the server can't create a group" | NN4, #16, #17 |
| NOT-31 | given note writing is not enabled, refuses and creates nothing: writes are off by default | Per-capability | NN2, #19 |
| NOT-36 | given note writing is not enabled, refuses and changes nothing: writes are off by default | Per-capability | NN2, #19 |
| MAIL-50 | given an account outside the allowlist, refuses to read, list or change anything in it, whichever operation asks | The allow-list holds on every operation | #19 |
| MAIL-52 | given drafting is not enabled, refuses: writes are off by default | Per-capability | NN2, #19 |
| MAIL-57 | given sending is not enabled, refuses: sending mail is off until the user turns it on | Per-capability | NN2, #19 |
| MAIL-61 | given the allowlist cannot be read, refuses every send | Fails closed | NN4, #19 |
| MAIL-67 | given moves are not enabled in settings, refuses and says which setting enables them | No tool in v1 (#18); kept in the backlog | NN2, NN5 |
| MAIL-104 | given deleting is not enabled, refuses and says which setting enables it | No tool in v1 (#18); kept in the backlog | NN2, NN5 |

**The gaps this closed.**

1. #19's hardest sentence — "Never from tool input. Nothing an agent sends can change a capability,
   including the developer setting from ADR-0003" — had no scenario, and neither did "no settings
   file in v1", which was rejected precisely because an agent with file access could write one.
   X-79 and X-80 now carry both.
2. #18 removes the contact-write tools so injected input can't widen the known-recipient set, and
   nothing said so. CON-56 does.
3. ADR-0005's "an existing group chat qualifies as a chat, never as a licence to message its members
   privately" and "the server can't create a group" are now MSG-96 and MSG-97.

---

## Threat 5: exfiltration through results and refusals

Contact details, message content or store paths leaking into the agent's context when they weren't
asked for. ADR-0005's refusal rule and ADR-0006's index/detail split are the answer.

**24 scenarios.**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| X-11 | makes no network connection in any operation | Nothing can leave the Mac by network | upstream #71 |
| X-22 | given an unexpected internal error, reports a generic failure without file paths or stack traces | The server's own errors carry no paths | ADR-0006 (#22), X-C7 |
| X-28 | given more matches than the page holds, says more exist and how to ask for the next page | A read can't be made to pull everything at once | NN3, X-C14 |
| X-32 | given evidence carrying a bearer token, redacts the credential and keeps the rest | Evidence is not a credential channel | X-C7 |
| X-33 | given evidence longer than the cap, cuts it and marks the cut | Evidence is capped | ADR-0006 (#22) |
| X-34 | never suggests anything it cannot know, such as trying again | A failure doesn't guess out loud | NN5 |
| X-35 | knows whether it is complete | Bounded reads | NN3 |
| X-36 | given fewer shown than exist, states both numbers | Bounded reads | NN3 |
| X-37 | given the page is at the hard ceiling, advises narrowing rather than asking for more | Bounded reads | X-C14 |
| X-45 | given a message body of any size or content, delivers it to the script without writing it to disk | No body is spilled to a temp file | NN1 |
| **X-81** | **new to the backlog** — given items the settings exclude, says how many were left out and never their titles or identifiers | #19's "excluded items are not named in results" | #19 |
| **X-82** | **new to the backlog** — given evidence naming a path inside the user's home directory, keeps the evidence verbatim but writes that path with the home directory replaced by `~` | Outside evidence stays verbatim; only the user's own home path is abbreviated | ADR-0006, #22 |
| CAL-31 | given a calendar the user excluded, never returns its events | An exclusion holds on search too | #19 |
| CAL-35 | given a range, reports the busy periods without revealing event titles | Availability answers the question asked and nothing more | CAL-C11 |
| CON-13 | never reports a contact note: macOS reserves that field for entitled apps | The most sensitive contact field is never in a result | #18 |
| CON-51 | never asks for the contact note, and still returns every other field | Contract level | #18 |
| MSG-24 | given a recipient the user has never messaged, refuses and names the contacts they probably meant | A refusal names contacts, not handles | ADR-0005 (#16) |
| **MSG-98** | **new to the backlog** — given several candidates, names each by contact name alone and never by a handle: a refusal is not a way to read contact details out of the machine | #17's refusal rule | NN4, ADR-0005, #17 |
| **MSG-99** | **new to the backlog** — reports the recipient by contact name and chat identifier and never by the handle addressed | #17's result rule: "a result that printed it would turn every send into a way to read contact details out of the machine" | NN4, ADR-0005, #17 |
| NOT-01 | reports a page of notes, each with a short preview but never its whole body | A listing can't be used to dump a library | ADR-0006 (#22) |
| NOT-63 | leaves no copy of a note's text on disk | Nothing is left behind | — |
| MAIL-26 | returns no email bodies unless asked: bodies are untrusted text | Bodies are opt-in | ADR-0006, #24 |
| MAIL-41 | never stores email contents outside Mail's own storage | Nothing is left behind | — |
| MAIL-50 | given an account outside the allowlist, refuses to read, list or change anything in it | An excluded account stays excluded | #19 |

**The gaps this closed.**

1. ADR-0005 and #17 both say a refusal names the contact, never the handle, and that a send's result
   identifies the recipient by contact name and chat identifier. MSG-98 and MSG-99 now state it, and
   MSG-26, MSG-36, MSG-44 and MSG-61 were rewritten to match.
2. #19's "excluded items are not named in results" is now X-81, and CAL-03 was rewritten to match.
3. A store's file path is exactly what an Apple Event or SQLite error carries, and X-22 covered only
   the server's own errors. X-82 resolves the tension with "the outside evidence verbatim" by
   keeping the evidence itself untouched and abbreviating only a path inside the user's home
   directory to `~`.

---

## Threat 6: sending without the user

A send that happens with no confirmation a person actually gave, including auto-answered
confirmations and tokens that pass through the model. ADR-0004 is the answer, and it is the decision
the backlog reflected least, because `findings.md` was written while MSG-C8, MAIL-C11 and X-C4 were
all still open and owned by #9.

**20 scenarios.**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| X-06 | marks every tool that changes a store as not read-only, so a client can ask before it runs | An annotation, explicitly advisory | #22, X-C5 |
| X-09 | marks sending a message or an email as not read-only, destructive, not idempotent and open-world: a send reaches other people and cannot be taken back | Annotations for sends | #22, X-C5 |
| X-31 | counts only an explicit approval from the user, never a model's reply | The domain rule that rules out sampling | NN2, ADR-0004 |
| **X-72** | **new to the backlog** — given a client that did not declare elicitation, offers no send tool, and no setting turns one on | "A rule that holds only on some clients can't be stated honestly" | NN2, ADR-0004 |
| **X-73** | **new to the backlog** — given a client that did not declare elicitation, refuses a send at dispatch and names the missing client support | The dispatch half, for a client holding an older tool list | NN2, NN5, ADR-0004, #19 |
| **X-74** | **new to the backlog** — given a response that leaves the required field unset, counts it as a decline: a client that auto-accepts an empty form is not a person | The defence against Codex `--yolo` | NN2, ADR-0004 |
| **X-75** | **new to the backlog** — given a decline or a cancel, sends nothing and says the user declined | What a decline means | NN2, ADR-0004 |
| **X-76** | **new to the backlog** — shows the resolved recipient, how it was resolved, the service and the whole body, never truncated | What the confirmation shows | NN2, ADR-0004 |
| **X-77** | **new to the backlog** — given a body that differs from the one confirmed, refuses: what was approved is what is sent | Accept or decline only, no editing | NN2, ADR-0004 |
| **X-78** | **new to the backlog** — requires a confirmation for every send whatever the settings say: no configuration removes it | Closes brightline's global skip switch | NN2, ADR-0004 |
| **X-92** | **new to the backlog** — offers no tool that prepares a send for another tool to complete: the token would come back in a tool result and pass through the model | The attack this threat names directly | NN2, ADR-0004, #5 |
| MSG-22 | given sending messages is not enabled, refuses and says which setting enables it | The capability gate, which is separate from the confirmation | NN2 |
| MSG-23 | given the user has not confirmed this send, refuses and sends nothing | The confirmation gate | NN2, ADR-0004 |
| MAIL-53 | given drafting is enabled, saves the draft without asking the user to confirm: nothing leaves the Mac | The boundary of the rule: confirmation is for sends | ADR-0004, #9 |
| MAIL-56 | sends nothing, even when sending is enabled | A draft tool is never a send tool | NN2, #18 |
| MAIL-57 | given sending is not enabled, refuses: sending mail is off until the user turns it on | The capability gate | NN2 |
| MAIL-58 | given the user has not confirmed this send, refuses and sends nothing | The confirmation gate | NN2, ADR-0004 |
| MAIL-99 | given the user has not confirmed this reply, refuses to send it | A reply is a send | NN2, ADR-0004 |
| **MAIL-110** | **new to the backlog** — given an address that account's Sent mail and existing conversations do not hold, refuses and names the contact rather than the address | What "known" means for email | NN4, ADR-0005, #16 |
| **MAIL-111** | **new to the backlog** — given the known-recipient check could not finish inside its budget, refuses and says how far back it looked | #16's incomplete-check rule | NN3, NN4, #16, #24 |

Alongside these, **X-07** marks every tool that changes or deletes existing data as destructive,
`update_note` included. It is not counted here, because an annotation is advisory and safety never
depends on it, but it is what makes a client ask. #22's parenthesis "v1 has no updates or deletes"
was corrected on that ticket: #18 keeps updating a note in v1, and that tool is destructive.

**The gaps this closed.** Everything ADR-0004 decided beyond "there must be a confirmation" was
uncovered: clients without elicitation (X-72, X-73), the required field and what a decline means
(X-74, X-75), what the confirmation shows (X-76), accept-or-decline only (X-77), no setting standing
in for a confirmation (X-78), no prepare/confirm tool pair (X-92), and Mail's known-recipient check
(MAIL-110, MAIL-111).

---

## Threat 7: a false report

The server claiming something happened that didn't, or hiding that it couldn't check.
Non-negotiable 3, upstream #66, and ADR-0006's `unconfirmed` outcome.

**81 scenarios.** This and threat 1 are what the backlog was mostly written for.

**The shape of a result and a failure**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| X-15 | given any refusal or failure, answers with a tool error the agent can read, never a protocol error | A failure the model never sees is a failure that didn't happen | ADR-0006, upstream #15 |
| X-19 | given an argument the tool does not declare, refuses the call: an ignored filter would make the reply lie | The answer matches the question | NN3 |
| X-20 | given any failure, answers with a named failure record carrying a stable code and one sentence saying what did not happen, with `isError` true | A failure says what did not happen, as a record | NN5, ADR-0006 |
| X-21 | given the app or store behind the tool complained, carries its words verbatim in the failure's evidence field, capped | Evidence is not paraphrased | X-C7, ADR-0006 |
| X-26 | given the app does not answer within its time budget, reports that the app timed out, not that permission is missing | A timeout isn't disguised | NN5, X-C8 |
| X-27 | given the store could not be read, reports a failure naming why, never an empty success | The upstream #66 family | NN3 |
| X-28 | given more matches than the page holds, says more exist and how to ask for the next page | A page isn't presented as everything | NN3 |
| X-35 | knows whether it is complete | Coverage | NN3 |
| X-36 | given fewer shown than exist, states both numbers | Coverage | NN3 |
| X-37 | given the page is at the hard ceiling, advises narrowing rather than asking for more | Coverage | — |
| X-42 | advertises exactly the tools the server lists | A manifest can't overclaim | — |
| X-48 | given output that is not the expected structure, refuses it rather than inventing an untitled item | No invented records | NN3 |
| X-55 | given a script that throws, reports a named script failure carrying the script's message | Named failure | NN5 |
| X-61 | given a request it could not complete, answers with a named failure, never with free text or a partial success | The helper can't half-succeed | NN3 |
| X-64 | given a result larger than the response limit, answers with a page instead of a truncated response | Truncation is never silent | NN3 |
| X-69 | given an empty store, reports empty; given an unreachable store, reports a named failure | Empty and broken stay apart | NN3 |
| **X-83** | **new to the backlog** — given a write the store could not confirm, reports an unconfirmed outcome and not an error, so the agent does not try the write again | `unconfirmed` is an outcome field, with `isError` false | NN3, ADR-0006, #9 |

**Calendar**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| CAL-06 | given more events than the limit, says the list is truncated and more exist | Coverage | NN3 |
| CAL-18 | given one calendar cannot be read or does not answer in time, reports the other calendars' events and names the calendar left out | A partial read says it is partial | NN3 |
| CAL-34 | given an identifier that matches no event, reports that no such event exists instead of opening the app | No pretend success | NN3 |
| CAL-36 | given a calendar whose events could not all be read, refuses to answer rather than reporting that time as free | The most dangerous false report in Calendar | NN3 |
| CAL-46 | reports the event as created only once the calendar holds it | Read-back | NN3 |
| CAL-47 | reports the calendar it filed the event in and the start and end the store saved, so a misread time is visible at once | Read-back | NN3 |
| CAL-53 | given a new start that cannot be read, refuses and changes nothing | No tool in v1 (#18, event update); kept in the backlog | NN3 |
| CAL-55 | reports the event as it reads back from the calendar after the change | No tool in v1 (#18) | NN3 |

**Reminders**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| REM-15 | given a reminder just created, includes it | No stale read | NN3 |
| REM-16 | given more reminders than the limit, reports the first ones and says more exist instead of presenting them as all | Coverage | NN3 |
| REM-18 | given a list too large to read within the time budget, says which list was not read | Coverage | NN3 |
| REM-20 | given the store cannot be read, fails and says why rather than reporting no reminders | Upstream #66 | NN3 |
| REM-27 | given the search could not cover every list, says how many lists it covered | Coverage | NN3 |
| REM-30 | given a reminder list that exists, puts the reminder in that list and reports the list and the id the store gave it | Read-back | NN3 |
| REM-32 | given a list that does not exist, refuses, creates no list and names the reminder lists there are | No silent substitution | NN3 |
| REM-33 | given a due date and time, reports the reminder created only after reading it back from the store with that due date and time | Read-back — upstream #64 | NN3 |
| REM-34 | given notes, stores them on the reminder and reports them as read back from the store | Read-back | NN3 |
| REM-45 | given an identifier no reminder has, refuses: nothing was changed | No tool in v1 (#18) | NN3 |
| REM-48 | given the store still holds the reminder afterwards, reports the outcome as unconfirmed | No tool in v1 (#18), but it is the `unconfirmed` shape | NN3, ADR-0006 |
| REM-62 | given a reminder saved with a due time, returns the same due time when fetched by its identifier | Contract | NN3 |
| REM-66 | given the store does not answer in time, fails with a timeout rather than returning no reminders | Contract | NN3 |

**Contacts**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| CON-12 | given a contact edited a moment ago, reports the edited details: nothing is served from a cache | No stale answer | NN3, MSG-C12 |
| CON-18 | given the contact store does not answer within its time budget, reports a timeout rather than no match | A timeout isn't "nobody by that name" | NN3 |
| CON-19 | given the native helper cannot be reached, reports that by name rather than an empty result or a scripted fallback | ADR-0002 | NN3, NN5 |
| CON-25 | reports the contact as read back from the contact store after saving, not the values it was given | No tool in v1 (#18) | NN3 |
| CON-26 | given an existing contact with the same name, reports the new contact's own identifier | No tool in v1 (#18) | NN3 |
| CON-32 | given a name rather than an identifier, refuses and lists the contacts the name matches: a write never guesses its target | No tool in v1 (#18) | NN3 |

**Messages**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| MSG-04 | given the message store exists but cannot be opened, fails rather than reporting no messages | Upstream #66 | NN3 |
| MSG-05 | given no message store exists on this Mac, fails as not found rather than as a missing permission | Two causes stay apart | NN5 |
| MSG-20 | given the search stopped before the oldest message, says how far back it reached | Coverage | — |
| MSG-36 | given the store shows the outgoing message left with no error, reports it sent, naming the recipient by contact name and chat identifier | Success only after the store says so, named the way #17 requires | NN3, #17 |
| MSG-37 | given the store records the outgoing message with a delivery error, reports it not sent and names the error | Delivery error | NN3 |
| MSG-38 | given the send raised no error but no outgoing message to that recipient appears in the store, reports the outcome as unconfirmed | The `unconfirmed` outcome | NN3, ADR-0006 |
| MSG-39 | given no outgoing record for that recipient appears, reports that it does not appear to have been sent and warns against sending twice | No double send | NN3 |
| MSG-40 | given the store cannot be read after the send, reports the outcome as unconfirmed rather than as sent or failed | The `unconfirmed` outcome | NN3, ADR-0006 |
| MSG-41 | given Messages stops answering, still checks the store before reporting anything | Never report on the script's word | NN3 |
| MSG-63 | given no card matches, reports the name as unknown rather than claiming there are no messages | Unknown is not empty | NN3 |
| MSG-92 | given a send just made, finds only outgoing messages to that recipient newer than the moment of sending | The check can't match an old message | NN3 |
| MSG-95 | converts a moment to Apple-epoch nanoseconds and back without loss: the store's own unit, so a send check compares like with like | The check's arithmetic | NN3 |

**Notes**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| NOT-06 | given a folder name that no account has, fails and names the folders that do exist rather than reporting no notes | Not-found is not empty | NN3 |
| NOT-07 | given an account that does not exist, reports it as unknown rather than as an empty folder | Not-found is not empty | NN3 |
| NOT-13 | given Notes does not become ready in time, fails saying Notes did not start rather than reporting no notes | A timeout isn't emptiness | NN3 |
| NOT-22 | given the search cannot run, fails and says why rather than reporting no notes | Upstream #67 | NN3 |
| NOT-35 | reports the note as created only once the store holds it, and gives its identifier | Read-back | NN3 |
| NOT-44 | given a body whose first line differs from the title, still confirms the update by identifier and reports the title the note now has | Read-back by identity | NN3 |
| NOT-45 | reports the update as done only after reading the note back by its identifier | Read-back | NN3 |
| NOT-46 | given the store does not yet show the new body, reports the update as unconfirmed rather than done | The `unconfirmed` outcome | NN3, ADR-0006 |

**Mail**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| MAIL-03 | given Mail has no accounts set up, says so rather than reporting a permission failure | Causes stay apart | NN5 |
| MAIL-13 | given unread emails in several accounts, orders them newest first by their real sent date | A real date, not a display string | NN3 |
| MAIL-19 | given more mail than it will look through, says how far back it looked instead of reporting there is no unread mail | Coverage — the brightline failure | NN3, #24 |
| MAIL-24 | given read and unread emails, reports each one's real read state | No guessed state | NN3 |
| MAIL-30 | reports which parts of an email it searched: subject only, or subject and body | Coverage — bodies are opt-in | NN3, #24 |
| MAIL-39 | given a search date that cannot be read as a date, refuses: a silent empty result looks like no mail | No silent empty | NN3 |
| MAIL-40 | given an email deleted since the last search, does not report it | No stale hit | NN3 |
| MAIL-42 | given the mail store cannot be read, fails and says what failed rather than reporting no accounts, mailboxes or emails | Upstream #69 | NN3 |
| MAIL-44 | given one account that fails or does not answer in time, still reports the other accounts' mail and names the account it could not read | Per-account coverage | NN3, #24 |
| MAIL-46 | given Mail has no accounts, fails saying so rather than asking for a permission | Causes stay apart | NN5 |
| MAIL-47 | given the mail store does not answer within the time budget, fails saying it timed out rather than blaming a permission | Causes stay apart | NN5 |
| MAIL-49 | given an email with no sent date, reports the date as unknown rather than inventing one | Nothing invented | NN3 |
| MAIL-54 | given recipients, a subject and a body, saves a draft without sending it and reports it only once it is found in the account's Drafts mailbox | Read-back | NN3 |
| MAIL-55 | given the draft cannot be found in the Drafts mailbox afterwards, reports it as unconfirmed | The `unconfirmed` outcome | NN3, ADR-0006 |
| MAIL-62 | reports the email as sent only once it is found in the sending account's Sent mailbox | Read-back — #9 bounds the check | NN3, #9 |
| MAIL-63 | given the email does not appear in the Sent mailbox afterwards, reports the send as unconfirmed | The `unconfirmed` outcome | NN3, ADR-0006 |
| MAIL-93 | given an identifier from a search result, returns that email's full text and never a different email with a similar subject | Identity, not subject | NN3 |

**The gap this closed.** #22 makes `unconfirmed` an *outcome field*, not an error, with `isError`
false "so the agent doesn't send again". Six scenarios report an unconfirmed outcome and none pinned
that it is not an error. X-83 does.

---

## Threat 8: supply chain and helper integrity

A tampered or substituted helper binary, or a dependency doing the tampering. ADR-0003 was decided
after `findings.md` was written, and none of what it decided had a scenario; the five below were the
whole of it, and only X-70 was really about integrity. The six new ones cover ADR-0003's mechanism.

**11 scenarios.**

| ID | Short name | What it proves | Decision it enforces |
|---|---|---|---|
| X-01 | touches no app and no store until a tool is called | Startup does no privileged work | upstream #10 |
| X-42 | advertises exactly the tools the server lists | The shipped package matches the server | — |
| X-59 | writes nothing but protocol responses to its output stream | The helper's channel is the protocol | X-C16 |
| X-60 | given a request for a protocol version it does not speak, refuses with a version mismatch | A mismatched helper is refused, not driven | X-C12 |
| X-70 | given the native helper is not installed or cannot be reached, fails with a named failure that says how to fix it, never a scripted fallback | The server never substitutes another path for a missing helper | NN3, NN5, ADR-0002 |
| **X-84** | **new to the backlog** — given a binary at the fixed path that does not meet the pinned code requirement, refuses to copy over it or to run it, and fails by name | The path is user-writable, and a stranger's binary there would prompt under a trusted name | NN5, ADR-0003 |
| **X-85** | **new to the backlog** — given the helper changed since it was installed, checks it again and refuses it | The requirement is checked before every launch, not once | NN5, ADR-0003 |
| **X-86** | **new to the backlog** — given a helper newer than the one it ships, keeps the newer one and names which client's install to update rather than replacing it | Mixed versions: the newest helper wins | NN5, ADR-0003, #8 |
| **X-87** | **new to the backlog** — given a development build and no developer setting in the client's configuration, refuses it | A development build needs a setting tool input can't reach | NN2, NN5, ADR-0003 |
| **X-88** | **new to the backlog** — given a request naming a script or a query it does not ship, refuses it: the helper runs only the scripts and prepared statements built into it | The flip side of ADR-0002 moving the SQL and the scripts into Swift | NN1, ADR-0002 |
| **X-91** | **new to the backlog** — installs the helper from the package it shipped in, running no install script and fetching nothing from the network | #8 chose "no postinstall step" partly for this | NN1, #8 |

### Dependency integrity is release and CI work, not server behaviour

The other leg of this threat has no scenario and should not have one. Pinned lockfiles, actions
pinned by SHA, `persist-credentials: false`, secret scanning, build provenance attestations and
checking every published install path against the artefact are release-pipeline properties, not
behaviours a tool can be asked for. `findings.md` parks them under Cross-cutting → "Repository and
release inputs", sourced to danielk-am `ae5295e`, chrischall `056c109` / `87b1ae3` / `b3909e9` /
`a731f24` / `8d10035` and long-tail/JoshOsullivan-au `ec13b9e`. `docs/security.md` should cite that
list and say plainly that this leg is answered by the release pipeline.

One repository input **is** a threat finding, and belongs in the threat model as the worked example
of why nothing in the repo is trusted to run itself: the malware in
long-tail/amandeeptherockstar `b1fffed`, which used a `.vscode` `runOn: folderOpen` task and a
committed `.env` to run code the moment someone opened the folder. It is why the fork research never
cloned or opened that repository, and why a repository check for automatic editor tasks and
committed secrets is part of Phase 0's CI.
