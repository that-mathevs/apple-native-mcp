# gene-jelly/apple-mcp

- **Remote:** `fork-gene-jelly`
- **Branches read:** `main` (4 commits). `HEAD` points at `main`. `fix-mail-search` and
  `index-safe-mode` are upstream copies with no commits of their own
  (`git log upstream/<b>..fork-gene-jelly/<b>` is empty).
- **Commits accounted for:** 4 / 4
- **Last commit:** 2026-04-12
- **In one paragraph:** A personal inbox-triage setup, written with Claude Opus 4.5 and 4.6. Its
  owner hid the Messages tool in favour of `mac_messages_mcp`, which can fall back to SMS and
  RCS. It kept this server for mail and reminders. For mail, it looks inside each account's
  mailboxes instead of only the application's top-level mailboxes, which is why upstream found no
  mail (#69, #58). It asks Mail for unread messages with a `whose read status is false` filter
  instead of reading every message's read flag one Apple Event at a time. And it adds
  triage operations: archive, delete, move, mark as read, and "have I replied?". For reminders,
  it reads each property as one list per reminder list and searches in TypeScript. The
  performance diagnosis is sound, and the explanation is below. The write operations are
  dangerous, though: they act on the first message whose subject and sender merely contain the
  given text. An escaping bug also lets a plain `"` break out of the script, which is worse than
  upstream's escaping.

## How it reaches each app

| Context | Mechanism | Notes |
|---|---|---|
| Mail (read) | AppleScript via `run-applescript`: `every account`, then `mailboxes of acct`, then `messages of mb whose read status is false` (or `whose subject contains … or sender contains …`), then 4 Apple Events per matching message | Output framed with `<<<FIELD>>>` / `<<<EMAIL_SEP>>>`. Capped at 20 messages and a 300-character preview. |
| Mail (write) | AppleScript `move foundMsg to <mailbox>` and `set read status of foundMsg to true`, where `foundMsg` is `item 1 of (messages of mb whose subject contains "<s>" and sender contains "<f>")` searched mailbox by mailbox | No message id anywhere. |
| Reminders (read) | AppleScript bulk properties: `name of reminders of targetList`, `id of …`, `completed of …` (one Apple Event per property per list) | Search filters names in TypeScript. |
| Messages | Removed from the advertised tool list only | The `messages` handler in `index.ts:369` is still reachable by name. |

## Changes

### C1 Unread mail and mail search look inside every account

- **Kind:** fix
- **Context:** mail
- **Symptom:** "Cannot find any mails" and "finds zero emails in every account" (upstream #69,
  #58), even though sending worked.
- **Root cause:** Upstream `utils/mail.ts:87` and `:185` iterate `set allMailboxes to mailboxes`
  at the application level. In Mail's dictionary, the application's `mailboxes` are the local
  "On My Mac" mailboxes, while account mailboxes such as INBOX, Sent and Archive are elements of
  each `account` (verify). On a Mac with only IMAP, Exchange or iCloud accounts, the loop sees
  nothing. The results were also discarded (`return "SUCCESS:" & count`, then `[]`).
- **Technique:** `repeat with acct in every account`, then `repeat with mb in mailboxes of acct`.
  Each result is tagged `"<account> - <mailbox>"` and returned as delimited text.
- **Evidence:** `c5a0edd`. Upstream #69, #58.
- **Quality of the fix:** partial.
  - Every mailbox is visited in dictionary order, including Junk, Trash, Sent and Drafts, so
    unread spam can fill the 20-item cap before INBOX is reached.
  - Mail's unified `inbox` and each mailbox's `unread count` aren't used.
  - Nested mailboxes may or may not be included in `mailboxes of account` (verify).
  - Errors per account and per mailbox are swallowed, so a permission failure looks like "no
    unread mail".
  - Dates are `date sent as string`, formatted by the locale and without an offset.
- **Verdict:** adopt the idea (accounts own mailboxes, and a read must cover every account).
  Whether the mechanism is JXA or the Envelope Index is still open in plan.md.
- **Scenarios:**
  - [acceptance] `listing unread mail` — `given unread messages in the inboxes of two accounts, reports both with their account and mailbox`
  - [acceptance] `listing unread mail` — `given unread messages only in junk, reports none unless junk is asked for`
  - [acceptance] `listing unread mail` — `given Mail cannot be read, fails and says why instead of reporting no mail`

### C2 Unread mail is filtered inside Mail instead of one message at a time

- **Kind:** fix (performance)
- **Context:** mail
- **Symptom:** Listing unread mail timed out, or took minutes on a large mailbox.
- **Root cause:** Upstream `utils/mail.ts:97-105`:
  `set unreadMessages to messages of currentMailbox`, then for `j` from 1 to count,
  `set currentMsg to item j of unreadMessages` and `if read status of currentMsg is false`. Each
  `read status of` is a separate Apple Event: a round trip through the Apple Event Manager into
  Mail's main thread, which resolves the object specifier and replies. So the cost grows with
  the number of **messages scanned**, not the number of unread messages found. A mailbox of
  20 000 read messages costs 20 000 round trips before the loop moves on. It stops early only
  after `maxEmails` unread messages have been found.
- **Technique (explained, not measured):** `set unreadMsgs to (messages of mb whose read status
  is false)` sends **one** Apple Event carrying a whose-test (`formTest`). Cocoa Scripting
  evaluates the test inside Mail's process against each message and replies with specifiers for
  the matches only. The scan is still O(N) on Mail's side, but each test is an in-process
  property read with no IPC, marshalling or context switch. The client's cost drops from about
  N + 5k events (N messages scanned, k results) to about 1 + 4k per mailbox, with k ≤ 20
  (subject, sender, date sent, content). Search gets the same treatment:
  `whose subject contains X or sender contains X` replaces a per-message `subject of` read.
- **Evidence:** `c5a0edd`. Related upstream #53 (the same failure in Reminders).
- **Quality of the fix:** partial. The fork leaves the bigger savings on the table:
  - (a) `unread count of mb` is one event per mailbox and would skip the whose-test entirely for
    the many mailboxes with nothing unread.
  - (b) Bulk property reads such as `subject of (messages of mb whose read status is false)`
    would cut the 4 events per message down to 4 per mailbox.
  - (c) `content of` is the most expensive property. On IMAP it can force a body download, and
    the fork fetches it for every result just to cut it to 300 characters.
  - A whose-test on a remote IMAP mailbox that isn't fully cached may still be slow inside Mail.
  - No timings are given in the commit, and none could be taken here: Mail has no account on
    this Mac and isn't running.
- **Verdict:** adopt the idea (push the filter into the store and read properties in bulk).
  Verify on a real mailbox of at least 10 000 messages with a few unread: time (1) upstream's
  per-message loop, (2) the fork's whose-test with per-message properties, (3) `unread count`
  pre-check plus bulk property reads, and (4) an Envelope Index query. The answer settles plan.md's
  Mail mechanism.
- **Scenarios:**
  - [contract] `a mail store` — `given a mailbox of ten thousand read messages and three unread, lists the unread ones within the time budget`
  - [contract] `a mail store` — `given mailboxes with nothing unread, does not read their messages`

### C3 Accounts, mailboxes and latest mail return real data

- **Kind:** fix
- **Context:** mail
- **Symptom:** "Accounts" said "Default Account" or "No email accounts found". "Mailboxes" always
  said Inbox, Sent, Drafts. "Latest" always failed.
- **Root cause:**
  - `utils/mail.ts:351` returns `{"Inbox", "Sent", "Drafts"}` and `:391` returns
    `{"Default Account"}`, both hard-coded.
  - `:362` and `:402` then keep the result only if `Array.isArray(result)`, which is never true
    for `run-applescript`'s string, so both return `[]` (`index.ts:769`).
  - `getLatestMails` calls `sort messagesList by date sent` in a handler outside the `tell` block
    (`:533-536`). Mail has no `sort` command, so the script doesn't compile. Measured with
    `osacompile`: "Expected end of line but found identifier (-2741)".
  - Its regex record parser (`:548-575`) couldn't have worked either.
- **Technique:**
  - `getAccounts` and `getMailboxes` build a list with `set end of … to name of …`, and
    TypeScript splits the comma-joined text.
  - `getLatestMails` takes `mailbox "INBOX" of targetAccount`, or the first mailbox, and reads
    `message i` for i = 1…limit.
  - It returns delimited records and reports `isRead` from `read status`.
- **Evidence:** `bb07be5`. Upstream #69, #58.
- **Quality of the fix:** partial.
  - A name containing a comma splits into two.
  - `getMailboxes` still reads the application's top-level mailboxes only (see C1).
  - "Latest" assumes `message 1` is the newest message, which is unverified, and it looks at one
    account's INBOX only.
  - `mailbox "INBOX"` fails for accounts whose inbox has another name, falling back silently to
    whichever mailbox comes first.
- **Verdict:** adopt the idea (report the real accounts and mailboxes). Verify message ordering
  before building "latest" on it.
- **Scenarios:**
  - [acceptance] `listing mail accounts` — `given two configured accounts, reports both by name`
  - [acceptance] `listing mailboxes` — `given an account with nested mailboxes, reports each mailbox under its account`
  - [acceptance] `reading the latest mail` — `given messages across inboxes, reports the newest first by date received`

### C4 Messages can be archived, deleted, moved and marked as read

- **Kind:** feature
- **Context:** mail
- **Symptom:** The agent couldn't tidy an inbox (upstream #51 asks for move, mark read/unread,
  flag).
- **Root cause:** Upstream has no mail write operations other than send.
- **Technique:**
  - Each operation takes `account`, `subject` and `sender`, loops over `mailboxes of
    targetAccount`, and takes
    `item 1 of (messages of mb whose subject contains "<subject>" and sender contains "<sender>")`.
  - **Archive:** finds the first mailbox named `Archive` or `[Gmail]/All Mail`, or whose name
    contains `Archive`, then `move`s the message there.
  - **Delete:** does the same for `Trash` and `move`s the message there.
  - **Move:** uses the first mailbox whose name equals *or contains* `targetMailbox`.
  - **Mark read:** `set read status … to true`.
  - Each returns `SUCCESS:` as soon as the command doesn't throw.
- **Evidence:** `bb07be5` (archive, delete, markread), `d13e5b4` (move, schema enum). Upstream #51.
- **Quality of the fix:** wrong.
  - **Wrong message.** "Subject contains 'Invoice' and sender contains 'acme'" picks the first
    such message in the first mailbox that has one, which could be in Sent or Trash, or be last
    year's invoice. Delete and move act on it with no confirmation.
  - **Wrong mailbox.** `contains` matching can pick `Archive/2019` for "Archive", or
    `Old Receipts` for "Receipts".
  - **No read-back.** It never checks that the message left its mailbox (upstream #66).
  - **Injection by a single quote.** The subject is escaped with
    `.replace(/"/g, '\\"').replace(/\\/g, '\\\\')`. Escaping quotes first and then doubling
    backslashes turns `"` into `\\"`, which closes the literal. A subject such as
    `" & (do shell script (character id {…}))) --` runs a shell command without any backslash in
    the input. Sender, account and target mailbox are escaped for `"` only, so they are open to
    the backslash form.
- **Verdict:** adopt the idea (triage operations are wanted; #51). Reject the technique: address a
  message by the id a read returned, resolve mailboxes by exact identity, and confirm the move in
  the store. Deleting is a destructive capability, off by default.
- **Scenarios:**
  - [acceptance] `moving a message` — `given a message id from an earlier read, moves exactly that message and reports its new mailbox as read back from the store`
  - [acceptance] `moving a message` — `given a subject and sender instead of an id, refuses: several messages can match`
  - [acceptance] `moving a message` — `given a destination name that matches no mailbox exactly, refuses and names the mailboxes there are`
  - [acceptance] `deleting a message` — `given deleting is not enabled, refuses and says which setting enables it`
  - [acceptance] `marking a message read` — `given a subject containing a double quote, marks the message and runs nothing else`

### C5 The agent can ask whether the user already replied to a message

- **Kind:** feature
- **Context:** mail
- **Symptom:** When triaging, the agent couldn't tell a message that still needs a reply from
  one that has had one.
- **Root cause:** Not in upstream.
- **Technique:** Strips a leading `Re:`/`RE:`/`Fwd:`/`FWD:` from the subject, pulls the address
  out of `Name <addr>`, finds the first mailbox named `Sent`, `Sent Messages` or containing
  `Sent Mail`, and then, **for every message in it**, reads the subject, tests `contains`, and
  checks whether any recipient's address `contains` the sender. It returns `REPLIED:<date sent>`
  or `NOREPLYFOUND`.
- **Evidence:** `bb07be5`.
- **Quality of the fix:** partial.
  - It's the per-message event loop that C2 exists to avoid, over the whole Sent mailbox.
  - Subject containment matches unrelated threads with generic subjects ("Hello").
  - A reply sent before the message in question still counts.
  - A reply from another account or client that didn't land in this Sent mailbox is missed.
  - An error reads as "no reply found" with `isError: false`.
- **Verdict:** adopt the idea (a "replied" state is useful when triaging). Reject the heuristic:
  thread by `Message-ID` and `In-Reply-To`/`References`, or by Mail's own `was replied to`
  message flag (verify that the property exists and is reliable).
- **Scenarios:**
  - [acceptance] `checking for a reply` — `given a sent message that answers this one, reports replied with when it was sent`
  - [acceptance] `checking for a reply` — `given a sent message with the same subject in another thread, reports not replied`

### C6 Reminders are read one property at a time per list, and searched in TypeScript

- **Kind:** fix (performance)
- **Context:** reminders
- **Symptom:** Listing reminders returned nothing or timed out. Search never found anything
  (upstream #53, #26).
- **Root cause:** Upstream stubs: `utils/reminders.ts:140-176`, `:184-217` and `:348-380`
  return `[]`.
- **Technique:**
  - Per list: `name of reminders of targetList`, `id of …`, `completed of …`. That's three
    Apple Events returning parallel lists, zipped in AppleScript and framed as `|||` fields with
    one line per reminder.
  - With a list name it addresses `list "<name>"` directly.
  - `getRemindersFromListById` loops over lists comparing `id`.
  - `searchReminders` loads everything and filters names in TypeScript.
  - It lowers `MAX_REMINDERS` to 25 and `MAX_LISTS` to 10.
- **Evidence:** `c5a0edd`. Upstream #53, #26.
- **Quality of the fix:** partial.
  - Body and due date are never read (`body: ""`, `dueDate: null`), so search ignores notes and
    results can't show when a reminder is due.
  - Completed reminders are mixed in, and the 25 cap is shared by all lists, so a few old lists
    fill it. Nothing says the result was cut short.
  - Each bulk read is still the whole list (the fork caps only the output), so large lists stay
    slow.
  - A name containing a newline or `|||` breaks the framing.
  - `list "<name>"` and the id are escaped for `"` only.
  - It drops the access check in search.
- **Verdict:** adopt the idea (bulk reads, filter outside the script). EventKit remains the plan.
- **Scenarios:**
  - [acceptance] `searching reminders` — `given text found only in a reminder's notes, finds it`
  - [acceptance] `listing reminders` — `given reminders with due dates, reports each one's due date`

### C7 Messages is left to another server that can fall back to SMS and RCS

- **Kind:** other:scope
- **Context:** messages
- **Symptom:** Messages to contacts without iMessage didn't go through (upstream #24).
- **Root cause:** Upstream `utils/message.ts:72-80` picks
  `1st service whose service type = iMessage` and doesn't even use it (`buddy "<phone>"` is
  resolved without `of targetService`). There's no SMS or RCS path.
- **Technique:** Removes `MESSAGES_TOOL` from the advertised list in `tools.ts`. The handler in
  `index.ts:369` is still dispatched by name, so a client that calls `messages` anyway still
  reaches upstream's injectable send.
- **Evidence:** `b99bbce`. Upstream #24.
- **Quality of the fix:** partial. Hiding a tool doesn't disable it.
- **Verdict:** verify. Does sending through the Messages scripting dictionary's SMS or RCS service
  work on macOS 26 when the recipient has no iMessage, and does `chat.db` record which service
  delivered? Also adopt the rule that a capability that's off is refused at dispatch, not merely
  unlisted.
- **Scenarios:**
  - [acceptance] `sending a message` — `given a recipient without iMessage, reports which service would carry the message before sending`
  - [acceptance] `a disabled capability` — `given a call to it by name, refuses as if it did not exist`

## Noise

- Lockfile churn: `d13e5b4`. The rest of `d13e5b4` is C4.

## Glossary candidates

- **account (mail):** a configured Mail account. It owns its mailboxes. The fork names results
  `"<account> - <mailbox>"`.
- **mailbox:** a folder of messages inside an account (INBOX, Sent, Archive, `[Gmail]/All Mail`).
  The application also has top-level local mailboxes of its own.
- **unread message:** a message whose `read status` is false.
- **whose-test:** a filter sent to the app in one request and evaluated inside the app's process.
- **archive mailbox / trash mailbox / sent mailbox:** role mailboxes the fork finds by name.
  Names vary by provider.
- **reply (to a message):** a sent message in the same thread addressed to the original sender.
  The fork approximates it by subject.
- **service (messages):** the transport carrying a chat: iMessage, SMS or RCS.

## Open questions

- Does Mail's application-level `mailboxes` really exclude account mailboxes on macOS 14–26? Does
  `mailboxes of account` include nested mailboxes?
- Is `message 1 of mailbox` the newest message by date received?
- How long do the four variants in C2 take on a large IMAP mailbox? Does a whose-test force Mail
  to download message headers it hasn't cached?
- Does Mail expose a reliable `was replied to` flag through scripting, as an alternative to C5's
  heuristic?
