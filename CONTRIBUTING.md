# Contributing to Godpowers

Thank you for your interest in contributing. This document explains how to
contribute changes and what we expect from contributors.

## Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b your-change-name`
3. Make your changes
4. Run tests: `npm test`
5. Commit with a clear message
6. Open a PR

## What We're Looking For

We welcome contributions in these areas:

### High value
- Per-tier reference files (antipattern catalogs, worked examples)
- Real integration tests and messy-repo dogfood scenarios
- Mode D suite hardening, cross-repo release edge cases, and dependent impact tests
- Host capability tests for AI coding tools with different spawning guarantees
- Extension pack examples and extension authoring tests
- New specialist agents for domain-specific work
- Bug fixes
- Documentation improvements

### Lower value
- Trivial style changes
- Renaming internal variables
- Adding emoji decoration (reject by policy)

## Quality Standards

All contributions must pass these checks before merge:

### Style
- No em dashes or en dashes (use commas, colons, semicolons, parentheses,
  or hyphens)
- No emojis as decoration (real icons OK in UI code only)
- No AI-generated decoration words ("powerful", "seamless", "revolutionary")
  in docs without quantification

### Skill files
- YAML frontmatter with `name` and `description`
- `description` includes "Triggers on:" with example phrases
- Body is substantive (>100 chars beyond frontmatter)
- Documents what agent it spawns (or "(built-in)" if it doesn't spawn one)

### Agent files
- YAML frontmatter with `name`, `description`, `tools`
- `description` documents who spawns it
- Has `## Gate Check` if it's a tier agent (tier 1+)
- Has `## Have-Nots` if it produces an artifact
- Has `## YOLO Handling` if it has pause conditions
- Has `## Done Criteria`

### Tests
- All smoke checks pass: `bash scripts/smoke.sh`
- All skill validation passes: `node scripts/validate-skills.js`
- Full release gate passes: `npm run release:check`
- Dogfood scenarios pass when migration, host, extension, suite, or release surfaces change: `node scripts/test-dogfood-runner.js`
- Package payload checks pass when runtime files, fixtures, routing, or docs change: `npm run pack:check`
- New agents added to relevant test loops

## Commit Messages

Godpowers uses [Conventional Commits](https://www.conventionalcommits.org/)
as a discipline for clear history, not as a load-bearing contract.

Format:
```
<type>(<optional scope>): <short summary>

<body explaining what and why>
```

Common types: `feat`, `fix`, `perf`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`.

Examples:
- `feat(cost): split live vs estimated source`
- `fix(otel): handle missing span_id gracefully`

## Dependencies and advisories

Dependabot owns the advisory response. Alerts and automated security fixes are
enabled, and Dependabot opens a pull request within about a minute of an
advisory being published. The default action on an advisory is to merge that
pull request, not to fix it by hand.

`.github/workflows/security-audit.yml` runs `npm audit` on a daily cron in both
scopes, because CI closes only half the gap. `npm run test:audit` does run on
every push and pull request, but nothing evaluates the tree between pushes, and
it audits with `--omit=dev`, so a development-scope advisory can never fail CI
at any point. Both halves bit during 5.14.x: the `hono` advisory surfaced as a
failed publish run, and all three `brace-expansion` advisories were visible only
to Dependabot.

Reach for an npm `override` in exactly one case: the patched version sits
outside the range every parent declares, so no resolution can reach it. In every
other case npm already selects the highest in-range version and a lockfile
refresh is the whole fix. An override is permanent, invisible, and pins a major:
`fast-uri: "^3.1.5"` caps at 3.x no matter what upstream does. Dependabot reads
overrides, and one that caps resolution below a fix produces no pull request at
all, only an error against the alert, which is how a repository ends up looking
patched while pinned to a vulnerable version.

When an override really is required, record the advisory id in
`overrides-rationale` next to it. `scripts/test-dependency-overrides.js` fails
the suite when an override is unjustified, absent from the lockfile, or no
longer load-bearing because its parents have caught up.

## Releasing

Releases are explicit, and publication is tag-triggered so the npm artifact
carries provenance. Pushing the tag is what publishes; do not run `npm publish`
by hand.

```
npm run release:prepare -- <patch|minor|major>
# then write the CHANGELOG entry and rewrite RELEASE.md by hand
npm run release:check
npm run lint
npm run version:check
git add -A
git commit -m "<type>(<scope>): <summary>"
git push origin main
bash scripts/release.sh X.Y.Z          # tags vX.Y.Z and pushes the tag
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file RELEASE.md
```

`.github/workflows/publish.yml` fires on the `v*` tag. It verifies that the tag
version matches both `package.json` files and that the tagged commit is an
ancestor of `origin/main`, re-runs the release and pre-publication gates, then
publishes `godpowers` and `@godpowers/mcp` with `--provenance`. The GitHub
Release itself is created by hand, as above.

A manual `npm pack` plus `npm publish` remains the fallback for when the
workflow cannot run. It produces no provenance attestation, so record the
release as provenance-unavailable when you use it.

Repo documentation sync must be clean before publishing. It keeps README
badges, public surface counts, release references, contribution guidance,
security policy, and Pillars planning signals aligned. CHANGELOG.md and
RELEASE.md are human-curated even when mechanical repo documentation sync has
run.

## Substitution Test

Every change to user-facing text (README, skill descriptions, agent
instructions) must pass the substitution test: replace "Godpowers" with a
competitor. If the sentence still reads true, it decides nothing. Rewrite.

## Adding a New Specialist Agent

1. Create `specialists/god-<name>.md` with required sections
2. Add or update routing metadata if the agent is spawned by a command
3. Add to `bin/install.js` if it needs special install handling (rare)
4. Add CHANGELOG entry under [Unreleased]
5. Update README's command table if it has a new slash command

## Adding a New Slash Command

1. Create `skills/god-<name>.md` with frontmatter + thin orchestration
2. The skill should spawn the right specialist agent (don't do work in skills)
3. Add `On Completion` section suggesting the next command
4. Create `routing/god-<name>.yaml` with atomic spawn tokens and trace events when agents are spawned
5. Add to `/god-next` routing logic if appropriate
6. Add to README command table
7. Add CHANGELOG entry
8. Add dogfood or release-surface coverage if the command touches migration, host guarantees, extensions, suites, package contents, or release behavior

## Reporting Bugs

Open an issue with:
- Godpowers version (`cat ~/.claude/GODPOWERS_VERSION`)
- Runtime (Claude Code, Codex, etc.)
- Steps to reproduce
- What you expected
- What happened
- Relevant artifacts from `.godpowers/` if applicable

## License

By contributing, you agree your contributions will be licensed under the
MIT License.
