# Godpowers 5.12.0 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-07-31

- [DECISION] Godpowers 5.12.0 adds decision units, a work unit whose deliverable is a resolved decision rather than code, plus `/god-chart` to chart the decisions between here and a named destination.
- [DECISION] The public surface contains 123 slash commands, 41 specialist agents, 13 workflows, and 45 recipes.
- [DECISION] The core package contains 100 runtime library modules and keeps zero production dependencies.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.12.0.

## Changes

- [DECISION] `lib/story-validator.js` gains a `kind` field (`slice`, `decision`, `research`, `prototype`, `grilling`, `task`) and picks the section contract from it, so a decision can be tracked as work; before this every board-shaped unit was schema-forced to be a build slice, and decision work in `.godpowers/spikes/` and `.godpowers/discussions/` was invisible to `/god-stories`, to dependency resolution, and to a second parallel session.
- [DECISION] A unit with no `kind` is a slice, so every story written before this release validates unchanged.
- [DECISION] `/god-chart` and `specialists/god-cartographer.md` chart a decision map for work too big for one session, naming the destination before any unit is written and producing decisions rather than deliverables.
- [DECISION] `## Not Yet Specified` on charts and `templates/ROADMAP.mdx` holds in-scope questions that cannot yet be phrased sharply; have-nots P-08 and P-09 now exempt that section, because requiring an owner and a hard due date on a question you cannot yet phrase forced honest known-unknowns off the artifact.
- [DECISION] `closed` joins the status vocabulary with a required `closed-reason`, so work ruled beyond the destination is closed rather than deleted, excluded from done counts, and kept out of the decisions log.
- [DECISION] `claim()`, `release()`, and `isClaimStale()` give a work unit a claim with a holder and a reclaim path; `in-progress` with no owner is now an error, because an unheld claim cannot be told apart from another session's.
- [DECISION] `frontier()` and `/god-stories --frontier` compute the open, unblocked, unclaimed units; `findDanglingDeps()` surfaces deps naming units that do not exist, which previously kept a unit permanently off the frontier with no explanation.
- [DECISION] `--yolo` cannot auto-resolve a unit marked `hitl: true`, alongside safe-sync blockers and unresolved Critical harden findings.
- [DECISION] `references/planning/WAYFINDING.md` carries the doctrine, and have-nots W-01 through W-08 move the catalog total from 158 to 166.

## Validation

- [DECISION] `scripts/test-story-validator.js` grows from 18 to 39 behavioral tests covering kinds, the per-kind section contract, closed-with-reason, claim and reclaim, staleness, the frontier, and dangling deps.
- [DECISION] The static check, self-project truth, public-surface counts, have-nots tally, golden-artifact tests, and `npm audit --omit=dev` are green on the tagged commit.
- [DECISION] Count-bearing lines in `ARCHITECTURE.md` and `ARCHITECTURE-MAP.md` that no gate covered had rotted to pre-5.x values and are corrected to current disk truth in this release.
- [DECISION] The complete release gate and the official Agent Skills validator run in the GitHub publication workflow before the artifact is published.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.12.0` or `npx godpowers@5.12.0`.
- [DECISION] Existing 5.x projects need no `.godpowers` artifact migration; existing STORY files carry no `kind` and are read as slices.
- [DECISION] Re-run the installer for each host runtime so the updated references and templates replace installed copies.

## Publication Evidence

- [DECISION] Pushing tag `v5.12.0` triggers the identity-bound provenance publication workflow, which runs the release gate, publishes `godpowers@5.12.0` and `@godpowers/mcp@5.12.0` with npm provenance, and attaches the GitHub Release assets.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
