# Godpowers 5.17.1 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-06

- [DECISION] Godpowers 5.17.1 hardens the release gate itself. The two publish-run traps recorded after 5.14.x, the npm advisory-cache gap and late version-surface drift, are now closed mechanically inside the gate instead of documented for humans to remember.
- [DECISION] The public surface contains 124 slash commands, 41 specialist agents, 13 workflows, and 45 recipes; no command, agent, workflow, or recipe was added, removed, or renamed.
- [DECISION] The core package contains 108 runtime library modules and keeps zero production dependencies. No runtime module was added; both changes live in `scripts/` and `package.json` scripts wiring.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.17.1.

## Changes

- [DECISION] The audit gate reads the live advisory feed. `npm audit` reads advisories through npm's HTTP cache, so a local `npm audit --omit=dev` could pass minutes before CI failed the same gate on an advisory published in between; that is how the `hono` advisory surfaced during 5.14.x as a failed publish run. `test:audit` now also runs `scripts/check-live-advisories.js`, which collects the resolved production dependency set from `package-lock.json` (the same `--omit=dev` scope, including workspace production dependencies) and POSTs it directly to the registry's bulk advisory endpoint with plain fetch, no npm cache in the path. Any returned advisory fails the gate at every severity, matching npm audit's default. A network or registry failure exits as blocked, never as clean, per the release checklist's do-not-claim-verified rule. `npm run audit:live` runs the check alone for the pre-tag re-check.
- [DECISION] Version-surface drift fails first and names its own fix. `release:check` now runs `version:check` before anything else, so a `package.json` edit made after `release:prepare` fails in seconds with the exact remediation (`npm run version:sync`) instead of surfacing minutes later as a self-truth failure mid-gate. The publish workflow runs the same `release:check`, so CI gets the identical early check.
- [DECISION] The remediation posture is unchanged and now enforced in the failure text: a live advisory finding points at merging the Dependabot pull request, not at hand-rolling an npm override (CONTRIBUTING.md, "Dependencies and security advisories").

## Validation

- [DECISION] One new test suite rides `npm test`: `scripts/test-live-advisories.js` (103 test script files total). It is offline by design: fetch is injected everywhere, the collector is exercised against both a fixture lockfile and the real `package-lock.json`, and the blocked, findings, clean, and empty-set paths are all pinned.
- [DECISION] The full suite passes, and the complete release gate is green end to end with both new guards visibly firing in its log: version surfaces checked first, live advisory feed clean for the resolved production set.
- [DECISION] Every changed file was checked for em dashes, en dashes, and decorative emoji, per the repository style policy.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.17.1` or `npx godpowers@5.17.1`.
- [DECISION] Nothing to migrate. No state format, artifact schema, command name, or gate behavior of the installed product changed; both fixes harden the repository's own release tooling. The published package differs from 5.17.0 only in version metadata and the `package.json` scripts block.
- [DECISION] Contributors get both guards automatically: `npm run release:check` now fails fast on version drift, and `npm run test:audit` now reads the same live advisory feed CI reads.

## Publication Evidence

- [DECISION] Pushing tag `v5.17.1` triggers the identity-bound provenance publication workflow, which verifies the tag against both package versions and against `origin/main`, runs the release and pre-publication gates, and publishes `godpowers@5.17.1` and `@godpowers/mcp@5.17.1` with npm provenance.
- [DECISION] The GitHub Release is created by hand from this file after the workflow goes green; the workflow does not create it.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.17.0 release flow.
