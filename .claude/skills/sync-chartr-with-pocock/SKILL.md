---
name: sync-chartr-with-pocock
description: Sync chartr's map files under `.plan/maps/` with the wayfinder map on GitHub Issues. Use after a session writes to a wayfinder map or its tickets, when a chartr session has answered a ticket in its file, or when chartr shows no map.
---

Two wayfinders keep the same map in two stores. `/mattpocock-skills:wayfinder` writes it
to GitHub Issues, per the Wayfinding operations in `docs/agents/issue-tracker.md`; chartr
reads it from `.plan/maps/<slug>/`, in the format `.chartr/TRACKER-CONVENTION.md` fixes.
GitHub is the **source of truth** and `.plan/maps/` is its **mirror**: whatever a file
knows first is **published** to GitHub, then the mirror is rewritten from GitHub. `.plan/`
is git-ignored because a mirror is a cache.

Where `.chartr/` is absent there is no chartr to sync: say so and stop. Otherwise read the
tracker convention first. It owns the file format; this skill owns only how GitHub maps
onto it.

## 1. Pair the maps

List every `wayfinder:map` issue, open and closed, and every `.plan/maps/*/map.md`. A
mirror names its issue in the first bullet of its Notes: `- **Mirror of** <issue URL>`. A
map issue with no mirror gets a new directory. A map's tickets are its children, found as
the tracker doc finds them.

A ticket file pairs with its issue through an `issue: <number>` frontmatter key (chartr
tolerates unknown keys). A new file takes the issue number as its `NN` where that `NN` is
free on the map, else one above the map's highest.

A **slug** is the title in lower case, apostrophes dropped, every other run of
non-alphanumerics a single `-`. An existing directory or file keeps its name through a
retitle, so links hold.

Done when every map issue has exactly one mirror directory.

## 2. Publish what the files know first

chartr's sessions answer in the file. On a first mirror there are no files and this step
is empty. Otherwise, for each ticket file in `NN` order:

- **No `issue:` key.** Create the issue as a child of the map, with its
  `wayfinder:<type>` label and its blocking edges, then write the key into the file.
- **`claimed_by` set, the issue unassigned.** Assign the issue to `@me`.
- **Unattributed text under `## Comments`.** Step 3 opens every comment it copies with an
  attribution line and a chartr session writes none, so text under no such line is the
  file's own: post it as a comment. On a closed ticket it lands after the answer, as an
  amendment.
- **`## Answer` with the issue still open.** Post the section under a `## Answer` heading
  as the resolution comment, close the issue, and add the ticket's Decisions-so-far line
  to the map issue.
- **`## Ruled out` with the issue still open.** Post the section, close the issue as not
  planned, and add its Out-of-scope line to the map issue.
- **Resolved on one side, ruled out on the other.** Show the human both and let them
  choose.

A line added to the map issue takes GitHub's form, `- [Title](issue URL): gist`, its gist
from the mirror's `map.md` where that has the line, else written from the answer.

A file is ahead only in those ways. Everything else is edited on GitHub and step 3
overwrites the file's copy: a Question, a Done-when, a blocking edge, the spec, and a
closed ticket's answer, which is amended by a further comment. Where a closed ticket's
answer differs from its `## Answer` comment beyond the heading demotion, name the ticket
in the report before step 3 overwrites it.

Done when no file is ahead of its issue.

## 3. Rewrite the mirror from GitHub

`map.md`: the issue title as the H1, then the five sections of the issue body, HTML
comments included. The map issue's comments stay on GitHub.

- Notes opens with the **Mirror of** bullet.
- Anywhere in `map.md`, a link to a ticket of this map becomes `./tickets/NN-slug.md`.
  Every other link stays an absolute URL.
- Decisions so far and Out of scope: `- [Title](link): gist` becomes
  `- [Title](link) — gist`.
- Not yet specified: one bold-lead bullet per patch, with `<clears-with: NN>` where the
  issue names the ticket that clears it.

`spec.md`: the file is `# <issue title>` then the issue body, and the second Notes bullet
is `- **Spec:** [<issue title>](./spec.md), mirror of <issue URL>`. That bullet pairs the
spec from then on. On a first mirror the spec is the issue outside the map that a resolved
answer presents as the spec the map produced; where two could be, ask the human.

Each child issue becomes `tickets/NN-slug.md`:

| File | From GitHub |
| --- | --- |
| `type` | the `wayfinder:<type>` label |
| `blocked_by` | every edge from `GET repos/<owner>/<repo>/issues/<n>/dependencies/blocked_by`, closed blockers included, as sorted `NN`s; `[]` for none |
| `issue` | the issue number |
| `claimed_by`, `claimed_at`, `undermined_by`, `assets` | kept exactly as the file has them, and left out of a new file; chartr owns the claim keys |
| `# <title>` | the issue title |
| `## Question` | the issue body's Question, links left as GitHub URLs |
| `## Done when` | the body's **Done when** paragraph, lifted out of the Question with its label stripped. Where the issue states none: the file's existing text, else the one-line criterion the Question implies |
| `## Comments` | every comment that is not part of the answer, in order. Partial findings on an open ticket live here |
| `## Answer` | closed as completed: the last comment opening with `## Answer`, heading stripped, then every later comment in order. Corrections arrive that way |
| `## Ruled out` | closed as not planned: the closing comment |

The sections keep the table's order, and one with no content is left out, heading and
all. Each copied comment opens with a `**<login>, <YYYY-MM-DD>:**` line of its own, the
`## Answer` comment excepted, and a blank line parts it from the next. Inside a section,
a copied H1 or H2 becomes an H3, so it cannot pass for a structural heading.

## 4. Verify

For every map:

- Every rule of the tracker convention holds for `map.md` and for each ticket file.
- Decisions so far has one bullet per resolved file and Out of scope one per ruled-out
  file; every `./tickets/` and `./spec.md` link resolves, and each link's title is its
  file's H1.
- Every `blocked_by` number is a file on the same map.
- Each file's derived status matches its issue: closed as completed is `resolved`, closed
  as not planned is `out_of_scope`, open is `open` or `claimed`.

A mismatch that comes from GitHub is mended on GitHub by the human, then step 3 runs
again: an issue closed without its `## Answer` or closing comment, a child without
exactly one `wayfinder:<type>` label, a blocking edge to an issue outside the map.

Done when every ticket of every map matches, or each mismatch is named for the human.
Report by ticket name what was published and what was rewritten. Name each open ticket
assigned on GitHub but unclaimed in its file: chartr shows it on its frontier while
someone holds it.
