# Godpowers 5.14.1 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-03

- [DECISION] Godpowers 5.14.1 is a dependency patch on top of 5.14.0: one development advisory that landed after the 5.14.0 tag, and one production advisory published between the two releases.
- [DECISION] The public surface contains 123 slash commands, 41 specialist agents, 13 workflows, and 45 recipes; no command, agent, reference, or have-not changed since 5.14.0.
- [DECISION] The core package contains 101 runtime library modules and keeps zero production dependencies.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.14.1.

## Changes

- [DECISION] `brace-expansion` is pinned to `^5.0.9` in the root `overrides` block. It arrives as `c8` to `test-exclude` to `minimatch` to `brace-expansion`, and versions below 5.0.9 carry GHSA-mh99-v99m-4gvg and GHSA-rgw5-rvv9-x895, two unbounded-expansion denial-of-service advisories at CVSS 7.5.
- [DECISION] The advisory is development-only, so no installed copy of Godpowers was ever exposed and the release gate's `npm audit --omit=dev` was correct to stay silent; the exposure is to anyone running the coverage gate from a clone, which is every contributor.
- [DECISION] `hono` is pinned to `^4.12.34` in the same block for GHSA-8j4g-w8fx-2239, a moderate ReDoS in the CORS middleware via `Access-Control-Request-Headers`. It arrives under `@godpowers/mcp` through `@modelcontextprotocol/sdk`, it is a production dependency, and the advisory was published between cutting 5.14.0 and cutting this release.
- [DECISION] The fix landed on main after `v5.14.0` was tagged, which left the published tarball's `package.json` without an override the repository had. `overrides` is inert inside a dependency, so nothing behaved differently, and the divergence is still worth one patch version rather than a footnote somebody finds later while investigating something else.
- [DECISION] No source, reference, template, agent, routing, or test file changed between 5.14.0 and 5.14.1; the diff is `package.json`, `package-lock.json`, the version surfaces, and the notes.

## Validation

- [DECISION] The full suite, the complete release gate, the pre-publication gate, and the static check are green on the tagged commit, unchanged from 5.14.0 apart from the resolved dependency.
- [DECISION] Zero advisories across all 141 packages in the tree including development dependencies, verified by posting the resolved dependency set to the registry bulk advisory API rather than reading `npm audit`, whose cached response is what let the `ip-address` advisories reach CI during the 5.14.0 run.
- [DECISION] The complete release gate and the official Agent Skills validator run in the GitHub publication workflow before the artifact is published.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.14.1` or `npx godpowers@5.14.1`.
- [DECISION] Nothing to migrate from 5.14.0. Upgrade anyway if you install the `@godpowers/mcp` companion, because the `hono` pin is the one change here that reaches an installed tree.
- [DECISION] Contributors working from a clone should run `npm install` so the pinned `brace-expansion` replaces the vulnerable copy in `node_modules`.

## Publication Evidence

- [DECISION] Pushing tag `v5.14.1` triggers the identity-bound provenance publication workflow, which verifies the tag against both package versions and against `origin/main`, runs the release and pre-publication gates, and publishes `godpowers@5.14.1` and `@godpowers/mcp@5.14.1` with npm provenance.
- [DECISION] The GitHub Release is created by hand from this file after the workflow goes green; the workflow does not create it.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
