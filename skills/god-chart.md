---
name: god-chart
description: |
  Chart a decision map for work too big for one session. Names the
  destination, then breaks the fog between here and there into decision
  units on the same board as build work. Spawns god-cartographer in a
  fresh context. Produces decisions, not deliverables.

  Triggers on: "god chart", "/god-chart", "chart the map", "map the decisions",
  "too big for one session", "I don't know where to start", "what do we need
  to decide first"
---

# /god-chart

Chart the way to a destination when the way is not visible yet.

Use this when an idea is too large to hold in one session and too foggy to
plan directly: you can name where you want to end up, but not the steps. The
chart records the destination, indexes the decisions made so far, and points
at the decision units that hold their detail.

## When to use

- The idea is large and the first move is genuinely unclear
- Several decisions block each other and you cannot see the order
- Two or more sessions will work the same problem and must not collide
- You keep starting to build and stopping because a question is unanswered

## When NOT to use

- The way is already clear. If charting surfaces no fog, you do not need a
  chart. Run `/god-prd` or `/god-feature` instead.
- One question, one session. That is `/god-discuss` or `/god-spike`.
- Work is already sequenced into delivery increments. That is `/god-roadmap`.
- You know what to build and want it built. That is `/god-build`.

## Plan, do not do

A chart produces decisions. It does not produce the thing.

The pull to skip a decision unit and just build is the signal you have
reached the edge of the chart, not a reason to widen it. When every unit is
resolved and nothing is left to decide, the chart is done and the work hands
off to `/god-prd`, `/god-feature`, or `/god-build`.

The one exception is a `task` unit: manual work that must happen before a
decision can be made. It earns its place by unblocking a decision, not by
delivering the destination.

## Forms

| Form | Action |
|---|---|
| `/god-chart <idea>` | Chart a new map: name the destination, create the units you can specify now |
| `/god-chart --work <chart-slug>` | Resolve the next frontier unit on that chart |
| `/god-chart --work <STORY-id>` | Resolve one named unit |
| `/god-chart --status <chart-slug>` | Show the chart, its frontier, and its fog |
| `/god-chart --close <STORY-id> --reason "<why>"` | Rule a unit beyond the destination |

## Runtime module resolution

Resolve the Godpowers runtime root before inspecting routes:

1. If `<projectRoot>/routing/god-chart.yaml` exists, use the repository checkout runtime at `<projectRoot>`.
2. Otherwise use the installed bundle at `<tool-config-dir>/godpowers-runtime`.
3. Read routing metadata from `<runtimeRoot>/routing/`.

## Process: chart a new map

1. Verify `.godpowers/state.json` exists. If not: `/god-init` first.
2. Spawn `god-cartographer` in a fresh context.
3. The cartographer names the destination with the user. The destination
   fixes the scope, so it is settled before anything else is written.
4. The cartographer maps the frontier breadth-first: fan out across the whole
   space rather than deep on one thread, surfacing the decisions that are
   open and the ones takeable now.
5. If step 4 surfaces no fog, stop and say so. A chart with no fog is
   overhead; route the user to `/god-prd` or `/god-feature`.
6. Write `.godpowers/charts/<slug>/CHART.mdx` from `templates/CHART.mdx`:
   Destination and Notes filled in, Decisions-so-far empty, the fog written
   into Not Yet Specified.
7. Create the units you can specify now as decision units under
   `.godpowers/stories/<slug>/`, then wire `deps:` in a second pass. Ids must
   exist before they can be referenced.
8. Report the frontier and stop. Charting is one session's work and resolves
   nothing by hand.

## Process: work through a chart

1. Load `CHART.mdx`. Read the index, not every unit body.
2. Choose the unit. If the user named one, use it. Otherwise take the first
   unit from `lib/story-validator.frontier(projectRoot)` that belongs to this
   chart.
3. Claim it before any work: `lib/story-validator.claim(path, owner)`. The
   claim records who holds it, so a second session skips it.
4. Resolve it by kind:
   - `research`: spawn `god-spike-runner` alone. No human needed.
   - `prototype`: build the cheapest artifact that raises the fidelity of the
     discussion, then react to it with the user.
   - `grilling`: run the conversation with the user, one question at a time.
   - `decision`: use `/god-discuss` discipline, then record the decision.
   - `task`: do the work if you can; otherwise hand the user a precise
     checklist.
