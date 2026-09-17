# Plan: rebuild apple-mcp

`supermemoryai/apple-mcp` was archived on 2026-01-01 with its bugs unfixed and a command-injection hole in the tools that send messages and create events. Around 25 forks have fixed pieces of it since, but no one has brought those fixes together. This plan collects what the forks learned and rebuilds the server from scratch with a clean architecture. Every behaviour is specified BDD-style before it is built.

## Goal

- **The server:** an MCP server that gives an agent safe, reliable access to the user's own data in the native macOS apps.
- **Pristine means:**
  - Dependency rules a tool can check.
  - No string-built scripts or queries anywhere.
  - A test suite that reads as the product's specification.
  - No code that exists without a scenario asking for it.
- **Success means:**
  1. Every problem the forks fixed and every relevant upstream issue is either covered by a named scenario or rejected with a reason.
  2. The printed spec (test names) explains, on its own, what the server does and what it refuses to do.
  3. Treating tool input as hostile (prompt injection) can't lead to running code, sending a message the user didn't confirm, or reporting success for something that didn't happen.

## Where things stand

The local repo is `~/apple-mcp`, cloned with full history. `main` points at `upstream/main` (`08e2c53`, v1.0.0).

**Remotes**

| Remote | What it is |
|---|---|
| `origin` | that-mathevs/apple-native-mcp (public, empty; `gh` default repo) |
| `upstream` | supermemoryai/apple-mcp (archived) |
| `fork-<owner>` | the 18 forks with at least 3 commits of their own, already fetched. See Appendix A. |

Some forks have more branches than `main` (e.g. `fork-ANierbeck/fix/applescript-input`), so list them all with `git branch -r --list 'fork-<owner>/*'`.

Decision 1 is settled: the project is the new public repo `that-mathevs/apple-native-mcp` (created 2026-09-17, still empty). Nothing has been pushed to it yet.

**Toolchain on this Mac:** Node 23.3, Swift 6.3.3, macOS 26.3. Bun isn't installed (upstream used it).

**What upstream has:** 8 tools (contacts, notes, messages, mail, reminders, calendar, maps, webSearch), each one a single tool with an `operation` argument. It drives the apps with about 50 AppleScript calls built from strings, and reads Messages' `chat.db` by shelling out to `sqlite3`. The only tests run against the real apps and the user's real data.

## Non-negotiables

These apply to every phase. A pull request that breaks one isn't finished.

1. **Tool input is hostile.** Nothing that reaches a tool is ever spliced into a script, a shell command or a SQL string:
   - Scripts are static files, and values reach them only as JSON arguments.
   - SQL is only ever a prepared statement.
   - There is no shell anywhere.
