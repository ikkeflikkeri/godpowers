---
name: god-story-build
description: |
  Implement a single story. Reads STORY.md, spawns the standard build
  pipeline (god-planner + god-executor + reviewers) scoped to the
  story's slice plan and acceptance criteria.

  Triggers on: "god story build", "/god-story-build", "build story",
  "implement story"
---

# /god-story-build

Run the build pipeline for ONE story.

## Forms

| Form | Action |
|---|---|
| `/god-story-build <STORY-id>` | Build the named story |
| `/god-story-build --next` | Build the first frontier story (pending, unblocked, unclaimed) |
| `/god-story-build --status` | Show build status of in-progress stories |
| `/god-story-build --next --force` | Take the next story even if a stale claim holds it |

## Process

1. Verify story exists; parse via `lib/story-validator.parseStory`.
2. Resolve which story to build. The two forms differ deliberately:
   - Named id: validate deps. For each dep, check its status is `done` or
     `closed` (a dep ruled out of scope no longer blocks). If any dep is
     open, pause and ask the user (proceed anyway, or start the dep first).
     The user named this story, so the unmet dep is worth surfacing.
   - `--next`: take the first entry from
     `lib/story-validator.frontier(projectRoot)`, which is already pending,
     unblocked, and unclaimed. Do not pause on deps; a blocked story is not
     on the frontier in the first place.
3. Refuse decision units. `/god-story-build` builds code. If the unit's kind
   is not `slice`, route to `/god-chart --work <id>` instead: a `grilling` or
   `research` unit resolves a question and has nothing to implement.
4. Claim it before any work: `lib/story-validator.claim(path, owner)`. This
   sets status `in-progress`, records the holder, and stamps `claimed-at`.
   A claim with no holder cannot be told apart from another session's, so
   the claim is what makes parallel `--next` runs safe.
   - If the story is already claimed by someone else and the claim is live,
     `claim()` throws. Pick the next frontier entry.
   - If the claim is stale (`isClaimStale`, default TTL 60 minutes), report
     the stale holder and take it with `{ force: true }` only when the user
     asks or `--force` was passed. This mirrors the state-lock reclaim path
     in `references/shared/LOCKING.md`.
   - If the build aborts before completing, call
     `lib/story-validator.release(path)` so the story returns to the frontier
     rather than sitting claimed forever.
5. Spawn `god-planner` with directive:
   "Plan a vertical slice for STORY-{id}. Slice plan from STORY.md:
   [steps]. Acceptance criteria from STORY.md: [criteria]. Don't
   exceed 7 commits."
6. Spawn `god-executor` to implement (TDD, atomic commits, code
   annotated `// Implements: STORY-{id}`).
7. Spawn `god-spec-reviewer` + `god-quality-reviewer` (two-stage).
8. On success: trigger `lib/reverse-sync.run()` (per Phase 6 pattern).
9. Story stays `in-progress` until user runs `/god-story-verify` AND
   `/god-story-close`. Build completion alone doesn't auto-close.

## Output

Code commits annotated with `// Implements: STORY-{id}`.
Reverse-sync writes Implementation Linkage footer to ROADMAP.md
(milestone-level credit) and the story's `Notes` section gets a
"Implemented in:" footer.

## Suggested next

- `/god-story-verify <id>` to runtime-test acceptance criteria
- `/god-story-close <id>` after verify passes

## What this does NOT do

- Auto-close the story (must explicitly /god-story-close)
- Run /god-test-runtime (that's /god-story-verify's job)
- Bypass design-reviewer if STORY changes UI (the standard gate
  still fires)
- Build decision units. `kind: decision`, `research`, `prototype`,
  `grilling`, and `task` units resolve a question; route them to
  `/god-chart --work <id>`.


Locking: See `<runtimeRoot>/references/shared/LOCKING.md` for the shared state-lock contract.
