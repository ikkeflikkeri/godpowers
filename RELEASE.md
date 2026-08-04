# Godpowers 5.14.2 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-04

- [DECISION] Godpowers 5.14.2 hands the advisory response back to Dependabot, which had been doing the job correctly all along, and closes the two gaps that let an advisory go unnoticed between pushes.
- [DECISION] The public surface contains 123 slash commands, 41 specialist agents, 13 workflows, and 45 recipes; no command, agent, reference, or have-not changed since 5.14.0.
- [DECISION] The core package contains 101 runtime library modules and keeps zero production dependencies.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.14.2.

## Changes

- [DECISION] The npm `overrides` block is removed. Dependabot alerts and automated security fixes were already enabled and already working: it opened a pull request within about a minute of each 5.14.x advisory, and both were closed unmerged only because a hand-written pin landed first.
- [DECISION] Four of the five overrides were never load-bearing. The patched `hono`, `ip-address`, `fast-uri`, and `brace-expansion` releases were already inside the ranges their parents declare, so npm selects them unaided and a lockfile refresh was the entire fix.
- [DECISION] The fifth was real: `@modelcontextprotocol/sdk` 1.29.0 declared `@hono/node-server` at `^1.19.9` and no 1.x release was ever patched for GHSA-frvp-7c67-39w9, so no resolution could reach a fix. Version 1.30.0 widens that to `^1.19.9 || ^2.0.5` and retires the override. With the block deleted the tree resolves to `@hono/node-server` 2.0.11, `hono` 4.13.0, `ip-address` 10.4.0, `fast-uri` 3.1.5, and `brace-expansion` 5.0.9.
- [DECISION] Removing them is not housekeeping. Dependabot reads npm overrides, and one that caps resolution below a fix produces no pull request at all, only an error recorded against the alert, so a stale pin is a way for a repository to look patched while pinned to a vulnerable version. `fast-uri: "^3.1.5"` capped at 3.x while upstream shipped 4.x.
- [DECISION] `scripts/test-dependency-overrides.js` fails the suite when an override is absent from the lockfile, carries no advisory id in `overrides-rationale`, or is no longer load-bearing because every declaring parent has caught up. It is offline and semver-only, so advisory freshness stays the scheduled workflow's job.
- [DECISION] `.github/workflows/security-audit.yml` runs `npm audit` daily in both scopes. `npm run test:audit` runs on every push and pull request, but nothing evaluated the tree between pushes, and it audits with `--omit=dev`, so a development-scope advisory could never fail any gate: all three `brace-expansion` alerts were development scope and Dependabot was the only thing that saw them.
- [DECISION] `.github/dependabot.yml` gains `applies-to: security-updates` groups for both ecosystems. Security updates ignore `schedule` and `open-pull-requests-limit` entirely, so grouping is the only lever the file has over them; the effect was immediate, with three separate GitHub Actions pull requests replaced by one grouped request.
- [DECISION] `codeaudit.md`, `secaudit.md`, and `uxaudit.md` are no longer tracked. They are regenerated auditor output, and the committed copies described branch `codex/product-trust-hardening` at 5.3.0 while presenting as current at the repository root.

## Validation

- [DECISION] Zero advisories across all 141 packages in the tree including development dependencies, verified by posting the resolved dependency set to the registry bulk advisory API rather than reading a locally cached `npm audit`.
- [DECISION] The override guard was proven to fire, not merely to pass, by reintroducing a redundant `fast-uri` pin and a pin on a package absent from the lockfile and confirming both are reported.
- [DECISION] `.github/workflows/security-audit.yml` was run on demand before release and passed both scopes, so the daily schedule starts from a known-green state.
- [DECISION] The full suite, the complete release gate, the pre-publication gate, and the static check are green on the tagged commit.
- [DECISION] The complete release gate and the official Agent Skills validator run in the GitHub publication workflow before the artifact is published.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.14.2` or `npx godpowers@5.14.2`.
- [DECISION] Nothing to migrate. The only shipped change is the removal of the `overrides` block from `package.json`, and npm ignores that field inside an installed dependency, so no consuming project resolved differently because of it.
- [DECISION] Contributors working from a clone should run `npm install` so the lockfile refresh takes effect locally.

## Publication Evidence

- [DECISION] Pushing tag `v5.14.2` triggers the identity-bound provenance publication workflow, which verifies the tag against both package versions and against `origin/main`, runs the release and pre-publication gates, and publishes `godpowers@5.14.2` and `@godpowers/mcp@5.14.2` with npm provenance.
- [DECISION] The GitHub Release is created by hand from this file after the workflow goes green; the workflow does not create it.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
