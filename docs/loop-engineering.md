# Loop engineering in Godpowers

Loop engineering is the shift from prompting a coding agent by hand to building a
small system that prompts the agent for you: something that finds the work, hands
it to the agent, checks the result, records what happened, and decides the next
move on its own. Godpowers 5.0 makes that a first-class mode.

This document maps the loop-engineering model onto the Godpowers building blocks
and points at the exact commands and modules that implement each part.

## The four parts of a loop

A loop has four moving parts. `/god-loop` wires them in this order and refuses to
build a loop that is missing the last one.

| Part | Role | In Godpowers |
|------|------|--------------|
| Automation | Heartbeat: decides when the loop wakes | `/god-automation-setup`, host-native schedulers (`lib/automation-providers.js`) |
| Skill | Work: the unit of work per tick | any Godpowers command (`/god-build`, `/god-fix`, `/god-hygiene`, ...) |
| State file | Memory: resume instead of restart | `.godpowers/state.json` and the run ledger (`lib/events.js`) |
| Objective gate | Brake: a change must pass before it is accepted | tier gates, the have-nots validator, tests and lint |

## Osmani's loop structure, mapped

The canonical loop structure is Automation -> Context -> Agent -> Verification ->
Gate -> State. Godpowers implements each stage:

- **Automation** -> `lib/automation-providers.js` detects 15+ host schedulers and
  records opt-in automations in `.godpowers/automations.json`.
- **Context** -> the project context files (`AGENTS.md` plus routed
  `agents/*.md`, in the Pillars layout) and
  the 123 skills carry durable project knowledge across runs.
- **Agent** -> fresh-context specialist agents spawned per sub-step.
- **Verification** -> the three-axis system: static lint, linkage drift, and
  runtime browser audit.
- **Gate** -> the have-nots (grep-testable failure modes) and tier gates block
  progress mechanically.
- **State** -> `.godpowers/state.json` is the one authoritative source; the
  hash-chained event ledger records every step.

## The one number that matters: accepted-change rate

Tokens spent and tasks attempted are vanity numbers. The metric that tracks
whether a loop is actually producing shippable work is the **accepted-change
rate**: of the changes the loop proposed, what fraction survived the gate instead
of being rejected or rolled back.

- Target: keep it above 50% (the loop-engineering rule of thumb).
- Source: `lib/change-metrics.js` derives it from the event ledger. It prefers
  explicit `change.accepted` / `change.rejected` events and otherwise falls back
  to `gate.pass`, `gate.fail`, and `state.rollback`.
- Surface: `/god-metrics` and the read-only MCP `change_metrics` tool.

A healthy rate means the loop's first attempts survive review. A low rate means
the loop is thrashing and should be paused and inspected.

## Letting the loop act: connectors

A loop that only reads its own state cannot act on the outside world. `/god-connect`
lets the loop open a GitHub issue, move a Linear ticket, post to Slack, or triage
a Sentry error, by delegating to the connectors the host already exposes over MCP.

- Godpowers never vendors an API client and never handles credentials; it only
  names the connector and the action (`lib/connectors.js`).
- Reads are allowed by default. Writes are denied until the project opts a
  connector into write scope in `.godpowers/connectors.json`, optionally narrowed
  to an action allowlist.

## From one loop to a graph of loops

A single improvement loop fails in four known ways: it games its own metric
(Goodhart), it cannot question its own target, it fights sibling loops, and
its measurement quietly decays into paperwork confirming paperwork. Godpowers
answers each failure structurally rather than with more prompting:

- **A metric never travels alone.** Every claimed-pass verification command is
  paired with its executed-backed count from the evidence ledger
  (`lib/gate.js` attestation pairing; `attested, not executed` findings).
  Workflow percent travels with built percent when steps were skipped
  (`lib/state.js`), a roadmap-declared done travels with its declared-only
  provenance (`lib/requirements.js`), and a repair-loop green travels with a
  test-surface integrity verdict (`lib/repair-integrity.js`): a green that
  deleted tests, added skips, or lowered coverage floors is SUSPECT and
  escalates instead of continuing.
- **Anchors, not mutual confirmation.** The one measurement that cannot be
  argued with is a command that actually ran: `lib/evidence.js` records
  spawnSync-backed executed verifications, and the tier gate corroborates
  agent-authored state against that ledger. `fixtures/tripwires/` is the
  held-out set: known-bad artifacts that each release-blocking sensor must
  FAIL, so a gate that has gone blind is distinguishable from one that works.
- **Frozen rules.** No auditor-authored summary line ever satisfies a gate;
  verdicts derive from per-finding statuses through the single shared parser
  (`lib/findings-verdict.js`, with the launch and publication policies pinned
  as a tested contract). A static check keeps the parser singular.
- **Speed separation.** Artifacts carry a cadence tier (`lib/artifact-map.js`):
  fast loops regenerate views freely, but a mechanical stamper that finds a
  slow artifact (PRD, ARCH, ROADMAP) drifted can only escalate to the review
  queue (`scripts/version-sync.js`, `lib/cadence-guard.js`), never re-bless
  it. Error-severity review items block Tier 3 routes until a human clears
  them.
- **The slow loop owns the knobs.** Fast-loop parameters (repair attempts,
  outcome budgets, freshness windows) live in one registry
  (`lib/loop-config.js`, `intent.yaml > loop-params`, edited via
  `/god-budget --loop` with a logged reason) instead of inline constants that
  fork across layers.
- **Audit the auditor.** `npm run evidence:drift` verifies the vendored
  verification engine against its pinned upstream on every release check, the
  full-suite guard is derived from disk (every `scripts/test-*.js` must run,
  removals need a named tombstone), and the have-nots severity-override table
  in `references/HAVE-NOTS.md` keeps the mechanical and LLM graders provably
  applying one severity per check.

## Keeping the loop safe: permission re-audit

An unattended loop accumulates permission creep. `lib/reaudit.js` tracks how
stale the last permission and attack-surface audit is (default 30-day cadence)
and reports when the next one is due. `/god-harden` records and reports it, and a
read-only `permission-reaudit` automation template can run it on schedule.

## Failure modes the design guards against

- **Ralph Wiggum failure** (a loop that quietly ships half-done work): prevented
  by the objective-gate requirement and the accepted-change-rate signal. A loop
  with no hard stop is refused.
- **Self-grading** (the agent that writes the change also approves it): prevented
  by spawning the reviewer in a separate fresh context (see `/god-review`).
- **Runaway cost**: every loop needs a hard stop (a token budget, an iteration
  cap, or a human review gate); `/god-budget` sets the caps.

## When not to build a loop

Loops are worth building only when the work recurs, a gate can verify the result
without a human, there is enough token budget, and the agent can reach the tools
it needs. For one-off work, use `/god-mode` (a single autonomous arc) instead of
a standing loop.
