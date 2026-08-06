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

- [DECISION] Tag `v5.17.1` resolves to `main` commit `f2215bade61fb2dec44ec5438c121c81d96bb70d`.
- [DECISION] Provenance workflow 31109012123 verified the release identity, ran the release and pre-publication gates, and published `godpowers@5.17.1` and `@godpowers/mcp@5.17.1` under the `latest` tag with npm provenance.
- [DECISION] The root registry integrity is `sha512-sTsoYdBKOeDETEDcro80iATGzpl2n8RmBvAMp8ZGv8opD3hASvMBE2yYsZuNLLZ0v1HuEcocTqjh4iEtHVkEOA==` (shasum `81e302262026de43318277ae11ed0514ec03d2fc`).
- [DECISION] The MCP registry integrity is `sha512-IKZ9OCn2E0t3nPS8rm14IlcqFWtrsRCtOVfbWY0rd5Ydzvo7lAMwwRgSuloYp587AIFDaj7oPFswmWRw12P09g==` (shasum `5bb5861a8e2329b574b776e4108c5821d292a51b`).
- [DECISION] Isolated exact-version verification (`scripts/verify-published-install.js godpowers@5.17.1`) passes against the registry artifact: Quick Proof, read-only project inspection, dashboard, next route, Claude install surface, and Codex install surface.
- [DECISION] GitHub Release `v5.17.1` was created by hand from this file after the workflow went green, notes only, no tarball assets.
