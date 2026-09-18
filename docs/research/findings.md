# Phase 1 findings

The Phase 1 research merged into one backlog: every report under `docs/research/` (19 fork
reports, `forks/long-tail.md` and `upstream.md`) read, deduplicated and grouped by context. It
answers ticket #3 on the map (#1) and feeds the v1 spec. It describes code and structure only:
no personal data is copied from the reports, and every example is invented.

## How to read this

- **Groups.** Calendar, Reminders, Contacts, Messages, Notes and Mail, then Cross-cutting (MCP
  surface, results and failures, permissions, security, settings, the automation runner, the native
  helper, testing, distribution) and Out of scope. Each group has a **scenario backlog**,
  **conflicts**, **verification tasks** and **credits**. After the groups come one **Rejected** list,
  the **Glossary candidates** for #11, the **Noise** commits and the **coverage check**.
- **Scenarios** are written in the `bdd` grammar under their subject (the `describe`):
  `- [ ] **ID** [layer] <it-sentence> · <NN tags> · <sources>`.
  - Layers: `acceptance` (at the MCP boundary, fake ports), `domain` (pure rules), `contract` (one
    port, run against the fake and the real adapter).
  - `NN1`–`NN7` mark scenarios that a Non-negotiable in `plan.md` requires. `—` means none.
  - Sources: `<fork> \`<sha>\``, `long-tail/<owner> \`<sha>\``, `upstream #n` (issue) or
    `upstream PR #n`.
  - `(after X-Vn)` means the scenario rests on an unverified claim; `(after X-Cn)` means it depends
    on how a conflict is decided, and scenarios tied to one conflict may contradict each other until
    then.
  - The checkbox is ticked when the slice is built (plan.md Phase 3).
- **Conflicts** (`X-Cn`) list each option with its sources, a recommendation, and whether a human has
  to decide. "Owned by #n" points at the open ticket that already carries the question. A conflict a
  closed ticket has answered carries **Settled by #n** with the answer, in place of the
  "Needs a human decision" line.
- **A scenario a closed decision overtook** keeps its id and is marked in place, never deleted:
  - **rejected by #n** and no checkbox means the decision chose against it, with the reason.
  - _No tool in v1 (#18)_ under a subject means the whole operation is outside v1, so it has no tool
    at all — not in `tools/list`, not in any description — and its scenarios wait for whenever it is
    pulled in. They still count as backlog.
  - An operation a decision put outside v1 altogether moves to **Out of scope**, with its id.
- **Verification tasks** (`X-Vn`) state a claim, where it comes from, and what would prove or
  disprove it on a real Mac. Tags: *(permission prompts)* for what #4 left open; *(evidence only)*
  for claims that only explain a fork's or upstream's failure, so nothing is built on them; *(only
  if in scope)* for claims about features outside v1. Notes and Mail mechanism questions are listed
  under their tickets, #6 and #7, not repeated as tasks. "Same claim as" marks a duplicate kept once.
- **Settled decisions respected here:** one tool per operation (#13, ADR-0001), macOS 14 or later
  (#14), v1 is the six contexts over stdio only (map #1), permission-prompt attribution (#4) and the
  elicitation facts (#5). Since the merge, also: the signed helper at a fixed path (#8, ADR-0002,
  ADR-0003), elicitation for every send (#9, ADR-0004), the known-recipient rule (#16, ADR-0005),
  how a recipient is named (#17), v1's six writes (#18), where settings live (#19), the four
  defaults (#20), the typedstream decoder (#21), records not prose (#22, ADR-0006), and one search
  grammar (#24).

## Summary

| Group | Scenarios | Required by an NN | Conflicts | Need a human | Verification tasks |
|---|---|---|---|---|---|
| Calendar | 92 | 19 | 11 | 1 | 14 (2 evidence only, 3 permission prompts) |
| Reminders | 66 | 22 | 11 | 0 | 18 (7 evidence only, 3 permission prompts) |
| Contacts | 55 | 28 | 8 | 0 | 11 (2 evidence only, 2 permission prompts) |
| Messages | 99 | 52 | 13 | 0 | 13 (2 permission prompts, 1 of them a duplicate) |
| Notes | 65 | 19 | 12 | 4 | 1 duplicate of X-V5, plus 16 claims for #6 |
| Mail | 107 | 36 | 16 | 3 | 10 (3 duplicates, 3 only if in scope), plus 16 claims for #7 |
| Cross-cutting | 92 | 54 | 20 | 0 | 12 (2 duplicates, 1 evidence only, 2 permission prompts) |
| **Total** | **576** | **230** | **91** | **8** | **79** |

Out of scope parks 17 more scenarios, 6 of them moved out of the backlog by #18 and #19. Six
scenarios are **rejected in place** by a closed decision and don't count above: CAL-42 (#20),
CON-37 (#17), MSG-45 (#17), MSG-60 (#17), MSG-83 (#24) and MAIL-38 (#24). Rejected lists 137 report
entries.

The threat-to-scenario mapping in [`docs/security-coverage.md`](../security-coverage.md) reads this
backlog and is where the 34 scenarios added for #26 came from.

## Open decisions

Eight conflicts still need a human. Every one of them waits on a mechanism ticket that is still
open, and each names its ticket in the group above.

- **#6 — how Notes is reached:** NOT-C1 (scripting or the note store), NOT-C5 (how a note's body is
  changed, which needs the real note document), NOT-C11 (whether Notes has to be started first).
- **#7 — how Mail is reached:** MAIL-C1 (scripting or the Envelope Index), MAIL-C7 (which identifier
  an email reference is built on), MAIL-C9 (whether body search is feasible).
- **#10 — how calendar data is reached:** CAL-C1.
- **NOT-C6, with #11:** whether a note's title is a field of its own or the first line of its body.
  A modelling choice for the glossary that also depends on NOT-M11 (#6).

**Settled since this file was merged** (23 conflicts, each carrying its answer in the group above):
X-C2, X-C19 and CAL-C10 by [#19](https://github.com/that-mathevs/apple-native-mcp/issues/19) and
[#8](https://github.com/that-mathevs/apple-native-mcp/issues/8); X-C3, MSG-C5, CON-C2 and MAIL-C12
by [#16](https://github.com/that-mathevs/apple-native-mcp/issues/16) and
[#17](https://github.com/that-mathevs/apple-native-mcp/issues/17); X-C4, MSG-C8 and MAIL-C11 by
[#9](https://github.com/that-mathevs/apple-native-mcp/issues/9); X-C6 by
[#22](https://github.com/that-mathevs/apple-native-mcp/issues/22); X-C13 by
[#8](https://github.com/that-mathevs/apple-native-mcp/issues/8); X-C20, CON-C7 and MSG-C9 by
[#18](https://github.com/that-mathevs/apple-native-mcp/issues/18); CAL-C3, CAL-C7, REM-C4 and REM-C9
by [#20](https://github.com/that-mathevs/apple-native-mcp/issues/20); MSG-C1 by
[#21](https://github.com/that-mathevs/apple-native-mcp/issues/21); MSG-C6 by
[#17](https://github.com/that-mathevs/apple-native-mcp/issues/17); MAIL-C4 and MAIL-C10 by
[#24](https://github.com/that-mathevs/apple-native-mcp/issues/24).

## Calendar

### Scenario backlog

#### listing calendars

- [ ] **CAL-01** [acceptance] lists each calendar with its identifier, its type and the account it belongs to: calendar names repeat across accounts · — · brightline `6bc977a`, `882140f`, `bc8e4a1`; mjmcg `17cba98`, `d4ec06d`, `dcf1993`
- [ ] **CAL-02** [acceptance] says which calendars accept new events · — · chrischall `29af0a2`, `60f9977`, `8c12640`, `bf6dc37`; mjmcg `17cba98`, `d4ec06d`, `dcf1993`
- [ ] **CAL-03** [acceptance] given calendars the settings exclude, says how many were left out and never their titles or identifiers, so the user can see the setting took effect · — · ANierbeck `3005df4`; #19

#### listing events

- [ ] **CAL-04** [acceptance] given events in several calendars, reports them in start order with each one's calendar named · — · arr2036 `1027ad1`, `3a26c9a`, `9097294`; chrischall `05e1ed7`, `25d47cc`, `3bb2b01`; faces-sh `0216d96`, `82efc89`; mjmcg `4ca8065`, `7623d19`, `88e26b9`, `d4ec06d`, `e85c620`; upstream #74, #25, #70, #6
- [ ] **CAL-05** [acceptance] given more events than the limit across several calendars, reports the earliest ones whichever calendar holds them · — · arr2036 `1027ad1`, `3a26c9a`, `9097294`; faces-sh `0216d96`, `82efc89`; upstream #25, #74, #70, #6
- [ ] **CAL-06** [acceptance] given more events than the limit, says the list is truncated and more exist · NN3 · arr2036 `1027ad1`, `3a26c9a`, `9097294`; morquis `0ec1adc`, `d76f3ec`; upstream #25, #74, #70, #6
- [ ] **CAL-07** [acceptance] given a weekly recurring event, reports each occurrence inside the range (after CAL-V1) · — · boutquin `2894ab6`, `8a5d2e0`; brightline `6bc977a`, `bc8e4a1`, `be4becf`; upstream #74, #25, #66
- [ ] **CAL-08** [acceptance] given a weekly series that began before the range, reports each occurrence inside the range (after CAL-V1) · — · morquis `0ec1adc`, `d76f3ec`
- [ ] **CAL-09** [acceptance] given a cancelled occurrence of a series, leaves it out (after CAL-V1) · — · morquis `0ec1adc`, `d76f3ec`
- [ ] **CAL-10** [acceptance] given an event that began before the range and ends inside it, reports it · — · boutquin `2894ab6`, `8a5d2e0`; upstream #74, #25, #66
- [ ] **CAL-11** [acceptance] given an all-day event on the first day of the range, includes it · — · chrischall `05e1ed7`, `25d47cc`, `3bb2b01`; upstream #74, #25, #6
- [ ] **CAL-12** [acceptance] given an all-day event, reports it on its own calendar day whatever the user's time zone (after CAL-V4) · — · felkru `631d4d1`; upstream #74, #25, #6
- [ ] **CAL-13** [acceptance] given no range and an event later today, reports it: the default range starts at the start of today, not now · — · felkru `631d4d1`; upstream #74, #25, #6
- [ ] **CAL-14** [acceptance] given an event with a location, reports the location · — · felkru `631d4d1`; upstream #74, #25, #6
- [ ] **CAL-15** [acceptance] given a calendar identifier, reports only that calendar's events, even when another account has a calendar of the same name · — · brightline `6bc977a`, `882140f`, `bc8e4a1`
- [ ] **CAL-16** [acceptance] given a calendar that does not exist, refuses and lists the calendars that do · — · brightline `6bc977a`, `882140f`, `bc8e4a1`; Bendix-ai `6e5ff6c`
- [ ] **CAL-17** [acceptance] given an allowlist that matches no calendar, reports no events rather than all of them · — · ANierbeck `3005df4`
- [ ] **CAL-18** [acceptance] given one calendar cannot be read or does not answer in time, reports the other calendars' events and names the calendar left out (after CAL-V5) · NN3 · ANierbeck `3005df4`; chrischall `05e1ed7`, `25d47cc`, `3bb2b01`; mjmcg `4ca8065`, `7623d19`, `88e26b9`, `d4ec06d`, `e85c620`; long-tail/dewdad `31ac622`; upstream #74, #25, #70, #6
- [ ] **CAL-19** [acceptance] given a range bound that is not a readable date, refuses rather than choosing another range: only dates reach the store · NN1, NN3 · arr2036 `1027ad1`, `3a26c9a`, `9097294`; boutquin `2894ab6`, `8a5d2e0`; upstream #74, #25, #70, #6
- [ ] **CAL-20** [acceptance] given calendar access has never been asked for, asks macOS for full access once and reports the outcome (after CAL-V12) · — · ANierbeck `8bfaa0c`, `a414c57`, `f745119`; upstream #74
- [ ] **CAL-21** [acceptance] given calendar access was denied, fails naming Privacy & Security › Calendars rather than reporting no events · NN5, NN3 · arr2036 `9097294`; brightline `4fb39a3`; morquis `96759b3`, `d76f3ec`; fpjnijweide `42c9e11`; upstream #74, #25, #65, #71
- [ ] **CAL-22** [acceptance] given access to add events only, explains that reading needs full access · NN5 · brightline `4fb39a3`; mjmcg `bde3e31`, `804b77d`; upstream #65
- [ ] **CAL-23** [acceptance] given calendar access is restricted by policy, says the user cannot grant it themselves · NN5 · brightline `4fb39a3`; upstream #65
- [ ] **CAL-24** [acceptance] given access reported as granted but no calendars visible, names the helper as the identity that needs calendar access (after CAL-V13) · NN5 · brightline `91b6cab`; #4, ADR-0002
- [ ] **CAL-25** [acceptance] needs calendar access only, never permission to control the Calendar app · — · arr2036 `9097294`; upstream #65, #71

#### searching events

- [ ] **CAL-26** [acceptance] given text that appears only in an event's location or notes, finds the event · — · arr2036 `1027ad1`, `3a26c9a`, `9097294`; boutquin `2894ab6`, `8a5d2e0`; brightline `6bc977a`, `bc8e4a1`, `be4becf`; chrischall `05e1ed7`, `25d47cc`, `3bb2b01`; mjmcg `4ca8065`, `7623d19`, `88e26b9`, `d4ec06d`, `e85c620`; upstream #6, #74, #25, #66, #70
- [ ] **CAL-27** [acceptance] matches the search text against title, notes and location ignoring case · — · brightline `6bc977a`, `bc8e4a1`, `be4becf`; upstream #74, #25
- [ ] **CAL-28** [acceptance] given more matching events than the limit, reports the earliest matches rather than whatever came first · — · fpjnijweide `42c9e11`; upstream #74, #25
- [ ] **CAL-29** [acceptance] given empty search text, refuses rather than reporting zero results · NN3 · faces-sh `42c2fd7`, `ac0058a`; upstream #66, #58, #69
- [ ] **CAL-30** [acceptance] given search text containing shell or script syntax, matches it literally and runs nothing · NN1 · Bendix-ai `6e5ff6c`, `bb0c1ab`; upstream #74, #25
- [ ] **CAL-31** [acceptance] given a calendar the user excluded, never returns its events · — · ANierbeck `8bfaa0c`, `a414c57`, `f745119`
- [ ] **CAL-32** [acceptance] given calendar access was denied, fails with a permission failure rather than reporting no events · NN5, NN3 · Bendix-ai `6e5ff6c`, `bb0c1ab`; upstream #74, #25

#### reading an event

- [ ] **CAL-33** [acceptance] given an invitation written by someone else, reports its title, location and notes as that event's fields and nothing more · — · ANierbeck `d2b9bf5`

#### opening an event

- [ ] **CAL-34** [acceptance] given an identifier that matches no event, reports that no such event exists instead of opening the app · NN3 · KassebaumEngineering `1d47e74`; upstream #66, #74, #25, #6

#### checking availability

- [ ] **CAL-35** [acceptance] given a range, reports the busy periods without revealing event titles (after CAL-C11) · — · mjmcg `17cba98`, `d4ec06d`, `dcf1993`

#### finding open slots

- [ ] **CAL-36** [acceptance] given a calendar whose events could not all be read, refuses to answer rather than reporting that time as free · NN3 · chrischall `4f327fd`, `d1c60f3`

#### creating an event

_[#20](https://github.com/that-mathevs/apple-native-mcp/issues/20) settles CAL-C3: an event with no
calendar named goes to the calendar the user set in Calendar for new events, unless the settings
name one. CAL-41 ships; CAL-42 is rejected._

- [ ] **CAL-37** [acceptance] given calendar writing is not enabled, refuses: writes are off by default · NN2 · arr2036 `3a26c9a`, `9097294`; upstream #34, #74
- [ ] **CAL-38** [acceptance] given a calendar that does not exist, refuses and lists the calendars events can be created in: an event never lands somewhere unexpected · — · arr2036 `3a26c9a`, `9097294`; KassebaumEngineering `1d47e74`; chrischall `3bb2b01`; faces-sh `34dced4`, `82efc89`; morquis `d76f3ec`; therealap `d50bfae`; upstream #70, #34, #74, #25, #6, #66
- [ ] **CAL-39** [acceptance] given a calendar that does not accept new events, refuses and names the calendars that do rather than writing somewhere else · — · faces-sh `34dced4`, `82efc89`; mjmcg `17cba98`, `d4ec06d`, `dcf1993`; therealap `d50bfae`
- [ ] **CAL-40** [acceptance] given no calendar and a default calendar named in the settings, files the event in that calendar · — · chrischall `3bb2b01`; #20
- [ ] **CAL-41** [acceptance] given no calendar and no default in the settings, files the event in the user's default calendar for new events and says so · — · therealap `d50bfae`; #20
- **CAL-42** [acceptance] given no calendar and no default configured, refuses and lists the calendars events can be created in · **rejected by #20**: every "add lunch tomorrow" would cost two calls, and the user already answered this in Calendar's own settings (CAL-41) · chrischall `3bb2b01`
- [ ] **CAL-43** [acceptance] given a start of 17:30 local time, stores and reports an event starting at 17:30 local time · — · boutquin `8a5d2e0`; upstream #34, #64
- [ ] **CAL-44** [acceptance] given a start and an end with offsets, creates the event at those instants and reports them · — · mjmcg `17cba98`, `d4ec06d`, `dcf1993`; upstream #70
- [ ] **CAL-45** [acceptance] given a title, location and notes containing quotes, backslashes, line breaks and script text, stores each exactly as given and runs nothing · NN1 · ANierbeck `3005df4`; brightline `859a9c8`; chrischall `18660e4`, `1a358d6`, `29af0a2`, `2e06954`, `60f9977`, `6831a90`, `88b58d0`, `91e0101`, `bf6dc37`, `fa61e37`; fpjnijweide `42c9e11`; therealap `d50bfae`; upstream #74, #25
- [ ] **CAL-46** [acceptance] reports the event as created only once the calendar holds it · NN3 · therealap `1a09e54`, `d50bfae`
- [ ] **CAL-47** [acceptance] reports the calendar it filed the event in and the start and end the store saved, so a misread time is visible at once · NN3 · arr2036 `3a26c9a`, `9097294`; therealap `d50bfae`; long-tail/amandeepjutla `027ba85`, `28c91b7`; upstream #34, #74, #25
- [ ] **CAL-48** [acceptance] reports the new event's identifier so it can be opened or changed later · — · chrischall `29af0a2`, `60f9977`, `8c12640`, `bf6dc37`
- [ ] **CAL-49** [acceptance] given an event with the same title already overlapping the requested time, refuses and names it so it can be changed instead · — · faces-sh `bcdc856`; upstream #27
- [ ] **CAL-50** [acceptance] given the caller says a second copy is wanted, creates the event despite an overlapping one with the same title · — · faces-sh `bcdc856`; upstream #27

#### updating an event

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18)): an operation
outside v1 has no tool at all, so it is absent from `tools/list` and from every tool description,
and an agent can't propose it. CAL-51 to CAL-60 are kept for whenever it is pulled in._

- [ ] **CAL-51** [acceptance] given a new start later than the old end, moves the whole event · — · chrischall `05e1ed7`, `29af0a2`, `60f9977`, `c9727ec`
- [ ] **CAL-52** [acceptance] given only a new title, leaves its times, location and notes as they were · — · chrischall `05e1ed7`, `29af0a2`, `60f9977`, `c9727ec`
- [ ] **CAL-53** [acceptance] given a new start that cannot be read, refuses and changes nothing · NN3 · arr2036 `9097294`
- [ ] **CAL-54** [acceptance] given an event years away, still finds it by its identifier · — · arr2036 `9097294`
- [ ] **CAL-55** [acceptance] reports the event as it reads back from the calendar after the change · NN3 · chrischall `05e1ed7`, `29af0a2`, `60f9977`, `c9727ec`
- [ ] **CAL-56** [acceptance] given a recurring event and no span, refuses: it must say whether one occurrence or the series changes (after CAL-C5) · — · chrischall `05e1ed7`, `29af0a2`, `60f9977`, `c9727ec`
- [ ] **CAL-57** [acceptance] given a weekly series and a span of one occurrence, changes only the occurrence asked for (after CAL-V3) · — · arr2036 `9097294`; mjmcg `17cba98`, `d4ec06d`, `dcf1993`
- [ ] **CAL-58** [acceptance] given another calendar, moves the event there keeping its attendees, alarms and recurrence (after CAL-V6) · — · chrischall `c9727ec`
- [ ] **CAL-59** [acceptance] given a title that two events in the range share, refuses and lists both with their identifiers (after CAL-C6) · — · faces-sh `4587d0a`, `7160b0a`, `bfd5b64`; upstream #64, #34, #53, #27

#### deleting an event

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18))._

- [ ] **CAL-60** [acceptance] given a recurring event and no span, refuses: it cannot tell one occurrence from the whole series (after CAL-C5) · — · arr2036 `9097294`; chrischall `29af0a2`, `60f9977`, `8c12640`, `bf6dc37`

#### an event range

- [ ] **CAL-61** [domain] given no start, begins at the start of today in the user's time zone · — · chrischall `05e1ed7`, `25d47cc`, `3bb2b01`; upstream #74, #25, #6
- [ ] **CAL-62** [domain] given no range just after local midnight or late in the evening west of UTC, starts on the user's local day, not the UTC one · — · boutquin `8a5d2e0`; mjmcg `4ca8065`, `7623d19`, `88e26b9`, `d4ec06d`, `e85c620`; upstream #34, #64, #74, #25, #70
- [ ] **CAL-63** [domain] given no dates, covers a default range of seven days, from the start of today through the end of the seventh day, in the user's time zone · — · ANierbeck `3005df4`; #20
- [ ] **CAL-64** [domain] given a start day and an end day without times, spans both whole days in the user's time zone, so events starting on the end day are included · — · brightline `6bc977a`, `bc8e4a1`, `be4becf`; boutquin `8a5d2e0`; arr2036 `1027ad1`, `3a26c9a`, `9097294`; upstream #74, #25, #70, #6, #34, #64
- [ ] **CAL-65** [domain] given bounds with a time and an offset, keeps them to the second rather than widening to whole days · — · boutquin `8a5d2e0`; upstream #34, #64
- [ ] **CAL-66** [domain] given an event that starts before the range and ends inside it, counts it as in range · — · chrischall `05e1ed7`, `25d47cc`, `3bb2b01`; morquis `0ec1adc`, `d76f3ec`; upstream #25, #74, #6

#### an event time

- [ ] **CAL-67** [domain] given a date-time without an offset, interprets it in the user's time zone and says so · — · morquis `d76f3ec`
- [ ] **CAL-68** [domain] renders as an ISO 8601 date-time with its offset, so an agent can compare times (after CAL-C8) · — · Bendix-ai `6e5ff6c`, `bb0c1ab`; upstream #74, #25
- [ ] **CAL-69** [domain] given today is the 31st and a date in a shorter month, keeps the day and month asked for · — · boutquin `8a5d2e0`; upstream #34, #64

#### an all-day event

- [ ] **CAL-70** [domain] given a day, occupies that day in the user's time zone (after CAL-V4) · — · arr2036 `3a26c9a`, `9097294`; upstream #34, #74
- [ ] **CAL-71** [domain] given a start and an end on the same day, spans that whole day · — · therealap `1a09e54`, `d50bfae`

#### an occurrence

- [ ] **CAL-72** [domain] is identified by its series and its original start, since every occurrence of a series shares one event identifier (after CAL-V2) · — · arr2036 `9097294`

#### calendar scoping

- [ ] **CAL-73** [domain] given a calendar identifier that is both allowed and blocked, treats it as blocked: the settings name calendars by identifier, never by title · — · ANierbeck `3005df4`; #19
- [ ] **CAL-74** [domain] given a calendar the user has hidden in Calendar, still reports it unless the settings exclude it: a hidden calendar is not an excluded one, and CAL-V7 is unverified · — · fpjnijweide `42c9e11`; #19

#### open slots in a range

- [ ] **CAL-75** [domain] given busy periods that overlap, treats them as one busy period · — · chrischall `4f327fd`, `d1c60f3`
- [ ] **CAL-76** [domain] given a gap shorter than the duration asked for, does not offer it · — · chrischall `4f327fd`, `d1c60f3`
- [ ] **CAL-77** [domain] given a meeting that began before the range, treats the start of the range as busy until it ends · — · chrischall `4f327fd`, `d1c60f3`
- [ ] **CAL-78** [domain] given an event marked as free, does not count it as busy (after CAL-V8) · — · chrischall `4f327fd`, `d1c60f3`
- [ ] **CAL-79** [domain] given an invitation the user declined, does not count it as busy (after CAL-V8) · — · chrischall `4f327fd`, `d1c60f3`

#### the event store

- [ ] **CAL-80** [contract] given events in a range, returns every occurrence in start order · — · fpjnijweide `42c9e11`; upstream #74, #25
- [ ] **CAL-81** [contract] given more events in the range than the limit, returns the earliest by start · — · Bendix-ai `6e5ff6c`, `bb0c1ab`; upstream #74, #25
- [ ] **CAL-82** [contract] given a recurring event, returns one occurrence per repeat inside the range, not only the first (after CAL-V1) · — · KassebaumEngineering `1d47e74`; chrischall `05e1ed7`, `25d47cc`, `3bb2b01`; danielk-am `ad3e9e9`; mjmcg `4ca8065`, `7623d19`, `88e26b9`, `d4ec06d`, `e85c620`; upstream #25, #74, #6, #66, #70
- [ ] **CAL-83** [contract] given a recurring event, gives each occurrence its own start and an identity that tells occurrences apart (after CAL-V2) · — · ANierbeck `8bfaa0c`, `a414c57`, `f745119`
- [ ] **CAL-84** [contract] given a meeting that began before the range and ends inside it, includes that meeting · — · Bendix-ai `3366690`, `6e5ff6c`, `9599219`, `d8c994a`, `fff9dd8`
- [ ] **CAL-85** [contract] given events on a CalDAV or Exchange calendar in the range, returns them alongside local ones · — · brightline `6bc977a`, `bc8e4a1`, `be4becf`; upstream #74, #25
- [ ] **CAL-86** [contract] given range bounds that carry milliseconds, queries exactly that range rather than a default one · — · ANierbeck `8bfaa0c`, `a414c57`, `f745119`
- [ ] **CAL-87** [contract] given a start time, stores exactly that instant whatever the Mac's region format · — · therealap `1a09e54`, `d50bfae`; arr2036 `3a26c9a`, `9097294`; Bendix-ai `3366690`, `ff8af9c`; upstream #34, #74
- [ ] **CAL-88** [contract] given an event saved at an instant, returns it at the same instant with an explicit offset · — · boutquin `8a5d2e0`; upstream #34, #64
- [ ] **CAL-89** [contract] given an event title containing field separators, returns the title unchanged · — · chrischall `0860cf8`, `18660e4`, `6831a90`, `91e0101`, `bf6dc37`
- [ ] **CAL-90** [contract] given an identifier that matches no event, answers not found within the time budget · — · chrischall `05e1ed7`, `0860cf8`, `0bd664e`, `18660e4`, `1a45550`, `29af0a2`, `68dc2b7`, `b6a4ec6`, `bf6dc37`, `c1bf44b`, `c9f9c48`, `d1c60f3`, `f1f2bb1`
- [ ] **CAL-91** [contract] given access has never been asked for, asks for full access once (after CAL-V12) · — · arr2036 `9097294`; upstream #65, #71
- [ ] **CAL-92** [contract] given calendar access is denied, fails with a named permission failure · NN5 · KassebaumEngineering `1d47e74`; upstream #74, #25, #6, #66
- [ ] **CAL-93** [contract] given an event moved to another calendar, keeps the same identifier (after CAL-V6) · — · chrischall `c9727ec`

### Conflicts

#### CAL-C1 How calendar data is reached

- **Options:**
  - EventKit behind a Swift helper. Every fork that did this used a short-lived process per call:
    ANierbeck `8bfaa0c`, `a414c57`, `f745119`; arr2036 `9097294`; Bendix-ai `6e5ff6c`, `bb0c1ab`;
    brightline `6bc977a` (source compiled on every call); fpjnijweide `42c9e11` (`.app` bundle);
    faces-sh `7160b0a`, `bfd5b64`, `4587d0a`. plan.md wants a long-lived, versioned JSON-lines helper.
  - EventKit through JXA's Objective-C bridge in `osascript`: KassebaumEngineering `1d47e74`.
  - An external EventKit CLI addressed by calendar name: mjmcg `d4ec06d`, `88e26b9`, `e85c620`,
    `4ca8065`, `7623d19`, `17cba98`, `dcf1993`.
  - A separate host app that holds the grant and answers over loopback HTTP: faces-sh `dbffae5`,
    `82efc89`.
  - Reading `Calendar.sqlitedb`'s occurrence cache: felkru `631d4d1`.
  - Scripting Calendar.app (AppleScript or JXA `whose`), with occurrences expanded by hand in
    morquis: morquis `d76f3ec`; chrischall `25d47cc`; boutquin `2894ab6`, `8a5d2e0`; danielk-am
    `ad3e9e9`; long-tail/dewdad `31ac622`; long-tail/amandeepjutla `28c91b7`; therealap `d50bfae`.
- **Recommendation:** Use EventKit through the long-lived helper. Scripting misses CalDAV and
  Exchange events (brightline `6bc977a`). It returns a series once instead of each occurrence
  (morquis `d76f3ec` had to expand repeats by hand and still missed BYDAY and EXDATE). And it is
  about 100 times slower (faces-sh measured 4.59 s → 0.04 s). The SQLite cache is a private store
  whose all-day times float. The JXA bridge is the only close alternative, and CAL-V9 and CAL-V14
  decide it.
- **Needs a human decision:** Yes — owned by #10 (the helper's distribution is #8).

#### CAL-C2 What happens when the EventKit route is unavailable or denied

- **Options:**
  - Fall back silently to scripting Calendar.app: ANierbeck `8bfaa0c`, `a414c57`, `f745119`;
    Bendix-ai `3366690`, `9599219`, `d8c994a`, `6e5ff6c`, `fff9dd8`.
  - Relaunch the helper as its own app through LaunchServices when access is denied: fpjnijweide
    `42c9e11`.
  - No fallback, and fail with a named failure: faces-sh `7160b0a` → `4587d0a` (removed its JXA
    fallback), `82efc89`.
- **Recommendation:** No fallback. The Bendix-ai fallback drops location and notes, searches
  titles only, misses events that overlap the range, and runs under a different permission. That
  is a different answer presented as the same one (NN3). The helper's own named failure
  (X-70) covers the missing-helper case. Whether a helper should take its own
  responsibility for the prompt is Decision 3.
- **Needs a human decision:** No — NN3 settles the fallback. The relaunch question is owned by #8.

#### CAL-C3 Which calendar a new event goes to when none is named

- **Options:**
  - The first calendar, or the first writable one: upstream `utils/calendar.ts:274-280`; morquis
    `d76f3ec`; chrischall `29af0a2`, `60f9977` (`task/enhance`).
  - EventKit's default calendar for new events: KassebaumEngineering `1d47e74`; arr2036 `9097294`
    (also used silently for unknown names). The therealap `d50bfae` and morquis verdicts point here.
  - A default configured on the server, otherwise refuse and list the calendars: chrischall
    `3bb2b01`.
- **Recommendation:** Never use "first calendar", which may be read-only or a subscription. Use
  the calendar the user chose as the default for new events in Calendar's settings. A settings
  default overrides it. Always report the calendar used (CAL-47). An unknown calendar name always
  refuses (CAL-38).
- **Settled by [#20](https://github.com/that-mathevs/apple-native-mcp/issues/20):** an event with
  no calendar named goes to the calendar the user set in Calendar for new events (CAL-41), and a
  calendar named in the settings overrides it (CAL-40). Refusing and listing the calendars every
  time is rejected (CAL-42). A calendar the settings exclude is not writable either
  ([#19](https://github.com/that-mathevs/apple-native-mcp/issues/19)).

#### CAL-C4 How a tool names a calendar

- **Options:**
  - By title: ANierbeck `3005df4`; Bendix-ai `6e5ff6c`; brightline `bc8e4a1`, `882140f`,
    `6bc977a`; chrischall `25d47cc`, `3bb2b01`; mjmcg `d4ec06d`, `17cba98`, `dcf1993`; therealap
    `d50bfae`; arr2036 `9097294`; faces-sh `34dced4`.
  - By title, although the fork holds the identifier (it maps hidden-calendar UUIDs back to names):
    fpjnijweide `42c9e11`.
  - By the identifier listed from the store: the brightline C10 and Bendix-ai C4 verdicts. mjmcg
    `dcf1993` already returns `id` next to `name`.
- **Recommendation:** Address a calendar by its identifier from `list_calendars`, which also
  returns account and type (CAL-01). Seven forks hit same-name calendars across accounts, where
  the first match silently wins. If titles are accepted at all, accept one only when it matches
  exactly one calendar, and otherwise refuse and list the candidates with their accounts.
- **Needs a human decision:** No — every report that looked at it records the same ambiguity
  defect.

#### CAL-C5 What a change to a recurring event applies to when no span is given

- **Options:**
  - This occurrence and every later one (`.futureEvents`), for update and delete: faces-sh
    `4587d0a`, `7160b0a`, `bfd5b64`.
  - One occurrence (`.thisEvent`), but the one found is the earliest in a four-year window rather
    than the one asked for: arr2036 `9097294`.
  - The whole series, because the Calendar.app uid addresses the master: chrischall `05e1ed7`,
    `c9727ec`, `bf6dc37`.
  - This occurrence unless the caller asks for the series: the mjmcg C11 scenario (`17cba98`,
    `dcf1993`).
  - Refuse until the caller names the span: the arr2036 C3, chrischall C5 and chrischall C19
    verdicts.
- **Recommendation:** Refuse without an explicit span (CAL-56, CAL-60), and address an occurrence
  by series plus original start (CAL-72). Every default the forks shipped either destroyed the
  rest of a series without warning or edited the wrong occurrence. A refusal costs the agent one
  retry.
- **Needs a human decision:** No — the observed data loss settles it, and refusal is the only
  choice that can't act on a guess.

#### CAL-C6 How the event to change is found

- **Options:**
  - By identifier only: arr2036 `9097294`; chrischall `05e1ed7`, `bf6dc37`; mjmcg `17cba98`,
    `dcf1993`; KassebaumEngineering `1d47e74`.
  - By identifier, or by title within a window, refusing when two events share it: faces-sh
    `4587d0a`, `7160b0a`, `bfd5b64`.
- **Recommendation:** Identifier only (series identifier plus occurrence start). `search_events`
  already turns a title into identifiers. A second lookup path is the shape in which the same
  fork's reminder writes hit the wrong item by "first contains". Keep CAL-59 only if titles are
  admitted.
- **Needs a human decision:** No — search plus identifier covers the need with one path.

#### CAL-C7 The range used when none is given

- **Options:**
  - From now to +7 days, with no start-of-day: upstream (`index.ts` "today to next 7 days");
    arr2036 `9097294` (search from −1 year to +3 years); felkru `631d4d1` (search −30 to +90 days);
    chrischall `25d47cc` (from now).
  - From the start of today to +7 days for listing and +30 days for search: brightline `6bc977a`.
  - From the start of today to the end of the 28th day after: ANierbeck `3005df4`.
  - A 30-day window for search on UTC dates: mjmcg `4ca8065`, `7623d19`.
- **Recommendation:** Start at the start of today in the user's time zone (CAL-13, CAL-61,
  CAL-62). Starting at "now" drops today's earlier events, and UTC dates pick the wrong day
  (felkru, boutquin, mjmcg). For the length, use 7 days for listing (upstream's documented
  promise, shared by three forks) and the same for search unless the caller widens it.
- **Settled by [#20](https://github.com/that-mathevs/apple-native-mcp/issues/20):** the default
  range is seven days, from the start of today in the user's time zone, for listing and for search
  alike, and every result states the range it used (CAL-63).

#### CAL-C8 How event times are written in results

- **Options:**
  - ISO 8601 in UTC (`Z`): KassebaumEngineering `1d47e74`; brightline `6bc977a`.
  - ISO 8601 in the user's local time with its offset: faces-sh `bfd5b64` ("an agent reading UTC
    parrots UTC at the user").
  - Local wall time with no offset, or locale-formatted text: Bendix-ai `bb0c1ab`; boutquin
    `8a5d2e0`; fpjnijweide `42c9e11`; ANierbeck `3005df4`.
- **Recommendation:** Use ISO 8601 in the user's local time with an explicit offset (CAL-68,
  CAL-88). It is as machine-comparable as UTC, and it stops the agent repeating UTC times to the
  user. Text without an offset loses the instant.
- **Needs a human decision:** No — the faces-sh observation and the instant-preserving
  requirement decide it.

#### CAL-C9 How a slow or unreadable calendar is handled

- **Options:**
  - One query per calendar, in parallel, with a time budget, dropping the ones that fail without
    a word: ANierbeck `3005df4`; chrischall `25d47cc`; mjmcg `4ca8065`, `7623d19`, `88e26b9`;
    long-tail/dewdad `31ac622`.
  - Skip calendars that are too big, or cap each calendar without saying so: chrischall `d1c60f3`,
    `4f327fd`; morquis `d76f3ec`.
  - Fail the whole call only when every calendar fails: faces-sh `42c2fd7`.
  - One EventKit query over all calendars: arr2036 `9097294`; Bendix-ai `6e5ff6c`; brightline
    `6bc977a`.
- **Recommendation:** One EventKit query over all calendars. Add a per-calendar budget only if
  CAL-V5 shows that an unreachable calendar stalls the query. A partial listing always names the
  calendar left out (CAL-18). Availability and open slots refuse rather than answer from partial
  data (CAL-36).
- **Needs a human decision:** No — NN3 settles "never silent", and CAL-V5 settles whether the
  split is needed.

#### CAL-C10 Which calendars the agent sees by default

- **Options:**
  - Allowlist and blocklist in environment variables, by display name, with blocked winning:
    ANierbeck `3005df4`.
  - Calendars the user unticked in Calendar.app, read from `com.apple.iCal DisabledCalendars`:
    fpjnijweide `42c9e11`.
  - A hard-coded skip list of holiday and system calendar titles in one language: Bendix-ai
    `6e5ff6c`.
  - Every calendar: most other forks.
- **Recommendation:** Settings allow and block calendars by identifier, and blocked wins
  (CAL-73). Never use a skip list of titles. A listing says how many calendars the settings
  excluded and never names them (CAL-03).
- **Settled by [#19](https://github.com/that-mathevs/apple-native-mcp/issues/19):** calendars are
  allowed and blocked by identifier, never by display name, and a block-list wins over an
  allow-list (CAL-73). Calendar.app's own hidden calendars are not read in v1 — `DisabledCalendars`
  is undocumented and CAL-V7 is unverified — so a hidden calendar stays visible unless the settings
  exclude it (CAL-74). Excluded items are counted in a result, never named (CAL-03, X-81).

#### CAL-C11 What an availability answer reveals

- **Options:**
  - Busy periods with start, end and calendar, and no event details: mjmcg `17cba98`, `dcf1993`.
  - Busy blocks carrying each event's title, start, end and calendar, turned into open slots:
    chrischall `d1c60f3`, `4f327fd`.
- **Recommendation:** Busy periods without titles, with open slots computed from them. Slot
  finding needs no titles, and `list_events` exists when details are wanted. This keeps
  attacker-written invitation titles out of an answer that doesn't need them (map fog "Threats to
  scenarios").
- **Needs a human decision:** No — the slot rules (CAL-75 to CAL-79) need only times and
  availability.

### Verification tasks

- **CAL-V1** An EventKit range query returns one event per occurrence of a recurring series in
  the range. That includes occurrences of a series whose first occurrence is before the range. It
  leaves out occurrences deleted from the series, and shows a moved occurrence at its new time.
  *From:* boutquin `2894ab6`, `8a5d2e0`; morquis `d76f3ec`; chrischall `25d47cc`;
  KassebaumEngineering `1d47e74`; danielk-am `ad3e9e9`; upstream #25. *Proves it:* In a scratch
  calendar, create a weekly series starting 8 weeks ago, delete one upcoming occurrence and move
  another. A Swift script calling `events(matching: predicateForEvents(withStart:end:calendars:))`
  over the next 4 weeks prints one entry per remaining week: none for the deleted week, and the
  moved one at its new start. *Disproves it:* The series appears once or not at all, or the
  deleted occurrence is listed.
- **CAL-V2** Every occurrence of a series shares one `eventIdentifier`, which is the same across
  separate `EKEventStore` instances and process launches. `occurrenceDate` keeps an occurrence's
  original start even after that occurrence is moved. *From:* arr2036 `9097294`; ANierbeck
  `8bfaa0c`, `a414c57`, `f745119`; KassebaumEngineering `1d47e74`; mjmcg `17cba98`, `dcf1993`.
  *Proves it:* In two separate runs of a Swift script over the CAL-V1 series, every occurrence
  prints the same identifier. The moved occurrence's `occurrenceDate` is its original weekly slot
  while `startDate` is the new time. *Disproves it:* Identifiers differ between occurrences or
  between runs, or `occurrenceDate` follows the move.
- **CAL-V3** Saving a change to one occurrence with span `.thisEvent` changes only that
  occurrence. `.futureEvents` changes it and the later ones and leaves the earlier ones alone.
  `remove(_:span: .thisEvent)` removes only that occurrence. *From:* arr2036 `9097294`; chrischall
  `05e1ed7`, `c9727ec`, `bf6dc37`; faces-sh `4587d0a`. *Proves it:* On a fresh weekly series, move
  the third occurrence with `.thisEvent`. Calendar.app shows only that week changed. Repeat with
  `.futureEvents` on the fifth occurrence: weeks 5 and later change and weeks 1–4 don't. Remove
  the second with `.thisEvent`: only week 2 disappears. *Disproves it:* Any other occurrence
  changes or disappears.
- **CAL-V4** An all-day event saved for a calendar day stays on that day whatever time zone the
  process reads it in. An all-day event created from the instant `2026-05-04T00:00:00.000Z` in a
  UTC−5 zone lands on 3 May, which is the defect to avoid. *From:* arr2036 `3a26c9a`, `9097294`;
  felkru `631d4d1`; KassebaumEngineering `1d47e74`; boutquin `8a5d2e0`. *Proves it:* Set the Mac's
  zone to UTC−5 and create one all-day event from a day and one from that instant. Calendar.app
  shows 4 May and 3 May. Reading both back with `TZ=Asia/Tokyo` and `TZ=America/New_York` gives the
  same day each time. *Disproves it:* The day shifts with the reader's zone, or the instant form
  lands on 4 May.
- **CAL-V5** With a subscribed calendar whose server is unreachable, an EventKit range query over
  all calendars still returns the other calendars' events promptly. *From:* long-tail/dewdad
  `31ac622`; ANierbeck `3005df4`; chrischall `25d47cc`; mjmcg `4ca8065`, `7623d19`. *Proves it:*
  Subscribe to an `.ics` URL, turn the network off (or point the subscription at a host that
  never answers), and time a one-week query: it returns within 1 s with the other calendars'
  events. *Disproves it:* The query blocks past the time budget, so a per-calendar budget is
  needed (CAL-18 keeps "names the calendar left out").
- **CAL-V6** Setting `EKEvent.calendar` to a calendar in another account and saving keeps the
  event's identifier, attendees, alarms and recurrence. *From:* chrischall `c9727ec`. *Proves it:*
  Move a recurring event with an alarm from a local calendar to an iCloud calendar, and one from
  iCloud to a CalDAV calendar. Each save succeeds, and a re-read shows the same
  `eventIdentifier`, alarm and recurrence rule. *Disproves it:* The save throws, the identifier
  changes, or any of those properties is lost. The move is then refused across accounts or
  reports a new identifier.
- **CAL-V7** On macOS 14–26, the `com.apple.iCal` `DisabledCalendars` preference lists the
  identifiers of the calendars unticked in Calendar.app, equal to `EKCalendar.calendarIdentifier`.
  *From:* fpjnijweide `42c9e11`. *Proves it:* Untick one calendar in Calendar.app. The key (read
  with `CFPreferencesCopyAppValue`) gains exactly that calendar's `calendarIdentifier`, and loses
  it on re-ticking. *Disproves it:* The key is missing, holds other identifiers, or doesn't change.
- **CAL-V8** `EKEvent.availability` is `.free` for an event the user marked as free. For an
  invitation the user declined, the current user's attendee has `participantStatus == .declined`
  and the event still comes back from a range query. *From:* chrischall `d1c60f3`, `4f327fd`.
  *Proves it:* Create an event with "Show as: Free" and decline an invitation from a second test
  account. A range query prints `.free` for the first and `.declined` for the second.
  *Disproves it:* Either property reads as busy/unknown, which would make CAL-78 or CAL-79
  unbuildable from the store.
- **CAL-V9** (feeds #10) A JXA script using the Objective-C EventKit bridge reads one week of
  events in under 4 s, where scripting Calendar.app over the same calendars takes about 35 s.
  *From:* KassebaumEngineering `1d47e74`. *Proves it:* Time both scripts, three runs each, on a
  Mac with at least one Exchange or CalDAV calendar. *Disproves it:* The JXA bridge is not clearly
  faster, or is slower than the Swift helper's warm query, which removes it as an option in
  CAL-C1.
- **CAL-V10** (evidence only: explains upstream; nothing is built on it) Upstream's `create` fails on
  macOS 26 because of `set targetCal to null` inside `tell application "Calendar"`, the
  `date "<toLocaleString()>"` literal, or both. The literal loses its time after a comma under a US
  region, fails under a day-first region, and may be rejected for the U+202F that Node 20+ puts
  before AM/PM. *From:* therealap `d50bfae`, `1a09e54`; long-tail/amandeepjutla `28c91b7`;
  boutquin `8a5d2e0`; Bendix-ai `ff8af9c`; upstream #70, #34. *Proves it:* Compile and run
  upstream's generated create script with each cause isolated (a `missing value` swap, a
  hand-written literal, a U+202F literal) under US and day-first regions, and record which
  variants create the event. *Disproves it:* The script succeeds with the literal and `null`,
  which leaves the upstream report unexplained.
- **CAL-V11** (evidence only: explains upstream; nothing is built on it) Scripting Calendar.app with
  `every event whose start date ≥ … and start date ≤ …` returns a recurring series once, at its
  master, and returns no events from CalDAV or Exchange calendars. *From:* brightline `6bc977a`,
  `be4becf`; boutquin `2894ab6`; chrischall `25d47cc`; danielk-am `ad3e9e9`; Bendix-ai `3366690`;
  upstream #25. *Proves it:* Run that script over the CAL-V1 series and a CalDAV calendar with
  events this week: one entry for the series, zero for CalDAV. *Disproves it:* Each occurrence and
  the CalDAV events are returned.
- **CAL-V12** (permission prompts) A helper calling `requestFullAccessToEvents` gets a Calendars
  prompt rather than a silent denial only when the Info.plist of whichever app macOS holds
  responsible carries `NSCalendarsFullAccessUsageDescription`. `NSCalendarsUsageDescription` alone,
  or no Info.plist at all, is denied without a prompt on macOS 14+. #4 left the silent refusal
  unexplained. *From:* arr2036 `9097294`; fpjnijweide `42c9e11`; Bendix-ai `6e5ff6c`, `bb0c1ab`.
  *Proves it:* After `tccutil reset Calendar` between runs, launch a self-responsible helper three
  ways: with both keys, with only the old key, and with no Info.plist. Only the first shows a
  prompt. *Disproves it:* All three prompt, or all three are denied the same way.
- **CAL-V13** (permission prompts) When the server runs under a host app that hasn't been granted
  Calendars, EventKit in a child process can report an authorized status yet return no calendars.
  *From:* brightline `91b6cab`. *Proves it:* On a Mac where a terminal holds the Calendars grant,
  run the helper under a host without one. `authorizationStatus(for: .event)` prints full access
  while `calendars(for: .event)` is empty. *Disproves it:* The status reads as not determined or
  denied whenever no calendars come back, so CAL-24 collapses into CAL-21.
- **CAL-V14** (permission prompts) From `osascript` on macOS 14+, the deprecated
  `requestAccessToEntityTypeCompletion` still grants read access to events (full access, not
  write-only or denied). *From:* KassebaumEngineering `1d47e74`. *Proves it:* After
  `tccutil reset Calendar`, run the JXA prelude: a prompt appears, and after granting,
  `authorizationStatus` is full access and a range query returns events. *Disproves it:* No
  prompt, or write-only status, or empty reads, which rules the JXA route out of CAL-C1.

### Credits

- **ANierbeck:** hiding calendars from the agent with blocked winning over allowed; a partial
  listing names what was left out; a default range from the start of today; event fields as
  structure so an invitation can't pose as something else.
- **arr2036:** EventKit range queries for listing and searching; typed instants and an explicitly
  chosen calendar for create; update and delete by identifier; requesting full calendar access
  through EventKit.
- **Bendix-ai:** filtering events inside the EventKit helper; narrowing reads to chosen calendars;
  never passing dates as locale-formatted text.
- **boutquin:** never handing a formatted date to an app; date-only input and "today" settled in
  the user's time zone; overlap semantics for a range.
- **brightline:** the recorded reason for EventKit (scripting misses CalDAV and Exchange events);
  calendars listed with account and type and filtered by identifier; one named failure per
  authorization state, write-only distinct from denied; logging status and calendar count for
  diagnosis.
- **chrischall:** refusing to guess a calendar, with a configured default; an update as one atomic
  change of the fields given; the open-slot finder as a pure rule; get by identifier and a
  writable flag on calendars; injection strings kept as hostile-input fixtures; a time budget for
  not-found lookups.
- **danielk-am:** pushing the date filter into the store and reading in bulk.
- **faces-sh:** an empty search refused rather than reported as zero results; no scripted fallback
  behind EventKit; refusing an ambiguous target and listing candidates; refusing an obvious
  duplicate with an explicit override; unknown or read-only calendars refused with the real names
  listed; the earliest N across every calendar; results in local time with an offset.
- **felkru:** a listing returns occurrences, each with its own start and end, linked to one event.
- **fpjnijweide:** sorting by start before applying the limit; respecting calendars hidden in
  Calendar.app (pending CAL-V7).
- **KassebaumEngineering:** EventKit with epoch instants; refusing an unknown calendar; confirming
  an event exists before claiming to open it.
- **long-tail/dewdad:** a per-calendar time budget whose partial result names what was left out.
- **long-tail/amandeepjutla:** create reports the start and end the store saved.
- **mjmcg:** every calendar merged and ordered; get, update, delete, availability and
  calendars-with-writable as operations; busy periods without event details; values never spliced
  into a script; bounded results.
- **morquis:** occurrences not series; overlap semantics; scoping by calendar; no silent
  truncation; an unknown calendar refused; offset-less times read in the user's zone and said so.
- **therealap:** never sending dates to the app as text; an event never filed in a calendar that
  wasn't asked for; reporting which calendar was used.

## Reminders

### Scenario backlog

#### listing reminder lists

- [ ] **REM-01** [acceptance] reports every reminder list with how many reminders are open and how many are overdue · — · mjmcg `804b77d`, `fed09d1`, `78b536b`
- [x] **REM-02** [acceptance] reports each reminder list's name and id without returning its reminders · — · morquis `d76f3ec`; upstream #53, #64
- [x] **REM-03** [acceptance] given reminder lists that share a name, reports each one with its own id (after REM-V5) · — · sicdigital `791f5f2`

#### listing reminders

- [ ] **REM-04** [acceptance] given reminders in several lists, reports each with its id, list, due date, creation date and completion state · — · mjmcg `bde3e31`, `804b77d`; sicdigital `791f5f2`, `3cfb29d`; gene-jelly `c5a0edd`; upstream #53, #26, #10, #59, #70
- [x] **REM-05** [acceptance] given open and completed reminders, reports only the open ones unless completed ones are asked for, in every scope including a named list (after REM-V8) · — · boutquin `8a5d2e0`; mjmcg `804b77d`, `fed09d1`, `5ca5e55`; upstream #53, #26; #20
- [x] **REM-06** [acceptance] given reminders in several lists, names every reminder under its list, open before completed, rather than only counting them · — · faces-sh `94149a2`, `dbffae5`
- [x] **REM-07** [acceptance] given a reminder list, reports only reminders from that list · — · mjmcg `5ca5e55`
- [ ] **REM-08** [acceptance] given a reminder list and the overdue range, reports only overdue reminders from that list · — · mjmcg `5ca5e55`
- [ ] **REM-09** [acceptance] given the overdue range, reports open reminders whose due time has passed · — · mjmcg `804b77d`, `fed09d1`, `5ca5e55`
- [ ] **REM-10** [acceptance] given a due-date range, reports only reminders due inside it and leaves out reminders with no due date (after REM-V8) · — · sicdigital `3cfb29d`
- [ ] **REM-11** [acceptance] given a range bound that is not a date, refuses and says which bound · — · sicdigital `3cfb29d`
- [x] **REM-12** [acceptance] given a list name two accounts share, refuses: it names both lists by account (after REM-V5) · — · mjmcg `5ca5e55`
- [x] **REM-13** [acceptance] given a list name that looks like a command-line flag, treats it as a list name · NN1 · mjmcg `d4ec06d`, `bde3e31`
- [ ] **REM-14** [acceptance] given an iCloud list and a CalDAV list, reports reminders from both (after REM-V9) · — · felkru `12ad33f`; upstream #53, #26
- [ ] **REM-15** [acceptance] given a reminder just created, includes it · NN3 · upstream #26, PR #40
- [x] **REM-16** [acceptance] given more reminders than the limit, reports the first ones and says more exist instead of presenting them as all · NN3 · boutquin `8a5d2e0`; KassebaumEngineering `1d47e74`; sicdigital `791f5f2`, `3cfb29d`; upstream #26, #53, #64, #10
- [x] **REM-17** [acceptance] given more reminders than one response holds, reports a page and how to get the next · — · mjmcg `2743d84`
- [x] **REM-18** [acceptance] given a list too large to read within the time budget, says which list was not read · NN3 · chrischall `6831a90`, `1a358d6`, `b6a4ec6`, `2846497`; upstream #53, #64, #59, #26, #10
- [ ] **REM-19** [acceptance] given thousands of completed reminders, answers within the time budget (after REM-V7) · — · upstream #53
- [ ] **REM-20** [acceptance] given the store cannot be read, fails and says why rather than reporting no reminders · NN3 · boutquin `8a5d2e0`; mjmcg `88e26b9`, `d4ec06d`, `bde3e31`; upstream #26, #53
- [x] **REM-21** [acceptance] given reminders access was denied, fails with a permission failure that names the Privacy & Security setting to change, rather than reporting no reminders · NN5 · danielk-am `ad3e9e9`, `9d9122c`; mjmcg `bde3e31`, `804b77d`; upstream #53, #26, #10, #59, #64
- [ ] **REM-22** [acceptance] given reminders access has never been requested, asks for it before reporting a failure (after REM-V18) · NN5 · danielk-am `ad3e9e9`, `9d9122c`

#### searching reminders

- [ ] **REM-23** [acceptance] given text found only in a reminder's notes, finds it · — · gene-jelly `c5a0edd`; mjmcg `bde3e31`, `804b77d`; boutquin `8a5d2e0`; upstream #53, #26, #10, #59, #70
- [ ] **REM-24** [acceptance] given text that differs from a reminder's title or notes only in letter case, finds it · — · boutquin `8a5d2e0`; upstream #26, #53
- [ ] **REM-25** [acceptance] given a term that matches completed and open reminders, reports both and marks which are completed · — · sicdigital `791f5f2`, `3cfb29d`; upstream #53, #26, #10
- [ ] **REM-26** [acceptance] given more matches than the limit, reports the first matches and says more exist · NN3 · mjmcg `bde3e31`, `804b77d`
- [ ] **REM-27** [acceptance] given the search could not cover every list, says how many lists it covered · NN3 · faces-sh `8ac7cb9`, `39585ad`, `4587d0a`
- [ ] **REM-28** [acceptance] given text that closes a string and runs a command, matches it literally and runs nothing · NN1 · boutquin `2894ab6`, `8a5d2e0`
- [ ] **REM-29** [acceptance] given a percent sign in the search text, matches it literally · — · felkru `12ad33f`

#### creating a reminder

- [ ] **REM-30** [acceptance] given a reminder list that exists, puts the reminder in that list and reports the list and the id the store gave it · NN3 · sicdigital `d5d5df0`; chrischall `6831a90`, `1a358d6`, `b6a4ec6`, `2846497`; upstream #26, PR #40
- [ ] **REM-31** [acceptance] given no list, puts the reminder in the user's default reminder list · — · mjmcg `bde3e31`, `804b77d`; upstream #64
- [ ] **REM-32** [acceptance] given a list that does not exist, refuses, creates no list and names the reminder lists there are · NN3 · KassebaumEngineering `1d47e74`; boutquin `8a5d2e0`; chrischall `6831a90`, `1a358d6`, `b6a4ec6`, `2846497`; danielk-am `ad3e9e9`, `9d9122c`; long-tail/Heming-Zhong `2dc6104`, `8f4cd41`; long-tail/brunnoaraujo `d8f5f19`; mjmcg `bde3e31`, `804b77d`; morquis `d76f3ec`; sicdigital `d5d5df0`; upstream #26, #53, #64, #34, #59, #10
- [ ] **REM-33** [acceptance] given a due date and time, reports the reminder created only after reading it back from the store with that due date and time (after REM-V1) · NN3 · boutquin `8a5d2e0`; chrischall `6831a90`, `1a358d6`, `b6a4ec6`, `2846497`; danielk-am `ad3e9e9`, `9d9122c`; long-tail/Heming-Zhong `2dc6104`, `8f4cd41`; long-tail/brunnoaraujo `d8f5f19`; mjmcg `bde3e31`, `804b77d`; morquis `d76f3ec`; sicdigital `d5d5df0`; upstream #64, #34, #53, #26, #59, #10
- [ ] **REM-34** [acceptance] given notes, stores them on the reminder and reports them as read back from the store · NN3 · boutquin `8a5d2e0`; chrischall `6831a90`, `1a358d6`, `b6a4ec6`, `2846497`; long-tail/Heming-Zhong `2dc6104`, `8f4cd41`; long-tail/brunnoaraujo `d8f5f19`; upstream #64, #34
- [ ] **REM-35** [acceptance] reports the stored due time in the user's local time with its offset, so a wrong time is visible at once · — · upstream #34
- [ ] **REM-36** [acceptance] given a title full of quotes, backslashes and script syntax, stores that exact title · NN1 · mjmcg `d4ec06d`, `bde3e31`
- [ ] **REM-37** [acceptance] given a daily repeat and a due time, creates a reminder that repeats every day · — · faces-sh `7160b0a`, `bfd5b64`, `4587d0a`; upstream #64, #34, #53, #27
- [ ] **REM-38** [acceptance] given a repeat but no due date, refuses: a repeat needs an anchor · — · faces-sh `7160b0a`, `bfd5b64`, `4587d0a`
- [ ] **REM-39** [acceptance] given an open reminder with the same name, refuses and names the existing one so it can be changed instead · — · faces-sh `bcdc856`; upstream #27
- [ ] **REM-40** [acceptance] given the caller says a second copy is wanted, creates it despite the same name · — · faces-sh `bcdc856`; upstream #27

#### editing a reminder

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18), which settles
Phase 3's ambiguity about upstream #27): editing, completing and deleting a reminder have no tool at
all. REM-41 to REM-49 are kept for whenever they are pulled in._

- [ ] **REM-41** [acceptance] given the reminder's identifier and a new due time, changes that reminder and creates no new one (after REM-V6) · — · mjmcg `804b77d`, `fed09d1`; upstream #27
- [ ] **REM-42** [acceptance] given a request to clear the due date, reports the reminder with no due date · — · mjmcg `804b77d`, `fed09d1`
- [ ] **REM-43** [acceptance] given another reminder list, moves the reminder there · — · mjmcg `804b77d`, `fed09d1`
- [ ] **REM-44** [acceptance] given both a due time and a request to clear it, refuses: the two contradict · — · mjmcg `804b77d`, `fed09d1`
- [ ] **REM-45** [acceptance] given an identifier no reminder has, refuses: nothing was changed · NN3 · mjmcg `804b77d`, `fed09d1`

#### completing a reminder

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18))._

- [ ] **REM-46** [acceptance] given an open reminder, reports it completed only after the store shows it completed · NN3 · mjmcg `bde3e31`, `804b77d`, `fed09d1`

#### deleting a reminder

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18))._

- [ ] **REM-47** [acceptance] given writes are not enabled, refuses: reminders are read-only by default · NN2 · mjmcg `bde3e31`, `804b77d`, `fed09d1`
- [ ] **REM-48** [acceptance] given the store still holds the reminder afterwards, reports the outcome as unconfirmed · NN3 · mjmcg `bde3e31`, `804b77d`, `fed09d1`
- [ ] **REM-49** [acceptance] given text that matches two reminders, refuses and lists both rather than deleting the first · — · faces-sh `7160b0a`, `bfd5b64`, `4587d0a`

#### a due date

- [ ] **REM-50** [domain] given a date without a time, is due that whole day in the user's time zone with no time, not at midnight UTC (after REM-V1) · — · long-tail/Heming-Zhong `2dc6104`, `8f4cd41`; long-tail/brunnoaraujo `d8f5f19`; sicdigital `d5d5df0`; upstream #64, #34
- [ ] **REM-51** [domain] given text that is neither a date nor a date and time, refuses rather than guessing or creating an undated reminder · — · long-tail/Heming-Zhong `2dc6104`, `8f4cd41`; long-tail/brunnoaraujo `d8f5f19`; upstream #34

#### a due time

_[#20](https://github.com/that-mathevs/apple-native-mcp/issues/20) settles REM-C9: a due time sets
no alert, and if REM-V4 shows a due time alone never notifies, the answer is an explicit alert
argument, never an implied one._

- [ ] **REM-52** [domain] given a wall-clock time with no offset, reads it in the user's time zone (after REM-V3) · — · chrischall `6831a90`, `1a358d6`, `b6a4ec6`, `2846497`; mjmcg `bde3e31`, `804b77d`; upstream #34, #64
- [ ] **REM-53** [domain] given a time with a UTC offset, keeps the instant rather than the wall-clock digits (after REM-V3) · — · mjmcg `bde3e31`, `804b77d`; upstream #64, #34
- [ ] **REM-54** [domain] given a date on the 31st, keeps its day and month · — · KassebaumEngineering `1d47e74`

#### a due range

- [ ] **REM-55** [domain] given "this week", spans the user's local days from today through the seventh day · — · mjmcg `804b77d`, `fed09d1`, `5ca5e55`
- [ ] **REM-56** [domain] given a reminder with no due date, excludes it from every dated range · — · mjmcg `804b77d`, `fed09d1`, `5ca5e55`

#### a date range

- [ ] **REM-57** [domain] given whole days, covers them from midnight to midnight in the user's time zone · — · sicdigital `3cfb29d`

#### a reminder list's open count

- [ ] **REM-58** [domain] given completed reminders in the list, leaves them out of the count · — · mjmcg `804b77d`, `fed09d1`, `78b536b`

#### a reminder field selection

- [ ] **REM-59** [domain] given a field name outside the known reminder fields, refuses: field names never become calls · NN1 · morquis `d76f3ec`

#### the reminder store

- [ ] **REM-60** [contract] given over a thousand reminders, fetches them all in one request within a second (after REM-V7) · — · faces-sh `dbffae5`, `82efc89`; upstream #53, #26, #10, #75, #74, #25
- [ ] **REM-61** [contract] given a library of thousands of reminders, answers a search within the time budget (after REM-V7) · — · mjmcg `bde3e31`, `804b77d`; upstream #53, #26, #10, #59, #70
- [ ] **REM-62** [contract] given a reminder saved with a due time, returns the same due time when fetched by its identifier (after REM-V1) · NN3 · upstream #64
- [ ] **REM-63** [contract] given a system locale that is not US English, stores the due time exactly as given · — · chrischall `6831a90`, `1a358d6`, `b6a4ec6`, `2846497`
- [ ] **REM-64** [contract] given a Mac set to a non-English locale, reports the same due dates as on an English one · — · sicdigital `3c13e0d`
- [ ] **REM-65** [contract] given a reminder that changes while a list is being read, reports every field of a reminder from that same reminder · — · sicdigital `791f5f2`, `3cfb29d`
- [ ] **REM-66** [contract] given the store does not answer in time, fails with a timeout rather than returning no reminders · NN3 · danielk-am `ad3e9e9`, `9d9122c`

### Conflicts

#### REM-C1 A reminder is created in a list that does not exist

- **Options:**
  - Create the list with that name: KassebaumEngineering `1d47e74`; morquis `d76f3ec`;
    long-tail/brunnoaraujo `d8f5f19`; upstream #26 (v0.2.x did this).
  - Fall back to the first or the default list: boutquin `8a5d2e0`; sicdigital `d5d5df0`;
    danielk-am `9d9122c`; long-tail/brunnoaraujo `d8f5f19` (when creating the list fails).
  - Fail the create: chrischall `6831a90`, `1a358d6`, `b6a4ec6`, `2846497` (returns false, with no
    list of alternatives).
- **Recommendation:** Refuse, create nothing, and name the lists that exist (REM-32). Every
  fallback produced a result that named the requested list while the reminder sat elsewhere
  (boutquin C3, sicdigital C3, upstream #26), and auto-creation turns a typo or a localised
  default name into an unrequested write (long-tail L1 (f)).
- **Needs a human decision:** No — upstream.md open question 9 asked exactly this; the forks'
  failures under both alternatives break NN3 or NN2, and refusing is what the evidence supports.

#### REM-C2 How reminders are reached

- **Options:**
  - AppleScript or JXA over Reminders.app, with bulk property reads: boutquin `8a5d2e0`;
    chrischall `6831a90`, `1a358d6`, `b6a4ec6`, `2846497`; gene-jelly `c5a0edd`;
    KassebaumEngineering `1d47e74`; sicdigital `791f5f2`, `3cfb29d`; morquis `d76f3ec`;
    danielk-am `ad3e9e9` (abandoned the same day).
  - EventKit through the JXA Objective-C bridge: danielk-am `9d9122c`.
  - EventKit through a third-party CLI: mjmcg `bde3e31`, `804b77d`.
  - EventKit in the fork's own Swift helper, JSON in and out: faces-sh `7160b0a`, `bfd5b64`,
    `4587d0a`.
  - EventKit inside a separate host app over loopback HTTP: faces-sh `dbffae5`, `82efc89`.
  - Reading `Calendar.sqlitedb` directly: felkru `12ad33f`.
- **Recommendation:** EventKit in the project's own Swift helper, with no scripted fallback, as
  plan.md's table already says. Every scripted path either timed out or silently returned too
  little (faces-sh measured 155 s down to 0.05 s; sicdigital reports about 30 s; danielk-am
  abandoned scripting because lists came back empty). The bridge's bitmask bugs (danielk-am C3)
  and the SQLite path's possible iCloud blind spot (felkru C7) rule those out.
- **Needs a human decision:** No — the measurements settle the mechanism. Ticket #10 records it
  in the table and #8 owns how the helper ships; REM-V7, REM-V9 and REM-V10 confirm it.

#### REM-C3 Keeping reads of a large library bounded

- **Options:**
  - A silent cap on the number returned: boutquin `8a5d2e0` (50); gene-jelly `c5a0edd` (25);
    KassebaumEngineering `1d47e74` (100 per list, 300 in all, logged only); sicdigital
    `791f5f2` (50); faces-sh `4587d0a` (1000).
  - Skip lists above a size unless one is named: chrischall `6831a90`, `1a358d6`, `b6a4ec6`,
    `2846497`.
  - Raise the buffer and read everything: mjmcg `2743d84`.
  - A time budget that states how many lists it covered: faces-sh `8ac7cb9`, `39585ad`.
  - A `LIMIT` in the store query: felkru `12ad33f`.
- **Recommendation:** Filter in the store fetch (open reminders, the list, the due range), apply
  a limit, say when more exist (REM-16, REM-26) and page past the helper's response ceiling
  (REM-17). Every silent cap led an agent to present a partial answer as complete.
- **Needs a human decision:** No — silent truncation breaks NN3 wherever it appears. The shape
  of a page on the wire is a Cross-cutting question about the helper protocol.

#### REM-C4 Whether a plain listing shows completed reminders

- **Options:**
  - Open reminders only: boutquin `8a5d2e0`; sicdigital `791f5f2`, `3cfb29d`; felkru `12ad33f`;
    upstream #53.
  - A due-window default (`upcoming`) that leaves out completed ones, but a named list shows
    everything, completed included ("checklist-style" lists): mjmcg `5ca5e55`.
  - Every reminder, to-do before done, with done ones marked: faces-sh `94149a2`, `dbffae5`.
  - Everything mixed with no marker: gene-jelly `c5a0edd`; morquis `d76f3ec`.
- **Recommendation:** Open reminders by default in every scope, named list included, with
  completed ones on request (REM-05). REM-06 then orders open before completed only when both
  are asked for. Completed history is what flooded responses and timed out (upstream #53, mjmcg
  C5).
- **Settled by [#20](https://github.com/that-mathevs/apple-native-mcp/issues/20):** a plain
  listing shows open reminders only, in every scope including a named list, and completed ones come
  only when asked for (REM-05); REM-06 then orders open before completed when both are asked for.
  mjmcg's "checklist-style" lists are rejected: one rule everywhere is easier to state and to test.

#### REM-C5 What a reminder search looks at

- **Options:**
  - Titles of open reminders only, filtered inside the store query: chrischall `6831a90`,
    `1a358d6`, `b6a4ec6`, `2846497`.
  - Titles and notes of open reminders: boutquin `8a5d2e0`; felkru `12ad33f`.
  - Titles of all reminders, completed ones marked: sicdigital `791f5f2`, `3cfb29d`.
  - Titles only, notes never read: gene-jelly `c5a0edd`.
  - Titles and notes of every reminder, filtered after loading all: mjmcg `bde3e31`, `804b77d`;
    danielk-am `9d9122c` (up to 5000).
- **Recommendation:** Search titles and notes, ignoring case, across open and completed
  reminders with completed ones marked, under a limit that says when more exist (REM-23 to
  REM-26). EventKit has no text predicate for reminders, so the helper filters after the fetch
  and returns only matches (REM-V7 checks this stays within the time budget).
- **Needs a human decision:** No — a search that skips notes or done reminders reports "not
  found" for reminders that exist (NN3), and upstream's own doc comment promised notes.

#### REM-C6 How a reminder list is named in a request

- **Options:**
  - By title: mjmcg `5ca5e55`; KassebaumEngineering `1d47e74`; boutquin `8a5d2e0`; chrischall
    `6831a90`, `1a358d6`, `b6a4ec6`, `2846497`; gene-jelly `c5a0edd`.
  - By id, with titles only for display: faces-sh `7160b0a`, `bfd5b64`, `4587d0a`; sicdigital
    `791f5f2` (by id for reading one list, by title for create).
  - By title or id, whichever matches: danielk-am `9d9122c`.
- **Recommendation:** Results always carry the list id. Requests accept an id or a title, and a
  title that matches lists in two accounts is refused, naming both (REM-12, REM-03).
- **Needs a human decision:** No — accepting titles keeps agents usable and the refusal removes
  the collision; REM-V5 confirms the collision is possible.

#### REM-C7 Picking the reminder to change, complete or delete

- **Options:**
  - By identifier: mjmcg `804b77d`, `fed09d1`; chrischall `6831a90`, `1a358d6`, `b6a4ec6`,
    `2846497` (complete by id).
  - By id, or else the first reminder whose name contains the text: faces-sh `7160b0a`,
    `bfd5b64`, `4587d0a`.
- **Recommendation:** Writes take the reminder's identifier (REM-41, REM-45). Where a lookup by
  text is offered, more than one match is refused with the candidates (REM-49), the rule faces-sh
  already applied to events.
- **Needs a human decision:** No — first-contains can edit or delete the wrong reminder
  (faces-sh C7), which evidence alone rules out. REM-V6 checks the identifier is stable.

#### REM-C8 How due dates and times cross the tool boundary

- **Options:**
  - Pass the string on for a CLI to parse, natural language included: mjmcg `bde3e31`,
    `804b77d`.
  - Parse ISO in JavaScript, which reads date-only input as UTC midnight, then build the date in
    server-local parts: sicdigital `d5d5df0`; KassebaumEngineering `1d47e74`; boutquin
    `8a5d2e0`; long-tail/Heming-Zhong `2dc6104`; long-tail/brunnoaraujo `d8f5f19`.
  - Parse with `NSISO8601DateFormatter` in the bridge: danielk-am `9d9122c`.
  - Epoch milliseconds in, local ISO out: faces-sh `bfd5b64`.
  - Output as local text with no offset: KassebaumEngineering `1d47e74`; boutquin `8a5d2e0`.
    Output as UTC with `Z`: sicdigital `3c13e0d`.
- **Recommendation:** Accept ISO 8601 only: a date alone is an all-day due date, a date-time
  with an offset is that instant, and one without an offset is read in the user's time zone.
  Anything else is refused (REM-50 to REM-53). Report local time with its offset (REM-35).
  Date-only-as-UTC moved reminders a day early west of UTC, and faces-sh found agents repeat UTC
  times back to users.
- **Needs a human decision:** No — each alternative has a demonstrated failure, and the rule is
  the one plan.md already uses for calendar ranges.

#### REM-C9 Whether a due time also sets an alert

- **Options:**
  - Set the alert ("remind me" date) to the due time on every create: long-tail/brunnoaraujo
    `d8f5f19`.
  - Set only the due date and time: long-tail/Heming-Zhong `2dc6104`; boutquin `8a5d2e0`;
    sicdigital `d5d5df0`; faces-sh `7160b0a`, `bfd5b64`, `4587d0a`; mjmcg `bde3e31`,
    `804b77d`.
- **Recommendation:** Keep due time and alert apart, and add no alert that wasn't asked for, as
  long-tail L1 decided. If REM-V4 shows that a due time alone never notifies, add an explicit
  alert argument rather than an implied one.
- **Settled by [#20](https://github.com/that-mathevs/apple-native-mcp/issues/20):** a due time
  sets no alert. If REM-V4 shows a due time alone never notifies, the answer is an **explicit alert
  argument, never an implied alert**: an implied one would fire a notification the user never asked
  for, and leave no way to ask for a quiet reminder.

#### REM-C10 Stopping a changed reminder from becoming a second reminder (upstream #27)

- **Options:**
  - Add an edit operation that changes the reminder in place: mjmcg `804b77d`, `fed09d1`.
  - Refuse a create whose name matches an open reminder, with an explicit override: faces-sh
    `bcdc856`.
- **Recommendation:** Adopt both. Editing (REM-41 to REM-45) removes the cause, and the twin
  guard (REM-39, REM-40) catches an agent that still reaches for create.
- **Needs a human decision:** No — the two don't exclude each other, and the override keeps a
  deliberate second copy possible.

#### REM-C11 Asking for Reminders access

- **Options:**
  - Request full access on every run: faces-sh `7160b0a`, `bfd5b64`, `4587d0a`.
  - Check the status and never request, accepting some non-granted statuses: danielk-am
    `9d9122c`.
  - Check the status through the CLI, but never use the result: mjmcg `bde3e31`, `804b77d`.
- **Recommendation:** Read EventKit's status. Request access only when it is not determined, and
  otherwise turn a missing grant into the named permission failure (REM-21, REM-22).
- **Needs a human decision:** No — #4 settled attribution, and NN5 settles the failure. What
  happens when a prompt never appears is REM-V18.

### Verification tasks

Not about Notes or Mail mechanisms or permission prompts:

- **REM-V1** An `EKReminder` saved through EventKit with year, month and day due-date components
  shows in Reminders.app as due that day with no time, and one saved with hour and minute too
  shows that time, and both read back unchanged by identifier. *From:* faces-sh `7160b0a`,
  `bfd5b64`, `4587d0a` (C7 verify); sicdigital `d5d5df0` (C3, can't create an all-day
  reminder); long-tail/Heming-Zhong `2dc6104`; upstream #64. *Proves it:* a small Swift program
  run on macOS 14+ saves both reminders to a throwaway list; Reminders.app shows one with no time
  and one with 17:30, and refetching each by `calendarItemIdentifier` returns the same components.
  *Disproves it:* the timed reminder shows no time in Reminders.app, or the date-only one shows
  00:00, or the refetched components differ.
- **REM-V2** `EKReminder.dueDateComponents.date` returns nil when the components carry no
  calendar, so reading a due date back needs the components resolved against a calendar and time
  zone. *From:* danielk-am `9d9122c` (open question). *Proves it:* save a reminder with due-date
  components that have no `calendar` set, refetch it, and print `dueDateComponents.date`; it is
  nil. *Disproves it:* it prints the expected date.
- **REM-V3** A due time given as an instant with a UTC offset is shown in Reminders.app at that
  instant in the Mac's time zone, and a wall-clock time with no offset is shown at those digits.
  Upstream #34's 55-minute shift came from the timestamp the model sent, not from the
  conversion. *From:* mjmcg `bde3e31`, `804b77d` (C2 verify, open question); boutquin `8a5d2e0`
  (open question on #34); upstream #34 (verify how JXA `new Date()` reads an ISO string with no
  offset). *Proves it:* on a Mac set to a zone other than UTC+2, create via the helper
  `2026-10-01T17:30:00+02:00` and `2026-10-01T17:30:00`; the first shows at the converted local
  time, the second at 17:30. In `osascript -l JavaScript`, `new Date("2026-10-01T17:30:00")`
  prints local 17:30. *Disproves it:* either reminder shows another time, or JXA reads the
  no-offset string as UTC.
- **REM-V4** A reminder saved through EventKit with a due time and no `EKAlarm` notifies the user
  at the due time, as one set in Reminders.app does. *From:* long-tail/brunnoaraujo `d8f5f19`
  (sets the alert explicitly); long-tail glossary "alert / remind me date". *Proves it:* save a
  reminder due two minutes ahead with no alarm, then leave the Mac awake; a notification appears.
  *Disproves it:* no notification appears, while an identical reminder with an `EKAlarm` at the
  due time does notify.
- **REM-V5** Two reminder lists in different accounts (for example iCloud and a CalDAV or local
  account) can have the same title, and EventKit returns both with different
  `calendarIdentifier`s. *From:* mjmcg `5ca5e55` (C6 verify, open question); KassebaumEngineering
  `1d47e74`; sicdigital `791f5f2`. *Proves it:* create a list with one title in two accounts in
  Reminders.app; `calendars(for: .reminder)` lists both with distinct identifiers. *Disproves it:*
  Reminders.app refuses the second title, or EventKit returns one.
- **REM-V6** A reminder's `calendarItemIdentifier` stays the same across helper restarts, app
  relaunches and an iCloud sync from another device, so it can address a reminder for editing.
  *From:* danielk-am `9d9122c` (glossary: `calendarItemIdentifier` is local,
  `calendarItemExternalIdentifier` survives sync); mjmcg `804b77d`, `fed09d1` (edit by id).
  *Proves it:* record the id of an iCloud reminder, edit that reminder on an iPhone, restart the
  helper and relaunch Reminders; `calendarItem(withIdentifier:)` still returns it. *Disproves it:*
  the lookup returns nil, or a different id is reported for the same reminder.
- **REM-V7** EventKit fetches every reminder of a library with over a thousand reminders
  (thousands completed) in under a second. Filtering titles and notes in the helper and counting
  open and overdue reminders per list both stay within a two-second time budget. *From:* faces-sh
  `dbffae5`, `82efc89` (measured 0.05 s inside a host app); mjmcg `bde3e31`, `804b77d`, `78b536b`;
  upstream #53. *Proves it:* on a Mac with a real or seeded store of 1,000+ reminders, time
  `fetchReminders(matching: predicateForReminders(in: nil))` and the filter and count passes from
  the helper binary, run three times cold. *Disproves it:* any run exceeds the stated times.
- **REM-V8** EventKit's incomplete-reminders predicate with no due-date bounds returns every open
  reminder, undated ones included, and with bounds returns only open reminders due inside them.
  *From:* danielk-am `9d9122c` (the incomplete-only predicate "renders inconsistently" through
  the JXA bridge). *Proves it:* seed a list with open dated, open undated and completed reminders;
  `predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars:)` returns
  both open ones, and with a one-day window returns only the dated one inside it. *Disproves it:*
  undated reminders are missing from the unbounded fetch, or completed ones appear.
- **REM-V9** (evidence only) EventKit returns reminders from iCloud lists and from CalDAV, Exchange or local lists
  alike. `Calendar.sqlitedb` holds only the non-iCloud ones, because upgraded iCloud reminders
  live in the Reminders group container. *From:* felkru `12ad33f` (C7 verify, open question).
  *Proves it:* with one iCloud and one CalDAV or local list, each holding a reminder, EventKit
  returns both; a read-only `sqlite3` query over `Calendar.sqlitedb` `CalendarItem` finds only
  the non-iCloud one. *Disproves it:* EventKit misses either, or the database holds both.
- **REM-V10** (evidence only) Scripting Reminders.app is too slow to serve a real library. A bulk property read
  takes tens of seconds on a list of a few hundred, `whose` filters take about 5 s per list, and
  per-item access hangs. *From:* sicdigital `791f5f2`, `3cfb29d` (25–35 s, open questions,
  including whether macOS 26 still exposes `creation date`, `due date` and `body`);
  KassebaumEngineering `1d47e74` (18 s per property on 469 items, verify); faces-sh `8ac7cb9`,
  `39585ad`; boutquin `8a5d2e0` (open question). Evidence for #10. *Proves it:* on macOS 26, time
  `osascript -e 'tell application "Reminders" to get name of reminders of list "<list>"'` on a
  list of 400+ and a `whose completed is false` read. Both take over 5 s. *Disproves it:* both
  finish in under a second.
- **REM-V11** (evidence only) AppleScript parses a `date "March 30, 2026 at 2:30:00 PM"` literal with the system
  region's format, so it fails or loses the time under a non-US region. *From:* chrischall
  `6831a90`, `1a358d6`, `b6a4ec6`, `2846497` (C25 verify); boutquin `8a5d2e0` (open question: only
  en-US or every region). Evidence for REM-63 and REM-64. *Proves it:* switch the region to German
  and run `osascript -e 'date "March 30, 2026 at 2:30:00 PM"'`; it errors or drops 14:30.
  *Disproves it:* it returns 30 March 2026 14:30 under German, French and Japanese regions.
- **REM-V12** (evidence only) In the morquis fork, `reminders` `listById` with `props: ["delete"]` deletes the
  reminders of the list on macOS 14+. *From:* morquis `d76f3ec` (C5 verify, open question).
  *Proves it:* build `fork-morquis/main`, point it at a throwaway list with two reminders, call
  `listById` with `props: ["delete"]`, and the list is empty afterwards. *Disproves it:* both
  reminders remain. Outcome decides whether the fork gets a security note, not our design.
- **REM-V13** (evidence only) `remindctl show week` covers the next seven days rather than the calendar week, and
  `upcoming` leaves out undated reminders. *From:* mjmcg `804b77d`, `fed09d1`, `5ca5e55` (C5
  verify). Evidence only: REM-55 and REM-56 define our own ranges. *Proves it:* with reminders
  due today+6, today+8 and undated, `remindctl show week --json` returns only today+6, and
  `show upcoming --json` omits the undated one. *Disproves it:* the output differs.
- **REM-V14** (evidence only) `remindctl show all --list <name>` ignores `--list` and returns reminders from every
  list. *From:* mjmcg `5ca5e55` (open question). Evidence only. *Proves it:* with two lists, the
  command returns reminders from both. *Disproves it:* it returns only the named list.
- **REM-V15** (evidence only) `remindctl` writes a JSON error to stdout and exits non-zero when a write fails, so
  mjmcg's runner reports the failed write as done. *From:* mjmcg `88e26b9`, `d4ec06d`, `bde3e31`
  (C15, open question). Evidence only. *Proves it:* `remindctl complete <nonexistent-id> --json`
  prints JSON on stdout with a non-zero exit. *Disproves it:* stdout is empty on failure.

Permission prompts (left open by #4):

- **REM-V16** (permission prompts) On macOS 14+, scripting Reminders from a host that has
  Automation access but no Reminders access returns `count of lists` as 0 rather than an error.
  *From:* danielk-am `ad3e9e9`, `9d9122c` (C3 verify). *Proves it:* in a terminal app with
  Automation → Reminders allowed and Privacy → Reminders off, run
  `osascript -e 'tell application "Reminders" to count of lists'`; it prints 0. *Disproves it:* it
  prints the real count or raises a permission error.
- **REM-V17** (permission prompts) On macOS 14+, reminders have no write-only access level:
  `EKEventStore.authorizationStatus(for: .reminder)` is only ever not determined, restricted,
  denied or full access. *From:* danielk-am `9d9122c` (glossary: write-only is events only);
  brightline `859a9c8` (glossary: authorization status); mjmcg `bde3e31`, `804b77d` (C9: a
  separate status word). *Proves it:* the SDK has no write-only request for reminders, and after
  every choice in the prompt and in System Settings the helper prints one of those four.
  *Disproves it:* a write-only status is observed for reminders.
- **REM-V18** (permission prompts) When the helper calls `requestFullAccessToReminders` with the
  status not determined, it returns only after the user answers the prompt. Where the host
  refuses silently, as #4 saw, it returns promptly as not granted rather than hanging. *From:*
  faces-sh `7160b0a`, `bfd5b64`, `4587d0a` (a 60 s access wait counted as not granted);
  danielk-am `9d9122c` (access never requested, so the host never appears in System Settings).
  *Proves it:* reset with `tccutil reset Reminders`, run the helper under Terminal and under the
  host #4 found silent, and log the time to completion and the result; the silent host returns in
  under a second as denied or not determined. *Disproves it:* the call blocks until a timeout
  under the silent host.

- Mechanism questions: see #6.
  - A JXA make-new on Notes.app succeeds when Notes isn't running, with no `activate` first.
    Reminders was the case seen, but EventKit needs no running app. *From:* faces-sh `3c590df`,
    `dbffae5` (C11 verify).
  - Launching a scripted app in the background (for example `NSWorkspace` with
    `activates = false`) avoids both the System Events Automation prompt and the focus steal. It
    also bears on Mail and Messages, and Reminders is not affected. *From:* ANierbeck `3005df4`
    (C16 verify).
- Permission-prompt attribution for a helper spawned by Node (faces-sh `dbffae5`, `82efc89` C6;
  mjmcg `bde3e31`, `804b77d` C9) is answered by #4 and not restated.

### Credits

- **boutquin:** a create that honours the requested list, notes and due time; open reminders as
  the default view.
- **chrischall:** fetching reminder properties in bulk and pushing the filter into the store
  query; completing a reminder by its id.
- **danielk-am:** EventKit for reminders instead of Reminders' scripting, with evidence that
  scripted reads came back empty.
- **faces-sh:** EventKit with no scripted fallback; a Swift helper speaking JSON; due times
  reported in local time; a repeat that needs a due date; refusing a twin reminder unless a copy
  is asked for; a reminders listing as an index grouped by list; stating how much of a partial
  search was covered.
- **felkru:** evidence that direct store reads are fast; reminders from every kind of account;
  search text matched literally.
- **gene-jelly:** reading in bulk and filtering outside the script.
- **KassebaumEngineering:** bulk reads; a due date built so the 31st can't overflow into the next
  month; returning the store's id and the list actually used.
- **long-tail/brunnoaraujo:** a create that reports the list actually used.
- **long-tail/Heming-Zhong:** notes and due date that reach the store on create.
- **mjmcg:** EventKit-backed reads with list, due date and completion state; editing a reminder
  in place, including moving it and clearing its due date; completing and deleting; due ranges
  such as overdue; open and overdue counts per list; a list scope that really scopes; an
  unreadable store as a failure, never an empty list.
- **morquis:** listing reminder lists first, and reminders per list on request.
- **sicdigital:** reads that carry id, list, due date and creation date; reminder lists returned
  as structured data with their ids; filtering by due and creation date; ISO 8601 timestamps.
- **upstream PR #40:** a reminder created in the requested list.

## Contacts

### Scenario backlog

#### finding a contact

- [ ] **CON-01** [acceptance] given a contact with email addresses and phone numbers, reports every one with its label · — · upstream #75; chrischall `0860cf8`
- [ ] **CON-02** [acceptance] reports every kind of detail on the contact: phone numbers, email addresses, postal addresses, URLs, birthday, organisation and job title · — · upstream #75; morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`; fpjnijweide `42c9e11`
- [ ] **CON-03** [acceptance] given a contact with email addresses and no phone number, finds them and reports the email addresses · — · upstream #75, #58; faces-sh `26a3d1c`, `82efc89`, `16172e8`; morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`
- [ ] **CON-04** [acceptance] given a contact with a phone number, reports the number as written in Contacts · — · upstream #47
- [ ] **CON-05** [acceptance] given an email address, finds the contact who owns it · — · upstream #75
- [ ] **CON-06** [acceptance] given part of an email address, finds the contact it belongs to · — · chrischall `0860cf8`
- [ ] **CON-07** [acceptance] given a phone number written differently from the way the contact stores it, finds the contact who owns it · NN4 · upstream #35; morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`
- [ ] **CON-08** [acceptance] given a name that matches several contacts, reports all of them rather than choosing one · NN4 · upstream #35; KassebaumEngineering `1d47e74`
- [ ] **CON-09** [acceptance] given two contacts with the same name, reports both separately, each with its own details · NN4 · KassebaumEngineering `1d47e74`
- [ ] **CON-10** [acceptance] given a full name that is also a family name on other contacts, lists the full-name match first · — · faces-sh `26a3d1c`, `82efc89`, `16172e8`; KassebaumEngineering `1d47e74`
- [ ] **CON-11** [acceptance] reports each contact's stable identifier, so the same contact can be addressed again after a rename (after CON-V2) · — · faces-sh `26a3d1c`, `82efc89`, `16172e8`; morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`
- [ ] **CON-12** [acceptance] given a contact edited a moment ago, reports the edited details: nothing is served from a cache (after CON-V5) · NN3 · upstream PR #49; faces-sh `0216d96`
- [ ] **CON-13** [acceptance] never reports a contact note: macOS reserves that field for entitled apps (after CON-V4) · — · morquis `5c01104`
- [ ] **CON-14** [acceptance] given a name containing quotes, backslashes and script syntax, searches for exactly that text and runs nothing · NN1 · ANierbeck `cd72bdf`, `fc893d7`; brightline `859a9c8`; morquis `d76f3ec`, `96759b3`
- [ ] **CON-15** [acceptance] given the Contacts app is not running, answers without starting it (after CON-V1) · — · upstream #65; ANierbeck `3005df4`
- [ ] **CON-16** [acceptance] given contacts access has not been decided yet, asks macOS for access before reading · NN5 · upstream #65
- [ ] **CON-17** [acceptance] given contacts access was denied, fails as a missing permission that names Privacy & Security > Contacts and what to enable there, rather than reporting no match (after CON-V10) · NN5 · upstream #65; morquis `96759b3`, `d76f3ec`
- [ ] **CON-18** [acceptance] given the contact store does not answer within its time budget, reports a timeout rather than no match · NN3 · nivra `0b616cd`, `2860fb6`; morquis `96759b3`, `d76f3ec`
- [ ] **CON-19** [acceptance] given the native helper cannot be reached, reports that by name rather than an empty result or a scripted fallback · NN3, NN5 · faces-sh `dbffae5`, `82efc89`

#### listing contacts

- [ ] **CON-20** [acceptance] given contacts that have only an email address, includes them in the list · — · faces-sh `dbffae5`, `82efc89`; upstream #58
- [ ] **CON-21** [acceptance] given a contact with neither email address nor phone number, lists it and says it has neither · — · faces-sh `26a3d1c`, `82efc89`, `16172e8`
- [ ] **CON-22** [acceptance] given two contacts with the same name, reports both with their own details · — · boutquin `2894ab6`
- [ ] **CON-23** [acceptance] returns a bounded page, says how many contacts there are and how to fetch the next page, rather than reading every contact or stopping silently · NN3 · upstream #17; fpjnijweide `42c9e11`; nivra `0b616cd`, `2860fb6`

#### the contact tools

- [ ] **CON-56** [acceptance] offers no tool that creates, changes or deletes a contact: a contact write would let injected input widen who counts as a known recipient · NN4 · #18

#### creating a contact

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18), settling CON-C7):
create, update and delete have no tool at all, because Contacts decides who counts as a known
recipient. CON-56 is v1's positive statement; CON-24 to CON-32 are kept for whenever contact writes
are pulled in._

- [ ] **CON-24** [acceptance] given contact writes are not enabled, refuses: writes are off by default · NN2 · fpjnijweide `42c9e11`, `48cd701`; faces-sh `431f4b1`
- [ ] **CON-25** [acceptance] reports the contact as read back from the contact store after saving, not the values it was given · NN3 · morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`; faces-sh `431f4b1`
- [ ] **CON-26** [acceptance] given an existing contact with the same name, reports the new contact's own identifier · NN3 · morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`
- [ ] **CON-27** [acceptance] given a phone number, email address or URL containing text that looks like script or replacement patterns such as `$'`, stores exactly that text or refuses it, and runs nothing · NN1 · morquis `2483f04`, `a77212a`, `5c01104`

#### updating a contact

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18))._

- [ ] **CON-28** [acceptance] given a detail whose text looks like script or replacement patterns, stores exactly that text or refuses it, and runs nothing · NN1 · morquis `2483f04`, `a77212a`, `5c01104`
- [ ] **CON-29** [acceptance] given a label that is not one of Apple's well-known labels, keeps it as a custom label rather than relabelling the value as work · — · morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`
- [ ] **CON-30** [acceptance] given an empty phone number or email address, refuses rather than removing every one of them · — · fpjnijweide `42c9e11`, `48cd701`
- [ ] **CON-31** [acceptance] given a family name of several words, stores it intact rather than splitting it at a space · — · fpjnijweide `42c9e11`, `48cd701`

#### deleting a contact

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18))._

- [ ] **CON-32** [acceptance] given a name rather than an identifier, refuses and lists the contacts the name matches: a write never guesses its target · NN3 · faces-sh `431f4b1`; fpjnijweide `42c9e11`, `48cd701`

#### a contact name match

- [ ] **CON-33** [domain] given a query that merely contains a contact's short name as letters inside a word, does not match it · NN4 · KassebaumEngineering `1d47e74`
- [ ] **CON-34** [domain] given a query that appears only as letters inside a word of a contact's name, does not match it: names match at word boundaries · NN4 · long-tail/tomsr73 `35e211d`
- [ ] **CON-35** [domain] given text in a different case or with or without diacritics, matches the same contact · — · upstream PR #49
- [ ] **CON-36** [domain] ranks an exact full name before a whole-word match, and a whole-word match before a word prefix · — · KassebaumEngineering `1d47e74`; faces-sh `26a3d1c`, `82efc89`, `16172e8`

#### a phone number

_Messages depends on these rules (matching a handle to a contact, the known-recipient rule).
Rules that only resolve a message recipient live in Messages.
[#17](https://github.com/that-mathevs/apple-native-mcp/issues/17) settles CON-C2: two numbers are
the same only when their full E.164 forms are equal, and a bare national number is never given a
country, so CON-37 is rejected._

- **CON-37** [domain] given a national number and the user's region, normalises it to E.164 in that region rather than assuming the US · **rejected by #17**: a bare national number is never given a country and the answer must not depend on the Mac's region; it is matched against stored handles instead (MSG-54 to MSG-56) · upstream #35; morquis `4e257c8`, `96759b3`
- [ ] **CON-38** [domain] given a number with a country code and a national trunk prefix, normalises it to one E.164 number · NN4 · upstream #35
- [ ] **CON-39** [domain] given the same number written with spaces, dashes, brackets or its country code, counts it as the same number · NN4 · ANierbeck `813c232`
- [ ] **CON-40** [domain] given two numbers where one merely contains the other, does not treat them as the same number · NN4 · upstream #35; ANierbeck `813c232`
- [ ] **CON-41** [domain] given two numbers that share their trailing digits but not their country or area, treats them as different · NN4 · KassebaumEngineering `13fd400`; morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`

#### a contact detail label

- [ ] **CON-42** [domain] given Apple's mobile label sentinel, reports it as mobile · — · morquis `5c01104`
- [ ] **CON-43** [domain] given a custom label, reports it unchanged · — · morquis `5c01104`
- [ ] **CON-44** [domain] given a well-known label of an email address, URL or postal address, translates it both ways, not only phone labels · — · morquis `5c01104`

#### a birthday

- [ ] **CON-45** [domain] reports a birthday as a calendar date with a zero-padded month and day, whatever the user's locale · — · fpjnijweide `42c9e11`, `48cd701`; morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`

#### the contact store

- [ ] **CON-46** [contract] given a person with only an email address, returns that person with the email address · — · fpjnijweide `42c9e11`
- [ ] **CON-47** [contract] given a contact with several phone numbers, returns every one with its label · — · upstream #47
- [ ] **CON-48** [contract] given a contact whose name contains punctuation, returns the name intact · — · nivra `0b616cd`, `2860fb6`
- [ ] **CON-49** [contract] given a library of thousands of contacts, answers a lookup within the time budget (after CON-V7) · NN3 · nivra `0b616cd`, `2860fb6`; faces-sh `dbffae5`, `82efc89`
- [ ] **CON-50** [contract] given access is denied, fails with the missing-permission failure rather than an empty result · NN5 · upstream #65; morquis `96759b3`, `d76f3ec`
- [ ] **CON-51** [contract] never asks for the contact note, and still returns every other field (after CON-V4) · — · morquis `5c01104`
- [ ] **CON-52** [contract] given a new contact with two labelled phone numbers, reads both back after saving · NN3 · morquis `a77212a`, `5c01104`
- [ ] **CON-53** [contract] given the identifier returned by a save, finds and deletes that same contact · NN3 · morquis `a77212a`, `5c01104`
- [ ] **CON-54** [contract] given a work fax number, reads it back labelled work fax (after CON-V3) · — · morquis `5c01104`
- [ ] **CON-55** [contract] reports the contacts authorisation status without reading any contact · NN5 · upstream #65

### Conflicts

#### CON-C1 How the server reaches Contacts

- **Options:**
  - Contacts.framework in a helper process the server spawns: plan.md; morquis `a77212a`,
    `5c01104` (the framework through the scripting bridge's ObjC import, for writes).
  - Contacts.framework in a separate host app reached over loopback HTTP, with no scripted
    fallback: faces-sh `dbffae5`, `82efc89`.
  - Scripting Contacts with bulk property reads: KassebaumEngineering `1d47e74`; morquis
    `d76f3ec`; faces-sh `0216d96` (before the host app).
  - Scripting Contacts person by person, parsed from delimited text: upstream #47, #58; nivra
    `0b616cd`, `2860fb6`; fpjnijweide `42c9e11`; chrischall `0860cf8`; boutquin `2894ab6`;
    upstream PR #49 (with an AppleScript fallback).
- **Recommendation:** Contacts.framework in the Swift helper, with no scripted fallback. The
  scripted paths dropped contacts without phones, gave wrong answers rather than slow ones (one fork
  listed a small fraction of the cards, and one search took minutes), silently dropped phones on
  write (morquis C13), and never raised a Contacts prompt (#65). The host-app route read every card
  in under a second but needs a proprietary app.
- **Needs a human decision:** No — every report points the same way and plan.md already chose it;
  record it when #10 finalises the table. How the helper is distributed is #8.

#### CON-C2 When two phone numbers count as the same number

- **Options:**
  - Either number contains the other: upstream #35; ANierbeck `813c232`; morquis `2483f04`,
    `a77212a`, `5fa172e`, `5c01104`.
  - The same trailing digits (the last ten, or a shared tail of at least seven):
    KassebaumEngineering `13fd400`, `1d47e74`; faces-sh `0216d96`.
  - A fixed default country for bare numbers, then a fuzzy fallback: upstream #35 (`+1`); morquis
    `4e257c8`, `96759b3` (the author's own country for a leading 0); upstream PR #49.
  - Normalise both to E.164 with the user's region, then compare exactly: the verdicts of
    ANierbeck C7, KassebaumEngineering C5, morquis C8.
  - Never invent a country: a bare national number is matched only against numbers already
    stored, answers must not change with the Mac's region, and a number that fits two countries is
    ambiguous: faces-sh `784db41`, `9609cb4`, `ad467f8`, `ac0058a`, `a663d12` (upstream #24, #48).
- **Recommendation:** Two numbers are the same only when their full E.164 forms are equal;
  containment and shared tails are never a match (CON-40, CON-41). A number that states its country
  normalises exactly. A bare national number is compared against the numbers already stored rather
  than read in the Mac's region, so one that fits handles in two countries is ambiguous and refused,
  as faces-sh learned after it sent to the wrong country.
- **Settled by [#17](https://github.com/that-mathevs/apple-native-mcp/issues/17):** a bare national
  number is never given a country. It is compared against the stored handles the user has real
  traffic with, after those are normalised, and exactly one match is the recipient. The answer must
  not depend on the Mac's region, so CON-37 is rejected and CON-07, CON-40, CON-41 and MSG-54 to
  MSG-56 carry the rule.

#### CON-C3 How a name matches a contact

- **Options:**
  - Substring in either direction, first match wins: upstream #35, upstream PR #49; fpjnijweide
    `42c9e11`; chrischall `0860cf8`.
  - Substring of the whole query, then of each word of three or more letters, every match
    returned: faces-sh `26a3d1c`, `82efc89`, `16172e8`.
  - A cascade from exact to fuzzy, the first strategy with a hit wins, namesakes merged:
    KassebaumEngineering `1d47e74`.
  - Word prefix only, first match wins: long-tail/tomsr73 `35e211d`.
  - Exact full name only, and exactly one match (for writes): fpjnijweide `42c9e11`, `48cd701`.
- **Recommendation:** Match at word boundaries only (a whole word or the start of a word), fold case
  and diacritics, rank exact full name, then whole word, then word prefix, and return every
  candidate. Substring matching put the wrong person's number in front of the agent (L5, faces-sh
  C20 quality note), and first-match or merging hid the choice (KassebaumEngineering C9).
- **Needs a human decision:** No — the failures of each looser rule are documented; the stricter
  rule loses nothing because ambiguity is shown, not guessed.

#### CON-C4 How much a contact listing returns

- **Options:**
  - Every contact that has a phone, stopped silently at a fixed cap: nivra `0b616cd`, `2860fb6`
    (1,000); fpjnijweide `42c9e11` (100).
  - Every card, as a brief index, with detail one lookup away: faces-sh `26a3d1c`, `82efc89`,
    `16172e8`.
  - A bounded page that says how to fetch the next: upstream #17.
- **Recommendation:** A bounded page with a total and a way to fetch the next (CON-23). Silent caps
  report a partial list as the whole address book, and an unbounded index is what timed out in #17.
- **Needs a human decision:** No — a page that states its bounds is the only option that is both
  bounded and truthful. The page size is a tuning detail.

#### CON-C5 Whether contact reads are cached

- **Options:**
  - A cache with a time-to-live and memory cap: upstream PR #49.
  - A short-lived scan cache cleared on every write: faces-sh `431f4b1`.
  - No cache; one read of the address book per request: faces-sh `0216d96`.
- **Recommendation:** No cache across requests (CON-12). A user who adds a contact and at once asks
  who just wrote would get a stale answer, and Contacts.framework reads are fast enough (CON-V7).
- **Needs a human decision:** No — the cache only existed to work around slow scripting.

#### CON-C6 How a contact write chooses its target

- **Options:**
  - The first contact whose display name matches: faces-sh `431f4b1`.
  - An exact name, refused unless exactly one contact has it: fpjnijweide `42c9e11`, `48cd701`.
  - The contact identifier, with the saved contact read back by identifier: morquis `2483f04`,
    `a77212a`, `5fa172e`, `5c01104` (its create read back by name and could return someone
    else's identifier).
- **Recommendation:** Writes take a contact identifier only; a name is a question for finding a
  contact (CON-32). Name targeting deleted the first namesake (faces-sh C35), and name read-back
  returned another person's identifier (morquis C12).
- **Needs a human decision:** No — both name-based approaches have a documented wrong-person
  failure.

#### CON-C7 Whether v1 writes contacts

- **Options:**
  - Read-only in v1: plan.md Phase 3 (find by name, phone and email only); the verdicts of faces-sh
    `431f4b1` (C35) and fpjnijweide `42c9e11`, `48cd701` (C7).
  - Create, update and delete by identifier through Contacts.framework, behind the write setting:
    morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`.
- **Recommendation:** Ship reads only, as Phase 3 orders. Keep CON-24 to CON-32 in the backlog
  with no tool in v1, so writes are specified when they are wanted.
- **Settled by [#18](https://github.com/that-mathevs/apple-native-mcp/issues/18):** v1 has no
  contact writes and no tool for them. Contacts decides who counts as a known recipient (NN4), and
  a tool that edits contacts lets injected input widen that set. CON-56 states the absence; CON-24
  to CON-32 stay in the backlog.

#### CON-C8 What happens to a label the address book doesn't know

- **Options:**
  - Write it as "work" without saying so: morquis `2483f04`, `a77212a`, `5fa172e`, `5c01104`
    (C12 technique).
  - Refuse it: morquis C12 verdict scenario.
  - Keep it as a custom label, translating only the well-known ones: morquis `5c01104` (C14 reads).
- **Recommendation:** Keep it as a custom label (CON-29, CON-43). Contacts stores custom labels as
  plain text, so refusing would reject legitimate labels and relabelling silently changes data.
- **Needs a human decision:** No — custom labels are part of the store's model, and the reads already
  round-trip them.

### Verification tasks

- **CON-V1** Contacts.framework reads contacts while the Contacts app is not running, without an
  Automation prompt and without starting the app. *From:* upstream #65 (-600 "Application isn't
  running" through scripting); ANierbeck `3005df4`. *Proves it:* quit Contacts, run a helper that
  fetches `unifiedContacts(matching:)` for a known name: it returns the contact, no Automation prompt
  appears and Contacts does not appear in the Dock. *Disproves it:* the fetch fails or waits, a
  prompt appears, or Contacts launches.
- **CON-V2** `CNContact.identifier` stays the same after the contact is renamed in Contacts, and a
  fetch by that identifier finds a linked (unified) contact; also check whether the scripting
  bridge's person id equals it including `:ABPerson`. *From:* morquis `a77212a`, `5c01104` (C13);
  faces-sh `26a3d1c`, `82efc89`, `16172e8` (C13, says verified equal). *Proves it:* note the
  identifier, rename the contact and link it to a second card, then
  `unifiedContacts(matching: predicateForContacts(withIdentifiers:))` returns it with the same
  identifier. *Disproves it:* the identifier changes, or the fetch returns nothing for a linked
  contact.
- **CON-V3** Contacts.framework stores the CN-constant work fax label as work fax; the uppercase
  `…FAX` quirk belongs to the scripting bridge only. *From:* morquis `5c01104` (C14). *Proves it:*
  save a contact with `CNLabelPhoneNumberWorkFax` through the helper; Contacts shows "work fax" and a
  fetch returns the same label. *Disproves it:* Contacts shows another label (such as assistant).
 
- **CON-V4** An unsigned or ad-hoc signed helper cannot read `CNContactNoteKey`, and asking for it
  fails with a catchable error rather than a crash. *From:* morquis `5c01104` (C15). *Proves it:*
  fetch a contact with a note, once without and once with `CNContactNoteKey` in the keys: the first
  succeeds, the second returns an error the helper can report. *Disproves it:* the note comes back
  (the field can be offered), or the process crashes.
- **CON-V5** A long-lived helper's `CNContactStore` returns an edit made in the Contacts app on the
  next fetch, without being recreated. *From:* upstream PR #49 (cache rejected); faces-sh `0216d96`
  (C14, stale names). *Proves it:* start the helper, fetch a contact, change its phone number in
  Contacts, fetch again through the same store: the new number is returned. *Disproves it:* the old
  value is returned until the store is recreated or the helper restarts.
- **CON-V6** A fetch right after a Contacts.framework save returns the saved contact at once, not
  after a delay of seconds. *From:* faces-sh `431f4b1` (C35 and open question "Reading back Notes and
  Contacts"). *Proves it:* save a new contact and fetch it by the returned identifier in the same
  helper; it is found, timed under 100 ms. *Disproves it:* the fetch misses it or blocks for
  seconds.
- **CON-V7** The helper answers a name lookup and a full listing over several thousand contacts
  within one second. *From:* faces-sh `dbffae5`, `82efc89` (C6, 0.79 s for about 1,600 cards through
  a host app); nivra `0b616cd`, `2860fb6` (C4). *Proves it:* on a test account with 5,000 generated
  contacts, time a name lookup and a full enumeration of names, emails and phones: both under 1 s.
  *Disproves it:* either takes longer, so paging or a narrower key set is needed.
- **CON-V8** (evidence only) Through the Contacts scripting bridge, a phone number pushed onto a person's phones is
  not persisted on macOS 14 to 26. Only supports CON-C1; skip if #10 closes on Contacts.framework.
  *From:* morquis `a77212a`, `5c01104` (C13). *Proves it:* a JXA script creates a person, pushes a
  phone and an email, saves; Contacts shows the email but not the phone. *Disproves it:* the phone
  is shown.
- **CON-V9** (evidence only) Changes made to Contacts through JXA are discarded unless `Contacts.save()` is called.
  Only matters if a scripted path is kept; plan.md has none. *From:* faces-sh `431f4b1` (C35).
  *Proves it:* a JXA script creates a person without calling `save()`; after the script exits the
  person is absent. *Disproves it:* the person is present.
- **CON-V10** (permission prompts) After the user denies the Contacts prompt, the helper (or the app
  macOS credits it to) is listed under Privacy & Security > Contacts and switching it on grants
  access without reinstalling; this decides what the missing-permission failure tells the user,
  since that pane has no add button. *From:* upstream #65; #4 (attribution settled, the re-grant path
  not). *Proves it:* deny the prompt, open the pane, find the entry, switch it on, and the next
  lookup succeeds (note whether the helper must restart). *Disproves it:* no entry appears, so the
  failure must instead tell the user to reset the grant.
- **CON-V11** (permission prompts) Under the host that refused silently in #4, the helper's Contacts
  authorisation status reads as denied or restricted rather than authorised with an empty store, so
  the failure is still named. *From:* upstream #65; #4 ("a host refused silently without a
  prompt"). *Proves it:* launch the server from that host, call
  `CNContactStore.authorizationStatus(for: .contacts)` and a lookup: the status is not
  `.authorized` and the lookup fails with a permission error. *Disproves it:* the status reads
  authorised while fetches return nothing.

### Credits

- **ANierbeck:** the inventory of injection sites, including the unescaped contact search name.
- **boutquin:** results cross the process boundary as structured data; namesakes keep their own
  details.
- **chrischall:** finding a contact by email address; returning email addresses as well as phones.
- **faces-sh:** Contacts.framework is the only workable route, with no scripted fallback; every
  contact carries its stable identifier; contacts without email or phone are listed and say so;
  the full-name match comes first; no cache, so an edit shows at once.
- **fpjnijweide:** contacts without phones and their email addresses and birthdays are returned; a
  write is refused unless it has exactly one target; dates are built from components, never parsed
  from locale text.
- **KassebaumEngineering:** name matching at word boundaries, the most precise match first.
- **morquis:** full contact records with every kind of labelled detail; a fixed two-way label
  vocabulary with custom labels kept; the contact note is never offered; writes through
  Contacts.framework, read back by the returned identifier; replacement patterns as a hostile-input
  case on every write path.
- **nivra:** every contact store call has a time budget and a named timeout; a failure is never an
  empty list.
- **tomsr73 (long tail):** a name never matches letters inside another word.
- **upstream PR #49:** search values passed as data, never spliced into a script; read the value,
  not a reference to it.

## Messages

### Scenario backlog

#### listing recent chats

- [ ] **MSG-01** [acceptance] lists one row per chat, group chats included and marked as groups, newest first · — · faces-sh `cad640a`, `ccc9f55`, `20c7fa3`, `0736b63`; upstream #3, #62
- [ ] **MSG-02** [acceptance] given a chat holding only the user's own failed sends, leaves it out: a failed send is not real traffic · NN4 · faces-sh `6e4b47a`, `9852b0e`, `ac0058a`

#### reading messages

- [ ] **MSG-03** [acceptance] given Full Disk Access is not granted, fails as a missing permission that names Full Disk Access and the app to grant it to, never as an empty result · NN5, NN3 · ANierbeck `768c941`; faces-sh `ac53e87`, `4c3096d`, `42c2fd7`; morquis `96759b3`, `d76f3ec`; upstream #62, #65, #71
- [ ] **MSG-04** [acceptance] given the message store exists but cannot be opened, fails rather than reporting no messages · NN3 · faces-sh `42c2fd7`, `ac0058a`; upstream #66, #58, #69
- [ ] **MSG-05** [acceptance] given no message store exists on this Mac, fails as not found rather than as a missing permission (after MSG-V13) · NN5 · faces-sh `42c2fd7`, `ac0058a`; upstream #66

#### reading a chat

- [ ] **MSG-06** [acceptance] given the other person uses an email-address handle, reports their messages · — · chrischall `2e06954`, `fa61e37`, `f1f2bb1`; upstream #62
- [ ] **MSG-07** [acceptance] includes the messages the user sent, marked as from the user (after MSG-V1) · — · morquis `96759b3`; upstream #62
- [ ] **MSG-08** [acceptance] given a phone number, shows both sides of that person's newest chat and names their other chats · — · faces-sh `cad640a`, `ccc9f55`, `20c7fa3`, `0736b63`; upstream #3, #62
- [ ] **MSG-09** [acceptance] given digits that match several people's handles, refuses and lists the candidates: two people are never merged · — · morquis `4e257c8`, `96759b3`

#### reading a chat by name

- [ ] **MSG-10** [acceptance] given a name that resolves to one person, returns the most recent messages with that person in time order · — · upstream #3
- [ ] **MSG-11** [acceptance] given two people's names, opens the newest chat that holds both of them · — · faces-sh `cad640a`, `ccc9f55`, `20c7fa3`, `0736b63`
- [ ] **MSG-12** [acceptance] given contacts cannot be read, fails as a missing Contacts permission rather than saying nobody has that name · NN5 · faces-sh `cad640a`, `0d381f9`, `68cd07b`, `9852b0e`; upstream #48

#### reading a chat for a range

- [ ] **MSG-13** [acceptance] given a start and end date, returns every message between them up to the raised ceiling and says which range it covered · — · faces-sh `1fa9dc5`, `64dac13`

#### listing unread messages

- [ ] **MSG-14** [acceptance] given more unread messages than the limit, reports how many are unread in total · — · faces-sh `54c30e3`, `799d643`, `16172e8`, `ccc9f55`
- [ ] **MSG-15** [acceptance] given many unread messages from one sender or many, reads the address book once per request to name the senders · — · faces-sh `0216d96`; morquis `d76f3ec`; upstream #58
- [ ] **MSG-16** [acceptance] given contacts cannot be read, still lists the messages under their handles and says names were unavailable · — · faces-sh `799d643`, `ccc9f55`

#### searching messages

- [ ] **MSG-17** [acceptance] given the people's names, ranks their shared chat above a message that merely mentions them · — · faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`
- [ ] **MSG-18** [acceptance] given messages the user sent to a group chat, includes them · — · faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`
- [ ] **MSG-19** [acceptance] names the chat each hit came from · — · faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`
- [ ] **MSG-20** [acceptance] given the search stopped before the oldest message, says how far back it reached · — · faces-sh `54c30e3`, `799d643`, `16172e8`, `ccc9f55`
- [ ] **MSG-21** [acceptance] given nothing matches, suggests reading a chat by the people's names · — · faces-sh `616cefe`, `049af46`, `6fe0c03`

#### sending a message

- [ ] **MSG-22** [acceptance] given sending messages is not enabled, refuses and says which setting enables it: writes are off by default · NN2, NN5 · brightline `859a9c8`
- [ ] **MSG-23** [acceptance] given the user has not confirmed this send, refuses and sends nothing · NN2 · brightline `859a9c8`
- [ ] **MSG-24** [acceptance] given a recipient the user has never messaged, refuses and names the contacts they probably meant · NN4 · ANierbeck `813c232`; morquis `d76f3ec`; upstream #48
- [ ] **MSG-25** [acceptance] given a number that belongs to no contact and was never messaged, refuses: recipients must be known · NN4 · faces-sh `ddf6cb1`, `9852b0e`, `ac0058a`; upstream #48
- [ ] **MSG-26** [acceptance] given a number never messaged that belongs to a contact the user reaches on another handle, refuses and names the contact, never the handle they write from: a refusal is not a way to read contact details out of the machine · NN4 · faces-sh `ddf6cb1`, `9852b0e`, `ac0058a`; #16, ADR-0005
- [ ] **MSG-27** [acceptance] refuses to reroute to another number on its own: a changed number would reach a phone the person no longer holds · NN4 · faces-sh `ddf6cb1`, `9852b0e`, `ac0058a`
- [ ] **MSG-28** [acceptance] given contacts cannot be read, refuses to send to a number never messaged rather than allowing it · NN4 · faces-sh `ddf6cb1`, `9852b0e`, `ac0058a`
- [ ] **MSG-29** [acceptance] given an email-address handle the user has messaged before, sends to it: a handle is not always a phone number · NN4 · ANierbeck `cd72bdf`, `fc893d7`
- [ ] **MSG-30** [acceptance] given a number that fits known handles in two countries, refuses before anything is sent and asks for the country code · NN4 · faces-sh `784db41`, `9609cb4`, `ad467f8`, `ac0058a`, `a663d12`; upstream #24, #48
- [ ] **MSG-31** [acceptance] given a recipient that is neither a handle nor a resolvable name, refuses and says nothing was sent · NN4 · faces-sh `20c7fa3`, `0736b63`, `9852b0e`, `39b7e40`; upstream #48, #66
- [ ] **MSG-32** [acceptance] given a number not on the send allowlist, refuses and says which setting allows it · NN4, NN5 · KassebaumEngineering `13fd400`; upstream #48; #16, #19
- [ ] **MSG-96** [acceptance] given a handle known only from a group chat the user has real traffic in, refuses to message that person privately: a group chat is a chat, not a licence · NN4 · ADR-0005, #16
- [ ] **MSG-99** [acceptance] reports the recipient by contact name and chat identifier and never by the handle addressed: the user already saw the handle in the confirmation, and a printed handle would make every send a way to read contact details out of the machine · NN4 · ADR-0005, #17
- [ ] **MSG-33** [acceptance] given a body containing quotes, backslashes, line breaks and script syntax, delivers exactly that text and runs nothing · NN1 · faces-sh `784db41`, `42c2fd7`, `39b7e40`; upstream #48
- [ ] **MSG-34** [acceptance] given a body containing text shaped like an internal reference, sends that text literally · NN1 · faces-sh `455d4ba`
- [ ] **MSG-35** [acceptance] given Automation control of Messages is denied, fails as a missing permission that names Automation > Messages (after MSG-V15) · NN5 · faces-sh `ac53e87`, `4c3096d`, `42c2fd7`; upstream #65, #71
- [ ] **MSG-36** [acceptance] given the store shows the outgoing message left with no error, reports it sent, naming the recipient by contact name and chat identifier · NN3 · faces-sh `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`; upstream #48, #66, #24; #17
- [ ] **MSG-37** [acceptance] given the store records the outgoing message with a delivery error, reports it not sent and names the error (after MSG-V8) · NN3 · faces-sh `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`; upstream #66, #24
- [ ] **MSG-38** [acceptance] given the send raised no error but no outgoing message to that recipient appears in the store, reports the outcome as unconfirmed · NN3 · chrischall `fa61e37`, `209f3a4`; morquis `d76f3ec`
- [ ] **MSG-39** [acceptance] given no outgoing record for that recipient appears, reports that it does not appear to have been sent and warns against sending twice (after MSG-V7, MSG-V8) · NN3 · faces-sh `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`; upstream #66, #24
- [ ] **MSG-40** [acceptance] given the store cannot be read after the send, reports the outcome as unconfirmed rather than as sent or failed · NN3 · faces-sh `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`; upstream #24, #66
- [ ] **MSG-41** [acceptance] given Messages stops answering, still checks the store before reporting anything · NN3 · faces-sh `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`
- [ ] **MSG-42** [acceptance] given a recipient without iMessage, refuses by name and sends nothing: v1 carries a send over iMessage only · — · gene-jelly `b99bbce`; upstream #24; #18

#### sending a message by name

- [ ] **MSG-43** [acceptance] given the name fits several people, sends nothing and lists who they could be · NN4 · faces-sh `20c7fa3`, `0736b63`, `9852b0e`, `39b7e40`; upstream #48
- [ ] **MSG-44** [acceptance] given a name that resolves to exactly one person with one handle the user has real traffic with, sends to that handle and reports the recipient by contact name and chat identifier · NN4 · faces-sh `20c7fa3`, `0736b63`, `9852b0e`, `39b7e40`; upstream #24; #17
- **MSG-45** [acceptance] given a recipient that is a name rather than a handle, refuses and lists the contacts that name matches · **rejected by #17**: names are accepted and must resolve to exactly one recipient; refusing them pushes users back to pasting phone numbers, and MSG-44 and MSG-62 carry the behaviour · upstream #48

#### sending a message to several people

- [ ] **MSG-46** [acceptance] given the only chat they share also holds others, sends nothing and names the others · NN4 · faces-sh `20c7fa3`, `0736b63`, `9852b0e`, `39b7e40`
- [ ] **MSG-47** [acceptance] given they share more than one chat, sends nothing: a message must not go to the wrong chat · NN4 · faces-sh `20c7fa3`, `0736b63`, `9852b0e`, `39b7e40`

#### sending a message into a chat

- [ ] **MSG-48** [acceptance] given a chat with no real traffic in it, refuses · NN4 · faces-sh `ddf6cb1`, `9852b0e`, `ac0058a`; ADR-0005
- [ ] **MSG-97** [acceptance] given several names that no single existing chat holds exactly, refuses and creates no chat: the server never creates a chat · NN4 · #16, #17

#### a handle

- [ ] **MSG-52** [domain] given a phone number with an international prefix, keeps its country code · — · chrischall `2e06954`, `fa61e37`, `f1f2bb1`
- [ ] **MSG-53** [domain] given an email address, keeps it unchanged as the handle · — · chrischall `2e06954`, `fa61e37`, `f1f2bb1`

#### matching an address to known handles

- [ ] **MSG-54** [domain] never returns a handle that is not already stored · NN4 · faces-sh `784db41`, `9609cb4`, `ad467f8`, `ac0058a`, `a663d12`; upstream #24, #48
- [ ] **MSG-55** [domain] given a national number whose digits end two different stored numbers in different countries, reports it as ambiguous · NN4 · faces-sh `784db41`, `9609cb4`, `ad467f8`, `ac0058a`, `a663d12`; upstream #24, #48
- [ ] **MSG-56** [domain] gives the same answer whatever region the Mac is set to · NN4 · faces-sh `784db41`, `9609cb4`, `ad467f8`, `ac0058a`, `a663d12`
- [ ] **MSG-57** [domain] given a spelling with punctuation, matches the E.164 handle with the same digits · — · faces-sh `784db41`, `9609cb4`, `ad467f8`, `ac0058a`, `a663d12`

#### a person's handles

- [ ] **MSG-58** [domain] given a contact card that spells a number with punctuation, ranks it by the history stored under its E.164 form · — · faces-sh `cad640a`, `0d381f9`, `68cd07b`, `9852b0e`; upstream #48

#### a name resolution

- [ ] **MSG-59** [domain] given exactly one matching card, resolves to that person however long since they were in touch · — · faces-sh `cad640a`, `0d381f9`, `68cd07b`, `9852b0e`
- **MSG-60** [domain] given several matching cards and only one in touch, resolves to the one in touch · **rejected by #17**: recency never picks among namesakes on a send; MSG-62 refuses and names the candidates · faces-sh `cad640a`, `0d381f9`, `68cd07b`, `9852b0e`
- [ ] **MSG-61** [domain] given several matching cards all in touch, asks which one and names each by contact name alone: last-contact times are contact detail a refusal must not hand over · NN4 · faces-sh `cad640a`, `0d381f9`, `68cd07b`, `9852b0e`; #17, ADR-0005
- [ ] **MSG-62** [domain] given a name that fits several contacts, refuses and names each candidate · NN4 · fpjnijweide `93daf09`, `48cd701`; long-tail/tomsr73 `35e211d`; upstream #48
- [ ] **MSG-63** [domain] given no card matches, reports the name as unknown rather than claiming there are no messages · NN3 · faces-sh `cad640a`, `0d381f9`, `68cd07b`, `9852b0e`
- [ ] **MSG-64** [domain] given two cards share a surname, never merges their handles · NN4 · faces-sh `cad640a`, `0d381f9`, `68cd07b`, `9852b0e`; upstream #48
- [ ] **MSG-65** [domain] given "dad", does not match a contact named Trinidad: names match whole words only · NN4 · long-tail/tomsr73 `35e211d`; upstream #48
- [ ] **MSG-66** [domain] given a contact with several numbers and no real traffic on any, refuses: the intended number is unknown · NN4 · fpjnijweide `93daf09`, `48cd701`; ADR-0005
- [ ] **MSG-98** [domain] given several candidates, names each by contact name alone and never by a handle: a refusal is not a way to read contact details out of the machine · NN4 · ADR-0005, #17

#### real traffic

- [ ] **MSG-67** [domain] given only the user's own undelivered messages to a handle, counts that handle as never in touch · NN4 · faces-sh `6e4b47a`, `9852b0e`, `ac0058a`
- [ ] **MSG-68** [domain] given a message the other person sent, counts it as real traffic · — · faces-sh `6e4b47a`, `9852b0e`, `ac0058a`

#### a chat

- [ ] **MSG-69** [domain] given a group chat that has shrunk to one other person, is still a group chat (after MSG-V2) · — · faces-sh `cad640a`, `ccc9f55`, `20c7fa3`, `0736b63`

#### an attributed body

- [ ] **MSG-70** [domain] given a typedstream blob, decodes the message text exactly · — · upstream #62
- [ ] **MSG-71** [domain] given accented text, non-Latin script and emoji, decodes it intact · — · faces-sh `cad640a`; morquis `96759b3`; upstream #62
- [ ] **MSG-72** [domain] given a body longer than 127 bytes, reads its multi-byte length and decodes the full text · — · faces-sh `cad640a`; morquis `96759b3`; #21
- [ ] **MSG-73** [domain] given an audio message, finds the transcript among the archive's own attribute names · — · faces-sh `cad640a`
- [ ] **MSG-74** [domain] given a length that overruns the blob, yields nothing rather than garbage · — · faces-sh `cad640a`
- [ ] **MSG-75** [domain] given plain text that is only the object-replacement placeholder, reads the text from the archive · — · morquis `96759b3`
- [ ] **MSG-100** [domain] given a truncated blob, reports no readable text as a named failure rather than crashing · NN5 · #21
- [ ] **MSG-101** [domain] given a cycle in the archive's back-references, stops rather than following it forever · — · #21
- [ ] **MSG-102** [domain] given a declared length larger than the whole blob, reads nothing past the blob · — · #21
- [ ] **MSG-103** [domain] never creates an object because the archive names its class: a stranger's message chooses nothing inside this process · NN1 · #21
- [ ] **MSG-104** [domain] given nesting deeper than the bound, stops at the bound and reports no readable text · — · #21

#### a message timestamp

- [ ] **MSG-76** [domain] given nanoseconds since 2001-01-01, reports the same instant in UTC · — · morquis `96759b3`
- [ ] **MSG-95** [domain] converts a moment to Apple-epoch nanoseconds and back without loss: the store's own unit, so a send check compares like with like · — · faces-sh `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`; upstream #66, #24

#### a range

- [ ] **MSG-77** [domain] given a bare end date, includes the whole of that day · — · faces-sh `1fa9dc5`, `64dac13`
- [ ] **MSG-78** [domain] given a date, starts at local midnight rather than UTC midnight · — · faces-sh `1fa9dc5`, `64dac13`
- [ ] **MSG-79** [domain] given a date the calendar does not have, refuses it rather than rolling over · — · faces-sh `1fa9dc5`, `64dac13`

#### a search query

_[#24](https://github.com/that-mathevs/apple-native-mcp/issues/24) settles MAIL-C10: this is one
grammar, in one domain module, shared with Mail search (MAIL-71). Messages has no default range,
because its store answers quickly._

- [ ] **MSG-80** [domain] given bare words, treats each as optional and ranks messages matching more of them higher · — · faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`
- [ ] **MSG-81** [domain] given a quoted phrase, matches it only as consecutive words · — · faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`
- [ ] **MSG-82** [domain] given a word prefixed with a minus, excludes any message containing it · — · faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`
- **MSG-83** [domain] given capitalised OR between phrases, treats it as an operator rather than a word · **rejected by #24**: the settled grammar is quoted phrases, a leading `-`, remaining words optional and ranking, case and diacritics folded, and every other character literal — there is no OR · faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`
- [ ] **MSG-84** [domain] given an empty query, matches nothing rather than everything · — · faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`
- [ ] **MSG-85** [domain] ignores accents and case · — · faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`

#### the message store

_[ADR-0002](../adr/0002-helper-owns-every-protected-access.md) moves this port behind the helper
protocol: the store is opened and queried inside the Swift helper, so these prepared statements are
Swift. The behaviours stand as written._

- [ ] **MSG-86** [contract] opens the store read-only: no query can change it · NN1 · ANierbeck `768c941`; faces-sh `784db41`, `42c2fd7`, `39b7e40`
- [ ] **MSG-87** [contract] given a handle containing quotes and SQL keywords, matches it literally and returns only that handle's messages · NN1 · ANierbeck `768c941`
- [ ] **MSG-88** [contract] given a handle pattern with wildcard characters, matches them literally · NN1 · morquis `4e257c8`, `96759b3`
- [ ] **MSG-89** [contract] given an email address the user has messaged, finds that handle · — · morquis `4e257c8`, `96759b3`
- [ ] **MSG-90** [contract] given a person who is in a group chat and a one-to-one chat, lists the two as separate chats · — · morquis `96759b3`
- [ ] **MSG-91** [contract] given a reaction to a message, does not list it as a message · — · morquis `96759b3`
- [ ] **MSG-92** [contract] given a send just made, finds only outgoing messages to that recipient newer than the moment of sending · NN3 · faces-sh `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`
- [ ] **MSG-93** [contract] given a query while Messages holds a write lock, retries briefly and then fails rather than hanging · — · faces-sh `431f4b1`

#### the message sender

- [ ] **MSG-94** [contract] given a recipient containing a backslash followed by a quote, treats it as part of the recipient and runs nothing else · NN1 · chrischall `2e06954`, `18660e4`, `88b58d0`, `bf6dc37`, `29af0a2`, `60f9977`, `91e0101`, `6831a90`, `1a358d6`, `fa61e37`
- [ ] **MSG-105** [contract] addresses an existing chat by its identifier or a service-scoped handle, never Messages' app-level name form: the name form creates ghost chats · NN1, NN4 · upstream #48; #17

### Conflicts

#### MSG-C1 Decoding the text of a message from its attributedBody

- **Options:**
  - Regexes over the blob's bytes or hex, then scrubbing their own artefacts: upstream #62; kept
    unchanged by ANierbeck `768c941`, chrischall `f1f2bb1` and faces-sh `431f4b1` (`oss-cleanup`).
  - Marker heuristic: find `NSString`, skip a fixed 5-byte preamble, read a 1-byte or `0x81` +
    2-byte length, decode UTF-8; prefer `text` unless it is U+FFFC: morquis `96759b3`.
  - Frame scan: every `+` followed by a 1-, 2- or 3-byte length, skip overruns and U+FFFD, take
    the first string that isn't archive bookkeeping: faces-sh `cad640a`.
  - A real typedstream decoder (plan.md "How each app is reached"): no fork built one.
- **Recommendation:** Build a pure domain decoder that walks the typedstream structure rather than
  scanning it, seeded with faces-sh's eight fixtures and morquis' umlaut, emoji and `0x81` cases.
  The regex produced mojibake and "not readable" bodies (upstream #62); morquis has no 3-byte
  length and a fixed preamble (MSG-V4); faces-sh's "first non-bookkeeping string" is the best
  evidence so far but unproven for mentions, rich links, edits and inline replies (MSG-V3).
- **Settled by [#21](https://github.com/that-mathevs/apple-native-mcp/issues/21):** we write our
  own typedstream decoder, in Swift, inside the helper ([ADR-0002](../adr/0002-helper-owns-every-protected-access.md)).
  It walks the archive's structure, is total, and bounds depth, length and total size, because a
  message body is attacker-controlled input. `NSUnarchiver` is excluded because it instantiates
  classes named in the data (MSG-103). #21 also absorbs MSG-V3 and MSG-V4 as decoder fixtures
  (MSG-100 to MSG-104).

#### MSG-C2 Reading the message store without a shell

- **Options:**
  - `exec` of the `sqlite3` CLI with the SQL inside a shell string: upstream #62.
  - `execFile`/`spawn` of `sqlite3` with argv, SQL still built from strings with escaping or
    digit filters: brightline `859a9c8`; chrischall `2e06954`, `fa61e37`, `f1f2bb1`; faces-sh
    `784db41`, `42c2fd7` (read-write), `431f4b1` (`-readonly` and a timeout).
  - An in-process driver opened read-only with prepared statements: ANierbeck `768c941`
    (`bun:sqlite`); morquis `96759b3` (`better-sqlite3`, `query_only`).
- **Recommendation:** `node:sqlite` opened read-only, prepared statements only. It keeps
  ANierbeck's and morquis' safety without tying the server to Bun or a native addon, and avoids
  the CLI round-trip that pushed about 48 MB of hex through stdout on every faces-sh search.
- **Needs a human decision:** No — NN1 and plan.md's Messages (read) row already decide it.

#### MSG-C3 What a read of "someone's messages" is scoped to

- **Options:**
  - Messages whose `handle_id` matches, inner-joined to `handle`: upstream #62 (drops sent and
    group messages).
  - Every chat the handle belongs to, merged into one stream: morquis `96759b3`.
  - One chat as the unit: the newest chat by default, the person's other chats named:
    faces-sh `cad640a`, `ccc9f55`, `20c7fa3`, `0736b63`; a membership-and-window-function variant
    in faces-sh `431f4b1`.
- **Recommendation:** The chat as the unit (faces-sh `main`). Merging showed one person's side of
  three group chats interleaved as a single "conversation" (faces-sh C19), and a merged stream
  gives the agent nothing it can reply into. MSG-V1 confirms the joins.
- **Needs a human decision:** No — both reports' verdicts reject merging, and the symptom evidence
  settles it.

#### MSG-C4 Matching a typed number or address to a stored handle

- **Options:**
  - Assume the US and prefix `+1`: upstream #62, #24; chrischall `f1f2bb1`.
  - Candidate spellings with the author's trunk prefix hard-coded, then `LIKE '%digits%'` and
    unescaped `LIKE ?` fallbacks: morquis `4e257c8`, `96759b3`.
  - Parse with the Mac's region and always send E.164: faces-sh `784db41`, `9609cb4`.
  - Match only strings already in the store, region-independent; a shared-suffix match counts
    only when every hit is the same number, otherwise the address is ambiguous: faces-sh
    `ad467f8`, `a663d12`, `ac0058a`.
  - Compare the last ten digits: KassebaumEngineering `13fd400`.
  - Either number containing the other, via a contact lookup: ANierbeck `813c232`.
  - A phone-only regex that rejects email handles: ANierbeck `cd72bdf`.
- **Recommendation:** faces-sh's region-independent match against stored handles. Using the Mac's
  region sent a message to a stranger in another country (faces-sh C22). Last-ten-digit and
  containment matching merge different numbers, and phone-only rules lose email handles
  (ANierbeck C2, chrischall C15). The Contacts group's "apply the user's region" rule (morquis C8
  verdict, upstream #35) must not be what picks a handle to send to.
- **Needs a human decision:** No — the mis-send evidence and NN4 decide it. The Contacts group
  should know its phone-number normalisation is not the send-path matcher.

#### MSG-C5 Who may be messaged

- **Options:**
  - Anyone: the recipient string goes straight to Messages: upstream #48.
  - A contact card with a loosely matching number, or an operator allowlist; an environment
    switch turns it off, and `schedule` skips it: ANierbeck `813c232`.
  - Only an explicit allowlist file; a missing or corrupt file blocks every send:
    KassebaumEngineering `13fd400`.
  - A buddy must already exist on the iMessage service: morquis `d76f3ec`.
  - Allowed unless the number belongs to a contact who writes from another handle; allowed when
    Contacts can't be read: faces-sh `ddf6cb1`, `9852b0e`, `ac0058a`.
- **Recommendation:** NN4 strictly: send only to a stored handle with real traffic (faces-sh
  C23's definition, so failed sends never qualify), fail closed, and use faces-sh's wrong-number
  refusal to name the handle the person really uses. An explicit allowlist is an optional setting
  on top. Admitting any contact card (ANierbeck) or failing open (faces-sh) both let a
  prompt-injected "text this number" through.
- **Settled by [#16](https://github.com/that-mathevs/apple-native-mcp/issues/16)
  ([ADR-0005](../adr/0005-a-known-recipient-is-one-with-real-traffic.md)):** a handle is known only
  when the store shows **real traffic** with it — an incoming message, or an outgoing one the store
  shows as sent or delivered. A contact card alone is never enough, however it got there, and ghost
  chats and failed sends never qualify. One incoming message is enough. A group chat qualifies as a
  chat and never as a licence to message a member privately (MSG-96), and the server can't create a
  chat (MSG-97). An allowlist narrows the rule and can never widen it
  ([#19](https://github.com/that-mathevs/apple-native-mcp/issues/19)).

#### MSG-C6 Whether a send accepts a name, and how a name becomes one person

- **Options:**
  - Only handles are accepted and names are refused: upstream #48; faces-sh `20c7fa3` (the
    last-resort guard in the sender); ANierbeck `cd72bdf`.
  - The first contact whose name contains the text, and its first number: fpjnijweide `93daf09`,
    `48cd701`; the maintainer's suggestion in upstream #24.
  - Whole-word prefix matching, first hit wins: long-tail/tomsr73 `35e211d`.
  - Resolve to one person, several (a question), unknown, or cannot ask; recency breaks ties among
    several; several names must land on one chat with nobody else in it: faces-sh `cad640a`,
    `0d381f9`, `68cd07b`, `9852b0e`, `0736b63`.
- **Recommendation:** Accept names, use faces-sh's four outcomes with tomsr73's whole-word
  matching (faces-sh's own card match is a substring match, so a short name can hit inside
  another), and refuse every ambiguity on a send. Contains-first-hit is exactly the ghost-recipient
  failure of upstream #48.
- **Settled by [#17](https://github.com/that-mathevs/apple-native-mcp/issues/17):** a send accepts
  a handle, a contact name or an existing chat, and it must resolve to exactly one recipient.
  Names are accepted (MSG-45 is rejected), matching is at word boundaries with case and diacritics
  folded, and recency never picks among namesakes (MSG-60 is rejected in favour of MSG-62). The
  **result** names the recipient by contact name and chat identifier, never by handle (MSG-36,
  MSG-44, MSG-99) — which is not the same as the **confirmation**, where ADR-0004 shows the user
  the resolved handle and the whole body before anything is sent.

#### MSG-C7 How a send's outcome is established

- **Options:**
  - Report "sent" whatever happened: upstream #48, #24, #66; morquis `d76f3ec`; faces-sh
    `431f4b1`.
  - Sent if the script raised no error, failed otherwise: chrischall `fa61e37`, `209f3a4`.
  - Poll the store for our outgoing row (Apple-epoch nanoseconds, our recipient, after our start),
    treat a script timeout as no verdict, and report error, sent or "not sent"; an unreadable
    store is also reported as not sent: faces-sh `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`.
- **Recommendation:** faces-sh's poll, with three fixes from its quality notes: "unconfirmed" is
  its own outcome (NN3), the recipient's handles are resolved before sending, and a row that
  exists but isn't sent yet is pending, not "no record". Whether "no row within the wait" may say
  not sent (MSG-39) or only unconfirmed (MSG-38) depends on MSG-V7 and MSG-V8; until they pass,
  report unconfirmed with the warning against sending twice.
- **Needs a human decision:** No — NN3 decides the shape, and the rest is empirical.

#### MSG-C8 How the user approves a send

- **Options:**
  - No approval; a recipient gate stands in for it: ANierbeck `813c232`; KassebaumEngineering
    `13fd400`; faces-sh `20c7fa3` names the handle addressed, but only after sending.
  - Ask the client's model through MCP sampling and approve any reply containing "yes", with an
    environment switch that skips it: brightline `859a9c8`.
- **Recommendation:** Neither. Sampling asks a model that shares the possibly injected context, and
  substring matching approves "no, I would not say yes". Confirm each send with the user, showing
  the resolved handle and the body, as #5's findings allow.
- **Settled by [#9](https://github.com/that-mathevs/apple-native-mcp/issues/9)
  ([ADR-0004](../adr/0004-sends-require-elicitation.md)):** every send is confirmed through MCP
  elicitation, which shows the resolved recipient, how it was resolved, the service and the whole
  body, never truncated, as untrusted content (X-76). A client that doesn't declare elicitation is
  not offered the send tools at all, and no setting turns them on (X-72, X-73, X-78). The form
  carries a required field, so a client that auto-accepts an empty form is a decline (X-74). Accept
  or decline only (X-75, X-77), and no prepare/confirm tool pair (X-92). X-31 stands as written.

#### MSG-C9 Scheduled sends

- **Options:**
  - An in-process timer with no checks: upstream (upstream.md open question 11); morquis
    `d76f3ec`; faces-sh `42c2fd7` (`main`, where an unreadable time or a delay over about 24.8
    days sends at once).
  - An in-process timer that refuses unreadable times and delays beyond the timer's limit, and
    says the schedule isn't persisted: faces-sh `431f4b1`.
  - No scheduling at all: chrischall `209f3a4`.
- **Recommendation:** Leave scheduling out of v1. No fork persisted a schedule, none could confirm
  a send that fires after the tool call returned (NN3), and ANierbeck `813c232`'s guard skipped
  scheduled sends entirely. If it is kept, the schedule must outlive the server and the recipient
  check and confirmation must happen when scheduling (MSG-49 to MSG-51).
- **Settled by [#18](https://github.com/that-mathevs/apple-native-mcp/issues/18):** scheduled
  sends are out of v1 and have no tool at all, so MSG-49 to MSG-51 move to **Out of scope**. Doing
  it properly needs persistence, a runner and its own confirmation model. `plan.md` Phase 3 step 5
  is updated.

#### MSG-C10 Addressing the recipient inside the send script

- **Options:**
  - App-level `buddy "<x>"`: upstream #48; faces-sh `39b7e40` (`main`).
  - `buddy "<x>" of targetService`: faces-sh `431f4b1` (`oss-cleanup`).
  - `buddies.whose({handle})` on the first iMessage service, refusing when none exists: morquis
    `d76f3ec`.
  - `send … to chat id "<guid>"` for an existing chat: faces-sh `20c7fa3`, `0736b63`.
- **Recommendation:** Address the existing chat by its guid when one holds exactly the recipients,
  otherwise a service-scoped handle; never the app-level form, which creates ghost chats
  (upstream #48, MSG-V5). MSG-V6 confirms which forms still resolve on macOS 14 and 26.
- **Needs a human decision:** No — MSG-V5 and MSG-V6 decide it.

#### MSG-C11 A read that cannot reach the message store

- **Options:**
  - Catch every error and return an empty list: upstream #66, #62; morquis `96759b3`, `d76f3ec`.
  - One access check that blames Full Disk Access for every cause: upstream #62 (as described in
    faces-sh C5).
  - Cut the Full Disk Access guidance to one line: ANierbeck `768c941`.
  - Split a denial, a missing store and a broken store, keep the driver's own words, and check
    before every read and every send: faces-sh `42c2fd7`, `ac0058a`.
- **Recommendation:** faces-sh's split, re-derived for `node:sqlite`'s error codes (MSG-V13).
- **Needs a human decision:** No — NN3 and NN5 decide it.

#### MSG-C12 Putting names on messages

- **Options:**
  - One whole-address-book lookup per message: upstream #58.
  - One batch read per request, deliberately not cached across calls: faces-sh `0216d96`.
  - A short cache that shares in-flight scans: faces-sh `431f4b1`.
  - Two bulk column reads over Apple Events: morquis `d76f3ec`.
- **Recommendation:** One batch per request through the Contacts port (Contacts.framework per
  plan.md), with no cache across calls: a contact added a moment ago must be named, and the cost
  that motivated caching goes away without Apple Events.
- **Needs a human decision:** No — the measured timings and the stale-name case decide it.

#### MSG-C13 Reading a range

- **Options:**
  - Compare local-time strings built in SQL: morquis `96759b3`.
  - Build local instants in Apple-epoch nanoseconds, cover a bare end date's whole day, silently
    ignore an unreadable date and echo what was understood: faces-sh `1fa9dc5`, `64dac13`.
- **Recommendation:** faces-sh's instants, but refuse an unreadable or impossible date (the
  report's verdict): ignoring it answers a different question than the one asked.
- **Needs a human decision:** No — the report's verdict and MSG-79 settle it.

### Verification tasks

Every task below stands alone and can become a ticket, except those tagged (permission prompts).
None concern the Notes or Mail mechanisms (#6, #7).

- **MSG-V1** In `chat.db`, an outgoing message in a one-to-one chat carries the other party's
  `handle_id`, an outgoing message in a group chat carries `handle_id` 0, and every message of a
  chat is reachable through `chat_message_join`. *From:* faces-sh `cad640a`, `ccc9f55`,
  `20c7fa3`, `0736b63`, `431f4b1`; upstream #62. *Proves it:* on a Mac with both kinds of chat,
  query outgoing rows per chat (joined through `chat_message_join`) and see the 1:1 rows carry the
  partner's handle ROWID, the group rows carry 0, and no row of either chat lacks a join row.
  *Disproves it:* outgoing one-to-one rows carry 0 (the `oss-cleanup` claim), group rows carry a
  handle, or some messages have no `chat_message_join` row.
- **MSG-V2** `chat.style` is 43 for a group chat and 45 for a one-to-one chat, whatever the
  current number of participants. *From:* faces-sh `cad640a`. *Proves it:* every chat with a
  `display_name` or more than one participant has style 43, a group chat left with one other
  participant still has 43, and every direct chat has 45. *Disproves it:* any group chat has 45,
  or the style changes when participants leave.
_**MSG-V3** (the first non-bookkeeping string is the text for a mention, a rich link, an edit and
an inline reply; faces-sh `cad640a`) and **MSG-V4** (strings are framed by a 1-byte, `0x81`+2-byte
or `0x82`+3-byte length; morquis `96759b3`, faces-sh `cad640a`) are no longer verification tasks.
[#21](https://github.com/that-mathevs/apple-native-mcp/issues/21) absorbs them as decoder fixtures,
because the decoder walks the format rather than scanning for markers._

- **MSG-V5** Sending through Messages' app-level `buddy "<name>"` with a string that isn't a
  registered handle raises no error, delivers nothing and creates a chat named by that string.
  *From:* faces-sh `20c7fa3`, `0736b63`, `9852b0e`, `39b7e40`; upstream #48, #24. *Proves it:*
  sending to an invented name returns without error and a new chat whose identifier is that
  string appears in `chat.db` with no delivered message. *Disproves it:* the script raises an
  error, or no chat is created.
- **MSG-V6** On macOS 14 and macOS 26, Messages' scripting dictionary still resolves `services`
  and `buddies`, and a service-scoped handle and `chat id "<guid>"` both deliver to an existing
  handle and chat. *From:* morquis `d76f3ec`; faces-sh `431f4b1`, `20c7fa3`. *Proves it:* a static
  JXA script given the handle or guid as a JSON argument sends a test message each way on both
  versions, and the outgoing row appears in the intended chat. *Disproves it:* the terms fail to
  resolve (only `accounts`/`participants` work), or a message lands in a different chat.
- **MSG-V7** After a scripted send, the outgoing message row (and the handle row, when the handle
  is new to this Mac) already exists in `chat.db` when the script returns. *From:* faces-sh
  `68cd07b`, `9852b0e`, `ac0058a`, `39b7e40`. *Proves it:* reading the store immediately after
  the script exits, in 20 sends, always finds the row. *Disproves it:* in any send the row appears
  only later, so "no row yet" can't mean "not sent".
- **MSG-V8** For a reachable iMessage recipient, `is_sent` becomes 1 within 5 s of the send, and
  for an address without iMessage Messages writes `error` 22. *From:* faces-sh `68cd07b`,
  `9852b0e`, `ac0058a`, `39b7e40`. *Proves it:* timing `is_sent` on 20 sends to a test account,
  plus one send to a number without iMessage, gives at most 5 s and error 22. *Disproves it:*
  `is_sent` regularly takes longer than 5 s, or the undeliverable send records another code or
  none.
- **MSG-V9** Sending to a bare formatted national number, such as "(555) 010-0100", makes Messages
  create a chat whose identifier is that literal string. *From:* faces-sh `784db41`, `9609cb4`,
  `ad467f8`, `ac0058a`, `a663d12`. *Proves it:* after such a send to a test number, `chat` holds a
  `chat_identifier` equal to the formatted string. *Disproves it:* the identifier is normalised to
  E.164.
- **MSG-V10** A message body containing U+201C, U+201D, U+2028 or "¬", passed as a JSON argument to
  a static send script, is delivered literally. *From:* faces-sh `784db41`, `42c2fd7`, `39b7e40`
  (claimed for its escaped script source). *Proves it:* the text read back from the store's
  outgoing row equals the input byte for byte. *Disproves it:* any character is changed, dropped
  or ends the body early.
- **MSG-V11** Decoding and ranking the newest 50,000 messages through `node:sqlite` in-process
  completes in under a second. *From:* faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896`.
  *Proves it:* a timed search over a store of at least 50,000 messages finishes under 1 s on this
  Mac. *Disproves it:* it takes longer, so search needs a bound and a coverage statement by
  default.
- **MSG-V12** On macOS 26, sending through Messages' SMS or RCS service reaches a recipient without
  iMessage, and `chat.db` records which service carried each message. *From:* gene-jelly
  `b99bbce`; upstream #24. *Proves it:* with an iPhone relaying SMS, a scripted send to a
  non-iMessage number arrives, and its row's service column reads SMS or RCS. *Disproves it:* the
  send fails or silently uses iMessage, or the store doesn't record the service.
- **MSG-V13** Opening `chat.db` read-only with `node:sqlite` fails differently for a denied Full
  Disk Access, a missing file and a corrupt file. *From:* faces-sh `42c2fd7`, `ac0058a`; morquis
  `96759b3`, `d76f3ec`. *Proves it:* each of the three conditions produces a distinct error code or
  message at open or first query. *Disproves it:* two of them give the same error, so the failure
  must be classified another way (for example by checking the file exists first).
- **MSG-V14** (permission prompts) Full Disk Access for reading `chat.db` has to be granted to the same
  responsible process #4 found for privacy prompts (`node` under Claude Desktop, the terminal app under a
  terminal), and a grant to any other process doesn't help. *From:* upstream #62; faces-sh `ac53e87`,
  `4c3096d`. *Proves it:* under each host, reads fail until that responsible process is granted Full Disk
  Access and succeed right after. *Disproves it:* a grant to a different process lets reads succeed, or
  the responsible process's grant doesn't.
- **MSG-V15** (permission prompts) Same claim as **X-V1** (-1743 denied, -1744 not yet asked), for Messages;
  tracked there. *From:* faces-sh `ac53e87`, `4c3096d`, `42c2fd7`.

### Credits

- **faces-sh:** the chat as the unit of reading, with group chats marked; decoding attributedBody
  from its framing, with real-world fixtures; a name resolving to one person or becoming a
  question, recency only breaking ties; matching addresses only to stored handles, independent of
  the Mac's region, and refusing ambiguous numbers; real traffic, so failed sends never count;
  the wrong-number refusal that names the handle the person uses and never reroutes; confirming a
  send against the store, with a timeout that is not a verdict; telling a denied, missing and
  broken message store apart; permission failures that name the setting and the app; one
  address-book read per request; stating totals and how far a search reached; empty searches that
  suggest a next step; ranges in the user's local days; a ranked search grammar over people and
  text; refusing a send to several people unless one chat holds exactly them; a read-only store
  with a bounded wait on a lock.
- **morquis:** reading through chats so sent and group messages appear; leaving reactions out;
  timestamps in Apple-epoch nanoseconds; resolving handles against the store's own values, with
  email and alphanumeric sender IDs as handles; attributedBody test data (accents, emoji,
  two-byte lengths); requiring a recipient to exist before sending.
- **ANierbeck:** a read-only message store with prepared statements; a recipient guard checked
  before every send; email addresses as valid handles.
- **KassebaumEngineering:** a fail-closed recipient allowlist whose refusal names the setting to
  change.
- **chrischall:** reading the message store without a shell; removing the in-process scheduler;
  backslash-then-quote attack strings as hostile-input fixtures.
- **brightline:** sends gated behind a setting, with a refusal that says why.
- **fpjnijweide:** the lesson that name resolution must be exact and refuse ambiguity.
- **long-tail/tomsr73:** names match whole words, never fragments of other names.
- **gene-jelly:** asking which service (iMessage, SMS, RCS) would carry a message.

## Notes

How Notes is reached (scripting vs reading `NoteStore.sqlite`) is still open and belongs to **#6**. The
acceptance and domain scenarios below work with either one. Where a scenario depends on
something #6 has to establish, it points at a `NOT-M` claim listed under Verification tasks.

### Scenario backlog

#### listing notes

- [ ] **NOT-01** [acceptance] reports a page of notes, each with its title, note folder, account, modification date and a short preview but never its whole body, and says how to read one in full · — · faces-sh `94149a2`, `dbffae5`; upstream #22
- [ ] **NOT-02** [acceptance] given more notes than one response holds, reports the first page, how many were left out and how to see the rest · — · therealap `5176aa5`; neektza `5766ff0`; upstream #67, #22
- [ ] **NOT-03** [acceptance] given a note folder, reports only the notes filed in that folder, most recently modified first · — · therealap `63bfc01`, `a675a7b`; upstream PR #28
- [ ] **NOT-04** [acceptance] reports each note with the account and note folder it belongs to: folder names repeat across accounts · — · therealap `63bfc01`, `a675a7b`; upstream PR #28
- [ ] **NOT-05** [acceptance] given a folder name that exists in two accounts and no account, refuses and names both accounts · — · morquis `05d1658`; danielk-am `9d9122c`; upstream #67; upstream PR #28
- [ ] **NOT-06** [acceptance] given a folder name that no account has, fails and names the folders that do exist rather than reporting no notes · NN3 · danielk-am `9d9122c`; therealap `63bfc01`, `a675a7b`
- [ ] **NOT-07** [acceptance] given an account that does not exist, reports it as unknown rather than as an empty folder · NN3 · morquis `05d1658`; upstream #67; upstream PR #28
- [ ] **NOT-08** [acceptance] given an account or folder name containing placeholder text, quotes or script syntax, looks it up as a literal name and runs nothing · NN1 · morquis `05d1658`
- [ ] **NOT-09** [acceptance] given the Recently Deleted folder asked for explicitly, lists the notes waiting to be deleted (after NOT-M7) · — · therealap `63bfc01`, `88c75f6`, `a675a7b`
- [ ] **NOT-10** [acceptance] given a real folder with a common name such as "Archive", includes its notes: no folder is left out because of its name · — · therealap `2efb44b`
- [ ] **NOT-11** [acceptance] given access to Notes has not been granted, fails with a permission failure that names the setting to change and the app to allow · NN5 · danielk-am `9d9122c`; upstream #43, #44
- [ ] **NOT-12** [acceptance] given Notes is not running, lists the notes without bringing Notes to the front (after NOT-V1) · — · ANierbeck `3005df4`
- [ ] **NOT-13** [acceptance] given Notes does not become ready in time, fails saying Notes did not start rather than reporting no notes (after NOT-V1) · NN3 · ANierbeck `3005df4`

#### searching notes

- [ ] **NOT-14** [acceptance] given text that appears only deep in a note's body, finds that note · — · KassebaumEngineering `1d47e74`; chrischall `68dc2b7`, `91e0101`; morquis `05d1658`; neektza `5d0e84a`; upstream #67, #22; upstream PR #28
- [ ] **NOT-15** [acceptance] given text that appears only in a note's title, finds that note · — · faces-sh `0216d96`; upstream #67, #44, #43
- [ ] **NOT-16** [acceptance] given three notes that mention the term, reports all three, each with its title and a preview of its text · — · therealap `220462c`, `a675a7b`; upstream #67
- [ ] **NOT-17** [acceptance] given a matching note beyond the first hundred, finds it: the whole library is searched, never a capped prefix · — · neektza `5d0e84a`
- [ ] **NOT-18** [acceptance] given more matches than the limit, reports the first page and says how many more there are · — · KassebaumEngineering `1d47e74`; neektza `5d0e84a`; upstream #67
- [ ] **NOT-19** [acceptance] given one note titled with the term and another mentioning it only in its body, lists the titled note first · — · fpjnijweide `93daf09`
- [ ] **NOT-20** [acceptance] given no match but a note with a similar title, offers it as a suggestion kept apart from the results · — · neektza `5d0e84a`
- [ ] **NOT-21** [acceptance] given search text full of quotes and backslashes, searches for that literal text and runs nothing else · NN1 · KassebaumEngineering `1d47e74`; therealap `a675a7b`; upstream #67, #58, #75
- [ ] **NOT-22** [acceptance] given the search cannot run, fails and says why rather than reporting no notes · NN3 · KassebaumEngineering `1d47e74`; morquis `96759b3`, `d76f3ec`; upstream #67, #58, #75
- [ ] **NOT-23** [acceptance] given a matching note in Recently Deleted, leaves it out of the results (after NOT-M7) · — · therealap `63bfc01`, `88c75f6`, `a675a7b`; KassebaumEngineering `1d47e74`
- [ ] **NOT-24** [acceptance] given a smart folder that also shows a matching note, reports that note once (after NOT-M8) · — · therealap `2efb44b`
- [ ] **NOT-25** [acceptance] given access to Notes has not been granted, fails naming the setting to change and the app to allow · NN5 · upstream #44

#### reading a note

- [ ] **NOT-26** [acceptance] given a note longer than a preview, returns its whole text · — · faces-sh `94149a2`, `dbffae5`; neektza `5d0e84a`; upstream #67
- [ ] **NOT-27** [acceptance] given a title that two notes share, refuses to guess and names both: titles are not identities · — · neektza `5d0e84a`; chrischall `68dc2b7`, `91e0101`; upstream #67, #22
- [ ] **NOT-28** [acceptance] given a note with a checklist, a table or an attachment, returns its text and says what was left out (after NOT-M13) · — · neektza `5d0e84a`
- [ ] **NOT-29** [acceptance] given access to Notes is denied, reports a permission failure rather than not found · NN5 · neektza `5d0e84a`
- [ ] **NOT-30** [acceptance] given a note body that imitates the end of a result or another note, reports it inside that one note's body · — · ANierbeck `d2b9bf5`

#### creating a note

- [ ] **NOT-31** [acceptance] given note writing is not enabled, refuses and creates nothing: writes are off by default · NN2 · brightline `859a9c8`
- [ ] **NOT-32** [acceptance] given a title containing quotes, a trailing backslash or script syntax, creates the note with exactly that title · NN1 · faces-sh `784db41`; morquis `96759b3`, `d76f3ec`; therealap `a675a7b`
- [ ] **NOT-33** [acceptance] given a note folder whose name contains quotes, backslashes or script syntax, files the note in exactly that folder and runs nothing · NN1 · ANierbeck `cd72bdf`, `fc893d7`
- [ ] **NOT-34** [acceptance] given a note folder that does not exist, refuses and names the folders that do rather than creating one · — · chrischall `68dc2b7`, `91e0101`; morquis `05d1658`; upstream #67, #22; upstream PR #28
- [ ] **NOT-35** [acceptance] reports the note as created only once the store holds it, and gives its identifier · NN3 · danielk-am `9d9122c`; morquis `05d1658`

#### updating a note

- [ ] **NOT-36** [acceptance] given note writing is not enabled, refuses and changes nothing: writes are off by default · NN2 · neektza `f0ea5df`; brightline `859a9c8`; upstream #27
- [ ] **NOT-37** [acceptance] given only a title, refuses and asks for the note's identifier: titles repeat, and the note checked must be the note written · — · KassebaumEngineering `e766bc9`; upstream #27, #22, #44
- [ ] **NOT-38** [acceptance] given a note with a checklist, refuses, changes nothing and names the checklist: the rewrite would drop every tick · — · KassebaumEngineering `e766bc9`; neektza `f0ea5df`; upstream #27, #22, #44
- [ ] **NOT-39** [acceptance] given a note with an attachment, refuses, changes nothing and names the attachment · — · KassebaumEngineering `e766bc9`; neektza `f0ea5df`; upstream #27, #22, #44
- [ ] **NOT-40** [acceptance] given a note with headings or other formatting its new body cannot carry, refuses and names what would be lost (after NOT-M13) · — · KassebaumEngineering `e766bc9`; neektza `f0ea5df`; upstream #27, #22, #44
- [ ] **NOT-41** [acceptance] given a note of plain, bulleted and numbered paragraphs, replaces its body (after NOT-M13, NOT-M14) · — · KassebaumEngineering `e766bc9`; upstream #27
- [ ] **NOT-42** [acceptance] given the note's contents cannot be inspected, refuses rather than assuming the note is simple · — · KassebaumEngineering `e766bc9`
- [ ] **NOT-43** [acceptance] given a new body only, keeps the note's title (after NOT-M11; see NOT-C6) · — · neektza `f0ea5df`
- [ ] **NOT-44** [acceptance] given a body whose first line differs from the title, still confirms the update by identifier and reports the title the note now has (after NOT-M11) · NN3 · KassebaumEngineering `e766bc9`
- [ ] **NOT-45** [acceptance] reports the update as done only after reading the note back by its identifier · NN3 · neektza `f0ea5df`; faces-sh `431f4b1`; KassebaumEngineering `e766bc9`; upstream #27, #22; upstream PR #28
- [ ] **NOT-46** [acceptance] given the store does not yet show the new body, reports the update as unconfirmed rather than done (after NOT-M10) · NN3 · KassebaumEngineering `e766bc9`
- [ ] **NOT-47** [acceptance] given the update succeeds, reports the previous body so the change can be undone by another update · — · KassebaumEngineering `e766bc9`

#### deleting a note

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18)): deleting a note
is destructive and has no tool at all. NOT-48 is kept for whenever it is pulled in._

- [ ] **NOT-48** [acceptance] given several notes whose titles contain the text and none equals it, refuses and lists them: a note is never deleted by a partial title match · — · faces-sh `431f4b1`; upstream #27, #22; upstream PR #28

#### a note folder

- [ ] **NOT-49** [domain] is identified by its account and its name together: folder names repeat across accounts · — · therealap `63bfc01`, `a675a7b`; morquis `05d1658`; danielk-am `9d9122c`; upstream PR #28

#### a note document

- [ ] **NOT-50** [domain] given paragraph styles and attachments, reports which of them a body rewrite would lose (after NOT-M13, NOT-M14) · — · KassebaumEngineering `e766bc9`

#### a note search query

- [ ] **NOT-51** [domain] treats the text literally, so no query can make the search run away · — · neektza `5d0e84a`

#### the note store

- [ ] **NOT-52** [contract] given several notes, returns each with its own title and body · — · danielk-am `9d9122c`; upstream #67, #43, #44
- [ ] **NOT-53** [contract] given a note whose title and body contain separator-like text, quotes or any other characters, returns exactly that one note with its title and text intact · — · neektza `5766ff0`; chrischall `0860cf8`, `18660e4`, `6831a90`, `91e0101`, `bf6dc37`; upstream #67, #22
- [ ] **NOT-54** [contract] given search text containing quotes, backslashes and newlines, matches it literally · NN1 · neektza `5d0e84a`
- [ ] **NOT-55** [contract] given a folder name that closes a string and adds a command, looks up a folder with exactly that name and runs nothing · NN1 · chrischall `2e06954`, `18660e4`, `88b58d0`, `bf6dc37`, `29af0a2`, `60f9977`, `91e0101`, `6831a90`, `1a358d6`, `fa61e37`
- [ ] **NOT-56** [contract] given thousands of notes, searches every one of them rather than the first few · — · faces-sh `0216d96`; upstream #67, #44, #43
- [ ] **NOT-57** [contract] given text to search for, finds the matching notes on macOS 14, 15 and 26 alike, whatever query support the app offers (after NOT-M1) · — · upstream #44
- [ ] **NOT-58** [contract] given a library of a thousand notes, lists a folder within the time budget (after NOT-M4, NOT-M5) · — · therealap `88c75f6`, `a675a7b`
- [ ] **NOT-59** [contract] given the notes change while they are being read, never pairs one note's title with another note's body · — · faces-sh `0216d96`; upstream #67, #44, #43
- [ ] **NOT-60** [contract] never reports a deleted note as a live one, whatever the system language (after NOT-M7) · — · therealap `63bfc01`, `88c75f6`, `a675a7b`
- [ ] **NOT-61** [contract] given a note edited seconds ago, reports its current contents rather than an older saved state (after NOT-M15) · — · KassebaumEngineering `e766bc9`
- [ ] **NOT-62** [contract] given text containing angle brackets and ampersands, stores it as text, not as markup (after NOT-M12) · — · neektza `f0ea5df`
- [ ] **NOT-63** [contract] leaves no copy of a note's text on disk · — · neektza `f0ea5df`; ANierbeck `39cc53a`; brightline `859a9c8`
- [ ] **NOT-64** [contract] given Notes is not running, creates the note all the same (after NOT-M9) · — · faces-sh `3c590df`, `dbffae5`
- [ ] **NOT-65** [contract] given a note created by the suite, removes only that note during cleanup · — · morquis `97d5918`, `d76f3ec`, `a8283e2`, `a977f72`, `5c01104`, `05d1658`

### Conflicts

#### NOT-C1 How Notes is read at all

- **Options:**
  - Read whole columns (`name`, `plaintext`) for the entire library in a couple of Apple Events, match in the server, and check that the columns line up · faces-sh `0216d96`
  - Let Notes filter with a `whose` query, and fall back to a full scan when `whose` throws · faces-sh `431f4b1`; morquis `05d1658`; neektza `5d0e84a`
  - Loop note by note or folder by folder, one Apple Event per property · danielk-am `9d9122c`; chrischall `91e0101`, `68dc2b7`; therealap `63bfc01`, `88c75f6`, `a675a7b`; upstream #22
  - Read the note document from `NoteStore.sqlite` (used only for the update check) · KassebaumEngineering `e766bc9`
- **Recommendation:** Reject per-note loops. Upstream #22 and faces-sh's measurements (945 s to list
  notes before, 0.44 s with column reads) rule them out. Choose between column reads and
  `NoteStore.sqlite` from the NOT-M1 to NOT-M8 measurements, whichever passes NOT-56 to NOT-60 on
  macOS 14, 15 and 26.
- **Needs a human decision:** Yes. Owned by #6.

#### NOT-C2 A folder name that exists in two accounts

- **Options:**
  - Refuse, name both accounts, and ask for the account · morquis `05d1658`
  - Merge every folder of that name and read them all, without saying which account a note came from · therealap `63bfc01`, `a675a7b`
  - Take the first folder found with that name · danielk-am `9d9122c`; chrischall `91e0101`, `68dc2b7`; upstream PR #28
- **Recommendation:** Refuse and name both accounts (NOT-05), and label every note with its account
  and folder (NOT-04). therealap's own verdict defers to morquis's account-and-folder identity, and a
  folder a write names has to mean exactly one folder.
- **Needs a human decision:** No. The reports' verdicts agree, and refusing is the only option that
  works for writes as well as reads.

#### NOT-C3 Creating a note in a folder that does not exist

- **Options:**
  - Create the folder silently, even when the name is a typo · chrischall `91e0101`, `68dc2b7`; faces-sh `431f4b1` (creates folders idempotently)
  - Refuse and report the missing container as an error · morquis `05d1658` (its integration test "create into a missing folder errors")
- **Recommendation:** Refuse and name the folders that exist (NOT-34). A folder the caller never
  asked for is a write with side effects, and a misspelt name must not quietly split someone's notes.
- **Needs a human decision:** No. NN2 and "results tell the truth" settle it.

#### NOT-C4 How a note is found for reading, changing or deleting

- **Options:**
  - First note whose title matches · neektza `5d0e84a`, `f0ea5df`; chrischall `91e0101`; KassebaumEngineering `e766bc9` (title in SQL and in the script, matched differently)
  - Exact title among `contains` matches, else the first `contains` match · faces-sh `431f4b1`
  - The store's own identifier · faces-sh `431f4b1` (`byId`)
- **Recommendation:** Use the identifier for every read of one note and every write. A title is only
  a search term that can match several notes (NOT-27, NOT-37, NOT-48). The evidence is
  KassebaumEngineering's check and write seeing different notes, and faces-sh's "Meeting" matching
  "Meeting notes 2024".
- **Needs a human decision:** No. Every report's verdict converges on identifiers.

#### NOT-C5 How a note's body is changed

- **Options:**
  - Look at the stored note document first, and refuse when the rewrite would lose checklists, styles or attachments · KassebaumEngineering `e766bc9`
  - Overwrite the body with plain text, passed through a temp file · neektza `f0ea5df`
  - Delete the note and create a new one · fpjnijweide `93daf09`
  - Convert Markdown to HTML and replace or append without checking · faces-sh `431f4b1`
- **Recommendation:** Adopt KassebaumEngineering's refusal (NOT-38 to NOT-42), addressed by identifier,
  and accept Markdown as input. Reject delete-and-recreate (it loses the creation date, attachments
  and folder) and unchecked overwrites (in one reported library, 55 % of notes would be damaged).
- **Needs a human decision:** Yes. Owned by #6. The refusal needs the real note document, which only
  `NoteStore.sqlite` is known to expose. If #6 finds no supported way to read it, the maintainer has
  to decide whether v1 offers updates at all.

#### NOT-C6 What happens to a note's title when its body changes

- **Options:**
  - Keep the title: set the name again after writing the body · neektza `f0ea5df`
  - Let the body's first line become the title · faces-sh `431f4b1` (replace mode); KassebaumEngineering `e766bc9` (does this without meaning to)
- **Recommendation:** Keep the title unless the caller changes it, and always report the title the
  note ends up with (NOT-43, NOT-44). Verify NOT-M11 first, because in Notes the title may simply be
  the body's first line.
- **Needs a human decision:** Yes. Is a note's title a separate field, or the first line of its body
  (which is how the Notes UI treats it)? That is a modelling choice for the glossary (#11), and it
  depends on NOT-M11 (#6).

#### NOT-C7 Reading a note back after writing it

- **Options:**
  - Forbid reading back, because a read of a note just changed "blocks for seconds", and echo the values that were sent · faces-sh `431f4b1`
  - Inspect the note again after the write · KassebaumEngineering `e766bc9`; neektza `f0ea5df` (only in its tests)
- **Recommendation:** Read back by identifier, and report "unconfirmed" when the store doesn't show
  the change within the time budget (NOT-45, NOT-46). How long the wait is comes from NOT-M10.
- **Needs a human decision:** No. NN3 settles it.

#### NOT-C8 How search decides what matches

- **Options:**
  - Case-insensitive literal substring over the title and the full plain text · KassebaumEngineering `1d47e74`; chrischall `91e0101`; morquis `05d1658`; danielk-am `9d9122c`
  - Title-only `whose`, then a regex taken from tool input, then fuzzy bigram scores returned as if they were matches · neektza `5d0e84a`
  - Title matches ranked above body matches · fpjnijweide `93daf09`
- **Recommendation:** A literal substring over the title and the whole text, with title matches first
  and near matches labelled as suggestions (NOT-14, NOT-19, NOT-20, NOT-51). neektza's version stops
  searching bodies (the upstream #67 bug again) and lets hostile input stall the server.
- **Needs a human decision:** No. The evidence rules out the regex and fuzzy tiers.

#### NOT-C9 Keeping deleted notes and smart-folder repeats out of results

- **Options:**
  - Walk folders and skip them by English display name ("Recently Deleted", plus one user's smart folder names) · therealap `63bfc01`, `88c75f6`, `a675a7b`, `2efb44b`
  - Read the library-wide notes collection, which may include Recently Deleted · faces-sh `0216d96`; KassebaumEngineering `1d47e74`
- **Recommendation:** Recognise the trash and smart folders by a property, an identifier or the store's
  deleted flag, never by name, and remove duplicates by note identifier (NOT-10, NOT-23, NOT-24,
  NOT-60).
- **Needs a human decision:** No for the rule, which NN3 settles. Which property makes it possible is
  a mechanism question for #6 (NOT-M7, NOT-M8).

#### NOT-C10 What listing notes returns

- **Options:**
  - An index: every title with a 200-character preview, plus how to read one note in full · faces-sh `94149a2`, `dbffae5`
  - Full HTML bodies of every match · fpjnijweide `93daf09`
  - 200-character previews of up to 200 notes, cut silently · KassebaumEngineering `1d47e74`; danielk-am `9d9122c`
  - Folder listings with 100-character content, behind a cache · upstream PR #28
- **Recommendation:** A page of titles, folders, accounts, modification dates and short previews,
  saying how many were left out and how to read one note by identifier (NOT-01, NOT-02, NOT-26).
  faces-sh measured 2.3 MB in one turn before its index. upstream #22 shows whole-body reads hanging
  Notes.
- **Needs a human decision:** No.

#### NOT-C11 Starting Notes before using it

- **Options:**
  - Ask System Events whether Notes is running, `activate` it, then poll until ready · ANierbeck `3005df4`
  - `activate` the app before a create · faces-sh `3c590df`, `dbffae5`
  - Don't start it: upstream, and every other fork
- **Recommendation:** Start Notes only if the chosen mechanism needs a running app (NOT-M9). If it
  does, start it in the background without asking System Events (NOT-V1), and name a timeout as its
  own failure (NOT-12, NOT-13).
- **Needs a human decision:** Yes. Owned by #6: a store read directly from disk needs no running app.
  If scripting wins, NOT-V1 decides how to start it.

#### NOT-C12 How results cross from the script back to the server

- **Options:**
  - Delimited text: ASCII RS/US · danielk-am `9d9122c`; KassebaumEngineering `1d47e74`
  - Delimited text: Control Pictures glyphs · therealap `220462c`, `a675a7b`
  - Delimited text: sentinel strings · neektza `5766ff0`
  - Delimited text: `|||` · chrischall `18660e4`, `bf6dc37`, `91e0101`, `6831a90`, `0860cf8`
  - Real JavaScript values returned through `@jxa/run` · faces-sh `784db41`
- **Recommendation:** JSON checked against a schema, or typed rows from the store (NOT-52, NOT-53).
  Every delimiter above can be forged or split by note text. The runner's side of this contract
  belongs to Cross-cutting.
- **Needs a human decision:** No.

### Verification tasks

- **NOT-V1** Same claim as **X-V5** (starting an app in the background avoids the System Events prompt and
  the focus steal), for Notes; tracked there. *From:* ANierbeck `3005df4`.
- Mechanism questions: see #6.
  - **NOT-M1** On macOS 14 to 26, JXA `Application('Notes').notes.whose({...})()` works when
    Automation for Notes is granted. It fails with -600 or "whose is not a function" when Automation
    is denied or not yet decided, so #43/#44 are a single reachability failure. danielk-am
    `9d9122c`; morquis `05d1658` (`whose` on `plaintext`); upstream #44, #43.
  - **NOT-M2** Why "Application isn't running (-600)" comes back for Notes while Notes is running:
    Automation not granted, a sandboxed parent, a background launch context, or a terminology change
    in Notes 4.12. upstream #44 (open question); danielk-am `9d9122c` (open question).
  - **NOT-M3** *(permission prompts)* -1743 when Automation is denied and -1744 when not yet asked, for
    Notes: same claim as **X-V1**, tracked there. faces-sh `42c2fd7`, `4c3096d`, `ac53e87`.
  - **NOT-M4** On a store of several thousand notes, whole-collection `name()` and `plaintext()`
    reads return aligned arrays in under a second, and a password-protected note doesn't fail the
    read. Also check the measurement of `whose` on `plaintext` (2.51 s) against column reads plus
    matching (0.49 s). faces-sh `0216d96`.
  - **NOT-M5** In a library of about 1,000 notes, reading each note's `container` costs far more
    than reading folder by folder, and bulk `name`/`plaintext` reads remove the per-note cost.
    therealap `88c75f6`, `a675a7b`.
  - **NOT-M6** `notes whose name contains` is fast on thousands of notes in an iCloud account,
    rather than still fetching every name over Apple Events. neektza `5d0e84a` (open question).
  - **NOT-M7** On macOS 26 the app-wide `notes` collection, and `notes whose name …`, include notes
    in Recently Deleted. The trash can be recognised without relying on the language (a folder
    property or id, or the store's marked-for-deletion flag). Also find out whether the duplicates
    therealap saw came from the parsing bug rather than the folder walk. therealap `63bfc01`,
    `88c75f6`, `a675a7b`; KassebaumEngineering `1d47e74`; neektza `5d0e84a` (open question).
  - **NOT-M8** On macOS 26, `folders` of Notes returns smart folders, which repeat notes filed in
    real folders, and a property tells a smart folder from a real one. Also check whether `folders`
    includes nested subfolders at every depth. therealap `2efb44b`; danielk-am `9d9122c` (one-level
    folder listing).
  - **NOT-M9** A JXA `make new note` on Notes.app succeeds without `activate` when the app isn't
    running. faces-sh `3c590df`, `dbffae5`.
  - **NOT-M10** Reading a note's name and modification date right after setting its body over JXA
    takes more than a second on an iCloud account. Also check whether the same holds when reading
    `NoteStore.sqlite`. faces-sh `431f4b1`.
  - **NOT-M11** After `set body of` a note, Notes renames the note from the body's first line unless
    `name` is set afterwards. Also check what setting `name` does to the body's first line.
    neektza `f0ea5df`; KassebaumEngineering `e766bc9` (open question).
  - **NOT-M12** Plain text assigned to `body` has its `<`, `&` and line breaks interpreted as HTML.
    neektza `f0ea5df`.
  - **NOT-M13** KassebaumEngineering's list of what a body rewrite loses holds on macOS 14, 15 and
    26: Title, Heading, Subheading and Checklist styles, a checklist sub-message, and attachments
    with a type UTI (images, PDFs, scans, drawings, tables, link cards). Check each blind spot:
    block quotes, indentation and alignment, highlight and text colour, inline attachments
    (hashtags, mentions, note links, possibly `ZTYPEUTI1`), and whether bold, italic,
    strikethrough and links survive the HTML round trip. Also record which of these the plain text
    silently leaves out (neektza `5d0e84a`). KassebaumEngineering `e766bc9`.
  - **NOT-M14** The Notes UI gives a new note's first line the Title style by default, so a lossy
    check that counts Title would refuse most notes created in the app. KassebaumEngineering
    `e766bc9`.
  - **NOT-M15** A note edited seconds ago is visible to a reader of `NoteStore.sqlite` (it may still
    be only in the WAL), and copying the database, `-wal` and `-shm` one after another can read an
    older consistent state. KassebaumEngineering `e766bc9`.
  - **NOT-M16** *(permission prompts)* Reading the Notes group container needs Full Disk Access, or
    the macOS 14+ "access data from other apps" consent. Find out which one, and whether #4's
    responsible-process rule decides which app the grant belongs to. KassebaumEngineering
    `e766bc9` (open question).

### Credits

- **KassebaumEngineering:** a note update that refuses a rewrite that would lose checklists, styles or attachments, and names what would be lost; a backup has to come from the source of truth, not the lossy body, so the previous body goes in the result; read back after writing; search the whole text and cap matches, not notes scanned; a "syntax error" is a failure, never "no results".
- **therealap:** the diagnosis that upstream's notes list and search broke because text output was treated as records (upstream #67); list and search scoped to a note folder; keep Recently Deleted out; smart folders repeat notes, so remove duplicates; capped results say they were cut short; reading each note's folder separately is too slow.
- **morquis:** account → folder → note containment; a folder name found in two accounts is refused as ambiguous; a missing account or folder is an error, not an empty result; real-app test runs gated by a switch, with uniquely prefixed fixtures, cleanup in reverse order and a watchdog.
- **danielk-am:** structured output the server parses and validates; notes scoped by account and folder, with a named not-found failure; the finding that #43/#44 were raised against upstream's earlier JXA code.
- **faces-sh:** values reach scripts as arguments, never spliced in; notes read a whole column at a time, with a check that columns line up; a list is an index, and the full note is one read away (faces-sh internal #504, #499); locate notes by identifier; Markdown as note input.
- **neektza:** a whole-note read; editing a note in place instead of creating a new one (upstream #27); the observation that Notes renames a note from its body unless the name is set again; let the store filter instead of scanning a capped prefix; near matches offered only as labelled suggestions; its integration tests as a list of edge cases.
- **chrischall:** search the note's plain text and report its folder; its injection attack strings as hostile-input fixtures.
- **fpjnijweide:** rank title matches above body matches.
- **ANierbeck:** the notes create path's unescaped folder name as a recorded injection site; start the app before scripting it; body text returned as a field, never as prose that can pose as another record.
- **brightline:** writes are gated, and a refused write is an error that says why; user content never goes to a shared, predictable path.
- **upstream PR #28:** list the notes in a folder, most recently modified first; a date-only bound means the local day.

## Mail

### Scenario backlog

In this group, "email" means one item in Mail and "mail" means emails in general. That keeps
"message" free for Messages (see Glossary candidates). How Mail is reached is still open in #7,
so acceptance and domain scenarios name no mechanism. A scenario whose truth depends on the #7
outcome is marked `(after #7)`.

#### listing mail accounts

- [ ] **MAIL-01** [acceptance] lists every configured account by the name Mail shows for it · — · brightline `ba218e6`, `be4becf`; felkru `c769cc0`; gene-jelly `bb07be5`; upstream #69
- [ ] **MAIL-02** [acceptance] reports each account's email addresses together with its name · — · chrischall `0860cf8`, `18660e4`, `88b58d0`
- [ ] **MAIL-03** [acceptance] given Mail has no accounts set up, says so rather than reporting a permission failure · NN5 · long-tail/zaclohrenz `277aac7`

#### finding a mail account

- [ ] **MAIL-04** [acceptance] given the account's email address instead of its name, finds the same account · — · ANierbeck `3005df4`

#### listing mailboxes

- [ ] **MAIL-05** [acceptance] reports each mailbox under the account it belongs to · — · long-tail/zaclohrenz `277aac7`; upstream PR #73
- [ ] **MAIL-06** [acceptance] given two accounts that both have an inbox, reports each inbox under its own account · — · felkru `c769cc0`
- [ ] **MAIL-07** [acceptance] given nested mailboxes, reports each one with its path inside its account · — · gene-jelly `bb07be5`; morquis `5bee2f6`, `5c01104`, `6361803`, `8a9b013`
- [ ] **MAIL-08** [acceptance] given local mailboxes on this Mac, reports them apart from any account · — · felkru `c769cc0`
- [ ] **MAIL-09** [acceptance] without being asked for counts, reports none rather than looking through emails: counting is slow on large accounts · — · morquis `5bee2f6`, `5c01104`, `6361803`, `8a9b013`

#### counting unread mail

- [ ] **MAIL-10** [acceptance] reports the unread count of each mailbox in each account · — · chrischall `0860cf8`, `18660e4`, `88b58d0`

#### listing unread mail

- [ ] **MAIL-11** [acceptance] given an unread email in an account's inbox, reports its sender, subject, sent date and account · — · brightline `ba218e6`, `be4becf`
- [ ] **MAIL-12** [acceptance] given unread emails in the inboxes of two accounts, reports all of them, each labelled with its account and mailbox · — · chrischall `25d47cc`; danielk-am `ad3e9e9`; gene-jelly `c5a0edd`; upstream PR #73; upstream #58, #69
- [ ] **MAIL-13** [acceptance] given unread emails in several accounts, orders them newest first by their real sent date · NN3 · ANierbeck `2c5506c`; chrischall `25d47cc`
- [ ] **MAIL-14** [acceptance] given unread emails in Junk or Trash, leaves them out unless asked for · — · chrischall `25d47cc`; gene-jelly `c5a0edd`
- [ ] **MAIL-15** [acceptance] given an account whose inbox has a localised name, finds that inbox · — · morquis `d76f3ec`
- [ ] **MAIL-16** [acceptance] given an account named in the request, fills the limit from that account alone · — · ANierbeck `2c5506c`
- [ ] **MAIL-17** [acceptance] given a mailbox named in the request, looks only in that mailbox · — · ANierbeck `3005df4`
- [ ] **MAIL-18** [acceptance] given one email that cannot be read, still returns the others · — · ANierbeck `3005df4`
- [ ] **MAIL-19** [acceptance] given more mail than it will look through, says how far back it looked instead of reporting there is no unread mail · NN3 · brightline `0833904`, `ba218e6`, `d2eef83`

#### listing the latest mail

- [ ] **MAIL-20** [acceptance] given no account named, reports the most recently received emails across every account, newest first · — · brightline `0833904`, `ba218e6`, `d2eef83`; gene-jelly `bb07be5`; morquis `d76f3ec`
- [ ] **MAIL-21** [acceptance] given an account and no search text, reports that account's newest emails · — · upstream #30
- [ ] **MAIL-22** [acceptance] given emails in several mailboxes of an account, reports the most recently received first (see MAIL-C2) · — · nivra `2860fb6`
- [ ] **MAIL-23** [acceptance] given newer mail in an account's inbox than in its archive, reports the inbox mail first · — · felkru `c769cc0`
- [ ] **MAIL-24** [acceptance] given read and unread emails, reports each one's real read state · NN3 · felkru `c769cc0`

#### listing mail in a mailbox

- [ ] **MAIL-25** [acceptance] given a mailbox, reports its newest emails first · — · upstream #58
- [ ] **MAIL-26** [acceptance] returns no email bodies unless asked: bodies are untrusted text · — · morquis `0d6918a`, `47cab04`, `51e80da`, `5a2ae64`, `7212c6d`, `9121ab3`, `cc303ee`
- [ ] **MAIL-27** [acceptance] given a next-page cursor, continues after the last email without repeats or gaps · — · morquis `0d6918a`, `47cab04`, `51e80da`, `5a2ae64`, `7212c6d`, `9121ab3`, `cc303ee`

#### searching mail

- [ ] **MAIL-28** [acceptance] given text that appears in an email's subject or sender, finds that email · — · upstream #69
- [ ] **MAIL-29** [acceptance] given text that appears only in an email's body, finds the email only when the caller asked for bodies to be searched, and states its coverage (after #7) · — · felkru `22aa354`; #24
- [ ] **MAIL-30** [acceptance] reports which parts of an email it searched: subject only, or subject and body · NN3 · brightline `0833904`, `ba218e6`, `d2eef83`
- [ ] **MAIL-31** [acceptance] given a term that appears only in an attachment name, finds the email when attachment names are searched · — · morquis `5ce2351`
- [ ] **MAIL-32** [acceptance] given an account, a mailbox and a date range, returns only emails inside all three · — · brightline `0833904`, `ba218e6`, `d2eef83`; upstream PR #37
- [ ] **MAIL-33** [acceptance] given no account named, searches every account and names the account of each result · — · chrischall `0860cf8`, `18660e4`, `88b58d0`
- [ ] **MAIL-34** [acceptance] given a matching email outside the inbox, finds it · — · long-tail/zaclohrenz `277aac7`
- [ ] **MAIL-35** [acceptance] given a match older than the most recent emails, still finds it · — · chrischall `0860cf8`, `18660e4`, `88b58d0`
- [ ] **MAIL-36** [acceptance] given more matches than the limit, returns the newest ones across every mailbox searched · — · upstream PR #37
- [ ] **MAIL-37** [acceptance] given no range, searches the last 30 days and says in the result which range it used and how far back it reached · NN3 · chrischall `e23e11e`; #24
- **MAIL-38** [acceptance] given no date window, refuses: an unbounded search never finishes on large accounts · **rejected by #24**: MAIL-37 ships and MAIL-38 doesn't — an agent refused until it names both dates has to guess them, and every ordinary search costs a round trip · morquis `5ce2351`
- [ ] **MAIL-39** [acceptance] given a search date that cannot be read as a date, refuses: a silent empty result looks like no mail · NN3 · chrischall `25d47cc`
- [ ] **MAIL-40** [acceptance] given an email deleted since the last search, does not report it · NN3 · felkru `22aa354`
- [ ] **MAIL-41** [acceptance] never stores email contents outside Mail's own storage · — · felkru `22aa354`

#### opening an email

- [ ] **MAIL-92** [acceptance] given an identifier that is not an email identifier, refuses before touching Mail · NN1 · chrischall `0860cf8`, `18660e4`, `88b58d0`
- [ ] **MAIL-93** [acceptance] given an identifier from a search result, returns that email's full text and never a different email with a similar subject · NN3 · fpjnijweide `42c9e11`, `48cd701`
- [ ] **MAIL-94** [acceptance] given attachments, reports each one's name, type and size · — · felkru `22aa354`
- [ ] **MAIL-95** [acceptance] given an HTML email, reports its links with their text · — · felkru `22aa354`
- [ ] **MAIL-96** [acceptance] given a link longer than usual, still reports it · — · felkru `22aa354`

#### reading mail

These scenarios hold for every read operation above.

- [ ] **MAIL-42** [acceptance] given the mail store cannot be read, fails and says what failed rather than reporting no accounts, mailboxes or emails · NN3 · ANierbeck `dd7eecb`; brightline `ba218e6`, `be4becf`; gene-jelly `c5a0edd`; long-tail/zaclohrenz `277aac7`; nivra `0b616cd`, `2860fb6`; upstream #69
- [ ] **MAIL-43** [acceptance] given macOS has not granted the access that reading mail needs, fails naming the permission and where to grant it, rather than reporting no mail · NN5 · ANierbeck `2c5506c`; felkru `c769cc0`; fpjnijweide `05305b2`, `42c9e11`, `6cf16c0`, `c8e39f6`
- [ ] **MAIL-44** [acceptance] given one account that fails or does not answer in time, still reports the other accounts' mail and names the account it could not read · NN3 · brightline `304f384`, `84edc6b`; upstream #19
- [ ] **MAIL-45** [acceptance] given Mail is not running, still reports the emails, within the time budget · — · felkru `c769cc0`
- [ ] **MAIL-46** [acceptance] given Mail has no accounts, fails saying so rather than asking for a permission · NN5 · felkru `c769cc0`
- [ ] **MAIL-47** [acceptance] given the mail store does not answer within the time budget, fails saying it timed out rather than blaming a permission · NN5 · felkru `c769cc0`; nivra `0b616cd`, `2860fb6`
- [ ] **MAIL-48** [acceptance] given an email body that imitates the end of a result or another email, reports it inside that one email's body · — · ANierbeck `d2b9bf5`
- [ ] **MAIL-49** [acceptance] given an email with no sent date, reports the date as unknown rather than inventing one · NN3 · sicdigital `3c13e0d`

#### any mail operation

- [ ] **MAIL-50** [acceptance] given an account outside the allowlist, refuses to read, list or change anything in it, whichever operation asks · — · ANierbeck `2c5506c`, `3005df4`

#### opening an attachment

- [ ] **MAIL-51** [acceptance] given two attachments whose names differ only in punctuation, opens the one asked for by its part · — · felkru `22aa354`

#### drafting an email

- [ ] **MAIL-52** [acceptance] given drafting is not enabled, refuses: writes are off by default · NN2 · KassebaumEngineering `1e95e41`; upstream PR #68
- [ ] **MAIL-53** [acceptance] given drafting is enabled, saves the draft without asking the user to confirm: nothing leaves the Mac · — · KassebaumEngineering `1e95e41`
- [ ] **MAIL-54** [acceptance] given recipients, a subject and a body, saves a draft without sending it and reports it only once it is found in the account's Drafts mailbox (after MAIL-V1) · NN3 · KassebaumEngineering `1e95e41`; chrischall `1a45550`, `9a62bc9`, `bfa14df`, `c9f9c48`; upstream PR #68
- [ ] **MAIL-55** [acceptance] given the draft cannot be found in the Drafts mailbox afterwards, reports it as unconfirmed (after MAIL-V1) · NN3 · KassebaumEngineering `1e95e41`
- [ ] **MAIL-56** [acceptance] sends nothing, even when sending is enabled · NN2 · upstream PR #68

#### sending an email

- [ ] **MAIL-57** [acceptance] given sending is not enabled, refuses: sending mail is off until the user turns it on · NN2 · brightline `859a9c8`
- [ ] **MAIL-58** [acceptance] given the user has not confirmed this send, refuses and sends nothing · NN2 · brightline `859a9c8`; morquis `d76f3ec`
- [ ] **MAIL-59** [acceptance] given a to, cc or bcc address that is not a known recipient, refuses the whole email · NN4 · ANierbeck `813c232`; #16, ADR-0005
- [ ] **MAIL-110** [acceptance] given an address that account's Sent mail and existing conversations do not hold, refuses and names the contact rather than the address · NN4 · ADR-0005, #16
- [ ] **MAIL-111** [acceptance] given the known-recipient check could not finish inside its budget, refuses and says how far back it looked · NN3, NN4 · #16, #24
- [ ] **MAIL-60** [acceptance] given a recipient field with one allowed and one unparsable address, refuses the whole send (after MAIL-V5) · NN4 · KassebaumEngineering `13fd400`
- [ ] **MAIL-61** [acceptance] given the allowlist cannot be read, refuses every send · NN4 · KassebaumEngineering `13fd400`
- [ ] **MAIL-62** [acceptance] reports the email as sent only once it is found in the sending account's Sent mailbox (after MAIL-V2) · NN3 · morquis `d76f3ec`
- [ ] **MAIL-63** [acceptance] given the email does not appear in the Sent mailbox afterwards, reports the send as unconfirmed (after MAIL-V2) · NN3 · morquis `d76f3ec`; brightline `859a9c8`

#### replying to an email

- [ ] **MAIL-99** [acceptance] given the user has not confirmed this reply, refuses to send it · NN2 · chrischall `1a45550`, `9a62bc9`, `bfa14df`, `c9f9c48`

#### trashing an email

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18)): mail triage —
move, mark read, delete, rules — has no tool at all, because the mechanism isn't settled (#7) and
triage is destructive at scale. MAIL-66, MAIL-67 and MAIL-100 to MAIL-105 are kept for whenever it
is pulled in._

- [ ] **MAIL-66** [acceptance] given two emails that match the description, refuses rather than guessing which one · — · ANierbeck `3005df4`

#### moving an email

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18))._

- [ ] **MAIL-67** [acceptance] given moves are not enabled in settings, refuses and says which setting enables them · NN2, NN5 · upstream #51
- [ ] **MAIL-100** [acceptance] given an email reference from an earlier read, moves exactly that email and reports its new mailbox as read back from the store · NN3 · gene-jelly `bb07be5`, `d13e5b4`; upstream #51
- [ ] **MAIL-101** [acceptance] given a subject and sender instead of an email reference, refuses: several emails can match · — · gene-jelly `bb07be5`, `d13e5b4`; upstream #51
- [ ] **MAIL-102** [acceptance] given a destination name that matches no mailbox exactly, refuses and names the mailboxes there are · NN5 · gene-jelly `bb07be5`, `d13e5b4`; upstream #51
- [ ] **MAIL-103** [acceptance] given a dry run, reports the source and destination mailboxes and changes nothing · — · morquis `59d3aa3`, `fa7e5f9`

#### deleting an email

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18))._

- [ ] **MAIL-104** [acceptance] given deleting is not enabled, refuses and says which setting enables it · NN2, NN5 · gene-jelly `bb07be5`, `d13e5b4`; upstream #51

#### marking an email read

_No tool in v1 ([#18](https://github.com/that-mathevs/apple-native-mcp/issues/18))._

- [ ] **MAIL-105** [acceptance] given a subject containing a double quote, marks the email read and runs nothing else · NN1 · gene-jelly `bb07be5`, `d13e5b4`; upstream #51

#### checking for a reply

- [ ] **MAIL-106** [acceptance] given a sent email that answers this one, reports replied with when it was sent · — · gene-jelly `bb07be5`
- [ ] **MAIL-107** [acceptance] given a sent email with the same subject that answers a different email, reports not replied · — · gene-jelly `bb07be5`

#### managing mailboxes

- [ ] **MAIL-68** [acceptance] offers no way to create, rename, move or delete a mailbox: an operation outside v1 has no tool at all, so an agent can't propose it · — · morquis `016aeaf`, `2465ad5`, `5c01104`; #18
- [ ] **MAIL-109** [acceptance] offers no way to change the user's mail rules: disabling a rule such as a junk filter is a quiet, harmful action · — · chrischall `0860cf8`, `0703ad1`

#### a mailbox

- [ ] **MAIL-69** [domain] is identified by its account and its path within that account · — · brightline `ba218e6`

#### a mailbox path

- [ ] **MAIL-70** [domain] given the same name in decomposed and composed Unicode, treats them as one path · — · morquis `5bee2f6`, `5c01104`, `6361803`, `8a9b013`

#### a mail search query

- [ ] **MAIL-71** [domain] given characters such as an asterisk, matches them literally rather than as a wildcard: Mail and Messages parse one grammar in one domain module (MSG-80 to MSG-85) · — · upstream #30; #24

#### a date range

- [ ] **MAIL-72** [domain] given an end date with no time, includes the whole of that day in the user's time zone · — · upstream PR #37

#### a header selection

- [ ] **MAIL-73** [domain] given a folded header and a requested name in different case, keeps the whole header · — · morquis `0d6918a`, `47cab04`, `51e80da`, `5a2ae64`, `7212c6d`, `9121ab3`, `cc303ee`

#### an email body

- [ ] **MAIL-97** [domain] given a multipart email with plain and HTML parts, yields readable text in the declared charset · — · fpjnijweide `42c9e11`, `48cd701`

#### an email reference

- [ ] **MAIL-98** [domain] given a Message-ID in angle brackets, stores it without the brackets · — · morquis `0d6918a`, `47cab04`, `51e80da`, `5a2ae64`, `7212c6d`, `9121ab3`, `cc303ee`

#### an emlx file

- [ ] **MAIL-74** [domain] given its byte-count header, separates the email from Apple's trailing metadata (after #7) · — · felkru `22aa354`

#### a mailbox URL

- [ ] **MAIL-75** [domain] given a Mail mailbox URL, yields its account and its human-readable path (after #7) · — · fpjnijweide `05305b2`, `42c9e11`, `6cf16c0`, `c8e39f6`

#### the mail store

- [ ] **MAIL-76** [contract] lists the mailboxes of each account, not only the mailboxes stored on this Mac · — · brightline `ba218e6`
- [ ] **MAIL-77** [contract] given two configured accounts, reports each by its real name · — · nivra `0b616cd`, `2860fb6`
- [ ] **MAIL-78** [contract] given a mailbox whose name contains a comma, reports it as one mailbox · — · nivra `0b616cd`, `2860fb6`
- [ ] **MAIL-79** [contract] finds each account's inbox whatever the server or the user's language calls it (after #7) · — · brightline `0833904`, `ba218e6`, `d2eef83`; morquis `d76f3ec`
- [ ] **MAIL-80** [contract] reports sent dates as instants with a time zone, not as locale-formatted text · — · brightline `ba218e6`, `be4becf`; sicdigital `3c13e0d`
- [ ] **MAIL-81** [contract] given a subject or body containing tabs, newlines, commas or other delimiter characters, returns every field intact · — · brightline `ba218e6`, `be4becf`; nivra `2860fb6`; upstream PR #73
- [ ] **MAIL-82** [contract] given an email whose body contains text shaped like another result, returns it as one email · — · ANierbeck `3005df4`
- [ ] **MAIL-83** [contract] given one unreadable email, still returns the others · — · brightline `0833904`, `ba218e6`, `d2eef83`
- [ ] **MAIL-84** [contract] given a search term containing quotes and backslashes, matches it literally and runs nothing · NN1 · chrischall `25d47cc`
- [ ] **MAIL-85** [contract] given a sender, a subject and a body term together, returns only emails matching all three · — · fpjnijweide `05305b2`, `42c9e11`, `6cf16c0`, `c8e39f6`
- [ ] **MAIL-86** [contract] given a mailbox of a hundred thousand emails, returns the newest page within its time budget · — · brightline `0833904`, `ba218e6`, `d2eef83`; upstream #58
- [ ] **MAIL-87** [contract] given a mailbox of ten thousand read emails and three unread, lists the unread ones within the time budget · — · gene-jelly `c5a0edd`
- [ ] **MAIL-88** [contract] given mailboxes with nothing unread, does not read their emails · — · gene-jelly `c5a0edd`
- [ ] **MAIL-89** [contract] given a mailbox of 50,000 emails, answers a 30-day search within the time budget · — · chrischall `e23e11e`
- [ ] **MAIL-90** [contract] queries one account at a time, so Mail is never asked about every account in one request (after #7) · — · brightline `304f384`, `84edc6b`
- [ ] **MAIL-91** [contract] given Mail is not running, starts it without bringing it to the front (after MAIL-V3) · — · morquis `d76f3ec`; ANierbeck `3005df4`

### Conflicts

#### MAIL-C1 How mail is read at all

- **Options:**
  - Script Mail per account and mailbox (AppleScript or JXA): brightline `ba218e6`, `0833904`, `d2eef83`; gene-jelly `c5a0edd`; chrischall `25d47cc`; morquis `d76f3ec`; felkru `c769cc0`; nivra `2860fb6`; long-tail/zaclohrenz `277aac7`; upstream PR #73
  - A Swift binary called "MailKit" that runs osascript itself: ANierbeck `2c5506c`
  - Read Mail's Envelope Index read-only, and one `.emlx` file on demand: fpjnijweide `42c9e11`, `c8e39f6`, `6cf16c0`, `05305b2`, `48cd701`
  - A private full-text copy of every email body: felkru `22aa354`
- **Recommendation:** Rule out the private copy, since it copies protected mail into an unprotected file, and rule out "MailKit", which links no MailKit and only wraps osascript (checked with `otool -L`). Choose between scripting and the Envelope Index from the timings in #7. fpjnijweide measured roughly 100x in favour of the index, but on one machine.
- **Needs a human decision:** Yes — owned by #7.

#### MAIL-C2 Which mailboxes unread and latest look in

- **Options:**
  - Each account's inbox only: brightline `0833904`, `d2eef83`; ANierbeck `3005df4`; morquis `d76f3ec`
  - Only the unified inbox: upstream PR #73; long-tail/zaclohrenz `277aac7`
  - Every mailbox of every account, in the order Mail lists them: gene-jelly `c5a0edd`; chrischall `25d47cc`; danielk-am `ad3e9e9`; nivra `2860fb6` (latest across the account's mailboxes); felkru `c769cc0`
  - Every mailbox except those whose URL looks like All Mail, Spam, Trash or Drafts: fpjnijweide `6cf16c0`, `05305b2`
- **Recommendation:** Unread and latest default to each account's inbox, a named mailbox replaces that default, and Junk and Trash come in only when asked for (MAIL-14, MAIL-17, MAIL-23). Search covers other mailboxes (MAIL-34). Evidence: walking every mailbox timed out after about two accounts in brightline and on 634 mailboxes in morquis, and dictionary order let junk fill the limit in gene-jelly. MAIL-22 (nivra) then only holds for a named mailbox or for search.
- **Needs a human decision:** No — timeouts seen by several forks and the junk-first failure settle the default.

#### MAIL-C3 How the inbox is recognised

- **Options:**
  - The literal name `INBOX`: brightline `0833904`
  - A list of names (`INBOX`, `Inbox`, `Posteingang`, `all mail`), else the first mailbox: morquis `d76f3ec`; ANierbeck `3005df4`
  - A name that contains "INBOX" or "Inbox", else the first non-empty mailbox: upstream PR #73; long-tail/zaclohrenz `277aac7`
  - Mail's own unified `inbox` property: brightline `ba218e6` (a verify)
  - The mailbox URL in the Envelope Index: fpjnijweide `05305b2`
- **Recommendation:** Recognise the inbox by its role, never by its name. A silent fallback to "the first mailbox" is a false result under NN3. MAIL-15 and MAIL-79 pin this down whichever way the role turns out to be read.
- **Needs a human decision:** No — name lists fail by construction (localised and provider names). Which role signal is reliable is a #7 fact.

#### MAIL-C4 How much work a search may do when no range is given

- **Options:**
  - Look only at the newest N emails of the inbox and say nothing: brightline `ba218e6` (100); chrischall `18660e4`, `88b58d0` (30)
  - Search the last 90 days by default: chrischall `e23e11e`; ANierbeck `3005df4` (latest only)
  - Refuse unless account, mailbox, start and end dates are given: morquis `5ce2351`
  - No bound, one indexed query: fpjnijweide `6cf16c0`, `05305b2`
- **Recommendation:** Never bound silently (MAIL-19, MAIL-30). Apply a default range and state it in the result (MAIL-37) rather than refusing (MAIL-38). An agent that is told the range can widen it, but one that is refused has to guess dates.
- **Settled by [#24](https://github.com/that-mathevs/apple-native-mcp/issues/24):** the default range is the last 30 days, newest first, and the result states the range it used and its coverage — how far back it reached and whether it stopped at its time budget. **MAIL-37 ships, MAIL-38 doesn't.** #7 measured Mail at about 17 ms per *matching* email, with a date search on a large mailbox failing after 120 s, so an unbounded search is not viable. Messages has no default range, because its store answers quickly.

#### MAIL-C5 How several accounts are read without hanging Mail

- **Options:**
  - One request that walks every account: gene-jelly `c5a0edd`; ANierbeck `2c5506c`; upstream PR #73
  - One bounded request per account, one after another, with a fixed 3 s pause: brightline `84edc6b`, `304f384`
  - Many requests to Mail at once (up to 100 concurrent in batches): chrischall `c9f9c48`
  - Keep the shape and raise the timeout to 60 s: nivra `0b616cd`, `2860fb6`
- **Recommendation:** One bounded request per account, one after another, with no fixed pause. Each account has its own time budget and its own named failure (MAIL-44, MAIL-90), and the request is killed when its budget runs out. If MAIL-V6 or #7 shows Mail still stalls, add a measured throttle in the adapter. brightline's field report shows that one request covering every account hangs Mail, and Mail answers Apple Events one at a time.
- **Needs a human decision:** No — brightline's field report and Mail's one-at-a-time event handling settle it. The pause is left to measurement in #7.

#### MAIL-C6 How results come back from the store

- **Options:**
  - Delimited text: brightline `be4becf` (tabs); gene-jelly `c5a0edd` (`<<<FIELD>>>`); nivra `2860fb6` (`|`); felkru `c769cc0` (U+241F glyphs); ANierbeck `2c5506c`, `3005df4` (`|SUBJ_END|`, `||`); upstream PR #73 (`||`, `@@`)
  - Parse osascript's human-readable list output: felkru `c769cc0`; gene-jelly `bb07be5`; danielk-am `ad3e9e9`
  - JSON with ISO dates from JXA: chrischall `25d47cc`; morquis `9121ab3` (structured content)
  - Typed rows from a store query: fpjnijweide `6cf16c0`
- **Recommendation:** Use typed data only: JSON from a static script, or typed rows. ANierbeck C6 shows an email body forging a whole extra email through a delimiter, which MAIL-48, MAIL-81 and MAIL-82 pin down.
- **Needs a human decision:** No — delimiter forgery is shown in the reports, and NN1 already rules out parsing text built by hand.

#### MAIL-C7 How a follow-up operation picks out one email

- **Options:**
  - The first email whose subject and sender contain the given text: gene-jelly `bb07be5`, `d13e5b4`; ANierbeck `3005df4`; fpjnijweide `42c9e11`, `48cd701` (subject LIKE, newest wins)
  - Mail's numeric scripting id, found by scanning every mailbox: chrischall `18660e4`, `1a45550`
  - A reference with Mail's object id, the Message-ID, account and mailbox path, with a dry run: morquis `51e80da`, `0d6918a`, `fa7e5f9`, `59d3aa3`
  - The Envelope Index row id, which also names the `.emlx` file: fpjnijweide `48cd701`
- **Recommendation:** Only an opaque email reference returned by an earlier read, never a subject or sender (MAIL-66, MAIL-93, MAIL-100, MAIL-101). Whether a Message-ID with account and mailbox, Mail's object id or a store row id backs the reference depends on which one stays stable, and that is a #7 fact.
- **Needs a human decision:** Yes — owned by #7 (which identifier survives restarts and moves). Rejecting subject matching needs no decision.

#### MAIL-C8 What happens when Mail is not running or not ready

- **Options:**
  - Ask System Events whether Mail runs, then `activate` it and poll: ANierbeck `3005df4`; morquis `d76f3ec`
  - `activate` on every access check: upstream PR #73; long-tail/zaclohrenz `277aac7`
  - `launch`, then poll the account count until it is above 0 for up to 15 s, only after a failed check: felkru `c769cc0`
  - Don't start Mail, because a store read doesn't need it running: fpjnijweide `6cf16c0`
- **Recommendation:** When the chosen mechanism needs Mail running, start it in the background with no System Events query and no focus steal (MAIL-V3). Wait within the time budget, and keep "no permission", "no accounts" and "timed out" as three separate named failures (MAIL-45 to MAIL-47).
- **Needs a human decision:** No — the failure split follows NN5, and MAIL-V3 and MAIL-V4 settle the launch method.

#### MAIL-C9 Which parts of an email a search matches

- **Options:**
  - Subject only: brightline `0833904`; ANierbeck `3005df4`; chrischall `25d47cc`; danielk-am `ad3e9e9`
  - Subject or sender, with the body filtered through scripting: upstream PR #73; long-tail/zaclohrenz `277aac7`; upstream PR #37
  - Subject, sender and optional attachment names, never bodies: morquis `5ce2351`
  - Sender, subject and summary as separate filters combined with AND: fpjnijweide `6cf16c0`, `05305b2`
  - Body full text through a private index: felkru `22aa354`
- **Recommendation:** Always state what was searched (MAIL-30). Offer body search (MAIL-29) only if #7 shows it works without a private copy and without reading every body through scripting, which is the slow case behind upstream #19.
- **Needs a human decision:** Yes — owned by #7 (whether body search is feasible).

#### MAIL-C10 What a search query looks like

- **Options:**
  - One free-text term matched as a substring: brightline `0833904`; chrischall `25d47cc`; ANierbeck `3005df4`; upstream PR #37
  - Separate sender, subject and content filters combined with AND: fpjnijweide `6cf16c0`, `05305b2`; chrischall `18660e4`
  - A term with full-text syntax stripped and each word quoted: felkru `22aa354`
  - A known grammar (quoted phrases, `-` exclusions, optional words ranked by matches), with a shared test corpus that a mail proxy also meets: faces-sh `cad640a`, `ccc9f55`, `fa7dcbd`, `bdbb896` (built for Messages search)
- **Recommendation:** Typed arguments for account, mailbox, sender and range, plus one free-text query parsed by the same domain grammar as Messages search, with every other character literal (MAIL-71, upstream #30). With one grammar, agents learn one syntax, and faces-sh's corpus shows a single grammar can serve both apps.
- **Settled by [#24](https://github.com/that-mathevs/apple-native-mcp/issues/24):** Mail and Messages share one grammar in one domain module — quoted phrases match as a phrase, a leading `-` excludes, remaining words are optional and rank the results, case and diacritics are folded, and every other character is literal. There is no `OR` (MSG-83 is rejected). Searching bodies is opt-in and always states its coverage (MAIL-29, MAIL-30). The terms are already in `CONTEXT.md` as **search query**, **range** and **coverage**.

#### MAIL-C11 How a send is gated

- **Options:**
  - Ask a model through MCP sampling, approve on the substring "yes", or skip everything with an env switch: brightline `859a9c8`
  - Always allowed, with only a recipient check: ANierbeck `813c232`; KassebaumEngineering `13fd400`
  - No gate at all: morquis `d76f3ec`
- **Recommendation:** Per-capability write enablement plus the user's confirmation of each send, never a model's reply (MAIL-57, MAIL-58). Drafts need enablement but no confirmation (MAIL-52, MAIL-53).
- **Settled by [#9](https://github.com/that-mathevs/apple-native-mcp/issues/9) ([ADR-0004](../adr/0004-sends-require-elicitation.md)):** every send is confirmed through MCP elicitation, and a client that doesn't declare elicitation is not offered the send tools at all (X-72, X-73). No setting may stand in for a confirmation (X-78). Drafts need the draft capability only, since nothing leaves the Mac (MAIL-53).

#### MAIL-C12 Who an email may be sent to

- **Options:**
  - An explicit allowlist file that fails closed. Addresses are found with a regex, and a field with no parsable address is refused: KassebaumEngineering `13fd400` (upstream #48)
  - An env allowlist compared as raw strings, with email otherwise open and cc/bcc never checked: ANierbeck `813c232`
  - NN4's "known recipient": an address the user has already written to
- **Recommendation:** Parse every recipient field completely and refuse the whole email if any address fails (MAIL-59, MAIL-60, MAIL-61). The default is a known recipient, with an allowlist as a setting on top.
- **Settled by [#16](https://github.com/that-mathevs/apple-native-mcp/issues/16) ([ADR-0005](../adr/0005-a-known-recipient-is-one-with-real-traffic.md)):** for email, a known recipient is an address in that account's Sent mail or an existing conversation — a contact card is not enough (MAIL-110). Every address in To, Cc and Bcc must be known, and the whole email is refused if any is unknown or any field doesn't parse completely. When the check can't be completed inside its budget the send is refused, saying how far back it looked (MAIL-111). **Drafts are exempt**, because a draft never leaves the Mac (MAIL-53). The allowlist half is settled by [#19](https://github.com/that-mathevs/apple-native-mcp/issues/19): it narrows the rule and never widens it.

#### MAIL-C13 How a draft is saved

- **Options:**
  - Open a visible compose window, `save`, and leave the window open: KassebaumEngineering `1e95e41`
  - Open a visible compose window and never save: upstream PR #68
  - Make an invisible outgoing email and never save it: chrischall `1a45550`, `bfa14df`
- **Recommendation:** Save without opening a window, then confirm the draft in the Drafts mailbox (MAIL-54, MAIL-55). Neither fork checked that a draft persisted, so MAIL-V1 decides the exact steps.
- **Needs a human decision:** No — MAIL-V1 settles it.

#### MAIL-C14 How mailboxes are named in results

- **Options:**
  - Joined strings: brightline `ba218e6` (`account/mailbox`); gene-jelly `c5a0edd` (`account - mailbox`); felkru `c769cc0` and danielk-am `ad3e9e9` (`account / mailbox`, with "On My Mac"); upstream PR #73
  - A `/`-joined path inside an account, compared after NFC: morquis `8a9b013`, `5bee2f6`
  - Account UUID and path from the mailbox URL: fpjnijweide `05305b2`
- **Recommendation:** A structured value: the account plus the path as a list of names (MAIL-69, MAIL-70). A joined string is ambiguous whenever a name contains the separator, which morquis admits for `/`.
- **Needs a human decision:** No — the separator collisions settle it.

#### MAIL-C15 Where email dates come from

- **Options:**
  - AppleScript `date sent as string`, in the Mac's locale with no offset: brightline `ba218e6`; gene-jelly `c5a0edd`; felkru `c769cc0`; nivra `2860fb6`
  - The current time, made up: ANierbeck `2c5506c` (and upstream's `new Date()` fallback)
  - Localised text parsed again afterwards: sicdigital `3c13e0d`; ANierbeck `3005df4` (a local-epoch sort key)
  - A JXA `Date` serialised as ISO: chrischall `25d47cc`
  - The store's Apple-epoch seconds: fpjnijweide `6cf16c0`
- **Recommendation:** Take instants from the store and report ISO 8601 with an offset. A missing date is unknown, never invented (MAIL-49, MAIL-80). sicdigital shows German and French dates turning into null when localised text is parsed again.
- **Needs a human decision:** No — the locale failures and the made-up timestamps settle it.

#### MAIL-C16 Attachments: listing, opening and saving

- **Options:**
  - Return paths into Mail's own storage: fpjnijweide `48cd701`
  - Match a name loosely and save into `~/.apple-mcp/attachments`: felkru `22aa354`
  - Save anywhere under `$HOME`, and attach any file on disk: chrischall `18660e4`, `d401ca1`
  - Export into any folder the caller names: morquis `db82ca5`, `e64a658`, `de6b9f6`
- **Recommendation:** List attachments by name, type, size and MIME part (as for Messages, upstream #62 and #3). Open one by its part, never by a loose name (MAIL-51, MAIL-94). Sending, saving and exporting attachments are **Out of scope**: [#18](https://github.com/that-mathevs/apple-native-mcp/issues/18) fixes v1's six writes and none of them writes a file, and [#19](https://github.com/that-mathevs/apple-native-mcp/issues/19) names the settings — capabilities, calendars, mail accounts, note folders, chats and the send allow-list — with no download or export folder among them. MAIL-64, MAIL-65 and MAIL-108 are parked there.
- **Needs a human decision:** No — the exfiltration and persistence paths in chrischall C22 and morquis C25 settle it, and #18 and #19 settle the scope.

### Verification tasks

- Mechanism questions: see #7.
  - "MailKit" isn't MailKit: the binary links only Foundation and wraps `/usr/bin/osascript` (already shown with `otool -L`; #7 should record it and close the question). *From:* ANierbeck `2c5506c`.
  - Is a `whose` filter on `read status` or `date sent` much faster than iterating on large IMAP and Exchange inboxes? Is it evaluated against the local store or as IMAP SEARCH? *From:* ANierbeck `3005df4`.
  - On a mailbox of more than 100k emails: (a) does `whose read status is false` time out, (b) does a bulk property fetch over a range finish in under 2 s, and (c) is `message 1` the most recently received email for IMAP, iCloud and Exchange? *From:* brightline `ba218e6`, `0833904`, `d2eef83`.
  - Is `messages of mailbox` ordered by date, arrival or id? "Latest" in several forks depends on it. *From:* gene-jelly `bb07be5`; felkru `c769cc0`; chrischall `18660e4`; upstream PR #73; upstream #58.
  - Timings on a 10k-email mailbox with a few unread: (1) a loop over each email, (2) a `whose` filter plus a property read per email, (3) an `unread count` pre-check plus bulk reads, (4) an Envelope Index query. Does a `whose` filter force Mail to download uncached headers? *From:* gene-jelly `c5a0edd`; upstream #53 (the same failure in Reminders).
  - Does adding `dateSent > since` to a `whose` filter cut search time about 10x on a large IMAP account? *From:* chrischall `e23e11e`.
  - With 5 accounts, do bulk fetches run one account after another with no pause leave Mail responsive? How much of the hang comes from fetching `content`, and how much from timed-out osascript processes that keep running? *From:* brightline `84edc6b`, `304f384`.
  - Does `mailbox "INBOX" of account` resolve for Exchange and POP accounts? Does Mail's unified `inbox` expose each account's inbox? Is there a language-independent way to recognise the inbox? *From:* brightline `ba218e6`; morquis `d76f3ec`.
  - Do the application-level `mailboxes` exclude account mailboxes? Does `mailboxes of account` include nested mailboxes and Gmail labels? *From:* brightline `ba218e6`; gene-jelly `c5a0edd`; felkru `c769cc0`; chrischall `25d47cc`.
  - Is `unread count` reliable for IMAP accounts? ANierbeck considers it unreliable, while chrischall and gene-jelly rely on it. *From:* ANierbeck `3005df4`; chrischall `18660e4`; gene-jelly `c5a0edd`.
  - On macOS 14–26, is Envelope Index `messages.date_sent` in seconds since 2001-01-01, and is `mailboxes.url` of the form `<scheme>://<account-uuid>/<percent-encoded path>`? Does `summaries.summary` hold full text or a preview? Why were `ews://` accounts excluded? *From:* fpjnijweide `6cf16c0`, `05305b2`, `42c9e11`, `c8e39f6`.
  - Are `.emlx` files named by `messages.ROWID` under `V10/<account-uuid>/**/Messages/`? Is the data directory still `V10` on macOS 26? *From:* fpjnijweide `42c9e11`, `48cd701`; felkru `22aa354`.
  - Does the Envelope Index give the mailbox tree and the unread and total counts without scripting? *From:* morquis `8a9b013`, `5bee2f6`, `6361803`, `5c01104`.
  - Is Mail's scripting `id` of an email stable across Mail restarts and mailbox rebuilds, or is Message-ID plus mailbox the only durable reference? *From:* morquis `51e80da`, `0d6918a`; chrischall `18660e4`.
  - Which permission does a read of `~/Library/Mail` need on macOS 14–26 (Full Disk Access, or the "access data from other apps" prompt), and what error does a denied read produce, so MAIL-43 can name it? (permission prompts) *From:* fpjnijweide `6cf16c0`; felkru `22aa354`.
  - Are the Exchange timings ("30 s → 564 ms", "4 min → 30–130 s") reproducible? *From:* morquis `d76f3ec`.
- **MAIL-V1** A draft email created through Mail's scripting interface without a visible window and then saved appears in the account's Drafts mailbox and survives quitting Mail, while one that is never saved does not. *From:* KassebaumEngineering `1e95e41`; chrischall `1a45550`, `bfa14df`; upstream PR #68; upstream open question 6. *Proves it:* with an iCloud and a Gmail IMAP test account, a static JXA script makes an outgoing email with `visible:false` and saves it. The draft is listed in that account's Drafts mailbox in Mail's UI and on the server (webmail), and is still there after Mail is quit and reopened. The same script without the save leaves nothing. *Disproves it:* the saved draft is missing from Drafts or disappears after a restart, or saving without a window throws or opens a compose window anyway.
- **MAIL-V2** After Mail sends an email through its scripting interface, that email appears in the sending account's Sent mailbox within a bounded time, so a send can be confirmed from the store. *From:* morquis `d76f3ec` (no Sent check); brightline `859a9c8` (no read-back); NN3. *Proves it:* for iCloud, Gmail IMAP and Exchange test accounts, send to a test address the user owns. Poll the account's Sent mailbox (by scripting and in the Envelope Index) and record how long the email takes to show up, with its Message-ID. It appears for every account type within a measured time (for example under 30 s), including a Gmail account whose server stores sent mail itself. *Disproves it:* for some account type the email never appears in any mailbox Mail shows as Sent, or only after an unbounded sync delay.
- **MAIL-V3** Same claim as **X-V5** (starting an app in the background avoids the System Events prompt and
  the focus steal), for Mail; tracked there. *From:* ANierbeck `3005df4`; morquis `d76f3ec`; felkru `c769cc0`.
- **MAIL-V4** Right after Mail launches, it reports zero accounts for a measurable time before its accounts load. *From:* felkru `c769cc0` (C2 and its open question). *Proves it:* on a Mac with at least two accounts, quit Mail, start it, and read the account count every 100 ms from launch. The count reads 0 for one or more samples before it reaches the real number, and the time is recorded. *Disproves it:* the first successful answer after launch already has the full count, which makes a readiness poll unnecessary.
- **MAIL-V5** Mail treats one recipient whose address string holds two comma-separated addresses as two recipients, which is the bypass of a regex allowlist. *From:* KassebaumEngineering `13fd400` (C5 and its open question). *Proves it:* add one `to` recipient whose address is `a@example.test, b@example.test` (both test mailboxes the user owns), save it as a draft or send it, and inspect the recipients Mail shows and the delivered headers. Two recipients appear. *Disproves it:* Mail refuses the address, or sends only to the first one.
- **MAIL-V6** Same claim as **X-V8** (clients give up on a slow tool call at a fixed time), with the
  five-account sequential read as the case to size; tracked there. *From:* brightline `84edc6b`, `304f384`.
- **MAIL-V7** (permission prompts) Same claim as **X-V3** (asking an app for `name` sends no Apple Event
  that needs Automation), for Mail; tracked there. *From:* upstream #69; upstream open question 1.
- **MAIL-V8** (only if in scope) Only needed if trashing enters scope: Mail's `delete` on an email always moves it to a recoverable Trash, including for Exchange accounts and accounts set to erase deleted emails immediately. *From:* ANierbeck `3005df4` (open question). *Proves it:* delete one test email per account type and setting, and find each one in that account's Trash, restorable. *Disproves it:* any email is erased outright.
- **MAIL-V9** (only if in scope) Only needed if a "replied" state enters scope: Mail exposes a scripting property on an email that is set exactly when the user has replied to it. *From:* gene-jelly `bb07be5` (C5). *Proves it:* reply to one test email from Mail and to another from webmail, and leave a third alone. The property is true for the first, reflects the server's answered flag for the second, and is false for the third. *Disproves it:* the property is missing, or wrong in any of those cases.
- **MAIL-V10** (only if in scope) Only needed if mailbox management is proposed: creating, renaming, moving and deleting a mailbox through Mail's scripting interface is unreliable on Exchange/M365 accounts. *From:* morquis `016aeaf`, `2465ad5`, `5c01104` (C26). *Proves it:* each operation, run 10 times on an Exchange test account, fails, or its result differs from what the server shows after sync. *Disproves it:* every run is reflected on the server.

### Credits

- **brightline:** mailboxes belong to accounts, so reading all mail means walking the accounts; one bounded read per account, where a failing account is named and doesn't sink the others; go to the inbox directly instead of walking every mailbox; saying how far back a read looked; the field report of which reads hang Mail.
- **felkru:** accounts listed as configured, with local mailboxes kept apart from account mailboxes; waiting within a budget until Mail is ready; "latest" meaning newest by date; the `.emlx` and attachment layout facts; listing attachments by name, type and size; an email's links returned as structured data, long links included.
- **gene-jelly:** pushing the unread filter into the store instead of checking one email at a time; covering every account; triage operations (archive, move, delete, mark read) and a "replied" state as wanted features (later scope), with mailboxes resolved exactly.
- **ANierbeck:** hiding mail accounts from the agent; unread mail from the inbox, newest first, skipping emails that can't be read; finding an account by name or email address; checking cc and bcc recipients too; starting an app before driving it; showing that "MailKit" is an osascript wrapper.
- **KassebaumEngineering:** a draft as the safe default way to compose; a send allowlist that fails closed and refuses unparsable recipient fields.
- **chrischall:** a search that states its range; searches scoped to an account and mailbox; unread counts per mailbox; accounts with their email addresses; checking an identifier's shape before touching Mail; restricting attachments to configured folders; replies kept behind the same per-send confirmation as sends.
- **danielk-am:** labelling every result with both its account and its mailbox.
- **fpjnijweide:** the Envelope Index as a candidate read path; sender, subject and body filters combined with AND; addressing an email by a stable identifier from a search result; reading one email's full text on demand.
- **morquis:** mailbox paths inside an account compared after NFC; counts only when asked; localised inbox names; email metadata without bodies; an email reference with Message-ID, account and mailbox; cursor paging; a search that names its range; searching attachment names; dry runs with before-and-after reports; retiring mailbox management that doesn't work; starting Mail without bringing it to the front; exports only into a configured folder (later scope).
- **nivra:** evidence that parsing osascript's human-readable output was why nothing came back; a time budget with a named timeout.
- **sicdigital:** ISO 8601 timestamps; a missing date reported as unknown, not invented.
- **long-tail/zaclohrenz:** real accounts and mailboxes, with a failed read reported as an error, never an empty result.
- **faces-sh:** one known search grammar with a test corpus shared across apps; a result page that says what it is a page of.
- **upstream PR #73:** real accounts and mailboxes, failing instead of returning an empty list, and unread mail from every account's inbox when no account is named.
- **upstream PR #68:** drafts.
- **upstream PR #37:** search scoped by account, mailbox and date range; a date-only end date covering the whole day.

## Cross-cutting

### Scenario backlog

#### starting the server

- [ ] **X-01** [acceptance] touches no app and no store until a tool is called: touching apps at startup crashed Reminders · — · upstream #10

#### listing tools

- [ ] **X-02** [acceptance] given the default configuration, offers only tools that read: writes are off until configured · NN2 · fpjnijweide `48cd701`
- [ ] **X-03** [acceptance] given a capability that is not enabled, does not list its tools · NN2 · chrischall `038ce2e`, `9efd4ef`, `0703ad1`, `473181a`, `add4b64`, `815f121`, `209f3a4`; faces-sh `784db41`, `42c2fd7`; upstream PR #76
- [ ] **X-04** [acceptance] lists exactly the operations the server can perform, one tool for each · — · morquis `64230cd`, `47f1515`, `5ce2351`, `fa7e5f9`, `db82ca5`, `59d3aa3`, `5c01104`
- [ ] **X-05** [acceptance] marks every tool that only reads as read-only and not destructive · — · ANierbeck `87cb579`, `3005df4`; mjmcg `dcf1993`, `fed09d1`; upstream PR #76
- [ ] **X-06** [acceptance] marks every tool that changes a store as not read-only, so a client can ask before it runs · NN2 · fpjnijweide `48cd701`; upstream PR #76
- [ ] **X-07** [acceptance] marks every tool that changes or deletes existing data as destructive, `update_note` included: it changes data that already exists and can lose formatting · — · chrischall `038ce2e`, `9efd4ef`, `0703ad1`, `473181a`, `add4b64`, `815f121`, `209f3a4`; mjmcg `dcf1993`, `fed09d1`; #22 (correction), #18
- [ ] **X-08** [acceptance] marks a tool that only adds a new item as not destructive: the hint means the tool may destroy something · — · ANierbeck `87cb579`, `3005df4`; upstream PR #76
- [ ] **X-09** [acceptance] marks sending a message or an email as not read-only, destructive, not idempotent and open-world: a send reaches other people and cannot be taken back · NN2 · ANierbeck `87cb579`, `3005df4`; upstream PR #76
- [ ] **X-10** [acceptance] given an in-memory client, offers the same tools as over stdio · — · sicdigital `c36da30`
- [ ] **X-72** [acceptance] given a client that did not declare elicitation, offers no send tool, and no setting turns one on: a rule that holds only on some clients can't be stated honestly · NN2 · ADR-0004
- [ ] **X-92** [acceptance] offers no tool that prepares a send for another tool to complete: the token would come back in a tool result and pass through the model · NN2 · ADR-0004, #5

#### calling a tool

- [ ] **X-11** [acceptance] makes no network connection in any operation · — · upstream #71
- [ ] **X-12** [acceptance] given a tool name the server has never had, answers with an error result and keeps answering later calls · — · therealap `1ad9f60`, `5f50276`
- [ ] **X-13** [acceptance] given a tool name the server has never had, refuses it as unknown rather than disabled · — · faces-sh `42c2fd7`, `ac53e87`
- [ ] **X-14** [acceptance] given a capability that is not enabled, refuses the call as disabled and names the setting that enables it: hiding a tool from the list does not disable it · NN2, NN5 · faces-sh `784db41`, `42c2fd7`; gene-jelly `b99bbce`; sicdigital `e066b89`, `fa5a728`, `c36da30`, `398bcd5`, `91d7447`, `dd291b9`
- [ ] **X-15** [acceptance] given any refusal or failure, answers with a tool error the agent can read, never a protocol error: some clients never show protocol errors to the model · — · sicdigital `e066b89`, `fa5a728`, `c36da30`, `398bcd5`, `91d7447`, `dd291b9`; upstream #15
- [ ] **X-16** [acceptance] given arguments that fail validation, names each invalid argument and what it accepts · NN5 · chrischall `7c36fdc`; therealap `1ad9f60`, `5f50276`; upstream #15
- [ ] **X-17** [acceptance] given arguments that fail validation, refuses before touching any app or store · NN1 · therealap `1ad9f60`, `5f50276`; chrischall `9efd4ef`, `add4b64`, `209f3a4`, `bf6dc37`, `29af0a2`, `91e0101`, `6831a90`, `18660e4`
- [ ] **X-18** [acceptance] given a limit that is not a positive whole number, refuses and names the argument: only a number may reach the store · NN1 · chrischall `9efd4ef`, `add4b64`, `209f3a4`, `bf6dc37`, `29af0a2`, `91e0101`, `6831a90`, `18660e4`; fpjnijweide `48cd701`; sicdigital `d261523`, `eef6636`
- [ ] **X-19** [acceptance] given an argument the tool does not declare, refuses the call: an ignored filter would make the reply lie · NN3 · fpjnijweide `48cd701`
- [ ] **X-20** [acceptance] given any failure, answers with a named failure record carrying a stable code and one sentence saying what did not happen, with `isError` true · NN5 · faces-sh `42c2fd7`, `ac53e87`; upstream #15; ADR-0006
- [ ] **X-21** [acceptance] given the app or store behind the tool complained, carries its words verbatim in the failure's evidence field, capped, never paraphrased · — · faces-sh `42c2fd7`, `ac53e87`; ADR-0006
- [ ] **X-22** [acceptance] given an unexpected internal error, reports a generic failure without file paths or stack traces · — · ANierbeck `dd7eecb`
- [ ] **X-23** [acceptance] given a failure that suggests a next step, names the action to take rather than a tool name that may not exist in the caller's toolset · NN5 · faces-sh `616cefe`, `049af46`, `6fe0c03`
- [ ] **X-24** [acceptance] puts everything the agent needs in the records it returns in `content`, mirrored in `structuredContent` against an output schema, never only in a side field: clients do not show side fields · — · faces-sh `94149a2`, `dbffae5` (fork-internal #504, #499); ADR-0006
- [ ] **X-73** [acceptance] given a client that did not declare elicitation, refuses a send at dispatch and names the missing client support, for a client holding an older tool list · NN2, NN5 · ADR-0004, #19
- [ ] **X-79** [acceptance] given arguments naming a capability, a setting or a helper path, changes nothing about what is enabled: settings never come from tool input · NN2 · #19, ADR-0003
- [ ] **X-83** [acceptance] given a write the store could not confirm, reports an unconfirmed outcome and not an error, so the agent does not try the write again · NN3 · ADR-0006, #9

#### calling a tool that reaches an app

- [ ] **X-25** [acceptance] given Automation permission for the app is not granted, reports a permission failure naming the app, the setting to change and where it is · NN5 · ANierbeck `dd7eecb`; brightline `2bcee54`; nivra `0b616cd`, `2860fb6`; faces-sh `ac53e87`, `4c3096d`, `42c2fd7`; upstream #65, #71
- [ ] **X-26** [acceptance] given the app does not answer within its time budget, reports that the app timed out, not that permission is missing (after X-V2) · NN5 · brightline `2bcee54`; nivra `0b616cd`, `2860fb6`
- [ ] **X-27** [acceptance] given the store could not be read, reports a failure naming why, never an empty success · NN3 · upstream #66, #58, #69, #67, #75; faces-sh `42c2fd7`, `ac0058a`; morquis `96759b3`, `d76f3ec`; mjmcg `88e26b9`, `d4ec06d`, `bde3e31`; KassebaumEngineering `1d47e74`; nivra `0b616cd`, `2860fb6`
- [ ] **X-90** [acceptance] reads no protected store from the server process itself: every privacy-protected access goes through the helper · NN1, NN5 · ADR-0002

#### calling a tool that returns a list

- [ ] **X-28** [acceptance] given more matches than the page holds, says more exist and how to ask for the next page · NN3 · sicdigital `d261523`, `eef6636`
- [ ] **X-81** [acceptance] given items the settings exclude, says how many were left out and never their titles or identifiers · — · #19

#### the settings

- [ ] **X-29** [domain] given a write capability nobody configured, treats it as off · NN2 · sicdigital `e066b89`, `fa5a728`, `c36da30`, `398bcd5`, `91d7447`, `dd291b9`
- [ ] **X-30** [domain] given the client's configuration cannot be read or does not parse, treats every write capability as off and says why · NN2 · KassebaumEngineering `13fd400`; sicdigital `91d7447`; #19
- [ ] **X-78** [domain] requires a confirmation for every send whatever the settings say: no configuration removes it · NN2 · ADR-0004
- [ ] **X-80** [domain] reads capabilities only from the client's configuration, so nothing the server itself can write can turn a write on · NN2 · #19

#### a confirmation

- [ ] **X-31** [domain] counts only an explicit approval from the user, never a model's reply · NN2 · brightline `859a9c8`; ADR-0004
- [ ] **X-74** [domain] given a response that leaves the required field unset, counts it as a decline: a client that auto-accepts an empty form is not a person · NN2 · ADR-0004
- [ ] **X-75** [domain] given a decline or a cancel, sends nothing and says the user declined · NN2 · ADR-0004
- [ ] **X-76** [domain] shows the resolved recipient, how it was resolved, the service and the whole body, never truncated · NN2 · ADR-0004
- [ ] **X-77** [domain] given a body that differs from the one confirmed, refuses: what was approved is what is sent · NN2 · ADR-0004

#### failure evidence

- [ ] **X-32** [domain] given evidence carrying a bearer token, redacts the credential and keeps the rest · — · faces-sh `42c2fd7`, `ac53e87`
- [ ] **X-33** [domain] given evidence longer than the cap, cuts it and marks the cut · — · faces-sh `42c2fd7`, `ac53e87`
- [ ] **X-82** [domain] given evidence naming a path inside the user's home directory, keeps the evidence verbatim but writes that path with the home directory replaced by `~` · — · ADR-0006, #22

#### a permission failure

- [ ] **X-34** [domain] never suggests anything it cannot know, such as trying again · NN5 · faces-sh `ac53e87`, `4c3096d`, `42c2fd7`; upstream #65, #71

#### a page of results

- [ ] **X-35** [domain] knows whether it is complete · NN3 · therealap `5176aa5`
- [ ] **X-36** [domain] given fewer shown than exist, states both numbers · NN3 · faces-sh `54c30e3`, `799d643`, `16172e8`, `ccc9f55`
- [ ] **X-37** [domain] given the page is at the hard ceiling, advises narrowing rather than asking for more · — · faces-sh `54c30e3`, `799d643`, `16172e8`, `ccc9f55`

#### a timestamp

- [ ] **X-38** [domain] given an instant from the store, reports it as ISO 8601 with the user's UTC offset: localised date text cannot be compared · — · sicdigital `3c13e0d`; chrischall `18660e4`, `bf6dc37`, `91e0101`, `6831a90`, `0860cf8`

#### the stdio server

- [ ] **X-39** [contract] writes nothing but protocol messages to stdout, and all diagnostics to stderr · — · brightline `985444b`; upstream #8
- [ ] **X-40** [contract] given a result larger than a pipe buffer, delivers it whole · — · brightline `985444b`
- [ ] **X-41** [contract] given a client built on the official Python SDK, completes initialisation and lists its tools · — · upstream #36

#### the extension package

- [ ] **X-42** [contract] advertises exactly the tools the server lists · — · therealap `1ad9f60`

#### the helper binary

_[ADR-0003](../adr/0003-signed-helper-at-a-fixed-path.md), decided in
[#8](https://github.com/that-mathevs/apple-native-mcp/issues/8), settles X-C13._

- [ ] **X-84** [acceptance] given a binary at the fixed path that does not meet the pinned code requirement, refuses to copy over it or to run it, and fails by name: the path is user-writable and a stranger's binary there would prompt under a trusted name · NN5 · ADR-0003
- [ ] **X-85** [acceptance] given the helper changed since it was installed, checks it again and refuses it: the requirement is checked before every launch, not once · NN5 · ADR-0003
- [ ] **X-86** [acceptance] given a helper newer than the one it ships, keeps the newer one and names which client's install to update rather than replacing it · NN5 · ADR-0003, #8
- [ ] **X-87** [acceptance] given a development build and no developer setting in the client's configuration, refuses it · NN2, NN5 · ADR-0003
- [ ] **X-91** [acceptance] installs the helper from the package it shipped in, running no install script and fetching nothing from the network · NN1 · #8

#### the automation runner

_[ADR-0002](../adr/0002-helper-owns-every-protected-access.md) moves this port behind the helper
protocol: static scripts are run by the Swift helper, not by a Node adapter. The behaviours below
stand as written, and X-C11's open question about argv against stdin is now internal to the helper._

- [ ] **X-43** [contract] given a string containing quotes, backslashes, line breaks, «guillemets», dollar patterns, shell metacharacters or script source, delivers it to the script unchanged and runs nothing it contains · NN1 · ANierbeck `cd72bdf`, `fc893d7`; faces-sh `784db41`; morquis `d76f3ec`, `96759b3`; nivra `0b616cd`, `2860fb6`; sicdigital `791f5f2`, `d5d5df0`; brightline `859a9c8`; boutquin `2894ab6`, `8a5d2e0`; chrischall `2e06954`, `18660e4`, `88b58d0`, `bf6dc37`, `29af0a2`, `60f9977`, `91e0101`, `6831a90`, `1a358d6`, `fa61e37`
- [ ] **X-44** [contract] given arguments of any JSON type, passes numbers, booleans and lists as data and never as script source · NN1 · chrischall `9efd4ef`, `add4b64`, `209f3a4`, `bf6dc37`, `29af0a2`, `91e0101`, `6831a90`, `18660e4`
- [ ] **X-45** [contract] given a message body of any size or content, delivers it to the script without writing it to disk (after X-V6) · — · ANierbeck `39cc53a`; brightline `859a9c8`; upstream #71
- [ ] **X-46** [contract] given a script that returns a list of records, hands back every record as structured values with its fields intact, not the text the script printed · NN3 · sicdigital `791f5f2`; therealap `220462c`, `a675a7b`; boutquin `2894ab6`; nivra `0b616cd`, `2860fb6`; upstream #67, #58, #26
- [ ] **X-47** [contract] given a field containing separator-like text or text that imitates another record, returns it unchanged inside its own field: results are structured, not delimited · — · boutquin `2894ab6`; therealap `220462c`, `a675a7b`; chrischall `18660e4`, `bf6dc37`, `91e0101`, `6831a90`, `0860cf8`; ANierbeck `d2b9bf5`
- [ ] **X-48** [contract] given output that is not the expected structure, refuses it rather than inventing an untitled item · NN3 · danielk-am `9d9122c`; upstream #67
- [ ] **X-49** [contract] given a result larger than a megabyte, returns all of it or fails naming the size · NN3 · KassebaumEngineering `1d47e74`; upstream #67, #58, #75
- [ ] **X-50** [contract] given a script that outlives its time budget, stops it and leaves no process behind before reporting the timeout: a script left running keeps the app busy · — · brightline `84edc6b`, `304f384`; morquis `97d5918`, `a8283e2`, `a977f72`; nivra `0b616cd`, `2860fb6`; upstream #59, #19, #58
- [ ] **X-51** [contract] given a child that ignores the polite stop, still ends it after the grace period · — · morquis `97d5918`, `a8283e2`, `a977f72`
- [ ] **X-52** [contract] given the client cancels a request, stops the script it started so the app is left alone, and ends its own work on its time budget whether or not a cancellation ever arrives · — · upstream #22, #59; #25
- [ ] **X-53** [contract] given a script still running, keeps answering other requests · — · nivra `0b616cd`, `2860fb6`
- [ ] **X-54** [contract] given the target app refuses Apple Events, reports a missing Automation permission that names the app, told apart by error number rather than message text (after X-V1) · NN5 · morquis `97d5918`, `a8283e2`, `a977f72`; faces-sh `42c2fd7`, `ac53e87`
- [ ] **X-55** [contract] given a script that throws, reports a named script failure carrying the script's message · NN5 · upstream #19

#### the automation scripts

_Shipped with the helper and run by it ([ADR-0002](../adr/0002-helper-owns-every-protected-access.md))._

- [ ] **X-56** [contract] given the shipped scripts, every one compiles · — · felkru `c769cc0`
- [ ] **X-57** [contract] each one runs under osascript with only the arguments it declares, on every macOS version it ships for · — · upstream #19

#### the native helper

- [ ] **X-58** [contract] given a request with any string argument, receives that argument byte for byte · NN1 · Bendix-ai `6e5ff6c`, `bb0c1ab`; upstream #74, #25
- [ ] **X-59** [contract] writes nothing but protocol responses to its output stream · — · ANierbeck `8bfaa0c`, `a414c57`, `f745119`
- [ ] **X-60** [contract] given a request for a protocol version it does not speak, refuses with a version mismatch · — · arr2036 `9097294`
- [ ] **X-61** [contract] given a request it could not complete, answers with a named failure, never with free text or a partial success · NN3 · arr2036 `9097294`; mjmcg `88e26b9`, `d4ec06d`, `bde3e31`
- [ ] **X-62** [contract] keeps serving other requests while one store query runs · — · arr2036 `9097294`
- [ ] **X-63** [contract] given a query that runs out of time, stops the work rather than leaving it running · — · long-tail/dewdad `31ac622`; upstream #74, #25, #70
- [ ] **X-64** [contract] given a result larger than the response limit, answers with a page instead of a truncated response · NN3 · mjmcg `2743d84`
- [ ] **X-65** [contract] given access has never been asked for, asks once before reading · NN5 · brightline `4fb39a3`; upstream #65
- [ ] **X-66** [contract] reports every date in the user's local time with its offset · — · faces-sh `7160b0a`, `bfd5b64`, `4587d0a`; upstream #64, #34, #53, #27
- [ ] **X-67** [contract] given the helper does not answer within its time budget, ends the helper process, forcing it after a grace period, and reports a timeout · — · morquis `97d5918`, `a8283e2`, `a977f72`
- [ ] **X-68** [contract] given the helper process crashed, starts it once more and then reports a named failure · NN5 · plan.md Phase 2 (edge cases for the walking skeleton)
- [ ] **X-88** [contract] given a request naming a script or a query it does not ship, refuses it: the helper runs only the scripts and prepared statements built into it · NN1 · ADR-0002
- [ ] **X-89** [contract] asks macOS for access under its own identity, so no grant lands on the process that launched it · NN5 · ADR-0002, #4

#### every store port

- [ ] **X-69** [contract] given an empty store, reports empty; given an unreachable store, reports a named failure · NN3 · upstream #66; faces-sh `42c2fd7`, `ac0058a`
- [ ] **X-70** [acceptance] given the native helper is not installed or cannot be reached, fails with a named failure that says how to fix it, never a scripted fallback: a fallback returns different data under a different permission · NN3, NN5 · Bendix-ai `3366690`, `6e5ff6c`, `9599219`, `d8c994a`, `fff9dd8`; faces-sh `dbffae5`, `82efc89`, `7160b0a`, `4587d0a`; upstream #53, #26, #10

#### a date range

- [ ] **X-71** [domain] given a start date with no time, begins at local midnight of that day, and given an end date with no time, includes the whole of that day: the rule every context's date filters share · — · upstream PR #28, PR #37

### Conflicts

#### X-C1 What a call to a capability that is switched off says

- **Options:**
  - Refuse as disabled (`app_disabled`), checked after "unknown tool": faces-sh `784db41`, `42c2fd7`, `ac53e87`
  - Refuse as if the tool did not exist. The fork itself only removed the tool from the list, which
    left it callable: gene-jelly `b99bbce`
  - Refuse with a readable tool error saying the operation isn't permitted: sicdigital `c36da30`,
    `91d7447`, `dd291b9`
- **Recommendation:** Refuse at dispatch, as disabled, and name the setting that enables it (X-14).
  Keep "unknown tool" a separate answer (X-13). Pretending the tool doesn't exist hides nothing, because
  the tool list is public, and it breaks NN5.
- **Needs a human decision:** No — NN5 settles it. The setting's name and where it lives feed map fog
  "Settings".

#### X-C2 How writes and other capabilities are switched on

- **Options:**
  - A per-app switch in an environment variable. Unset exposes every app: faces-sh `784db41`, `42c2fd7`
  - A per-token deny-list of operations, where the "read" token still creates items: sicdigital
    `e066b89`, `fa5a728`, `c36da30`, `398bcd5`, `91d7447`, `dd291b9`
  - One global environment switch that skips every confirmation: brightline `859a9c8`
  - No gate, with delete tools next to reads: chrischall `038ce2e`, `815f121`; mjmcg `dcf1993`, `fed09d1`
  - A policy file read on every call, failing closed when it is missing or corrupt:
    KassebaumEngineering `13fd400`
- **Recommendation:** Use an allow-list per capability. It is off when unset (X-29), fails closed when
  the settings can't be read (X-30), and is checked both when listing tools and at dispatch (X-03, X-14).
  A deny-list lets every future write through, and a per-app switch leaves an app's writes on with its
  reads.
- **Settled by [#19](https://github.com/that-mathevs/apple-native-mcp/issues/19):** one capability
  per write operation — #18 fixed v1's writes at six, so the list is short enough to name each one —
  set only in the client's `env` block. **No settings file in v1**, because every file the server can
  read is one an agent with file access can write, and that would let a prompt-injected agent grant
  itself the capability to send. Off when unset (X-29), fails closed (X-30), checked in the tool list
  and again at dispatch (X-03, X-14), and never changed by tool input (X-79, X-80).

#### X-C3 Who a send may reach

- **Options:**
  - An exact-string allowlist in an environment variable. Otherwise any contact whose phone loosely
    matches passes, and email is open by default: ANierbeck `813c232`
  - An allowlist file, with numbers matched on their last 10 digits and addresses pulled out by regex.
    Fails closed: KassebaumEngineering `13fd400`
  - Known recipients only, meaning handles the user has already messaged: plan.md NN4; upstream #48
- **Recommendation:** NN4's known-recipient rule is the default. An explicit allowlist is an optional
  setting that narrows it further. Numbers are compared as normalised E.164 and addresses as parsed
  addresses, and a recipient field that doesn't parse completely is refused. The reports show bypasses
  in last-10-digit, substring and regex matching.
- **Settled by [#16](https://github.com/that-mathevs/apple-native-mcp/issues/16)
  ([ADR-0005](../adr/0005-a-known-recipient-is-one-with-real-traffic.md)):** a send may reach only a
  handle the user has **real traffic** with, matched on a normalised form exactly. An allowlist
  narrows that and can never widen it ([#19](https://github.com/that-mathevs/apple-native-mcp/issues/19)).
  Messages and Mail own the scenarios.

#### X-C4 How a write is confirmed

- **Options:**
  - Ask through MCP sampling, approve if the reply contains "yes", and offer a global skip switch:
    brightline `859a9c8`
  - Rely on tool annotations and the client's own approval: ANierbeck `87cb579`, `3005df4`;
    upstream PR #76
  - User confirmation through MCP elicitation: plan.md NN2 (see closed #5)
- **Recommendation:** Never use sampling. It asks a model with the same possibly injected context, and
  substring matching accepts "no, I would not say yes". Annotations are advisory. Keep X-31 as the domain
  rule, whatever mechanism #9 picks.
- **Settled by [#9](https://github.com/that-mathevs/apple-native-mcp/issues/9)
  ([ADR-0004](../adr/0004-sends-require-elicitation.md)):** every send is confirmed through MCP
  elicitation, and a client that doesn't declare it is not offered the send tools at all. X-31
  stands as written, and X-72 to X-78 and X-92 carry the rest.

#### X-C5 How tools are annotated

- **Options:**
  - Sends destructive, other writing tools not destructive, no `openWorldHint`: ANierbeck `87cb579`,
    `3005df4`
  - Every tool open-world, every writing tool not destructive "because none of them support DELETE":
    upstream PR #76
  - Every tool that changes a store destructive (scenario only; the fork set no annotations):
    fpjnijweide `48cd701`
  - No annotations: chrischall `038ce2e`, `209f3a4`; mjmcg `dcf1993`, `fed09d1`
- **Recommendation:** Follow the MCP definitions:
  - `readOnlyHint` is true only on reads (X-05) and false on anything that changes a store (X-06).
  - `destructiveHint` is true on updates, deletes and sends (X-07, X-09) and false on pure creates (X-08).
    v1's only update is `update_note`, and it is destructive: #22's parenthesis "v1 has no updates or
    deletes" was corrected on that ticket.
  - `idempotentHint` is false on creates and sends.
  - `openWorldHint` is true on sends only (a local lookup is not open-world, contrary to PR #76).

  fpjnijweide's "every change is destructive" is kept as X-06, which is what actually makes a client
  ask.
- **Needs a human decision:** No — the spec's definitions settle reads, creates and deletes. NN2
  settles sends toward the cautious reading (upstream open question 7).

#### X-C6 What shape a tool result takes

- **Options:**
  - Prose in `content`: a short index for lists and full detail for one item: faces-sh `94149a2`,
    `dbffae5`, `54c30e3`
  - A JSON envelope `{data, pagination}`: sicdigital `d261523`, `eef6636`
  - Prose, with an "external content" banner around bodies: ANierbeck `d2b9bf5`
- **Recommendation:** Return JSON in `content`, mirrored in `structuredContent` with an output schema.
  A body is then a field and can't pose as another record (ANierbeck's banner and `||` parsing were both
  forged by one email). Keep faces-sh's split between index and detail so a list stays small (its notes
  list was 2.3 MB of prose).
- **Settled by [#22](https://github.com/that-mathevs/apple-native-mcp/issues/22)
  ([ADR-0006](../adr/0006-results-are-records-not-prose.md)):** every tool returns JSON records in
  `content`, mirrored in `structuredContent` against an output schema, and text the user didn't
  write is always a field (X-24, X-46, X-47). No banner and no per-field marker: the protection is
  structural. A failure is a record with a stable code, one sentence and the outside evidence
  verbatim, carried with `isError: true` (X-20, X-21). `unconfirmed` is an outcome field, not an
  error (X-83).

#### X-C7 How much of an underlying error reaches the agent

- **Options:**
  - Keyword sanitising: pass a message through only if it contains "access", "invalid" and similar,
    otherwise a generic line: ANierbeck `dd7eecb`
  - A named code, one sentence, then the evidence verbatim, capped and redacted: faces-sh `42c2fd7`,
    `ac53e87`
  - One fixed hint that blames permissions for every timeout: brightline `2bcee54`
  - The helper's stderr passed through as the message: mjmcg `88e26b9`, `d4ec06d`; brightline `4fb39a3`
- **Recommendation:** Use faces-sh's envelope for failures that come from an app, a store or the
  helper (X-20, X-21, X-32, X-33). Give the server's own unexpected errors a generic failure with no paths
  or stack (X-22) and log the detail to stderr.
- **Needs a human decision:** No — both sets of scenarios hold once evidence from the outside is told
  apart from the server's own bugs. Keyword sanitising hid Automation denial (-1743), the most common
  failure.

#### X-C8 How a failure is recognised as a missing permission, a timeout or a script error

- **Options:**
  - Error numbers plus English phrases: faces-sh `42c2fd7`, `ac53e87`
  - Matching localised stderr text, including a German pattern: morquis `97d5918`, `a8283e2`, `a977f72`
  - Keywords in the message: ANierbeck `dd7eecb`
  - Reading the store's authorisation status before any work: brightline `4fb39a3`
  - A status command that exists but is never called: mjmcg `bde3e31`, `804b77d`
- **Recommendation:** Classify Apple Event failures by their OSStatus number (-1743, -1744, -600, -609,
  -1712). Classify helper failures by the framework's authorisation status, checked before the work.
  Never classify by text.
- **Needs a human decision:** No — morquis' German pattern and faces-sh's misfiled phrases show that
  text depends on language and wording. Confirm the numbers with X-V1.

#### X-C9 What happens when a call runs out of time

- **Options:**
  - Race a timer and leave `osascript` running: brightline `2bcee54`; long-tail/dewdad `31ac622`
  - Block the event loop with `execSync` and a larger budget: nivra `0b616cd`, `2860fb6`
  - `execFile` timeout with an immediate SIGKILL, then check the store anyway: faces-sh `39b7e40`
  - Spawn, then SIGTERM, then SIGKILL after a grace period, as a typed failure, with a test double that
    ignores SIGTERM: morquis `97d5918`, `a8283e2`, `a977f72`
  - A fixed pause between calls to let the app recover: brightline `304f384`, `84edc6b`
- **Recommendation:** Use morquis' escalation for the automation runner and for the native helper's
  supervisor (X-50, X-51, X-67). Remove the cause of slow calls instead of pausing or raising budgets.
- **Needs a human decision:** No — upstream #22 and #59 show that a script left running keeps Notes
  or Reminders busy until reboot, so the child has to end.

#### X-C10 How a script's results reach TypeScript

- **Options:**
  - Printable delimiters (`|||`, `:::`): boutquin `2894ab6`; chrischall `18660e4`, `bf6dc37`, `0860cf8`
  - ASCII control-character separators: KassebaumEngineering `1d47e74`; danielk-am `9d9122c`
  - Control Pictures glyphs (U+241E/U+241F): therealap `220462c`; felkru `c769cc0`
  - Splitting osascript's printed list on `", "`: nivra `0b616cd`, `2860fb6`
  - Parallel property lists zipped by index: sicdigital `791f5f2`
  - JSON out of JXA: faces-sh `784db41`; morquis `97d5918`
- **Recommendation:** Static JXA scripts return `JSON.stringify(...)`, and the adapter validates it
  against a schema (X-46, X-47, X-48).
- **Needs a human decision:** No — every delimiter scheme has a shifting or forging failure in its
  report.

#### X-C11 How values get into a script

- **Options:**
  - Escape values into AppleScript string literals: ANierbeck `cd72bdf`; brightline `859a9c8`;
    chrischall `2e06954`; sicdigital `791f5f2`, `d5d5df0`; KassebaumEngineering `1d47e74`
  - Escape into JXA literals, one hand-copied escaper per module: morquis `d76f3ec`
  - Splice `JSON.stringify` literals into JXA source: morquis `96759b3`; KassebaumEngineering `1d47e74`
  - Pass values as arguments to a JXA function: faces-sh `784db41`
- **Recommendation:** Scripts are static files, and values arrive only as JSON arguments (X-43, X-44).
  Whether the JSON travels in argv or on stdin waits on X-V6, which
  [ADR-0002](../adr/0002-helper-owns-every-protected-access.md) makes internal to the helper.
- **Needs a human decision:** No — NN1 settles it. brightline missed the calendar location and notes,
  morquis lost two sites, and chrischall opened a numeric injection path.

#### X-C12 How the server talks to a native helper

- **Options:**
  - A per-call CLI through a shell string: Bendix-ai `6e5ff6c`, `bb0c1ab`
  - A per-call `execFile` with argv verbs and free-text errors: arr2036 `9097294`
  - A per-call `execFile` with one JSON argv: faces-sh `7160b0a`, `bfd5b64`, `4587d0a`
  - A per-call helper that silently falls back to AppleScript: ANierbeck `8bfaa0c`, `a414c57`, `f745119`
  - Third-party EventKit CLIs: mjmcg `bde3e31`, `2743d84`
  - A host app reached over loopback HTTP: faces-sh `dbffae5`, `82efc89`
- **Recommendation:** Use plan.md's long-lived helper with versioned JSON-lines requests (X-58 to
  X-68) and no scripted fallback.
- **Needs a human decision:** No — a per-call process pays startup and the access request every time
  (Bendix-ai measured about 6 s). faces-sh removed its fallback because two implementations of one
  contract diverge silently.

#### X-C13 How the native helper is built and shipped

- **Options:**
  - A prebuilt, ad-hoc-signed binary committed next to its source: arr2036 `9097294`; ANierbeck
    `8bfaa0c`; Bendix-ai `6e5ff6c`
  - Compiled with `swiftc` at build time: faces-sh `4587d0a`
  - Its own `.app` bundle launched through LaunchServices so it holds its own grant: fpjnijweide
    `42c9e11`
  - External CLIs the user installs separately: mjmcg `bde3e31`
- **Recommendation:** Never commit binaries. Build reproducibly from the repo's source.
- **Settled by [#8](https://github.com/that-mathevs/apple-native-mcp/issues/8)
  ([ADR-0003](../adr/0003-signed-helper-at-a-fixed-path.md)):** the helper ships as a signed,
  notarised universal binary, not built from source on the user's Mac, because an ad-hoc build loses
  its grant on every rebuild and every build loses it when the file moves. It runs from
  `~/Library/Application Support/apple-native-mcp/apple-native-mcp`, so every install channel and
  update shares one path and one grant, and it is checked against a pinned code requirement
  (identifier plus team `4A82YT3HVP`) before copying and before every launch. The `the helper
  binary` subject carries the scenarios (X-84 to X-87, X-91).

#### X-C14 How large results are kept within limits

- **Options:**
  - Raise the output buffer (16 MB, 20 MB, 50 MB): KassebaumEngineering `1d47e74`; ANierbeck `8bfaa0c`;
    mjmcg `2743d84`
  - Pages with limit and offset, where `count` is the page size: sicdigital `d261523`, `eef6636`
  - Pages that state shown, total and ceiling: faces-sh `54c30e3`, `799d643`, `16172e8`, `ccc9f55`
  - A truncated flag on one output only: therealap `5176aa5`
- **Recommendation:** Every read returns a bounded page that knows whether it is complete, states a
  total when counting is cheap, and says how to get the next page (X-28, X-35 to X-37). The helper
  protocol has a stated maximum response size (X-64), and a runner result over its ceiling is a named
  failure (X-49).
- **Needs a human decision:** No — a bigger buffer only moves the ceiling, and sicdigital's offset
  applied after a store-side limit returns empty pages.

#### X-C15 How timestamps are written in results

- **Options:**
  - Localised text parsed back into UTC with `Z`: sicdigital `3c13e0d`
  - Local time with its offset: faces-sh `bfd5b64`
  - UTC with fractional seconds: arr2036 `9097294`
  - Locale-formatted date strings: Bendix-ai `bb0c1ab`
  - Components rebuilt in JavaScript, with no zone: chrischall `18660e4`
- **Recommendation:** ISO 8601 in the user's local time with its offset (X-38, X-66). Date-only
  values stay dates.
- **Needs a human decision:** No — parsing localised text yields null on German and French Macs, and
  faces-sh saw agents repeating UTC times to the user.

#### X-C16 How the server keeps stdout clean

- **Options:**
  - Monkey-patch `stdout.write` to drop chunks that don't start with `{`: upstream #8
  - Delete the filter and add handlers that log uncaught exceptions and carry on: brightline `985444b`
  - Log to stdout from the helper wrapper: ANierbeck `8bfaa0c`
- **Recommendation:** Nothing writes to or patches stdout except the transport. All logs go to
  stderr. An uncaught exception ends the process (X-39, X-59).
- **Needs a human decision:** No — the filter corrupted responses and let a line starting with `{`
  through. Carrying on after an uncaught exception hides crashes.

#### X-C17 How behaviour is tested

- **Options:**
  - Module mocks of the script runner, run on Linux CI: chrischall `05e1ed7`, `25d47cc`, `e23e11e`,
    `3bb2b01`, `c9727ec`, `87b1ae3`
  - Asserting on generated script text, plus gated real-app suites: morquis `97d5918`, `d76f3ec`,
    `a8283e2`, `a977f72`, `5c01104`, `05d1658`
  - Shape assertions against the user's real apps, including a real send: chrischall `0bd664e`,
    `c1bf44b`, `18660e4`, `1a45550`, `c9f9c48`, `0860cf8`, `bf6dc37`, `29af0a2`, `d1c60f3`, `68dc2b7`,
    `b6a4ec6`, `f1f2bb1`, `05e1ed7`
  - Driving the server over stdio, plus a manifest-against-tool-list check: therealap `1ad9f60`
- **Recommendation:** Use plan.md's layers:
  - Acceptance specs through an in-memory client (X-10).
  - Contract suites run against the fake and the real adapter. Real runs sit behind an explicit
    switch, with uniquely prefixed fixtures, cleanup by id in LIFO order and a hard watchdog (morquis).
  - CI fails on an empty suite, and a check keeps any package manifest in step with the tool list
    (therealap, X-42).
- **Needs a human decision:** No — plan.md already settles the layers. The mocks pinned upstream's
  stubs, script-text assertions pass with injections, and real-data shape tests messaged a real person.

#### X-C18 How an app is started before it is scripted

- **Options:**
  - Ask System Events, `activate`, poll up to 10 s, then carry on silently: ANierbeck `3005df4`
  - Ask System Events, `launch`, poll `count of accounts` (only after a failed check): felkru `c769cc0`
  - `activate` before a create: faces-sh `3c590df`
- **Recommendation:** Start the app without bringing it to the front and without System Events, then
  wait for it to be ready within the time budget. "Permission missing", "not ready in time" and "app
  has no data" are three named failures.
- **Needs a human decision:** No — System Events needs its own Automation grant and `activate` steals
  focus. Which launch call avoids both is X-V5.

#### X-C19 Which app a permission failure tells the user to enable

- **Options:**
  - A host-app name from an environment variable, falling back to "this app", plus the exact pane:
    faces-sh `ac53e87`, `4c3096d`, `42c2fd7`
  - Numbered steps to the pane, telling the user to "enable the app": brightline `4fb39a3`
  - Pre-Ventura "System Preferences > Security & Privacy" wording, or "Automation" for everything:
    morquis `96759b3`, `d76f3ec`
- **Recommendation:** Name the pane in current macOS wording, and name the app whose row the user will
  actually see. Per #4, that is the helper's own executable name when the helper disclaims
  responsibility, and otherwise the responsible host (Claude, Terminal). Never name a guess.
- **Settled by [#8](https://github.com/that-mathevs/apple-native-mcp/issues/8)
  ([ADR-0002](../adr/0002-helper-owns-every-protected-access.md)):** the helper disclaims
  responsibility and owns every privacy-protected access, so a permission failure names the helper's
  own executable name, `apple-native-mcp`, and the pane in current macOS wording. #4 showed the
  prompt names the executable's file name. X-89 pins the grant to the helper's own identity, and
  CAL-24 names it.

#### X-C20 Which writes beyond plan.md's Phase 3 list are in v1

- **Options:**
  - Only the writes Phase 3 names: create event; create reminder with a due time; edit a
    reminder (upstream #27); create and update a note; draft and send mail; send a message. The
    report verdicts that say "out of v1 scope" follow this list: upstream #51; ANierbeck
    `3005df4` (C15 trash, mark read); chrischall `1a45550`, `bfa14df`, `9a62bc9`, `c9f9c48` (C21),
    `0860cf8`, `0703ad1` (C23 rules); morquis `fa7e5f9`, `59d3aa3` (C24), `db82ca5`, `e64a658`,
    `de6b9f6` (C25), `016aeaf`, `2465ad5`, `5c01104` (C26); faces-sh `431f4b1` (C35 contact writes);
    fpjnijweide `42c9e11`, `48cd701` (C7 contact writes).
  - Also the writes other reports adopt behind the write setting: event update and delete
    (arr2036 `9097294`; chrischall `05e1ed7`, `c9727ec`; mjmcg `17cba98`, `dcf1993`), reminder
    complete and delete (mjmcg `bde3e31`, `804b77d`, `fed09d1`), note delete (faces-sh `431f4b1`),
    contact create, update and delete by identifier (morquis `2483f04`, `a77212a`, `5c01104`), and
    mail triage: move, mark read, delete (gene-jelly `bb07be5`, `d13e5b4`; upstream #51).
- **Recommendation:** Build Phase 3's writes first. Keep every other write scenario in the backlog,
  so it is specified whenever it is pulled in.
- **Settled by [#18](https://github.com/that-mathevs/apple-native-mcp/issues/18):** v1 offers
  exactly six writes — create an event, create a reminder with a due time, create a note, update a
  note, draft an email, send an email, send a message over iMessage only. **An operation outside v1
  has no tool at all:** it is absent from `tools/list` and from every description, so an agent can't
  propose it. Every other write scenario stays in the backlog marked "no tool in v1" (CAL-51 to
  CAL-60, REM-41 to REM-49, NOT-48, CON-24 to CON-32, MAIL-66, MAIL-67, MAIL-100 to MAIL-105,
  MAIL-109), and scheduled sends and attachment writes move to **Out of scope**. This also settles
  CON-C7 and MSG-C9.

### Verification tasks

Standalone tasks (not Notes or Mail mechanisms). Each can become its own ticket.

- **X-V1** On macOS 14 and later, a script sent to an app whose Automation consent was denied fails
  with -1743, one whose consent was never asked fails with -1744, and neither number changes with the
  system language. *From:* faces-sh `ac53e87`, `4c3096d`, `42c2fd7`; morquis `97d5918`. *Proves it:*
  `tccutil reset AppleEvents`, then run a static JXA script against Notes three ways: never asked
  (leave the prompt unanswered until the call returns), denied, and denied with the system language
  set to German. The error numbers are -1744, -1743 and -1743. *Disproves it:* the same number for
  "never asked" and "denied", or only text and no number under German.
- **X-V2** (permission prompts) While an Automation consent prompt is waiting for an answer, the script
  blocks instead of failing, and the server can read the consent state without prompting (for example
  `AEDeterminePermissionToAutomateTarget` with `askUserIfNeeded` false). That tells "waiting for the
  user" apart from "the app is slow". *From:* brightline `2bcee54`. *Proves it:* after a reset, start a
  script and leave the prompt open. `osascript` stays alive past 30 s, and a status call made meanwhile
  returns a "would prompt" code at once without a second prompt. *Disproves it:* the script fails
  immediately, or the status call opens a prompt or blocks.
- **X-V3** (permission prompts) Asking an app for `name`, `version` or `running` doesn't send an Apple
  event, so it never prompts and passes even when reading data will fail. Only a check that reads data
  prompts. *From:* upstream #65, #69, #74 (upstream open question 1). *Proves it:* after `tccutil reset
  AppleEvents`, `tell application "Contacts" to get name` succeeds with no prompt and no row under
  Automation, while `count of people` prompts. Repeat on macOS 14, 15 and 26. *Disproves it:* the
  `name` call prompts or fails.
- **X-V4** "Application isn't running (-600)" for an app that is running comes from one identifiable
  cause: Automation denied, a sandboxed parent process, or a launch from a background process.
  *From:* upstream #65, #44 (upstream open question 2). *Proves it:* reproduce -600 against Contacts
  from a Claude Code session, a Claude Desktop child and a process left running after its terminal closed, with
  Automation granted and denied. Exactly one of these conditions yields -600. *Disproves it:* -600
  appears under several conditions, or never with the app running.
- **X-V5** Starting an app without activation (`NSWorkspace` with `activates = false`, or AppleScript
  `launch`) doesn't steal focus, doesn't trigger a System Events Automation prompt, and leaves the app
  answering scripts within a few seconds. *From:* ANierbeck `3005df4`. *Proves it:* quit Notes, keep
  another app frontmost, and start Notes each way. The frontmost app is unchanged, no System Events row
  appears under Automation, and a `count of notes` call answers within 5 s. *Disproves it:* focus
  moves, a System Events prompt appears, or the first call fails.
- **X-V6** A value passed to a static JXA script as a JSON argument (argv, or an environment variable
  as `@jxa/run` does) is limited by `ARG_MAX`, so a body over about 1 MB can't start `osascript`, while
  stdin carries any size. *From:* ANierbeck `39cc53a`; brightline `859a9c8`. *Proves it:* pass bodies
  of 100 KB, 900 KB and 2 MB by argv, by environment and by stdin to a script that returns the body's
  length. argv and environment fail with `E2BIG` near 1 MB, and stdin returns every length. *Disproves
  it:* argv carries 2 MB intact.
- **X-V7** A static JXA script file that takes JSON arguments behaves like an inline script built from
  strings: the same Automation prompt and no measurable slowdown under Claude Desktop and Claude Code.
  (Why morquis moved away from `@jxa/run`'s JSON arguments is unrecorded.) *From:* morquis `97d5918`,
  `d76f3ec`. *Proves it:* time 20 runs of each against Notes from both clients. Medians are within
  10 %, and one prompt covers both. *Disproves it:* the argument form is consistently slower, prompts
  again or fails.
- **X-V8** Claude Desktop and Claude Code give up on a tool call after a fixed time (the MCP TypeScript
  SDK client defaults to 60 s) and send `notifications/cancelled`. Every time budget has to end before
  that. *From:* brightline `84edc6b`, `304f384`. *Proves it:* a test tool that sleeps 30, 59, 61 and
  120 s. Record when each client shows a timeout and whether a cancellation notification arrives.
  *Disproves it:* a client waits indefinitely or never sends a cancellation.
- **X-V9** Non-protocol text on stdout breaks a stdio session in Claude Desktop and Claude Code (rather
  than being skipped), and upstream's stdout filter dropped or stalled large responses under Claude
  Desktop. *From:* brightline `985444b`; ANierbeck `8bfaa0c` (open question); upstream #8. *Proves it:*
  a test server that prints one stray line before a response, and upstream `main` returning a 200 KB
  result. The session errors or the response never arrives. *Disproves it:* both clients skip the
  line, and the large result arrives whole.
- **X-V10** Same claim as **MAIL-V5** (a recipient string holding two comma-separated addresses becomes two recipients); tracked there. *From:* KassebaumEngineering `13fd400`.
- **X-V11** (evidence only) `tsc --noEmit` fails on `fork-faces-sh/main`, because three Messages failure codes sit
  outside the `FailureCode` union. Nothing is built on it. *From:* faces-sh `42c2fd7`, `ac53e87`. *Proves it:* check out the
  fork and run it; errors name `wrong_number`, `message_not_sent` and `ambiguous_number`. *Disproves
  it:* the typecheck passes.
- **X-V12** (permission prompts) Same claim as **CAL-V12**: the silent refusal #4 saw comes from a missing
  usage-description key in the responsible app's `Info.plist`; tracked there. *From:* Bendix-ai `6e5ff6c`; fpjnijweide `42c9e11`.
- Mechanism questions: see #6.
  - On macOS 14–26, JXA `Application('Notes').notes.whose({...})()` works when Automation for Notes is
    granted, and fails with -600 or "whose is not a function" when it isn't. That decides whether Notes
    can use JXA at all. danielk-am `9d9122c`; upstream #43, #44.
- Mechanism questions: see #7.
  - With 5 accounts, fetching each account in turn in bulk with no pause leaves Mail responsive. If it
    doesn't, the pause belongs in the automation adapter as a measured, configurable throttle, not in
    the use case. brightline `84edc6b`, `304f384`; upstream #19, #58.
- Not carried as tasks, because the rebuild makes them moot or #4 answered them:
  - Bun's JavaScriptCore parses macOS's "… at 12:00:00 AM" dates differently from V8 (sicdigital
    `3c13e0d`): the rebuild never parses localised dates.
  - Upstream could start two servers on one stdin after a 5 s loading timeout (upstream #36): the
    rebuild has no lazy loading.
  - The Automation prompt is the same whether `osascript` starts through `execFile` or `sh -c` (nivra
    `0b616cd`, `2860fb6`): #4 answered it, since the responsible process is the same.
  - Which app a bare CLI helper's Calendars, Reminders or Contacts prompt is credited to (Bendix-ai
    `6e5ff6c`; upstream #65, #50): answered by #4.

### Credits

- **ANierbeck:** per-operation tool annotations so a client can confirm only harmful calls; typed
  failures that keep a named permission failure apart from a generic internal one; its list of
  injection sites and validation rules as hostile-input fixtures; making sure an app is running before
  it is scripted; provenance of read content carried in structure.
- **Bendix-ai:** filtering inside the native helper rather than in TypeScript.
- **KassebaumEngineering:** a recipient policy that fails closed and says how to change it; a script
  error is a failure, never "no results"; an output ceiling and a timeout on every script run.
- **arr2036:** the native helper's source lives in the repo and its values arrive as data.
- **boutquin:** results cross the process boundary as structured data.
- **brightline:** every call into an app has a deadline; stdout belongs to the protocol and logs go to
  stderr; writes are gated, and a refused write is an error that says why; user content is never
  written to a shared, predictable path; each authorisation state is its own named failure.
- **chrischall:** argument validation by schema at the MCP edge; one tool per operation; its attack
  strings as hostile-input fixtures for every contract.
- **danielk-am:** script output parsed and validated as structured data; exact dependency pins with a
  lockfile and automated update PRs (`ae5295e`).
- **faces-sh:** values reach scripts as arguments, never spliced; one failure envelope (code, what
  didn't happen, verbatim evidence, cap, redaction); permission failures that name the pane and the app
  and never guess; a read that couldn't happen is never an empty result; pages that state shown, total
  and ceiling; everything the agent needs in `content`, as an index plus detail; next steps named as
  actions; capabilities switched off both in the list and at dispatch; dates in local time with their
  offset.
- **felkru:** every shipped script is compiled as part of the build.
- **fpjnijweide:** one tool per operation, each declaring only its own required arguments.
- **gene-jelly:** a capability that is off is refused at dispatch, not merely unlisted.
- **long-tail/JoshOsullivan-au:** secret scanning as a cheap CI step (`ec13b9e`).
- **mjmcg:** per-operation tools so risk tiers can be applied; an unreadable store is a named failure;
  bounded helper responses.
- **morquis:** a runner whose timeout terminates and then force-kills the child, with a typed failure
  and a test double that ignores SIGTERM, reused for the helper's supervisor; real-app suites behind an
  explicit switch, with prefixed fixtures, LIFO cleanup and a watchdog.
- **nivra:** never parse human-readable script output; every store call has a time budget and a named
  timeout.
- **sicdigital:** the capability is checked at the call boundary, fails closed, and is refused as a
  readable tool error; pages that say more exist; the server is composed without a transport and driven
  by an in-memory client in specs; ISO 8601 timestamps.
- **therealap:** records come back whole as structured data; a capped result says it was truncated;
  CI fails on an empty suite, a package manifest is checked against the tool list, and bad calls are
  tested over stdio.
- **upstream PR #76:** MCP tool annotations.

### Install docs inputs

- **upstream #72** (ChatGPT developer mode): the server is local and stdio only. Say so, and say why a network
  transport is out of v1 scope.
- **upstream #55** (Smithery "Missing API Key"): depend on no registry or installer service. The config runs a
  local command by absolute path.
- **upstream #50** (Claude Desktop config fails): GUI apps don't inherit the shell's `PATH`, so use absolute
  paths. Name which app receives each grant (Automation, Full Disk Access, Calendars, Reminders,
  Contacts) under Claude Desktop and under a terminal, per #4.
- **upstream #36** (Python SDK clients hang at initialise): the runtime is Node, not bun. List the clients
  verified, including one built on the Python SDK (X-41).
- **upstream #33** (how to test from a terminal): CONTRIBUTING points at the MCP Inspector, and at the
  acceptance specs with fake ports as the main way to exercise behaviour.
- **upstream #29** (crash on macOS 12): state macOS 14 and Node 24 as minimums, and have the server check both
  at startup with a named failure.
- **upstream #17** (Cursor unsupported by the installer; calls time out): document the standard JSON config
  per client rather than an installer CLI. Slow full listings are fixed by bounded pages, not by docs.
- **upstream #14** (bun from bun.sh not found): don't rely on `PATH` lookup from GUI clients. Node managed by
  nvm has the same trap.
- **upstream #5** (npm support): install from npm as `apple-native-mcp`, because `apple-mcp` belongs to upstream.
- **upstream #2** (`env: bun: No such file`): the published entry point runs on the stated Node without bun,
  and the docs show the absolute `node` path.
- Also: check every install path in docs and registries against the artefact actually published
  (chrischall C9). Consider generating the README's feature list from the printed
  spec so it can't overclaim (upstream open question 10).

### Repository and release inputs

Infrastructure ideas that describe no server behaviour, so they have no scenario. They feed Phase 0
(repo setup and CI) and Phase 4 (release).

- **Exact dependency pins with a lockfile and automated update PRs:** danielk-am `ae5295e` (C9).
- **Secret scanning as a CI step:** long-tail/JoshOsullivan-au `ec13b9e`.
- **A repository check for automatic editor tasks (`.vscode` `runOn: folderOpen`) and committed `.env`
  files:** the malware in long-tail/amandeeptherockstar `b1fffed` (L6) used both.
- **CI fails on an empty or missing test suite, and a check keeps any package manifest in step with the
  tool list:** therealap `1ad9f60` (C12); scenario X-42.
- **Release pipeline hygiene:** pin actions by SHA and every CLI version, `persist-credentials: false`,
  never commit build output or bundles, publish an explicit allowlist of files, fail loudly, attach
  checksums or provenance, and check every install path against the published artefact: chrischall
  `056c109`, `87b1ae3`, `b3909e9`, `a731f24`, `8d10035` (C9, C10), `2e06954`, `599505f`, `1d96a0f`,
  `44a6344` (C26).
- **Real-app contract runs behind an explicit switch, with uniquely prefixed fixtures, cleanup by
  identifier in LIFO order and a hard watchdog:** morquis `97d5918`, `a8283e2`, `a977f72`, `5c01104`
  (C29); ANierbeck `228b6ba` (C17, real-data tests kept out of git).

## Out of scope

v1 is Calendar, Reminders, Contacts, Messages, Notes and Mail over stdio (map #1, plan.md
"Out of scope for v1"). The work below is accounted for here so nothing is lost, but none of it
is built in v1. The scenarios are parked, in the `bdd` grammar, for whoever picks the area up
later.

### Other apps

- **Maps.** Maps has no scripting interface that returns results, so every fork that "fixed"
  search reports a location it never read. Sources: upstream #45; morquis `d76f3ec`, `5fa172e`
  (C32); nivra `0b616cd` (C5); fpjnijweide `48cd701` (7 maps tools in C1).
  - Parked: [acceptance] *searching places* — given no place was found, reports none rather than
    inventing one · morquis `d76f3ec`
  - Parked: [acceptance] *searching places* — given results cannot be read back, says it only
    opened Maps rather than reporting a location · nivra `0b616cd`
- **Web search.** Every MCP client already has it. Upstream's `utils/web-search.ts` is dead code
  on `main` (upstream merged PR #11; upstream.md "Corrections"). morquis only re-indented it
  (`1074bb8`, noise).
- **Photos.** Sources: upstream #38, PR #39 (shell injection through `exportPhoto`), PR #40 and
  #41 (carry the same Photos diff); morquis `3e3a3d8`, `d76f3ec` (C31); danielk-am `61cdb09` (C8).
  - Parked: [acceptance] *exporting a photo* — given a destination outside the allowed export
    folder, refuses · upstream PR #39
  - Parked: [acceptance] *browsing an album* — given an album name containing a backslash and a
    quote, finds that album and runs nothing else · danielk-am `61cdb09`
- **Music.** Sources: upstream PR #52; morquis `3e3a3d8` (C31).
  - Parked: [acceptance] *searching the music library* — given a query containing script syntax,
    treats it as text to match · upstream PR #52
  - Parked: [acceptance] *searching the music library* — given part of a track name, returns
    matching tracks with their persistent identifiers · morquis `3e3a3d8`
- **Shortcuts.** A shortcut can run shell scripts or send messages, so running one is a
  capability to do anything. Source: danielk-am `9d9122c` (C6).
  - Parked: [acceptance] *running a shortcut* — given a shortcut not named in the settings,
    refuses to run it · danielk-am `9d9122c`
- **Safari.** `do JavaScript` in the user's logged-in tabs is a capability never to offer; the
  history search has a SQL quoting bug. Source: danielk-am `9d9122c` (C7). Record it in the
  threat model as an example.
  - Parked: [domain] *a history search* — given search text containing a question mark, matches
    it literally · danielk-am `9d9122c`
- **Apple Health exports.** Reads files a paid third-party iOS app writes; not a native macOS
  app. Source: therealap `5f50276`, `aa97910`, `c7b7f2b`, `67eeee8`, `c93618c`, `5176aa5`
  (C11), merged in `b691220`. Its truncation rule is adopted in Cross-cutting (therealap
  `5176aa5`, C10).
  - Parked: [acceptance] *reading health data* — given a folder not named in the settings,
    refuses to read it: tool input never chooses which files are opened · therealap `5f50276`
- **System console / logs.** Not the user's data in a native app. Source: upstream #42 (rejected).

### Transports and deployment

- **HTTP, REST and any network transport.** v1 is stdio only: a server that can send messages as
  the user doesn't listen on a network port (map #1). Both forks that added one exposed injectable
  scripts to the LAN. Sources: upstream #72 (ChatGPT developer mode needs remote HTTP); mjmcg
  `a999c4b`, `039b646`, `ef2a44f` (C14); sicdigital `509e617`, `91d7447`, `d261523`, `eef6636`,
  `f0994c9`, `d4888a0`, `5f6bd19`, `3f1fad3`, `dd291b9` (C6), `e066b89`, `fa5a728`, `c36da30`,
  `398bcd5` (C7 token scopes), `d261523`, `eef6636` (C8 REST pages). If a network mode is ever
  proposed it needs its own threat model: loopback by default, a token required, `Origin`
  checked, writes still off.
  - Parked: [acceptance] *starting the network transport* — given no access token is configured,
    refuses to start: tools would be open to the network · mjmcg `a999c4b`
  - Parked: [acceptance] *starting the network transport* — given no explicit address to listen
    on, listens only on the loopback interface · sicdigital `509e617`
- **Running as a LaunchAgent.** Only meaningful for a network server. Its lesson (automation
  needs the logged-in GUI session and its TCC grants) goes to the install docs. Source: sicdigital
  `3c8ec13` (C10).
- **MCP resources.** Tools cover reading a conversation and carry per-operation annotations.
  Source: upstream #3 (rejected; the need is covered by Messages read scenarios).

### Out of v1 by decision

Scenarios moved here from the backlog because a closed ticket put the whole operation outside v1.
They keep their ids so nothing is lost.

- **Scheduled message sends.** Out of v1 per [#18](https://github.com/that-mathevs/apple-native-mcp/issues/18):
  no fork persisted a schedule and nothing could confirm a send that fires after the tool call
  returned (NN3), so it needs persistence, a runner and its own confirmation model. This settles
  **MSG-C9** and updates plan.md Phase 3 step 5. Sources: faces-sh `431f4b1`, `42c2fd7` (C31);
  morquis `d76f3ec` (C10); chrischall `fa61e37`, `209f3a4` (C16); ANierbeck `813c232` (C7).
  - Parked: **MSG-49** [acceptance] *scheduling a message* — given a recipient the user has never
    messaged, refuses when asked to schedule, not later when it fires · NN4 · ANierbeck `813c232`
  - Parked: **MSG-50** [acceptance] *scheduling a message* — refuses when the schedule would not
    survive the server stopping · NN3 · chrischall `fa61e37`, `209f3a4`
  - Parked: **MSG-51** [acceptance] *scheduling a message* — given a time that cannot be read,
    refuses rather than sending now · — · faces-sh `431f4b1`, `42c2fd7`
- **Sending, saving and exporting mail attachments.** Out of v1 per
  [#18](https://github.com/that-mathevs/apple-native-mcp/issues/18), whose six writes do not include
  writing a file, and [#19](https://github.com/that-mathevs/apple-native-mcp/issues/19), whose
  settings name capabilities, calendars, mail accounts, note folders, chats and the send allow-list
  and no download or export folder. See **MAIL-C16**. Sources: chrischall `18660e4`, `0860cf8`,
  `d401ca1` (C22); felkru `22aa354` (C5); morquis `db82ca5`, `e64a658`, `de6b9f6` (C25).
  - Parked: **MAIL-64** [acceptance] *sending an email* — given an attachment outside the folders
    the user allowed, refuses: a tool call must not mail arbitrary files · — · chrischall `0860cf8`,
    `18660e4`, `d401ca1`
  - Parked: **MAIL-65** [acceptance] *saving an attachment* — given a destination outside the
    configured download folder, refuses · — · chrischall `0860cf8`, `18660e4`, `d401ca1`
  - Parked: **MAIL-108** [acceptance] *exporting an email* — given a destination outside the
    configured export folder, refuses · — · morquis `db82ca5`, `de6b9f6`, `e64a658`

Writes that stay in the backlog rather than moving here — event update and delete, reminder edit,
complete and delete, note delete, contact writes, and mail triage — have **no tool in v1** per #18
and are marked as such under their own subjects. **X-C20** is settled.

## Rejected

Every report entry whose verdict rejects something, with the one-line reason, so nothing is
dropped silently. "Outright" means nothing from the entry is adopted. "Technique" means the idea
is adopted in a group above and only the fork's way of doing it is rejected. Entries that are only
out of v1 scope are in **Out of scope**. Entry ids (C1, L1, #n) refer to the fork report.

### Rejected outright

- **ANierbeck C3** `3005df4`: event create still injectable (trailing backslash plus newline) — a
  live hole; cite it in the threat model.
- **ANierbeck C4** `39cc53a`: random-named temp files for bodies — values travel as JSON arguments,
  so no body ever touches disk.
- **ANierbeck C6** `d2b9bf5`: an "external content" banner around bodies — a prose boundary in the
  same channel is forgeable; provenance goes in structure instead.
- **ANierbeck C12** `2c5506c`: the "MailKit" helper — links no MailKit, wraps `osascript`, invents
  dates and returns the oldest unread mail; no evidence for any native mail API (#7 records it).
- **ANierbeck C17** `228b6ba`: tests that assert on their own fixtures — pin no server behaviour
  (the habit of keeping real-data tests out of git is adopted).
- **Bendix-ai C2** `3366690`, `9599219`, `d8c994a`, `6e5ff6c`, `fff9dd8`: silent AppleScript
  fallback and a hard-coded home path — different data under a different permission (NN3).
- **boutquin C6** `2894ab6`, `8a5d2e0`: quote-only escaping kept and new splice sites added —
  widens the injection surface (NN1).
- **brightline C6** `859a9c8`: escaping at about 30 splice sites — missed the calendar create site;
  escaping by review fails (NN1).
- **brightline C8** `859a9c8`: private temp files for bodies — unnecessary with JSON arguments.
- **chrischall C6** `c9727ec`: move an event by copy and delete — silently loses attendees, alarms,
  recurrence and identity; EventKit sets the calendar in one save.
- **chrischall C8** `05e1ed7`, `25d47cc`, `e23e11e`, `3bb2b01`, `c9727ec`, `87b1ae3`: unit tests
  that mock the script runner — test the call graph and pin upstream's stubs as intended.
- **chrischall C9** `b3909e9`, `a731f24`, `8d10035`: released skill and plugin point at software
  the fork doesn't ship — Phase 4 lesson: check every install path against the published artefact.
- **chrischall C10** `056c109`, `87b1ae3`, `b3909e9`, `b4dec96`, `7c36fdc`, `781b52c`, `1bed392`,
  `a731f24`, `8d10035`, `49d61fe`, `fa6c6fe`, `bbbafa6`, `f502364`, `01c1e71`, `31240a0`, `28ce002`:
  the release pipeline — unpinned actions and CLIs, token on argv, persisted PAT, committed build
  output, hidden failures; its lessons feed Phase 4 (Cross-cutting).
- **chrischall C13** `9efd4ef`, `add4b64`, `209f3a4`, `bf6dc37`, `29af0a2`, `91e0101`, `6831a90`,
  `18660e4`: numeric and boolean arguments spliced unvalidated — a new injection path (NN1).
- **chrischall C14** `18660e4`, `bf6dc37`, `91e0101`, `6831a90`, `0860cf8`: `|||`-delimited results
  — hostile text forges records.
- **chrischall C16** `fa61e37`, `209f3a4`: "no script error" as a send's success — not a store
  check (NN3); removing the in-process scheduler is noted in MSG-C9.
- **chrischall C22** `18660e4`, `0860cf8`, `d401ca1`: attach any file and save attachments anywhere
  under `$HOME` — exfiltration and persistence paths.
- **chrischall C26** `2e06954`, `599505f`, `1d96a0f`, `44a6344`: committed bundles with personal
  config and an npm publish to a name the fork doesn't own.
- **chrischall C27** `0bd664e`, `c1bf44b`, `18660e4`, `1a45550`, `c9f9c48`, `0860cf8`, `bf6dc37`,
  `29af0a2`, `d1c60f3`, `68dc2b7`, `b6a4ec6`, `f1f2bb1`, `05e1ed7`: shape assertions against the
  real apps, including a real send — specify nothing and message a real person.
- **faces-sh C10** `8ac7cb9`, `39585ad`, `4587d0a`: scripted reminder search under a time budget —
  superseded by EventKit; only "state the coverage" survives.
- **faces-sh C11** `3c590df`, `dbffae5`: activate Reminders before a create — EventKit needs no
  running app.
- **faces-sh C31** `431f4b1`, `42c2fd7`: in-process timers for scheduled sends — lost on exit and
  fire early; whether v1 schedules at all is MSG-C9.
- **faces-sh C33** `455d4ba`: the circuit cache expands tokens inside tool arguments — lets an
  injected body exfiltrate cached tool output (NN1).
- **felkru C4** `22aa354`: a private full-text copy of every email — copies protected mail into an
  unprotected file and goes stale.
- **felkru C7** `12ad33f`: reading `Calendar.sqlitedb` for reminders — private schema, possibly no
  iCloud reminders; EventKit is the mechanism.
- **felkru C8** `631d4d1`: reading the occurrence cache for events — blank locations, floating
  all-day times, today's events dropped.
- **felkru C9** `22aa354`: relicensing to GPL-3.0-or-later — no code crosses over (NN6); felkru is
  credited for ideas only.
- **fpjnijweide C8** `93daf09`, `48cd701`: a contact name resolves to the first partial match and
  its first number — the ghost-recipient failure of upstream #48 (NN4).
- **long-tail L6** amandeeptherockstar `b1fffed`: malware (remote `eval` on start, VS Code
  auto-run task) — nothing enters the findings; don't clone or open it.
- **morquis C2** `d76f3ec`, `96759b3`: hand-copied escapers in every module — lost at two call
  sites (NN1).
- **morquis C3** `2483f04`, `a77212a`, `5c01104`: `String.replace` undoes escaping on contact
  values — code execution through contact writes.
- **morquis C4** `05d1658`: chained placeholder replaces in the Notes scope — code execution
  through account and folder names.
- **morquis C5** `d76f3ec`: caller-supplied property names invoked as methods — a field name can
  be `delete`.
- **morquis C6** `96759b3`, `d76f3ec`: failures returned as "nothing found" — breaks NN3 and NN5.
- **morquis C16** `d76f3ec`: bulk JXA reads of the address book — Contacts goes through the helper;
  the bulk-read lesson carries to Notes and Mail if they stay on scripting.
- **morquis C28** `64230cd`, `47f1515`, `5ce2351`, `fa7e5f9`, `db82ca5`, `59d3aa3`, `5c01104`: a
  runtime-info tool with schema drift checks — one registry makes drift impossible, and hostname
  and argv are needless exposure.
- **morquis C30** `5fa172e`: build with `tsc` for a native SQLite addon — `node:sqlite` needs no
  addon.
- **neektza C3** `5d0e84a`: regex and fuzzy search tiers — user regex can stall the server, body
  search is lost, near matches pose as results.
- **nivra C3** `0b616cd`, `2860fb6`: `osascript` through `sh -c` with `execSync` — adds a shell,
  blocks the event loop, leaves injection untouched.
- **sicdigital C11** `791f5f2`, `d5d5df0`: backslash-and-quote escaping in reminders — values
  reach scripts only as data (NN1).
- **upstream #3**: MCP resources for iMessage — tools cover the need and carry annotations.
- **upstream #31**: spam.
- **upstream #42**: system console access — not user data in a native app.
- **upstream #43**: duplicate of #44.
- **upstream #71**: permission manifest review — not a defect; input to `docs/security.md`.
- **upstream PR #32** (`0620f65`, `a6d4a4c` on `upstream/main`): `latest` via a `sort` that doesn't
  compile — already on `main` and broken; covered by #30's scenarios.
- **upstream PR #41**: byte-identical duplicate of PRs #39 and #40.
- **upstream PR #56**: demo scripts that replace the package metadata.
- **upstream PRs #46, #57, #61**: marketing badges.

### Idea adopted, technique rejected

- **ANierbeck C1** `768c941`: `bun:sqlite` — ties the server to Bun; `node:sqlite` read-only instead.
- **ANierbeck C2** `cd72bdf`, `fc893d7`: an AppleScript escaper plus a phone-only recipient regex —
  splicing is banned (NN1) and email handles were refused.
- **ANierbeck C8** `dd7eecb`: keyword-based error sanitising — hides -1743 from the user; typed
  failures instead.
- **ANierbeck C9** `8bfaa0c`, `a414c57`, `f745119`: per-call EventKit helper with a silent fallback
  — ignores millisecond range bounds, never requests access, logs to stdout.
- **ANierbeck C13** `3005df4`: dates set field by field and `|`-delimited per-calendar queries —
  month overflow, forgeable records, silent skips.
- **Bendix-ai C1** `6e5ff6c`, `bb0c1ab`: CLI run through an unquoted shell string with
  human-formatted dates — shell injection, limit before sort.
- **Bendix-ai C3** `ff8af9c`, `3366690`: date literals in one region's format — breaks every other
  region.
- **KassebaumEngineering C1** `e766bc9`: title-based identity for the lossy-update check — the
  check and the write can see different notes.
- **KassebaumEngineering C2** `e766bc9`: a byte-exact note backup on disk — unrestorable copy of
  private data outside the protected container.
- **KassebaumEngineering C3** `e766bc9`: re-inspecting by title after the write — a renamed note
  reads as "found nothing, all fine".
- **KassebaumEngineering C4** `1e95e41`: drafts through a quote-escaped script and a `/tmp` body
  file — injectable, and the draft is never confirmed.
- **KassebaumEngineering C5** `13fd400`: last-ten-digit and regex-extracted allowlist matching —
  merges countries and lets unparsed addresses through.
- **KassebaumEngineering C6** `1d47e74`: control-character framing and escaping — scripts still
  built from strings.
- **KassebaumEngineering C8** `1d47e74`: creating a missing reminder list, and a silent 100-per-list
  cap — unrequested writes and silent truncation.
- **KassebaumEngineering C9** `1d47e74`: merging namesakes and first-match wins — hides ambiguity.
- **arr2036 C3** `9097294`: first identifier match in a ±2-year scan — edits the wrong occurrence.
- **arr2036 C4** `9097294`: a committed prebuilt binary, one process per call, free-text errors —
  unreproducible and unversioned.
- **boutquin C2** `8a5d2e0`: local date fields spliced into `current date` — month overflow and
  UTC reading of date-only input.
- **boutquin C3** `8a5d2e0`: unknown list falls back to the first list — the result lies.
- **boutquin C4** `8a5d2e0`: a property read and a shell per reminder — slow and swallows errors.
- **brightline C1** `be4becf`, `ba218e6`: hand-delimited mail text — typed data instead.
- **brightline C3** `ba218e6`, `0833904`, `d2eef83`: a silent fixed window of 100 messages —
  reports "no unread mail" for mail it never looked at.
- **brightline C4** `84edc6b`, `304f384`: a fixed 3 s sleep between accounts — a guess, not
  back-pressure.
- **brightline C5** `2bcee54`: every timeout blamed on permissions — points users at the wrong fix.
- **brightline C7** `859a9c8`: confirmation through MCP sampling and substring matching — asks a
  model, not the user.
- **brightline C9** `be4becf`, `bc8e4a1`, `6bc977a`: `swift file.swift` on every call — compile
  latency and an Xcode dependency.
- **brightline C13** `985444b`: log-and-continue global exception handlers — hide crashes.
- **chrischall C1** `25d47cc`, `05e1ed7`, `3bb2b01`: strict start/end predicate and silent dropping
  of failed calendars.
- **chrischall C12** `2e06954`, `18660e4`, `88b58d0`, `bf6dc37`, `29af0a2`, `60f9977`, `91e0101`,
  `6831a90`, `1a358d6`, `fa61e37`: backslash-and-quote escaping — still builds source from input;
  the attack strings are kept as fixtures.
- **chrischall C15** `2e06954`, `fa61e37`, `f1f2bb1`: US-only handle normalisation.
- **chrischall C18** `d1c60f3`, `4f327fd`: busy blocks from a start-date filter, big calendars
  skipped — reports busy time as free.
- **chrischall C20** `18660e4`, `88b58d0`, `0860cf8`: a "search" that scans 30 messages of one
  mailbox.
- **chrischall C21** `1a45550`, `bfa14df`, `9a62bc9`, `c9f9c48`: unconfirmed replies, 100 concurrent
  batch operations, unsaved drafts (delete, move, flag and batch are out of v1).
- **danielk-am C3** `ad3e9e9`, `9d9122c`: EventKit through the JXA bridge — bitmask bugs, denied
  treated as granted, silent default-list fallback.
- **danielk-am C4** `ad3e9e9`: AppleScript calendar reads parsed as text.
- **danielk-am C5** `ad3e9e9`: AppleScript mail reads parsed as text.
- **faces-sh C2** `784db41`, `42c2fd7`, `39b7e40`: escaping in place of parameters, and a
  read-write `chat.db`.
- **faces-sh C6** `dbffae5`, `82efc89`: a proprietary host app serving EventKit and Contacts over
  loopback HTTP.
- **faces-sh C7** `7160b0a`, `bfd5b64`, `4587d0a`: mutation target by first "contains" match.
- **faces-sh C17** `94149a2`, `dbffae5`: read-by-title as the only route to one item.
- **faces-sh C26** `ddf6cb1`, `9852b0e`, `ac0058a`: failing open, and allowing any number no card
  claims (NN4).
- **faces-sh C34** `431f4b1`: first-match fallback and the ban on reading back after a write (NN3).
- **faces-sh C35** `431f4b1`: contact writes targeted by name (writes themselves are CON-C7).
- **felkru C2** `c769cc0`: every failure treated as "grant Automation".
- **felkru C3** `c769cc0`: "latest" as mailbox order.
- **fpjnijweide C7** `42c9e11`, `48cd701`: empty string clears every phone or email, no
  read-back (contact writes are CON-C7).
- **fpjnijweide C9** `93daf09`: full HTML bodies, a one-note string parser and delete-and-recreate
  editing.
- **gene-jelly C4** `bb07be5`, `d13e5b4`: triage by subject and sender "contains", with quotes
  escaped in the wrong order — acts on the wrong message and is injectable.
- **gene-jelly C5** `bb07be5`: "replied" guessed from subject containment in Sent.
- **long-tail L1** Heming-Zhong `2dc6104`, `8f4cd41`; brunnoaraujo `d8f5f19`: auto-creating lists
  and an implied alert.
- **long-tail L2** dewdad `31ac622`: `Promise.race` over a walk of every event — leaves `osascript`
  running and drops calendars silently.
- **long-tail L3** amandeepjutla `28c91b7`, `027ba85`: US month-first date text and a shell per
  field.
- **long-tail L4** zaclohrenz `277aac7`: delimiter text and body reads to search.
- **mjmcg C1** `bde3e31`, `804b77d`: load every reminder then filter.
- **mjmcg C6** `5ca5e55`: silently dropping the due-window filter when a list is named.
- **mjmcg C8** `2743d84`: raising `maxBuffer` — moves the ceiling instead of bounding the result.
- **mjmcg C10** `d4ec06d`, `88e26b9`, `e85c620`, `4ca8065`, `7623d19`: UTC-date windows and silent
  partial results.
- **mjmcg C11** `d4ec06d`, `17cba98`, `dcf1993`: `slice(0, 16)` drops the UTC offset.
- **mjmcg C15** `88e26b9`, `d4ec06d`, `bde3e31`: stdout of a failing process parsed as success.
- **morquis C1** `97d5918`, `a8283e2`, `a977f72`: classifying failures by localised stderr text.
- **morquis C7** `96759b3`: merging all of a handle's chats into one stream.
- **morquis C8** `4e257c8`, `96759b3`: a hard-coded country and fuzzy `LIKE` fallbacks.
- **morquis C10** `d76f3ec`: unconfirmed send success and the in-memory scheduler.
- **morquis C12** `2483f04`, `a77212a`, `5fa172e`, `5c01104`: read-back by name and substring
  phone matching.
- **morquis C17** `d76f3ec`, `0ec1adc`: hand-expanded RRULEs over scripting.
- **morquis C18** `d76f3ec`: "first calendar" as the default.
- **morquis C19** `d76f3ec`: creating reminder lists as a side effect.
- **morquis C21** `d76f3ec`: guessing the inbox by localised names.
- **morquis C27** `d76f3ec`: unconfirmed mail send; launching Mail to the foreground.
- **morquis C29** `97d5918`, `d76f3ec`, `a8283e2`, `a977f72`, `5c01104`, `05d1658`: unit tests that
  assert on generated script text.
- **neektza C1** `5766ff0`: sentinel-string framing.
- **neektza C2** `5d0e84a`: spliced escaping.
- **neektza C5** `f0ea5df`: plain-text overwrite through a `/tmp` file, by title, with no read-back.
- **nivra C1** `0b616cd`, `2860fb6`: splitting `osascript` list output on `", "`.
- **nivra C2** `2860fb6`: "latest" as the first ten messages of the first mailboxes.
- **nivra C4** `0b616cd`, `2860fb6`: raising timeouts as the fix.
- **sicdigital C3** `d5d5df0`: silent first-list fallback and date-only as UTC.
- **sicdigital C4** `3c13e0d`: round-tripping localised date text — null on non-English Macs.
- **sicdigital C7** `e066b89`, `fa5a728`, `c36da30`, `398bcd5`, `91d7447`, `dd291b9`: a deny-list of
  write operations — anything not listed is allowed (NN2 needs an allow-list).
- **sicdigital C8** `d261523`, `eef6636`: `count` as page size and broken offsets.
- **therealap C4** `2efb44b`: hard-coded smart-folder names.
- **therealap C6** `a675a7b`: escaped splicing in Notes scripts.
- **therealap C8** `d50bfae`: escaped splicing in the Calendar create script.
- **therealap C12** `1ad9f60`, `5f50276`: the eager/lazy safe-mode reset (the empty-suite and
  manifest checks are adopted).
- **upstream PR #28**: a notes cache with unbounded recursion and folders keyed by name.
- **upstream PR #37**: an empty search term meaning "list".
- **upstream PR #49**: a contacts cache that hides edits.
- **upstream PR #73**: delimiter-joined text and reading every body to search.

## Glossary candidates

Input to ticket #11 (`CONTEXT.md`), merged from every report's "Glossary candidates" section and
grouped by where the term is used. Terms repeat across groups where the meaning differs by context
(for example **account** in Calendar, Notes and Mail). Owners in brackets are the reports the term
comes from. Nothing here is decided: #11 settles each term with the maintainer.

### Calendar

- **calendar:** an EventKit calendar holding events, with an identifier, a title, a type and an
  account; titles repeat across accounts, so the identifier addresses it. (ANierbeck, arr2036,
  Bendix-ai, brightline, chrischall, mjmcg, therealap; upstream)
- **calendar identifier:** the store's stable id for a calendar (`calendarIdentifier`). Avoid
  "calendar name" as an identifier. (brightline, mjmcg, fpjnijweide)
- **account:** the source a calendar belongs to (iCloud, Exchange, CalDAV, local). Avoid "source"
  in tool output. (ANierbeck, mjmcg, therealap)
- **calendar type:** local, CalDAV, Exchange, subscription or birthday. Avoid "system calendar".
  (ANierbeck, Bendix-ai, brightline)
- **writable calendar:** a calendar that accepts new events; subscriptions and holidays don't.
  Avoid "read-only calendar" as a separate term. (chrischall, mjmcg, faces-sh, therealap)
- **default calendar:** the calendar the user set for new events in Calendar
  (`defaultCalendarForNewEvents`). A settings default, if adopted, needs a distinct name
  ("configured calendar"); never "first calendar". (KassebaumEngineering, arr2036, chrischall)
- **excluded calendar:** a calendar the settings hide from the agent (allow/block). Synonyms to
  avoid: whitelist, blacklist, disabled calendar. (ANierbeck)
- **hidden calendar:** a calendar unticked in Calendar.app (`DisabledCalendars`); distinct from
  an excluded calendar. (fpjnijweide)
- **event:** a calendar entry with a title, start and end (or all-day), location and notes.
  Identified by its event identifier. Avoid "appointment". (arr2036, boutquin, mjmcg; upstream)
- **event identifier:** EventKit's `eventIdentifier`, shared by every occurrence of a series.
  Avoid "uid", which is Calendar.app's scripting id and may differ. (ANierbeck, arr2036,
  chrischall, therealap)
- **occurrence:** one dated instance of an event in a range, identified by its series and its
  original start. (ANierbeck, arr2036, KassebaumEngineering, felkru, morquis, brightline;
  upstream)
- **series:** a recurring event as a whole. Avoid "master event". (arr2036, morquis)
- **span:** how far a change to an occurrence reaches: this occurrence, or this and future
  occurrences. (arr2036)
- **all-day event:** an event that occupies whole calendar days in the user's time zone, not an
  instant range. (boutquin, mjmcg, therealap)
- **range:** the start and end instants a read covers; date-only bounds mean whole local days.
  Synonyms to avoid: window, time range, date range. (boutquin, faces-sh "period", ANierbeck)
- **default range:** the range used when none is given, from the start of today. (ANierbeck,
  brightline)
- **truncated:** a result that stopped at a limit and says so. (therealap, morquis)
- **authorization status:** EventKit's access state: not determined, restricted, denied,
  write-only, full access. "Full access" and "write-only" are the macOS 14+ terms. (arr2036,
  brightline, danielk-am)
- **busy period:** a start and end during which the user is busy, with no event details. Synonym
  to avoid: busy block. (mjmcg, chrischall)
- **open slot:** a gap between busy periods, inside a range, at least the requested duration.
  Synonyms to avoid: available slot, free slot. (chrischall)
- **availability:** whether an event counts as busy or free. (chrischall)
- **duplicate event:** a create whose title matches an event overlapping the same time; allowed
  only with an explicit override. Avoid "twin". (faces-sh)

### Reminders

- **reminder:** an item in a reminder list with an id, title, notes, completion state, optional
  due date, creation date and priority. Avoid `body` and `description` for its notes. (mjmcg,
  sicdigital, danielk-am, upstream)
- **reminder list:** a container of reminders belonging to one account, with an id and a title.
  Titles aren't unique across accounts. Avoid bare "list" in tool names, and "calendar" even
  though EventKit models it as an `EKCalendar`. (mjmcg, boutquin, sicdigital, chrischall,
  danielk-am, faces-sh, KassebaumEngineering, upstream)
- **default reminder list:** the list the store names as the default for new reminders. Not a
  list titled "Reminders". (mjmcg, long-tail, danielk-am)
- **open reminder / completed reminder:** a reminder not yet done, or marked done. Prefer these to
  "incomplete", "to do" and "done". (boutquin, sicdigital, upstream)
- **completion date:** when a completed reminder was marked done. (mjmcg)
- **creation date:** when the store created the reminder. It can't be set. (sicdigital)
- **due date:** the day a reminder is due, with no time (an all-day due date). (long-tail,
  sicdigital, upstream)
- **due time:** a due date with a time of day, read in the user's time zone unless it carries an
  offset. Keep it distinct from due date. Avoid `dueDate` for both. (boutquin, mjmcg, upstream)
- **alert:** a notification time on a reminder ("remind me date", `EKAlarm`), distinct from its
  due time. (long-tail)
- **clear due:** removing a reminder's due date, as opposed to leaving it unchanged. (mjmcg)
- **overdue:** an open reminder whose due time has passed. (mjmcg)
- **due range:** a named span over due dates (today, overdue, this week) defined in our domain,
  not a CLI preset. (mjmcg) `CONTEXT.md` settles the word as **range**, never "window".
- **open count / overdue count:** per reminder list, how many open reminders it holds and how
  many of those are overdue. Avoid `reminderCount`. (mjmcg)
- **repeat:** a reminder's recurrence, a frequency and an interval. It needs a due date as its
  anchor. Prefer it to "recurrence rule" in tool text. (faces-sh)
- **twin:** a create whose name matches an open reminder, refused unless a copy is asked for.
  Avoid "duplicate", which suggests an existing copy. (faces-sh)
- **reminder identifier:** the id a reminder is addressed by. EventKit has a local
  `calendarItemIdentifier` and an external id that survives sync; which one we expose depends on
  REM-V6. (danielk-am, chrischall)
- **reminders index:** a listing that names each reminder under its list without full detail.
  (faces-sh)
- **authorization status:** EventKit's per-entity grant: not determined, restricted, denied, full
  access (write-only exists for events only). (danielk-am, brightline, mjmcg)
- **coverage:** how much of the store a partial read reached, for example lists searched out of
  lists that exist. (faces-sh)
- **checklist-style list:** mjmcg's term for a list whose completed items still matter. Don't
  adopt it until REM-C4 is decided. (mjmcg)

### Contacts

- **contact:** a person or company in Contacts (a `CNContact`) with a stable identifier, names and
  labelled details; phone numbers as the user typed them (upstream, faces-sh, morquis). Avoid
  "person" (scripting term), "card" and "address book entry" in tool names and scenario text.
- **contact identifier:** the stable `CNContact.identifier`, in the `UUID:ABPerson` form; what a
  write and a follow-up read address (morquis, faces-sh). Avoid "contact id" for a scripting id
  until CON-V2 confirms they are equal.
- **contact detail:** one labelled value on a contact: a phone number, email address, postal address
  or URL (morquis, upstream).
- **contact detail label:** a well-known label stored as a sentinel such as `_$!<Work>!$_` (fax labels
  use a legacy `…FAX` spelling in scripting), or custom plain text (morquis).
- **contact note:** a field reserved to apps holding Apple's contacts-notes entitlement; never
  offered (morquis).
- **contact store:** the port through which contacts are read and written (name chosen here for
  consistency with "event store" and "message store"). Avoid "address book" and "contacts store".
- **phone number (normalised):** a number in E.164, read with the user's region when it has no
  country code (upstream, morquis). A phone number is not a **handle** until it is matched to one in
  Messages; "handle", "known handle" and "ambiguous number" belong to Messages (faces-sh).
- **resolution:** what a name comes to: one, several, unknown, or cannot ask when Contacts is
  unreadable (faces-sh). Owned by Messages; finding a contact reports the candidates it uses.
- **recipient resolution:** turning a spoken name into a contact's handle (long tail). Owned by
  Messages.

### Messages

- **handle:** one address a person is reached at in Messages: a phone number (usually E.164), an
  email address, or an alphanumeric sender ID; `handle.id` is the stored spelling. Avoid "phone
  number" as a synonym (faces-sh, morquis, ANierbeck, chrischall, upstream).
- **known handle:** a handle string already stored in the message store; the only thing an address
  may match (faces-sh).
- **ambiguous number:** an address whose digits fit known handles in different countries; refused,
  never resolved (faces-sh).
- **chat:** a thread with participants, addressed by its guid; a *group chat* or a *one-to-one
  chat* by the chat's own style, not by participant count. Avoid "conversation" and "thread" as
  synonyms (faces-sh, morquis, upstream).
- **participant:** a handle that belongs to a chat; the user is never listed (faces-sh).
- **real traffic:** a message the other person sent, or one of the user's that the store shows as
  sent or delivered; failed sends don't count (faces-sh). Settled in `CONTEXT.md`; "genuine
  contact" is not our word.
- **last in touch:** the newest real traffic on any of a person's handles; breaks ties, never
  filters (faces-sh).
- **ghost chat:** a chat holding only failed sends, or created by addressing a name instead of a
  handle (faces-sh, upstream #48).
- **name resolution:** what a name comes to: one person, several (a question), unknown (Contacts
  read, no match), or cannot ask (Contacts unreadable) (faces-sh).
- **wrong number:** a never-used address belonging to someone who writes from another handle;
  refused, naming the handle they use (faces-sh).
- **known recipient:** a handle the user has already exchanged messages with (NN4); its exact
  meaning is open in MSG-C5 (ANierbeck, upstream).
- **send allowlist:** operator-configured recipients a send may go to; avoid "whitelist"
  (ANierbeck, KassebaumEngineering).
- **send confirmation:** the user's explicit approval of one specific send (upstream).
- **sent:** the outgoing message left with no error; not the same as *delivered* (faces-sh).
- **delivery error:** the error code Messages records on an outgoing message it couldn't deliver,
  such as 22 for an address without iMessage (faces-sh).
- **unconfirmed outcome:** a send that was attempted but couldn't be checked in the store
  (upstream, faces-sh).
- **service:** the transport that carries a chat: iMessage, SMS or RCS (gene-jelly, upstream).
- **buddy:** Messages' scripting word for a handle on a service; implementation vocabulary only,
  never a domain word (morquis, upstream).
- **attributed body:** the archived rich-text blob that holds almost every message's text;
  *bookkeeping string* is a string inside it that describes the archive, never text a person wrote
  (faces-sh, morquis, chrischall, upstream).
- **reaction:** a tapback stored as a message row that isn't a message the user wrote; avoid
  "tapback" in tool output (morquis).
- **message timestamp:** nanoseconds since 2001-01-01 UTC, the store's own unit (faces-sh, morquis).
- **range:** a start and end in the user's local time; a bare end date means that whole day
  (faces-sh). Settled in `CONTEXT.md`; "period" and "window" are not our words, except for a
  Calendar **busy period**.
- **search query:** optional ranked terms, exact phrases and exclusions, folded for accents and
  case (faces-sh).
- **coverage:** how far a search reached: messages scanned, whether it hit its ceiling, the oldest
  message reached (faces-sh).
- **Full Disk Access:** the macOS setting required to read the message store, granted to the
  responsible app (upstream, faces-sh).

### Notes

- **note:** a Notes item with a title, a body and a plain text view, addressed by its identifier. Titles aren't unique (KassebaumEngineering, neektza, chrischall, upstream). Avoid "item" and "record".
- **note identifier:** the store's stable id for a note, the same one whether reached by scripting or in the store. It's the only way to address one note for a read or a write (KassebaumEngineering, faces-sh).
- **title:** a note's name. Notes may derive it from the body's first line (neektza, KassebaumEngineering; see NOT-C6). Avoid "name" in scenarios.
- **note body:** the HTML projection of a note that scripting reads and writes. It's lossy (KassebaumEngineering).
- **note text (plain text):** the read-only text of a note without formatting, which search matches. It leaves out checklists, tables and attachments (neektza, chrischall). Avoid "content".
- **note document:** the stored source of truth for a note (paragraphs, styles, attachments) that the body projects from (KassebaumEngineering). Avoid "payload" in scenarios.
- **paragraph style:** Title, Heading, Subheading, Monostyled, Bulleted, Dashed, Numbered or Checklist (KassebaumEngineering).
- **checklist item:** a checklist paragraph whose ticked state has no HTML form (KassebaumEngineering).
- **attachment (note):** an object attached to a note: image, PDF, scan, drawing, table or link card (KassebaumEngineering). Keep it apart from a mail attachment.
- **lossy rewrite:** replacing a note's body in a way that drops something its document held (KassebaumEngineering). Avoid "blocker" in scenarios; say "what would be lost".
- **preview:** the first characters of a note's text, shown in a list or search result (neektza, faces-sh).
- **index vs detail:** a list shows every note briefly, and a read shows one note in full (faces-sh).
- **suggestion:** a note that didn't match but has a similar title, always labelled apart from results (neektza).
- **account (Notes):** a top-level Notes container such as iCloud, On My Mac or Exchange. It owns note folders (morquis, danielk-am, therealap). Keep it apart from a mail account.
- **note folder:** a container of notes inside an account, identified by account and name together. Names repeat across accounts, and folders can nest (therealap, morquis, chrischall, danielk-am, upstream).
- **Recently Deleted:** the folder where deleted notes wait before they are purged. Normal reads leave it out, and its display name is localised (therealap).
- **smart folder:** a saved-search view that repeats notes filed in real folders (therealap).
- **shared note:** a note shared through iCloud, whose folder and account can't be read (danielk-am).
- **locked note:** a password-protected note whose text can't be read without the password (faces-sh, KassebaumEngineering).
- **Automation permission (Notes):** Privacy & Security > Automation > Notes. -600 and -1743/-1744 are how its absence shows up (upstream, faces-sh, nivra).
- **truncated / page:** a result that stopped at a limit and says so. Shared with Cross-cutting (therealap, faces-sh).

### Mail

- **account (mail):** a configured Mail account with a display name (not unique) and one or more email addresses. It owns its mailboxes. (brightline, felkru, gene-jelly, nivra, chrischall, ANierbeck, morquis, upstream)
- **mailbox:** a folder of emails inside one account, which can nest. It is identified by its account and its path, and its name repeats across accounts. Avoid "folder". (all mail forks, upstream)
- **local mailbox:** a mailbox that belongs to Mail itself ("On My Mac", Outbox) rather than to an account. (felkru, brightline)
- **mailbox path:** the names from an account's top-level mailbox down to a mailbox, compared after NFC. (morquis)
- **inbox:** an account's incoming mailbox, recognised by its role. Its displayed name is localised or depends on the provider (`INBOX`, `Inbox`, `Posteingang`). (brightline, ANierbeck, morquis)
- **unified inbox:** Mail's app-level inbox spanning all accounts. Don't use plain "inbox" for it. (brightline, long-tail/zaclohrenz, upstream)
- **email:** one item in Mail. Mail's dictionary and the forks say "message", but keep that word for Messages. (proposal)
- **unread email / read state:** an email whose read status is false. **unread count:** Mail's per-mailbox count, whose reliability for IMAP is a #7 question. (gene-jelly, ANierbeck, chrischall)
- **latest mail:** the most recently received emails, newest first. Not "the first N in mailbox order". (felkru, nivra, gene-jelly, morquis)
- **role mailbox:** Drafts, Sent, Junk, Trash or Archive, whose names vary by provider. Recognise it by role, not by name. (gene-jelly, fpjnijweide)
- **draft:** an unsent email saved in an account's Drafts mailbox. It isn't a compose window. (KassebaumEngineering, upstream PR #68)
- **email reference:** what a read returns so a later operation can act on exactly that email (Message-ID, account, mailbox path, and a store id). Avoid matching by subject. (morquis, fpjnijweide, chrischall)
- **Message-ID:** the RFC 5322 header, stored without angle brackets. Unlike Mail's scripting **mail object id**, it is not local to one Mac. (morquis)
- **range:** the dates a search covered, always stated in the result. **coverage:** how far back a read looked. Avoid "window", "search window" and "scan window". (chrischall, brightline, morquis, faces-sh)
- **search query:** the free-text part of a search, with a defined grammar and literal characters. Avoid "search term" when it means the parsed query. (faces-sh, upstream #30)
- **attachment:** a MIME part of an email with a file name, content type and size, addressed by its part. (felkru, fpjnijweide)
- **header selection:** the headers asked for by name, case-insensitively, with folded lines kept. (morquis)
- **account allowlist:** the accounts the user lets the agent see. Its opposite is "hidden account". Avoid "whitelist". (ANierbeck)
- **send allowlist:** addresses the server may send to, set on top of **known recipient** (for email, still to be defined; see MAIL-C12). (KassebaumEngineering, ANierbeck)
- **dry run:** a write that reports what it would change and changes nothing. (morquis)
- **time budget:** the longest a mail read may run before it is stopped and reported as timed out. (brightline, nivra, upstream)
- **cold start:** the time between Mail launching and its accounts being loaded. (felkru)
- **Envelope Index / emlx / mailbox URL:** Mail's SQLite catalogue, per-email file and mailbox locator. These are adapter words and stay out of acceptance scenarios. (fpjnijweide, felkru)
- **Apple epoch:** seconds since 2001-01-01 UTC. An adapter word. (felkru, fpjnijweide)
- **rule (mail), template (mail):** a Mail rule, and a fork-local template that isn't Mail data. Both are outside v1. (chrischall)

### Cross-cutting

- **capability:** a group of operations switched on or off together in settings, such as sending
  messages. Avoid "scope", "token" and "app switch" (faces-sh, sicdigital, gene-jelly).
- **write capability:** a capability that changes a store or reaches another person. Off until
  configured (sicdigital, brightline, chrischall).
- **tool annotation:** the hints a tool declares: read-only, destructive, idempotent and open-world
  (ANierbeck, upstream PR #76).
- **named failure:** a failure with a code, one sentence saying what didn't happen, and the evidence
  verbatim. Avoid "error message" and "failure envelope" in test names (faces-sh, ANierbeck).
- **permission failure:** a named failure for a missing macOS grant, naming the pane and the app to
  enable. Avoid "access denied" as a catch-all (faces-sh, brightline, ANierbeck).
- **Automation permission:** Privacy & Security > Automation, which lets one app control another
  (upstream, nivra).
- **Full Disk Access:** the grant needed to open protected stores such as `chat.db` (upstream,
  faces-sh).
- **authorisation status:** a framework's access state for one store: not determined, restricted,
  denied, write-only (events only) or full access (brightline, danielk-am, arr2036, mjmcg).
- **responsible app:** the app macOS credits a permission prompt to, which isn't necessarily the
  process that asked. Avoid "host app" (upstream, brightline, nivra, fpjnijweide, faces-sh).
  Settled by [ADR-0002](../adr/0002-helper-owns-every-protected-access.md): the helper disclaims
  responsibility and holds every grant under its own identity, so it is the app a permission failure
  names.
- **Apple Event error number:** the OSStatus a failed script call carries (-1743 not permitted, -600
  not running), used to classify failures instead of message text (nivra, faces-sh, morquis).
- **time budget:** the longest an operation may run before it is stopped and reported as timed out.
  Avoid "timeout" for the budget itself (upstream, brightline).
- **unconfirmed outcome:** a write that was attempted but couldn't be checked in the store (upstream,
  faces-sh).
- **confirmation:** the user's explicit approval of one specific write. Never a model's reply
  (upstream, brightline).
- **page / total / ceiling:** what one answer shows, how many exist, and the most one call can ever
  return. Avoid `count` for the page size (faces-sh, sicdigital).
- **truncated:** a result that stopped at a limit before reading everything, and says so (therealap).
- **index vs detail:** a list shows every item briefly, and a read of one item shows it in full
  (faces-sh).
- **external content:** text written by someone other than the user (an email, message or invitation),
  carried as a field and never trusted as instructions (ANierbeck).
- **send allowlist:** an explicit setting listing who may be sent to, on top of known recipients. Avoid
  "whitelist" (ANierbeck, KassebaumEngineering).

## Noise

Commits that carry no behaviour, idea or risk, listed per fork so the coverage check can account for them. Commits that mix noise with a real change are cited where the change is.

- **ANierbeck** (README and docs rewrites, doc-comment example cleanup, merges of the seven fix/* branches): `075c188`, `16ba7eb`, `2d36d9b`, `3b8eb76`, `3db8c74`, `3ea6722`, `483751e`, `59bc09d`, `5afc319`, `ea9c5e5`, `f955386`, `ffd7901`
- **boutquin** (lockfile churn, contributing guide, merge commit): `0a826ab`, `0c0a1fd`, `1fe8124`
- **brightline** (README install options, DXT bundle rebuilds and manifest): `0d1032a`, `598ce4e`, `86e3953`, `967b090`
- **chrischall** (.gitignore, README build commands, design-spec and plan documents): `1c129c8`, `448966a`, `55ec296`, `628a89c`, `758d4a5`, `8c4a3f8`, `8ded6d8`, `a003966`
- **danielk-am** (README rewrite, two unmerged Dependabot bumps): `0b4f949`, `a98f45f`, `e5a21f1`
- **faces-sh** (version bump for Maestro, merge commits of PRs #1 and #3 to #12): `020a3ab`, `1c453a8`, `2247d56`, `43cbf80`, `44aac44`, `536770c`, `562a239`, `7ff67c0`, `ad793f9`, `caf8201`, `da74a70`, `dee264f`
- **fpjnijweide** (debug logging, credit banners, README): `19881d7`, `7ecf179`
- **long-tail** (VraoNOVA Dependabot config twice; dewdad built bundle; adynt8 audio file; fastmcp-me badges; NYO2008 demo package): `096db2e`, `0a53c3e`, `1cd276b`, `6503136`, `6714752`, `80a4404`
- **mjmcg** (debug logging added then removed): `6cd7564`, `c4a80c4`
- **morquis** (upstream history carried under rewritten SHAs (patch-identical to upstream through ec3018b) and their merges, merges of the fork's own Codex PRs, docs and plans, ESLint setup and a placeholder test): `00741ac`, `020a53e`, `0b34bbb`, `0dbcd51`, `0fedf0e`, `11d210a`, `123fc54`, `1926bf0`, `19c023f`, `1e097d7`, `25f47b7`, `2bb3a4f`, `2e564f7`, `2f218be`, `3514613`, `362cea4`, `36afdfe`, `36f0fed`, `3991552`, `3d2e315`, `3ee64ba`, `4524b9e`, `4558a34`, `4b210ef`, `5449623`, `568f769`, `59fded6`, `5ef1e65`, `5f54271`, `62a2cd6`, `6885e73`, `72db840`, `7527415`, `75ffc81`, `7a73457`, `8034ce5`, `8508ba0`, `8529354`, `855de2c`, `88ab897`, `8f0ed0a`, `9181050`, `9351a97`, `983fd88`, `998f94d`, `a12b186`, `a2b57c8`, `a799b3b`, `a7cd912`, `a8c8ab2`, `abc55e4`, `b2eb556`, `b5094b6`, `b8e7632`, `bcb1357`, `bd1fc1c`, `bddc8a4`, `bf02aee`, `c284487`, `c49486b`, `cd41df1`, `cd6e0d0`, `cf05626`, `d1373c2`, `d41d235`, `d5b580d`, `d65c9a6`, `dbd51aa`, `dbdf201`, `dc60b07`, `ddb1335`, `dff4183`, `e16e021`, `e3aa89b`, `e447e10`, `e4f8388`, `e5e0991`, `e9146c7`, `eb9f23c`, `ebc8a09`, `f2ddfdf`, `f572af3`, `f6a41bb`, `f8dfa1a`, `fb07813`, `fca9d8c`, `fce4380`
- **nivra** (README notice): `625cca3`
- **sicdigital** (implementation plan, README and usage docs, package identity and version bump): `6d3e786`, `73154b6`, `9849c70`, `98b4afe`, `ca978bd`, `cd15fe0`, `da0f965`
- **therealap** (stray patch file deleted): `5589fcd`
- **yjbae-sqa** (package name renamed twice and reverted, no net change): `2621136`, `51306d6`, `5f0bb07`

## Coverage check

Phase 1's exit asks that every commit in every Appendix A fork, and every Appendix B issue, appears in
the findings as a scenario source, a rejection or a verification task. It was checked mechanically on
this file:

- **Scenarios:** 576 in the backlog, 230 of them required by a Non-negotiable, plus 17 parked under
  Out of scope and 6 rejected in place by a closed decision. The 34 added for
  [#26](https://github.com/that-mathevs/apple-native-mcp/issues/26) carry a ticket or an ADR as
  their source rather than a fork commit, because they come from a decision rather than from
  something a fork got wrong; they therefore add no commits or issues to the sets below.

- **Commits:** the set is every commit (merges included) reachable from any branch of each
  `fork-<owner>` remote and not from any `upstream/*` branch (`git rev-list`), for the 18 Appendix A
  forks plus `yjbae-sqa`, and the 16 commits listed in `forks/long-tail.md`: 410 commits in 20 sets.
  Each short SHA was searched for in this file with the Conflicts and Credits sections removed, so a
  commit only counts when it is a scenario source, a verification task, a rejection, an Out of scope
  entry, a repository or release input, or a Noise line. **All 410 are present.**
- **Issues:** all 46 issue numbers in plan.md Appendix B appear as `upstream #n` in the same sections.
  Bare `#n` references in this file are this project's own tickets on `that-mathevs/apple-native-mcp`,
  never upstream's.
  **All 46 are present.** 39 are scenario sources, rejections, verification tasks or Out of scope
  entries. The seven that are purely setup problems (upstream #55, #50, #33, #29, #14, #5, #2) are
  accounted for, per their verdict in `upstream.md`, under Cross-cutting's "Install docs inputs"
  (#50's permission question was answered by #4).
- **Pull requests:** all 15 unmerged upstream PRs (#28, #32, #37, #39, #40, #41, #46, #49, #52, #56,
  #57, #61, #68, #73, #76) appear. **All 15 are present.**
- **Report entries:** every entry whose verdict rejects something is in Rejected (137) or, when it is
  only out of v1 scope, in Out of scope (21).

Not covered, as `docs/research/` already records: forks created after the 2026-09-17 snapshot, and the
TypeScript source of long-tail commit `28c91b7`, which isn't public.
