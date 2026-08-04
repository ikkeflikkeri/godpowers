# Godpowers 5.15.0 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-04

- [DECISION] Godpowers 5.15.0 rewires the improvement-loop network from mutual confirmation to anchored verification: metrics never travel alone, gates corroborate claims against executed evidence, no auditor grades its own gate, and fast loops can no longer close slow loops' freshness checks.
- [DECISION] The public surface contains 123 slash commands, 41 specialist agents, 13 workflows, and 45 recipes; no command or agent was added or removed. `references/HAVE-NOTS.md` gains a Severity Overrides table without changing its 183-entry catalog.
- [DECISION] The core package contains 105 runtime library modules and keeps zero production dependencies. Four modules are new: `findings-verdict.js`, `repair-integrity.js`, `cadence-guard.js`, and `loop-config.js`.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.15.0.

## Changes

- [DECISION] The tier gate pairs every claimed-pass verification command in `state.json` with its executed-backed count from the evidence ledger (`lib/evidence.js` verifications.jsonl). A claimed pass with no fresh verified executed record raises `<tier>-attestation-gap` ("attested, not executed") at warning severity behind a single promotion constant, so in-flight projects do not retroactively fail while the fabrication channel becomes visible on every gate run and dashboard.
- [DECISION] `lib/findings-verdict.js` is now the only parser of `.godpowers/harden/FINDINGS.mdx`. The launch and publication policies are pinned as one tested contract: accepted risk resumes the arc, it never authorizes publication. The `Launch gate: PASSED` short-circuit in `lib/router.js` is deleted; the harden auditor writes that file, so trusting its own summary line let the audited party grade its own gate. A static check forbids any other lib module from parsing the findings artifact.
- [DECISION] `fixtures/tripwires/` plus `scripts/test-gate-tripwires.js` negative-test the release sensors: a self-passed Critical, an attested-not-executed state file, and an uncited OWASP table must each FAIL their sensor. The suite pins both the current warning-stage behavior and the future error-stage behavior of the attestation gap, so severity promotion is a deliberate tested transition.
- [DECISION] The autonomous repair loop gains a test-integrity counter-metric (`lib/repair-integrity.js`): a green re-run whose repair deleted test files, added skip markers, or lowered coverage thresholds is SUSPECT and escalates via `lib/executor-repair.js` regardless of remaining budget. The signals are deliberately cross-language and high-precision; renames stay quiet.
- [DECISION] `scripts/version-sync.js` may re-bless the roadmap artifact hash only when the delta is exactly its own managed version stamp (`lib/cadence-guard.js` classifies the delta; `lib/artifact-map.js` records each artifact's cadence tier). Content drift is queued to `.godpowers/REVIEW-REQUIRED.mdx` and reported red instead of re-stamped; a human blesses deliberately with `--bless-roadmap="<reason>"`, logged to SYNC-LOG.mdx. This generalizes the 5.14.3 fix: the blind re-stamp of commit 1e99b1b is now structurally impossible, not just patched once.
- [DECISION] Error-severity review-queue items mechanically block Tier 3 routes through the safe-sync-clear prerequisite until `/god-review-changes` clears them, and judgment-grade failures under `--yolo` are deferred into that queue instead of vanishing, so autonomy can keep building but cannot reach deploy, harden, or launch past an unreviewed judgment failure.
- [DECISION] `lib/loop-config.js` is the single home for fast-loop knobs, with per-project overrides in `intent.yaml > loop-params` edited via `/god-budget --loop` with a logged reason. It closes a live defect: the runbook allowed 3 repair attempts while `lib/executor-repair.js` defaulted to 2. A static check keeps the runbook prose equal to the exported default.
- [DECISION] Headline percentages carry their counter-metric: workflow percent travels with built percent when steps were skipped, a roadmap-declared done increment is annotated declared-only when linkage evidence does not back it, and linkage coverage of an empty requirement set reads 0 with a no-known-ids reason instead of a vacuously perfect 1.
- [DECISION] The Severity Overrides table in `references/HAVE-NOTS.md` registers the A-14/A-15/A-16 compatibility downgrades with owner, rationale, and sunset; `scripts/test-have-nots-tally.js` asserts the validator's behavior matches the table and god-standards-check grades at the enforced severity, so the mechanical and LLM graders can no longer fork on one catalog.
- [DECISION] `npm run evidence:drift` joins `release:check`: the vendored verification engine is compared against its pinned upstream on every release (soft-skip when the upstream checkout is absent so CI stays green). The check fired on its first run, catching a real upstream refactor and an additive record key, reviewed and recorded in `lib/evidence/.provenance.json`.
- [DECISION] The full-suite guard in `scripts/static-check.js` is derived from disk: every `scripts/test-*.js` must be registered in the runner, with an explicit tombstone list, replacing a hand allowlist that covered 9 of ~90 suites.

## Validation

- [DECISION] The full suite (98 test scripts plus integration and MCP protocol tests) passes, and the complete release gate is green end to end: standards, coverage, per-file coverage, audit, self-project truth, evidence drift, and both package-content checks.
- [DECISION] Coverage holds at 94.95 percent lines and 79.74 percent branches, above the 90 and 75 release floors, with the per-file 70 percent gate green across 103 lib modules.
- [DECISION] The self-project truth gate returns pass at 140 checks on the release tree.
- [DECISION] The tripwire suite proves each hardened sensor fails its known-bad fixture; the fixtures are frozen and the suite is protected from silent removal by the derived runner guard.
- [DECISION] An independent Codex review at maximum reasoning effort was run over the complete change set before release; findings were triaged and addressed.
- [DECISION] The complete release gate and the official Agent Skills validator run in the GitHub publication workflow before the artifact is published.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.15.0` or `npx godpowers@5.15.0`.
- [DECISION] Nothing to migrate for existing `.godpowers` projects. The attestation gap ships as a warning, the OWASP citation check is advisory, and the roadmap re-bless guard only changes behavior in this repository's own version-sync flow. Projects that want claimed passes to become executed-backed run their verification commands through `npx godpowers verify "<command>" --substep=<id>`.
- [DECISION] The `Launch gate: PASSED` short-circuit removal is the one behavioral tightening user projects can observe: a findings file whose summary line disagrees with its per-finding statuses no longer passes the launch prerequisite. A compliant findings file (statuses resolved or human-accepted) is unaffected.

## Publication Evidence

- [DECISION] Pushing tag `v5.15.0` triggers the identity-bound provenance publication workflow, which verifies the tag against both package versions and against `origin/main`, runs the release and pre-publication gates, and publishes `godpowers@5.15.0` and `@godpowers/mcp@5.15.0` with npm provenance.
- [DECISION] The GitHub Release is created by hand from this file after the workflow goes green; the workflow does not create it.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
