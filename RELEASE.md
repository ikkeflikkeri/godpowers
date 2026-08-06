# Godpowers 5.16.0 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-06

- [DECISION] Godpowers 5.16.0 closes the learning loop. Lessons extracted after a milestone now feed the next build plan, the learning loop gained ledger-backed telemetry, and prompt changes gained a human-gated improvement-proposal pipeline plus a frozen eval corpus for the artifact grader.
- [DECISION] The public surface contains 124 slash commands, 41 specialist agents, 13 workflows, and 45 recipes; `/god-polish` was added after 5.16.0 shipped, ahead of the 5.17.0 release notes.
- [DECISION] The core package contains 108 runtime library modules and keeps zero production dependencies. Two runtime modules were added: `lib/learning-metrics.js` and `lib/improvement-proposals.js`.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.16.0.

## Changes

- [DECISION] The planner consumes prior learnings. `god-planner` reads the most recent milestone's `LEARNINGS.mdx` and recalls recent structured lessons (`npx godpowers lesson list`) before slicing, capped by the new `lessons-recall-limit` loop parameter (default 10, tuned via `/god-budget --loop`). `/god-extract-learnings` double-writes each Lessons Learned bullet into the evidence lessons store with a milestone tag, deduplicated on re-run. Previously the learnings pipeline was write-only: nothing ever read `LEARNINGS.mdx` back.
- [DECISION] The learning loop is observable. New `lesson.recorded` and `lesson.recalled` ledger events, a `godpowers event emit` CLI subcommand as the concrete emission surface for skill prose, and `lib/learning-metrics.js` surfacing recorded and recalled counts in `/god-metrics`. Observability only: nothing gates on these numbers, and the accepted-change rate shown alongside is labeled correlation, not causation.
- [DECISION] Prompt changes are proposal-gated. `lib/improvement-proposals.js` lets the learning loop DRAFT a change to a prompt surface (`skills/`, `specialists/`, `references/`, declared `frozen` cadence via the new `PROMPT_SURFACES` map in `lib/artifact-map.js`) but never apply one: proposals land in `.godpowers/proposals/` and escalate a warning-severity item into the review queue, and only a human applies them in `/god-review-changes` via the new `godpowers proposal` CLI (propose, list, decide). Staleness (target changed since drafting) refuses acceptance mechanically; dedupe and a `proposal-open-limit` cap (default 1) bound the queue; `proposal.*` events keep self-improvement telemetry out of the product accepted-change rate.
- [DECISION] The proposal severity is staged. Proposals ship at `warning` (visible, never blocking) with a dual-state-pinned promotion path to `error` in `scripts/test-improvement-proposals.js`, cloned from the `ATTESTATION_GAP_SEVERITY` pattern, so the promotion is a deliberate tested transition rather than silent drift.
- [DECISION] The review queue gained surgical clearing. `reviewRequired.removeItem` removes exactly one item from one batch, leaving every other byte of the ledger untouched, so deciding a proposal can never drop someone else's pending review.
- [DECISION] A frozen eval corpus protects the artifact grader. `fixtures/evals/` holds known-good and known-bad PRD and roadmap fixtures graded by the already-frozen `lib/artifact-linter.js`, including tripwire fixtures whose self-authored "PASSED" prose must not blind the grader. Honestly framed: a frozen grader on a frozen corpus protects the sensors and gives reviewers reference examples; it cannot measure the effect of a prompt change.

## Validation

- [DECISION] Three new test suites ride `npm test`: `scripts/test-learning-metrics.js`, `scripts/test-improvement-proposals.js`, and `scripts/test-eval-set.js` (101 test script files total).
- [DECISION] The full suite passes, and the complete release gate is green end to end: standards, coverage, per-file coverage, audit, self-project truth, evidence drift, and both package-content checks.
- [DECISION] Every changed file was checked for em dashes, en dashes, and decorative emoji, per the repository style policy. The two `bad-*` roadmap eval fixtures contain an em dash deliberately: it is the failure mode they exist to encode, per the `fixtures/evals/README.md` contract.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.16.0` or `npx godpowers@5.16.0`.
- [DECISION] Nothing to migrate. No state format, artifact schema, command name, or gate behavior changed; the new loop parameters use built-in defaults until a project overrides them.
- [DECISION] Existing projects gain the learnings-to-planner feed automatically on their next `/god-build` when `.godpowers/learnings/` exists; proposals and eval fixtures are opt-in surfaces.

## Publication Evidence

- [DECISION] Pushing tag `v5.16.0` triggers the identity-bound provenance publication workflow, which verifies the tag against both package versions and against `origin/main`, runs the release and pre-publication gates, and publishes `godpowers@5.16.0` and `@godpowers/mcp@5.16.0` with npm provenance.
- [DECISION] The GitHub Release is created by hand from this file after the workflow goes green; the workflow does not create it.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