5. Zoom as needed: fetch the full body of a related or resolved unit on
   demand rather than loading the whole chart.
6. Record the resolution: write `## Answer` into the unit, set status `done`,
   and append one line to the chart's Decisions so far. The decision lives in
   the unit; the chart only gists it and links.
7. Graduate any fog the answer sharpened into new units, and clear those
   patches from Not Yet Specified so each lives in exactly one place.
8. If the answer reveals a unit sits beyond the destination, close it with a
   reason rather than resolving it. It goes to Out of Scope, not to
   Decisions so far.

Resolve one unit per session, with one exception: `research` units carry no
conversation, so several can run in parallel in isolated contexts.

## Human in the loop

Every unit is either worked with a human who speaks for themselves (`hitl:
true`) or driven by the agent alone (`hitl: false`). `prototype`, `grilling`,
`decision`, and `task` default to human-in-the-loop; `research` and `slice`
do not.

`/god-mode --yolo` auto-resolves preference pauses. It cannot auto-resolve a
unit marked `hitl: true`. A grilling unit whose questions the agent answered
itself has produced nothing.

## Fog of war

A chart is deliberately incomplete. Beyond the live units is fog: decisions
you can tell are coming but cannot yet pin down, because they hang on
questions still open.

The test is whether you can state the question precisely now, not whether you
can answer it.

- Unit when the question is already sharp, even if it is blocked.
- Not Yet Specified when you cannot phrase it that sharply yet.

Do not pre-slice the fog into unit-sized pieces. One patch of fog may
graduate into several units, or none.

## Out of scope

The destination fixes the scope, so work beyond it is out of scope, not fog.
It never graduates. If the destination is redrawn, that is a fresh chart, not
a resumption of this one.

When a unit turns out to sit past the destination, close it with a reason and
leave one line in Out of Scope. It stays out of Decisions so far, which
records the route actually walked.

## Output

```
.godpowers/charts/<slug>/CHART.mdx          the map
.godpowers/stories/<slug>/STORY-<slug>-NNN.mdx   the decision units
```

Decision units share the board with build slices. `/god-stories --frontier`
shows what is takeable; `/god-stories --kind decision` filters to decision
work.

## Have-Nots

`/god-chart` FAILS if:

- The destination is missing or restates the idea instead of naming an end state (W-01)
- The chart restates a decision that its unit already holds (W-02)
- A unit ships behavior instead of resolving a question (W-03)
- Fog is pre-sliced into unit-sized pieces before it is sharp (W-04)
- Out-of-scope work is filed as fog and left to graduate (W-05)
- A unit is worked without being claimed first (W-06)
- The agent answers a human-in-the-loop unit on the human's behalf (W-07)
- A unit is deleted rather than closed with a reason (W-08)

## Re-invocation contract

What happens if `/god-chart` is run when `.godpowers/charts/<slug>/CHART.mdx`
already exists:

| Existing state | Behavior |
|---|---|
| File does not exist | Spawn god-cartographer; produce chart and first units |
| File exists, open units remain | Treat as `--work`: pick the next frontier unit |
| File exists, no open units, fog remains | Spawn god-cartographer to graduate fog into new units |
| File exists, no open units, no fog | Report the chart complete and route to the build tier |
| `--force` flag passed | Snapshot existing chart to `.godpowers/.trash/god-chart-<ts>/`. Chart fresh. |
| `--dry-run` flag passed | Show what would happen; touch nothing |

## On Completion

```
Chart <slug> created. Destination: [one line].

Changed:
- .godpowers/charts/<slug>/CHART.mdx
- N decision units under .godpowers/stories/<slug>/

Frontier (takeable now):
- STORY-<slug>-001 [grilling] <title>
- STORY-<slug>-003 [research] <title>

Fog: M patches in Not Yet Specified.

Next commands:
- /god-chart --work <slug>: Resolve the next frontier unit.
- /god-stories --frontier: See everything takeable across all charts.
- /god-chart --status <slug>: See the chart, its frontier, and its fog.
- /god-prd if the way is already clear: Skip charting and write the PRD.
```


Locking: See `<runtimeRoot>/references/shared/LOCKING.md` for the shared state-lock contract.
