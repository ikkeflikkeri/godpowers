# Contributing to Godpowers

Thanks for being here. This page covers how to get a change merged and what we
check before merging it.

Godpowers has strong opinions about quality, and most of them are enforced by
tests rather than by reviewers. That is good news for you: if the suite passes,
you are most of the way there, and you will not be surprised in review by a
standard nobody wrote down.

## Quick start

```bash
git checkout -b your-change-name
# make your changes
npm test
```

Then commit with a clear message and open a pull request. That is the whole
loop.

## What we are looking for

**Genuinely valuable**

- Per-tier reference files: antipattern catalogs and worked examples
- Real integration tests and messy-repo dogfood scenarios
- Multi-repo suite hardening, cross-repo release edge cases, dependent impact tests
- Host capability tests for AI tools with different spawning guarantees
- Extension pack examples and extension authoring tests
- New specialist agents for domain-specific work
- Bug fixes
- Documentation improvements

**Please do not**

- Trivial style changes
- Renaming internal variables for taste reasons
- Adding emoji decoration. This is rejected by policy, not preference.

## Quality standards

Everything below is checked before merge.

### Style

- **No em dashes or en dashes.** Use commas, colons, semicolons, parentheses,
  or hyphens.
- **No emojis as decoration.** Real icons are fine in UI code.
- **No decoration words** such as "powerful", "seamless", or "revolutionary" in
  documentation unless you can quantify the claim.

### Skill files

- YAML frontmatter with `name` and `description`
- The `description` includes "Triggers on:" with example phrases
- The body is substantive: more than 100 characters beyond the frontmatter
- It documents which agent it spawns, or says "(built-in)" if it spawns none

### Agent files

- YAML frontmatter with `name`, `description`, and `tools`
- The `description` documents who spawns it
- `## Gate Check` if it is a tier agent (tier 1 and above)
- `## Have-Nots` if it produces an artifact
- `## YOLO Handling` if it has pause conditions
- `## Done Criteria`

### Tests

```bash
bash scripts/smoke.sh                      # smoke checks
node scripts/validate-skills.js            # skill validation
npm run release:check                      # the full release gate
```

Two more apply conditionally:

- `node scripts/test-dogfood-runner.js` when migration, host, extension, suite,
  or release surfaces change
- `npm run pack:check` when runtime files, fixtures, routing, or docs change

New agents need to be added to the relevant test loops.

### The substitution test

Every change to user-facing text (README, skill descriptions, agent
instructions) has to pass it: replace "Godpowers" with a competitor's name. If
the sentence still reads true, it decided nothing. Rewrite it.

This applies to your pull request description too.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/) as a
discipline for readable history, not as a load-bearing contract. Nothing breaks
if you get the type slightly wrong.

```
<type>(<optional scope>): <short summary>

<body explaining what and why>
```

Common types: `feat`, `fix`, `perf`, `docs`, `refactor`, `test`, `chore`,
`build`, `ci`.

Examples:

- `feat(cost): split live vs estimated source`
- `fix(otel): handle missing span_id gracefully`

The body should explain **why**. The diff already shows what.

## Adding a new specialist agent

1. Create `specialists/god-<name>.md` with the required sections
2. Add or update routing metadata if a command spawns the agent
3. Add to `bin/install.js` only if it needs special install handling (rare)
4. Add a CHANGELOG entry under `[Unreleased]`
5. Update the README command table if it introduces a new slash command

## Adding a new slash command

Before you do: new public commands are held to a high bar. Add one only when
existing families, ladders, profiles, and recipes genuinely cannot express the
need.

1. Create `skills/god-<name>.md` with frontmatter and thin orchestration
2. Have the skill spawn the right specialist. **Do not do work inside skills.**
3. Add an `On Completion` section suggesting the next command
4. Create `routing/god-<name>.yaml` with atomic spawn tokens and trace events
5. Add it to `/god-next` routing logic if appropriate
6. Add it to the README command table
7. Add a CHANGELOG entry
8. Add dogfood or release-surface coverage if it touches migration, host
   guarantees, extensions, suites, package contents, or release behavior

## Dependencies and security advisories

Read this section before touching `package.json`. The failure mode it describes
is subtle and has bitten this repository before.

**Dependabot owns the advisory response.** Alerts and automated fixes are
enabled, and Dependabot opens a pull request within about a minute of an
advisory being published. The default action is to merge that pull request, not
to fix it by hand.

**Why there is also a daily cron.** `npm run test:audit` runs on every push and
pull request, but that leaves two gaps: nothing evaluates the dependency tree
*between* pushes, and it audits with `--omit=dev`, so a development-scope
advisory can never fail CI at any point.
`.github/workflows/security-audit.yml` closes both with a daily `npm audit` in
both scopes. Both halves of that gap bit during 5.14.x: the `hono` advisory
surfaced only as a failed publish run, and all three `brace-expansion`
advisories were visible only to Dependabot.

**When to use an npm `override`.** Exactly one case: the patched version sits
outside the range every parent declares, so no resolution can reach it. In every
other situation npm already picks the highest in-range version, and refreshing
the lockfile is the entire fix.

Understand what an override costs. It is permanent, invisible, and pins a major
version: `fast-uri: "^3.1.5"` caps you at 3.x no matter what upstream does.
Dependabot reads overrides, and one that caps resolution below a fix produces no
pull request at all, only an error against the alert. That is how a repository
ends up looking patched while pinned to a vulnerable version.

When an override really is required, record the advisory id in
`overrides-rationale` beside it. `scripts/test-dependency-overrides.js` fails
the suite when an override is unjustified, missing from the lockfile, or no
longer load-bearing because its parents have caught up.

**Adding any top-level manifest field** means updating the allowlist in the
"root manifest keeps its declared shape" check in `scripts/static-check.js`, in
the same commit. That includes the `overrides` and `overrides-rationale` pair a
security pin needs. The same check asserts that `dependencies`,
`optionalDependencies`, and `peerDependencies` are all empty, which is the
mechanical enforcement of the architecture decision that the core package needs
no production dependency.

## Releasing

Maintainers only.

Releases are explicit, and publication is triggered by the tag so the npm
artifact carries provenance. **Pushing the tag is what publishes.** Do not run
`npm publish` by hand.

```bash
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

A manual `npm pack` plus `npm publish` is the fallback for when the workflow
cannot run. It produces no provenance attestation, so record that release as
provenance-unavailable when you use it.

Repo documentation sync must be clean before publishing. It keeps README badges,
public surface counts, release references, contribution guidance, security
policy, and planning signals aligned. CHANGELOG.md and RELEASE.md stay
human-curated even after mechanical repo documentation sync has run.

## Reporting bugs

Open an issue with:

- Your Godpowers version (`cat ~/.claude/GODPOWERS_VERSION`)
- Which AI tool you are running (Claude Code, Codex, and so on)
- Steps to reproduce
- What you expected
- What actually happened
- Relevant files from `.godpowers/`, if any

Output from `/god-doctor` and `/god-status` is often the fastest way to get to
the cause.

**Found a security vulnerability?** Do not open an issue. See
[SECURITY.md](SECURITY.md) for private reporting.

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.
