# Godpowers 5.14.3 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-04

- [DECISION] Godpowers 5.14.3 clears the last two open Dependabot pull requests and deletes the reason one of them could never have gone green on its own.
- [DECISION] The public surface contains 123 slash commands, 41 specialist agents, 13 workflows, and 45 recipes; no command, agent, reference, or have-not changed since 5.14.0.
- [DECISION] The core package contains 101 runtime library modules and keeps zero production dependencies.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.14.3.

## Changes

- [DECISION] The roadmap's Evidence Provenance block no longer records a `package.json` source hash. The check asserted a derivation that does not exist: `god-roadmapper` is spawned with the PRD and ARCH paths and never reads the manifest, `ROADMAP.mdx` derives no content from it, and the only value it does take, the version, is separately asserted by `roadmap:source-version`.
- [DECISION] What the hash did in practice was fail every pull request touching a root dependency, because Dependabot cannot run `npm run version:sync`. PR #78 failed on exactly that with all three Node jobs green and the coverage gate complete; the c8 upgrade itself was never the problem.
- [DECISION] The three genuine roadmap sources, PRD, ARCH, and the stack decision, keep whole-file hashes at full strength, and nothing about them is narrowed. A regression test proves a devDependency bump alone now leaves the roadmap evidence valid, and the existing staleness test is repointed at `PRD.mdx` rather than deleted.
- [DECISION] `scripts/version-sync.js` loses the step that re-stamped the deleted hash. The documented remedy for a red `roadmap:hash:package.json` was to run `version:sync`, which rewrote the value blind; across 151 commits touching `package.json` it never once made anybody read a diff. That is have-not U-07 inside a guard, where the mechanism exists and the review it implies is auto-dismissed by the standard fix.
- [DECISION] A new "root manifest keeps its declared shape" check in `scripts/static-check.js` pays for the deletion with strictly more coverage than it removes. It asserts the exact top-level key set of `package.json` and that `dependencies`, `optionalDependencies`, and `peerDependencies` are each empty.
- [DECISION] That closes a real hole rather than a hypothetical one: the previous check read only `dependencies`, so ARCH ADR-002's no-production-dependency claim could have been violated through `optionalDependencies` with nothing noticing, because the override guard reads the lockfile and `npm audit` fires only on a known advisory. A clean production dependency passed every gate in the repository.
- [DECISION] `c8` moves to 12.0.0 through Dependabot PR #78. It declares `engines.node: ^20.19 || ^22.12 || >=23`, but it is a devDependency that only the coverage job runs, on Node 20, so `engines.node` stays at `>=18` and the Node 18 test job is untouched.
- [DECISION] The pinned GitHub Actions move through Dependabot PR #89: `actions/checkout` to v7.0.1, `actions/setup-node` to v7.0.0, and `actions/setup-python` to v7.0.0 across all four workflows. The regenerated pull request included `security-audit.yml`, so no workflow is left behind on an older pin.

## Validation

- [DECISION] The fix is proven by construction, not by assertion: a simulated Dependabot root-manifest bump was applied to a clean tree and the self-project truth gate returned pass at 140 checks with no `version:sync` and no hand-edited hash.
- [DECISION] Coverage under `c8` 12.0.0 holds at 94.78 percent lines and 79.56 percent branches, above the 90 and 75 release floors, with the per-file 70 percent gate green across 99 lib modules.
- [DECISION] The self-project truth ledger moves from 141 checks to 140 and `.godpowers/AUDIT-REPORT.mdx` is corrected to match; nothing else in the repository quoted the old number.
- [DECISION] The full suite, the complete release gate, the pre-publication gate, and the static check are green on the tagged commit.
- [DECISION] The complete release gate and the official Agent Skills validator run in the GitHub publication workflow before the artifact is published.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.14.3` or `npx godpowers@5.14.3`.
- [DECISION] Nothing to migrate. Every change is to this repository's own gates, evidence, and development dependencies; no shipped runtime file changed.
- [DECISION] A `.godpowers` project in the wild is unaffected. `lib/self-project-truth.js` returns early unless the package name is `godpowers`, and `templates/ROADMAP.mdx` has no provenance block at all, so the hash that was removed only ever existed in this repository's self-hosted copy.

## Publication Evidence

- [DECISION] Pushing tag `v5.14.3` triggers the identity-bound provenance publication workflow, which verifies the tag against both package versions and against `origin/main`, runs the release and pre-publication gates, and publishes `godpowers@5.14.3` and `@godpowers/mcp@5.14.3` with npm provenance.
- [DECISION] The GitHub Release is created by hand from this file after the workflow goes green; the workflow does not create it.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
