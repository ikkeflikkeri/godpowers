# Godpowers 5.13.0 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-02

- [DECISION] Godpowers 5.13.0 gives `CODEDNA.md` an owner and gives every not-applicable documentation row an evidence state and an expiry, porting the style fingerprint from codedna and the absence-defending selection engine from docdna.
- [DECISION] The public surface contains 123 slash commands, 41 specialist agents, 13 workflows, and 45 recipes; no command or agent was added.
- [DECISION] The core package contains 101 runtime library modules and keeps zero production dependencies.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.13.0.

## Changes

- [DECISION] `god-repo-scaffolder` owns `CODEDNA.md` at the repo tier under the contract in `references/building/STYLE-GENOME.md`; before this `god-executor` and `god-quality-reviewer` both read the profile as an input and both were forbidden from creating one, so a documented input to two agents existed only if the user had installed a separate tool.
- [DECISION] `lib/style-stats.js` measures comment density, naming-casing histograms per identifier kind, function-length median and p90, identifier lengths, quote and indentation habits, and documentation coverage per language, so a numeric style norm is quoted from a run rather than estimated from a handful of files.
- [DECISION] The 15 AI tells are enumerated in the style genome reference, turning have-not U-01 from a judgement call into a checklist; `god-quality-reviewer` flags only the tells the profile says this project actually deviates on, because a false tell costs as much trust as a missed one.
- [DECISION] The have-not ledger has four states (`pass`, `fail`, `unknown`, `not-applicable`), matching what the godaudits sibling already reports; a check that never ran and a check that came back clean were previously the same row.
- [DECISION] A not-applicable documentation row records the evidence state that licensed it (`absent` or `by-design`) and may not rest on `unknown` or `hint`, because "we did not look" and "we decided this does not apply" read identically and have opposite consequences a year later.
- [DECISION] Every not-applicable row carries a `revisit when` predicate naming an observable event, and `god-reconciler` re-evaluates all of them on the way in and leads with the ones firing; a reason alone explained a decision at the moment it was made and never reopened it.
- [DECISION] Lifecycle stage and durability enter the documentation profile; a `durability: evidence` row (post-mortems, readiness reviews, scan outputs, approved closeouts) is append-only, because `god-updater` and `/god-sync` sweep artifacts on every feature and editing one destroys the only property that made it evidence.
- [DECISION] Staleness is four independent verdicts (drift-stale, calendar-stale, expiry-stale, unverifiable) rather than one status; a business case has no code to hash, so reporting it as drift-stale is theater.
- [DECISION] The verdict-by-state lattice makes the action on an existing repository a lookup: `adopt` costs a frontmatter block rather than a rewrite, and an orphan document (present, unjustified by the profile) gets a row and a question rather than a deletion task.
- [DECISION] Six documentation have-nots (DC-06 through DC-11) and seven style-genome have-nots (SG-01 through SG-07) move the catalog from 166 to 179; the five existing documentation have-nots were all about docs that lie and none was about a document that should exist and does not.

## Validation

- [DECISION] `scripts/test-style-stats.js` adds 6 behavioral tests covering casing classification, per-language measurement, vendored-tree skipping, unlisted extensions, truncation reporting, and sample counts.
- [DECISION] DC-07, DC-08, and DC-10 are mechanical in `lib/have-nots-validator.js` under a new `docmanifest` artifact type, with 5 further tests in `scripts/test-artifact-linter.js` proving a complete row passes and that the checks do not leak into other artifact types.
- [DECISION] `lib/style-stats.js` reaches 95.7 percent line and 80.2 percent branch coverage, clearing both the 90 and 75 percent release floors and the per-file 70 percent gate.
- [DECISION] The static check, self-project truth, public-surface counts, have-nots tally, golden-artifact tests, and `npm audit --omit=dev` are green on the tagged commit.
- [DECISION] The complete release gate and the official Agent Skills validator run in the GitHub publication workflow before the artifact is published.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.13.0` or `npx godpowers@5.13.0`.
- [DECISION] Existing 5.x projects need no `.godpowers` artifact migration; an existing `CODEDNA.md` is adopted rather than rewritten, and a documentation manifest without tripwires is reported rather than failed.
- [DECISION] Re-run the installer for each host runtime so the updated references and templates replace installed copies.

## Publication Evidence

- [DECISION] Pushing tag `v5.13.0` triggers the identity-bound provenance publication workflow, which runs the release gate, publishes `godpowers@5.13.0` and `@godpowers/mcp@5.13.0` with npm provenance, and attaches the GitHub Release assets.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