2. **Read-only by default.** Every capability that writes (send a message, send an email, create or change an event, note or reminder) is off until configured. Sending a message or an email also needs the user's confirmation for each send.
3. **Results tell the truth.** A tool reports success only after checking the store. If the check isn't possible, it says the outcome is unconfirmed. (Upstream #66 "False Success of Calls". faces-sh reads the Messages store after sending.)
4. **Recipients must be known.** A message goes only to a contact or number the user has already messaged. Otherwise it is refused, and the refusal says who they probably meant. (Upstream #48 "ghost" contacts. faces-sh's wrong-number check.)
5. **Failures say how to fix them.** A missing macOS permission is its own named failure that tells the user which setting to change and where (upstream #65).
6. **Ideas, not code, move across from forks.** A fork's fix becomes a scenario, the scenario gets built fresh, and the fork is credited in `CREDITS.md`. Nothing is cherry-picked.
7. **Boundaries are machine-checked.** The architecture rules below are enforced by dependency-cruiser in CI, not by review.

## Target architecture

The core is ports and adapters. Business rules sit at the centre and have no dependencies. macOS lives only in adapters. MCP lives only at the outer edge.

```
src/
  domain/<context>/        pure rules and types, no I/O, no Node APIs
  application/<context>/   use cases (one per tool operation) + the ports they need
  adapters/
    native/                client for the Swift helper (EventKit, Contacts)
    messages-store/        chat.db read-only via node:sqlite, prepared statements only
    automation/            JXA runner: runs a named static script with JSON args
  mcp/                     tool definitions, input schemas (zod), result + failure mapping
  main.ts                  composition root: the only place adapters meet use cases
native/                    Swift package: long-lived helper process, JSON lines over stdio
spec/
  acceptance/              scenarios at the MCP boundary, in-memory client + fake ports
  contracts/               one contract per port, run against the fake AND the real adapter
```

The contexts are `calendar`, `reminders`, `contacts`, `messages`, `notes` and `mail`.

**Dependency rules** (dependency-cruiser):

- `domain` imports nothing outside `domain`.
- `application` imports `domain` and its own port interfaces, never `adapters` or `mcp`.
- `adapters` import `application` ports and `domain` types, never `mcp`.
- `mcp` imports `application`, never `adapters`.
- Only `main.ts` imports everything.
- Contexts don't import each other's internals. When Messages needs to resolve a contact, it goes through a port whose adapter calls the contacts use case.

**How each app is reached.** Choices marked *verify* depend on evidence from Phase 1.

| Context | Mechanism | Why |
|---|---|---|
| Calendar, Reminders | EventKit via the Swift helper | Typed, fast, no scripting. arr2036 and ANierbeck both moved calendar to EventKit. |
| Contacts | Contacts.framework via the Swift helper | Returns emails as well as phones (upstream #75, #47). Requests permission properly (#65). |
| Messages (read) | `chat.db` opened read-only via `node:sqlite` | Upstream's approach works. The flaws were the shell-out and the regex decoding of `attributedBody`. Replace the regex with a real typedstream decoder. |
| Messages (send) | JXA static script, recipient and body as argv JSON | No other API sends iMessages. |
| Notes | *verify*: JXA static scripts vs reading `NoteStore.sqlite` | Upstream hit "whose is not a function" on some macOS versions (#44). danielk-am rewrote notes "for modern macOS", and morquis scopes notes by account and folder. |
| Mail | *verify*: JXA static scripts vs reading the Envelope Index | ANierbeck says it uses a "MailKit" Swift binary, but MailKit is for Mail extensions, not reading mailboxes. Find out what it actually does. brightline and felkru fixed per-account enumeration. |

**The Swift helper.** One long-lived process speaks versioned JSON-lines requests and responses. Its protocol is a port with its own contract suite, so the TypeScript side is tested against a fake helper and the helper is tested against real EventKit.

**Out of scope for v1:** Maps and web search. They don't touch personal data, and every MCP client already has web search. Photos, Music and Shortcuts are candidates for later (upstream PR #39, morquis' music tool, danielk-am's shortcuts).

## How we work: BDD

The `bdd` skill decides what tests say. The `tdd` skill (red → green → refactor, one vertical slice at a time) decides the loop.

- **`CONTEXT.md` comes first.** It is the glossary: handle, chat, buddy, account, calendar, event, occurrence, reminder list, note folder, mailbox, and so on. Every test name and every exported identifier uses these words. When a scenario needs a word that isn't in the glossary, stop and add it first.
- **Work outside in.** Each slice starts with one acceptance scenario at the MCP boundary. Scenarios it can't yet satisfy pull in use cases, then domain rules, then ports. Each layer inward is its own red → green cycle.
- **Three kinds of spec:**
  - *Acceptance* (`spec/acceptance`): what an agent observes through a tool, backed by fake ports. These run everywhere, including CI.
  - *Domain* (`src/domain/**/*.spec.ts`): pure rules such as phone-number normalisation, search query parsing, date ranges and `attributedBody` decoding.
  - *Contract* (`spec/contracts`): one suite per port, written once and run against both the fake and the real adapter. Real runs need a Mac with permissions granted (`npm run spec:mac`), so they aren't part of hosted CI. A fake that passes its contract is proof that the acceptance specs hold in reality.
- **Done means the spec reads well.** Print the test names (`vitest --reporter=verbose`) and read them as a document. A name a stranger can't learn from is a defect.
- **Write the reason into the scenario** wherever a rule exists because of a real-world failure. Cite the upstream issue or fork commit in a one-line comment.

## Phase 0: decisions and language

1. Settle the open decisions at the end of this file.
2. Write `CONTEXT.md` with the first glossary pass, using upstream's code, the issues and the fork commit messages as sources.
3. Set up the repo:
   - One commit that deletes the legacy code. It's still reachable with `git show upstream/main:<path>`.
   - Node 24 LTS (`node:sqlite` without a flag), TypeScript strict with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.
   - Vitest, ESLint, dependency-cruiser with the rules above.
   - A CI workflow on a macOS runner: typecheck, lint, boundaries, domain and acceptance specs, and the Swift helper building with its own unit specs.
   - `LICENSE` keeps the original MIT notice and adds ours.

**Exit:** CI is green on an empty skeleton, and a failing boundary rule shows up as a CI failure.

## Phase 1: go through the forks

Output is research only. No product code.

**For each fork in Appendix A:**

1. Read every commit on every branch that upstream doesn't have:
   ```sh
   git log --no-merges --reverse --stat upstream/main..fork-<owner>/<branch>
   git diff upstream/main...fork-<owner>/<branch> -- <path>
   ```
   For large forks (morquis, 121 commits), read by context directory rather than commit by commit.
2. Write `docs/research/forks/<owner>.md`, with one entry per distinct change:
   - **Kind:** fix, feature, hardening, refactor, infra or noise.
   - **Context:** calendar, messages, etc.
   - **Symptom:** what a user saw go wrong, in user terms.
   - **Root cause:** why it happened.
   - **Technique:** how the fork fixed it.
   - **Evidence:** commit SHAs, plus any upstream issue it resolves.
   - **Verdict:** *adopt the idea*, *reject* (with a reason), or *verify* (a claim still to test on a real Mac).
   - **Scenarios:** the scenario names it implies, in the `bdd` naming grammar.
3. Also go through upstream's unmerged PRs (#73 mail fixes, #76 tool annotations, #68 drafts, #49 contacts search, #40 reminder lists, #37/#32 mail search, #28 notes by folder, #39 photos, #52 music) and read the bodies of the issues in Appendix B. The mapping there is by title only.
4. Re-list the forks at the start. Appendix A is a snapshot from 2026-09-17, and new forks with commits may have appeared:
   ```sh
   gh api --paginate 'repos/supermemoryai/apple-mcp/forks?per_page=100' \
     --jq '.[] | select(.pushed_at > "2025-08-12") | .full_name'
   ```

The forks are independent, so give each one to its own research agent. One agent then merges the results.

**Merge into `docs/research/findings.md`, grouped by context:**
- A **scenario backlog** with every scenario deduplicated, each one tracing back to its sources.
- **Conflicts**, where forks solved the same problem differently, with a recommendation for each.
- **Verification tasks**, meaning claims to prove on a real Mac before building on them (e.g. ANierbeck's MailKit, Notes' "whose" failures on specific macOS versions).
- **Credits**: which fork contributed which idea, to go into `CREDITS.md`.

**Exit:** every commit in every fork in Appendix A and every issue in Appendix B appears in the findings, as a scenario, a rejection or a verification task. The "How each app is reached" table is final.

## Phase 2: walking skeleton

This is the thinnest slice that goes through every layer, chosen because the Swift helper is the riskiest piece of the architecture.

**Slice:** `list_events` returns the calendar events in a time range.
- **Acceptance:** an agent asking for this week's events gets them, in order, with their calendar named.
- **Domain:** the range rules (whole days in the user's time zone, recurring events expanded into occurrences).
- **Port:** `EventStore`, with its contract passing against the fake and against real EventKit through the helper.
- **Edge cases the helper has to handle:** calendar permission not granted (a named failure that says how to fix it), the helper crashing (restarted once, then a named failure), and a protocol version mismatch.

**Exit:** the tool works from a real MCP client (Claude Code), `npm run spec:mac` is green on this Mac, and the printed spec reads as a spec.

## Phase 3: one context at a time

Each context is a series of vertical slices taken from the Phase 1 backlog. Read-only operations come before writes. The order follows dependencies and risk:

1. **Calendar:** search, open, then create (behind the write setting). Upstream #74, #25, #6.
2. **Reminders:** lists, search, create with a due time. Upstream #64, #34, #53, #26, #10, #59, #27.
3. **Contacts:** find by name, phone and email. Returns every kind of contact detail. Messages depends on it. Upstream #75, #65, #58, #47.
4. **Messages (read):** recent chats, a chat's messages, unread, with attachments listed. Upstream #62, #3.
5. **Messages (send):** confirmed and verified, known recipients only, then scheduled sends. Upstream #48, #24, #66.
6. **Notes:** list, search the full note content, create, update without losing formatting (KassebaumEngineering "refuses lossy rewrites"). Upstream #67, #44, #27, #22.
7. **Mail:** accounts and mailboxes, search, latest, drafts, then send (confirmed). Upstream #69, #58, #51, #30, #19, PRs #73, #68.

**Definition of done for each slice:**
- Scenario names were written first and read as a spec before any code.
- The loop went red → green → refactor.
- The contract is green against the real adapter on a Mac.
- Tool annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`) are set (upstream PR #76).
- The backlog entries are ticked off in `findings.md`.
- Credits are recorded.
- There are no boundary or lint exceptions.

## Phase 4: release

- A **threat model** in `docs/security.md`: prompt-injected tool input, a malicious chat or email body read back to the agent, over-broad permission grants. Each threat maps to the scenarios that cover it.
- **Settings:** per-capability write enablement, and allowlists for accounts, calendars and chats.
- **Distribution** as settled in Decision 3.
- **Install docs** for Claude Code and Claude Desktop, including the macOS permission prompts that show up and what each one is for.
- **Publishing** under the chosen name (Decision 1). The upstream README and the forks that were credited get a note pointing at the new project.

## Open decisions

1. **Where it lives.** _Settled 2026-09-17: a new public repo, `that-mathevs/apple-native-mcp` (npm name `apple-native-mcp` was free)._ Option A is a GitHub fork of `supermemoryai/apple-mcp`: it keeps the visible lineage, but a fork is easy to overlook. Option B is a new repo whose README credits upstream: its own issue tracker and a clean identity. **Recommend B.** The npm name `apple-mcp` is taken, so a new name is needed either way.
2. **Tool surface.** Option A mirrors upstream's single tools with an `operation` argument, so existing configs keep working. Option B has one tool per operation with names from the glossary (fpjnijweide already split into 32 tools). **Recommend B.** Clearer tools and precise annotations matter more than compatibility with an archived package that's already broken.
3. **Distributing the Swift helper.** _Settled 2026-09-17 in [#8](https://github.com/that-mathevs/apple-native-mcp/issues/8): a signed, notarised universal binary at a fixed per-user path, not built from source. See ADR-0003. Every privacy-protected access, including `chat.db` and scripts, also moves behind the helper (ADR-0002), which supersedes the Node-side `messages-store` and `automation` adapters below._ Option A builds it from source at install time, which needs the Xcode command line tools. Option B ships a signed, notarised universal binary. **Recommend A for v1** and move to B once there are users. Before choosing, check how macOS attributes EventKit and Contacts permission prompts to the helper vs the host app (terminal or Claude).
4. **Minimum macOS.** **Recommend macOS 14+**, which is where EventKit's full-access API arrived. Older versions drop out rather than getting a second code path.
5. **Scope of v1.** The six contexts above. Confirm that dropping Maps and web search is acceptable.

## Appendix A: forks with their own commits (snapshot 2026-09-17)

Commits are counted on each fork's `main` beyond `upstream/main`.

| Remote | Commits | Last commit | What stood out |
|---|---|---|---|
| `fork-morquis` | 121 | 2026-05-08 | Most work: restructure (`core/`), unit tests, notes scoped by account/folder, music. README never updated. |
| `fork-faces-sh` | 45 | 2026-09-03 | Kept running inside Faces' product. JXA via `@jxa/run`, escaping, wrong-number check, checks the store after send. Five apps. Mail search query syntax. |
| `fork-ANierbeck` | 26 | 2026-04-19 | "apple-mcp-secure": EventKit calendar, "MailKit" mail (verify), whitelist access control, input validation. Also branch `fix/applescript-input`. |
| `fork-sicdigital` | 25 | 2026-07-21 | Repo `apple-rest-mcp`: REST front end with OpenAPI spec, ISO 8601 timestamps. |
| `fork-chrischall` | 23 | 2026-04-21 | Automated build and release pipelines publishing to ClawHub. Injection lines still unescaped. |
| `fork-mjmcg` | 18 | 2026-05-10 | Reminders: lists and counts. |
| `fork-brightline` | 18 | 2026-02-09 | Mail: queries each account in turn, throttled. |
| `fork-therealap` | 16 | 2026-09-06 | Calendar appointments. |
| `fork-fpjnijweide` | 8 | 2026-02-23 | Split into 32 per-operation tools. |
| `fork-Bendix-ai` | 7 | 2026-01-30 | Swift CLI helper, with a fallback path. |
| `fork-danielk-am` | 5 | 2026-05-11 | Notes + reminders rewritten for modern macOS. Shortcuts, Safari. |
| `fork-boutquin` | 5 | 2026-01-27 | Calendar time and reminder visibility fixes. |
| `fork-KassebaumEngineering` | 4 | 2026-08-13 | Notes update that refuses lossy rewrites. |
| `fork-gene-jelly` | 4 | 2026-04-12 | Mail + reminders: loops over accounts, faster "whose" filters. |
| `fork-felkru` | 4 | 2026-05-26 | Mail: lists real accounts and mailboxes, launches Mail.app automatically. |
| `fork-nivra` | 3 | 2026-01-25 | Mail runs osascript directly. |
| `fork-neektza` | 3 | 2026-02-19 | Notes edit operation. |
| `fork-arr2036` | 3 | 2026-05-04 | Calendar entirely on an EventKit Swift binary. |

## Appendix B: upstream issues by context (mapped by title only)

- **Messages:** #62 can't read messages, #48 sends to "ghost" contacts, #24 sending fails, #3 iMessage resource routes.
- **Contacts:** #75 phones only, no emails. #65 permission never requested. #58 no contacts. #47 details missing. #35.
- **Calendar:** #74 no entries found, #70, #25 missing events, #6.
- **Reminders:** #64 no time on creation, #34 wrong time parsing, #53 listing times out, #26 and #10 fetch crashes, #59, #27 edits create new items, #70.
- **Notes:** #67 content search broken, #44/#43 "Application isn't running" / "whose is not a function", #27, #22.
- **Mail:** #69 and #58 no mail found, #30 and #19 search/retrieval fails, #51 management request.
- **Cross-cutting:** #66 false success. #8 array vs object input. #15 error display. #71 permission manifest.
- **Setup/clients (feed install docs):** #72, #55, #50, #36, #33, #29, #17, #14, #5, #2.
- **Out of scope:** #45 Maps, #38 Photos, #31, #42.
