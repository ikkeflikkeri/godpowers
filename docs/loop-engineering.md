# Loop engineering in Godpowers

Most people use an AI coding agent by typing at it. You ask, it answers, you
read the answer, you ask again. You are the loop.

**Loop engineering** is what happens when you stop being the loop and build a
small system that does it for you: something that finds the work, hands it to
the agent, checks whether the result is any good, writes down what happened, and
decides what to do next. Godpowers 5.0 makes this a first-class mode.

This page explains the model and points at the exact commands and modules behind
each piece.

## The four parts of a loop

Every loop has four moving parts. `/god-loop` wires them in this order, and it
will refuse to build a loop that is missing the last one.

| Part | Its job | In Godpowers |
|------|---------|--------------|
| Automation | The heartbeat: decides when the loop wakes up | `/god-automation-setup`, host-native schedulers (`lib/automation-providers.js`) |
| Skill | The work: one unit per tick | any Godpowers command (`/god-build`, `/god-fix`, `/god-hygiene`, and so on) |
| State file | The memory: resume rather than restart | `.godpowers/state.json` and the run ledger (`lib/events.js`) |
| Objective gate | The brake: a change must pass before it counts | tier gates, the have-nots validator, tests and lint |

The brake is the part people skip, and it is the part that matters. A loop
without one does not stop being a loop; it just becomes a loop that ships
half-finished work quietly, forever.

## The canonical loop structure, mapped

The standard loop shape is Automation, then Context, Agent, Verification, Gate,
and State. Here is how each stage lands in Godpowers:

- **Automation** - `lib/automation-providers.js` detects 15+ host schedulers and
  records opt-in automations in `.godpowers/automations.json`.
- **Context** - the project context files (`AGENTS.md` plus routed
  `agents/*.md`, in the Pillars layout) and
  the 124 skills carry durable project knowledge across runs.
- **Agent** - fresh-context specialists, spawned per sub-step.
- **Verification** - the three-axis system: static lint, linkage drift, and
  runtime browser audit.
- **Gate** - have-nots and tier gates block progress mechanically, not by
  persuasion.
- **State** - `.godpowers/state.json` is the single source of truth, and a
  hash-chained event ledger records every step.

## The one number that matters

Tokens spent and tasks attempted are vanity metrics. Both go up when a loop is
working beautifully and when it is spinning in circles.

The number that distinguishes those two cases is the **accepted-change rate**:
of the changes the loop proposed, what fraction survived the gate instead of
being rejected or rolled back?

- **Target:** keep it above 50 percent.
- **Source:** `lib/change-metrics.js` derives it from the event ledger. It
  prefers explicit `change.accepted` and `change.rejected` events, falling back
  to `gate.pass`, `gate.fail`, and `state.rollback`.
- **Where to see it:** `/god-metrics`, and the read-only `change_metrics` tool.

A healthy rate means the loop's first attempts tend to survive review. A low
rate means it is thrashing, and you should pause it and look at why. Because the
number is computed from the ledger rather than self-reported, a loop cannot
flatter itself.

## Letting the loop act on the world

A loop that can only read its own notes is half a loop. `/god-connect` lets it
open a GitHub issue, move a Linear ticket, post to Slack, or triage a Sentry
error, by handing the job to connectors your host already exposes.

- Godpowers never bundles an API client and never handles your credentials. It
  names the connector and the action, and that is all (`lib/connectors.js`).
- Reads are allowed by default. **Writes are denied** until the project opts a
  connector into write scope in `.godpowers/connectors.json`, optionally
  narrowed to a specific list of permitted actions.

## From one loop to a graph of loops

A single self-improving loop fails in four known ways. It games its own metric.
It cannot question its own target. It fights with sibling loops. And its
measurements quietly decay into paperwork that confirms other paperwork.

Godpowers answers each of these structurally, rather than by asking the agent
more nicely:

- **A metric never travels alone.** Every claimed-pass verification is paired
  with its executed-backed count from the evidence ledger (`lib/gate.js`
  attestation pairing, producing `attested, not executed` findings). Workflow
  percent travels with built percent when steps were skipped (`lib/state.js`).
  A roadmap-declared "done" travels with its declared-only provenance
  (`lib/requirements.js`). A repair-loop green travels with a test-surface
  integrity verdict (`lib/repair-integrity.js`), so a green achieved by deleting
  tests, adding skips, or lowering coverage floors is marked SUSPECT and
  escalates instead of sailing through.
- **Anchors, not mutual confirmation.** The one measurement that cannot be
  argued with is a command that actually ran. `lib/evidence.js` records
  genuinely executed verifications, and the tier gate checks agent-authored
  state against that ledger. `fixtures/tripwires/` is the held-out set: known-bad
  artifacts that every release-blocking sensor must fail, which is how you tell
  a working gate apart from one that has gone blind.
- **Frozen rules.** No summary line written by an auditor can satisfy a gate.
  Verdicts derive from per-finding statuses through a single shared parser
  (`lib/findings-verdict.js`), with launch and publication policies pinned as a
  tested contract. A static check keeps that parser singular, so no second
  opinion can quietly appear.
- **Speed separation.** Artifacts carry a cadence tier (`lib/artifact-map.js`).
  Fast loops regenerate views freely, but when a mechanical stamper finds a slow
  artifact (a PRD, an architecture doc, a roadmap) has drifted, it can only
  escalate to the review queue. It can never re-bless the artifact itself.
  Error-severity review items block shipping until a human clears them.
- **The slow loop owns the knobs.** Fast-loop parameters (repair attempts,
  outcome budgets, freshness windows, polish rounds) live in one registry
  (`lib/loop-config.js`), edited via `/god-budget --loop` with a logged reason,
  rather than as inline constants that fork across layers.
- **Audit the auditor.** `npm run evidence:drift` checks the vendored
  verification engine against its pinned upstream on every release. The
  full-suite guard is derived from disk, so every test script must run and any
  removal needs a named tombstone. The severity-override table keeps the
  mechanical and model-based graders provably applying one severity per check.

## Keeping the loop safe over time

An unattended loop accumulates permissions the way a desk accumulates paper.
`lib/reaudit.js` tracks how stale the last permission and attack-surface audit
is (30-day cadence by default) and reports when the next one is due.
`/god-harden` records and reports it, and a read-only `permission-reaudit`
automation template can run it on schedule.

## Failure modes this design guards against

| Failure | What it looks like | The guard |
|---|---|---|
| Ralph Wiggum failure | The loop cheerfully ships half-done work forever | The objective gate is mandatory, and the accepted-change rate exposes thrashing. A loop with no hard stop is refused outright. |
| Self-grading | The agent that wrote the change also approves it | The reviewer is spawned in a separate fresh context. See `/god-review`. |
| Runaway cost | The loop is expensive and nobody noticed | Every loop needs a hard stop: a token budget, an iteration cap, or a human gate. `/god-budget` sets them. |

## When not to build a loop

Loops are worth the setup only when all four of these hold: the work recurs, a
gate can verify the result without a human in the room, there is enough token
budget to matter, and the agent can actually reach the tools it needs.

For one-off work, use `/god-mode` and run a single autonomous arc. Building a
standing loop for a job you will do once is strictly more work than doing the
job.
