# yjbae-sqa/apple-mcp

- **Remote:** `fork-yjbae-sqa`
- **Branches read:** `0.2.7` (the default branch; 3 commits beyond its merge base `50c7738`
  "DXT addition", 2025-07-09, which is an ancestor of `upstream/main`). `main` has 0 commits of
  its own (`git log upstream/main..fork-yjbae-sqa/main` is empty).
- **Commits accounted for:** 3 / 3
- **Last commit:** 2025-08-14
- **In one paragraph:** Confirmed noise. All three commits are GitHub web-editor "Update
  package.json" edits made within 17 minutes, and each changes only the `name` field:
  `apple-mcp` → `@pensive/apple-mcp` → `@yjbae/apple-mcp` → `apple-mcp`. The net diff from
  `50c7738` to `fork-yjbae-sqa/0.2.7` is empty. Probably someone trying out a scoped npm publish
  and then reverting. Nothing to learn.

## How it reaches each app

No changes.

## Changes

None.

## Noise

- `package.json` `name` renamed twice and then reverted, with no net change: `5f0bb07`, `2621136`,
  `51306d6`

## Glossary candidates

None.

## Open questions

None.
