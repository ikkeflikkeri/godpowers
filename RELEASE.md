# Godpowers 5.15.1 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-04

- [DECISION] Godpowers 5.15.1 is a documentation release. It rewrites the public documentation surface for a broader, less technical audience and changes no runtime behavior.
- [DECISION] The public surface contains 123 slash commands, 41 specialist agents, 13 workflows, and 45 recipes; no command, agent, workflow, or recipe was added, removed, or renamed.
- [DECISION] The core package contains 105 runtime library modules and keeps zero production dependencies. No runtime module changed in this release.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.15.1.

## Changes

- [DECISION] The public documentation now leads with the reader's problem rather than the system's mechanism. README, `docs/getting-started.md`, `docs/concepts.md`, `docs/quick-proof.md`, `docs/tutorials/first-project.md`, `SUPPORT.md`, `USERS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and `docs/README.md` were rewritten. `docs/loop-engineering.md`, `docs/mcp.md`, `docs/host-capabilities.md`, `docs/extension-authoring.md`, `docs/brownfield-bluefield.md`, `docs/automation-providers.md`, `docs/validation.md`, `docs/recipes.md`, `docs/reference.md`, and `docs/command-flows.md` were revised.
- [DECISION] Jargon moved after the on-ramp, each term glossed on first use. Vocabulary that appears in real tool output (arc, tier, gate, have-nots) is retained deliberately, because a user cannot read the dashboard without it.
- [DECISION] Reference-grade material keeps its precision. Per-command flows, validation internals, and recipe tables gained entry points and audience signposts rather than prose simplification, which would degrade them for the reader who actually needs them at incident time.
- [DECISION] Marketing tone for this product means concrete and specific, not superlative. A documentation surface full of unquantified decoration words would fail the substitution test that Godpowers enforces on every artifact it produces, on its own front page.
- [DECISION] README gained a "Who this is for" audience table and an "Honest limits" section stating what Godpowers does not claim: it does not evaluate whether a product idea is good, it is not a penetration test, it does not behave identically on every host, and it does not remove the need to read its output.
- [DECISION] `USERS.md` keeps "Godpowers has zero recorded production users" as its opening line and now frames why that sentence stays in place until it is false.
- [DECISION] Mermaid diagrams were added for the gate loop (README) and the tier model (`docs/concepts.md`), and the brownfield decision tree moved from box-drawing ASCII to Mermaid. All three render natively on GitHub and require no image assets or external requests.

## Fixed

- [DECISION] `docs/concepts.md` claimed both 25 and 30 mechanical have-nots within the same section. The count derived from `lib/have-nots-validator.js` is 25.
- [DECISION] `docs/reference.md` listed `/god-build` and `/god-fix` twice in the verb dispatcher sentence.
- [DECISION] `docs/mcp.md` documented 5 of the 9 tools exported by `packages/mcp/lib/tools.js`, pinned `4.0.2` in its setup and serve commands, and described the mutation boundary as scoped to the 4.0.0 release.
- [DECISION] `USERS.md` described the 3.0 line as current in a stale run-on paragraph.

## Validation

- [DECISION] The full suite passes, and the complete release gate is green end to end: standards, coverage, per-file coverage, audit, self-project truth, evidence drift, and both package-content checks.
- [DECISION] The self-project truth gate returns pass at 140 checks on the release tree.
- [DECISION] The documentation drift guards did their job during this work: `lib/repo-doc-sync.js` failed the suite when a rewrite dropped the `repo documentation sync` phrase from `CONTRIBUTING.md`, and the change was corrected before commit rather than shipped.
- [DECISION] Every changed file was checked for em dashes, en dashes, and decorative emoji, per the repository style policy. None are present.
- [DECISION] No runtime module, route, skill, agent, workflow, or recipe changed, so behavioral risk for existing projects is limited to what users read.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.15.1` or `npx godpowers@5.15.1`.
- [DECISION] Nothing to migrate. No state format, artifact schema, command name, or gate behavior changed.
- [DECISION] Existing installs gain nothing functional by upgrading. Upgrade for the documentation, or skip this release safely.

## Publication Evidence

- [DECISION] Pushing tag `v5.15.1` triggers the identity-bound provenance publication workflow, which verifies the tag against both package versions and against `origin/main`, runs the release and pre-publication gates, and publishes `godpowers@5.15.1` and `@godpowers/mcp@5.15.1` with npm provenance.
- [DECISION] The GitHub Release is created by hand from this file after the workflow goes green; the workflow does not create it.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
