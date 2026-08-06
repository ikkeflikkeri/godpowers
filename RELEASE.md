# Godpowers 5.17.0 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-06

- [DECISION] Godpowers 5.17.0 gives the design loop an external bar. DESIGN.md can name a shipped product as its reference anchor, the runtime audit judges the app against it through sealed blind A/B pairs, design reviews and divergence passes gained the same blind protocol, and the new `/god-polish` command climbs toward the bar inside hard bounds.
- [DECISION] The public surface contains 124 slash commands, 41 specialist agents, 13 workflows, and 45 recipes. One command was added: `/god-polish` (`build` family, tier 3). No command, agent, workflow, or recipe was removed or renamed.
- [DECISION] The core package contains 108 runtime library modules and keeps zero production dependencies. One runtime module was added: `lib/blind-compare.js`.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.17.0.

## Changes

- [DECISION] DESIGN.md gained an optional reference anchor. A `reference:` frontmatter block (`name`, `url`, `focus`) names a shipped external product as the audit-time quality bar. `lib/design-spec.js` validates the block (`D-REFERENCE-SHAPE`, `D-REFERENCE-NAME`, `D-REFERENCE-URL`), `lib/runtime-audit.js` captures the reference beside the app during design audits, and god-browser-tester judges the pair blind. The anchor is a verification anchor only: it never supplies tokens, god-designer records one only when the user names it, and anchor changes gate through god-design-reviewer like any other DESIGN.md change.
- [DECISION] Blind judgment is mechanical, not procedural trust. `lib/blind-compare.js` copies two role-named artifacts into neutral `a`/`b` slots, seals the role assignment in a sidecar, and enforces ordering in code: unseal refuses until a verdict exists, a recorded verdict is immutable, an unsealed pair refuses new verdicts, and a judged pair cannot be rebuilt. The protocol (`references/design/BLIND-COMPARISON.md`) states the honest limit plainly: the sidecar sits on disk during judging, so the blindness is a seatbelt against accidental peeking and after-the-fact edits, not cryptography.
- [DECISION] The reference verdict is advisory by design. A lost comparison files a warning-severity `reference-comparison` finding into REVIEW-REQUIRED.md; an unreachable reference degrades to a `reference-unreachable` warning. Neither trips the critical-finding gate, and god-browser-tester's have-nots now make escalating one a named failure. Losing to Linear is information, not a broken build.
- [DECISION] Reviews and divergence judge pixels, not labels. god-design-reviewer stage 1 judges rendered current-vs-proposed pairs blind when a design change renders, and the divergence pass judges rendered candidate pairs blind before convergence. Both skip honestly when nothing renders or the artifacts are identifiable at a glance, and both record the skip.
- [DECISION] `/god-polish` is a bounded climb, not a gauntlet. Each round runs the design audit (including the blind reference comparison when anchored), turns findings into one design-scoped fix slice, applies it under unchanged TDD and two-stage review rules, and re-audits as proof. The loop stops on the first of: the `polish-rounds-limit` loop parameter (new, default 3, hard max 10, tuned via `/god-budget --loop`), a human stop, a dry round with no measurable improvement, or a critical finding. State lives in `.godpowers/polish/POLISH.mdx` ledger entries with `polish.round` and `polish.closed` events; the loop refuses to run on a red build.
- [DECISION] The influence is acknowledged once, in the canonical place. INSPIRATION.md credits the gauntlet-loop skill (Matt Shumer's aim prompt, packaged by duolahypercho, MIT) for the reference-bar, blind-judgment, and climb-loop framings, and names what godpowers inverted: sealed mechanical ordering over trusted procedure, advisory severity over an unreachable "utterly wowed" bar, and a rounds cap plus dry-round detector over "the human is the only brake". No code or prose is vendored and there is no runtime dependency.

## Validation

- [DECISION] One new test suite rides `npm test`: `scripts/test-blind-compare.js` (102 test script files total). `scripts/test-runtime-audit.js` and `scripts/test-design-foundation.js` grew reference-anchor and capture coverage; `lib/blind-compare.js` lands at 100% line coverage and the lib aggregate stays above the 90/75 floors.
- [DECISION] The full suite passes, and the complete release gate is green end to end: standards, coverage, per-file coverage, audit, self-project truth, evidence drift, and both package-content checks.
- [DECISION] Every changed file was checked for em dashes, en dashes, and decorative emoji, per the repository style policy.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.17.0` or `npx godpowers@5.17.0`.
- [DECISION] Nothing to migrate. No state format, artifact schema, command name, or gate behavior changed. Both new surfaces are opt-in: a DESIGN.md without a `reference:` block audits exactly as before, and `/god-polish` runs only when invoked and refuses pre-green projects.
- [DECISION] Existing projects gain the blind reference comparison on their next design audit after declaring an anchor; `polish-rounds-limit` uses its built-in default until a project overrides it.

## Publication Evidence

- [DECISION] Pushing tag `v5.17.0` triggers the identity-bound provenance publication workflow, which verifies the tag against both package versions and against `origin/main`, runs the release and pre-publication gates, and publishes `godpowers@5.17.0` and `@godpowers/mcp@5.17.0` with npm provenance.
- [DECISION] The GitHub Release is created by hand from this file after the workflow goes green; the workflow does not create it.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
