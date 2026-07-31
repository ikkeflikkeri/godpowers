# Wayfinding

Planning work that is too big for one agent session and too foggy to sequence.

`/god-roadmap` sequences work you already understand into delivery increments.
`/god-chart` is what runs before that, when you can name where you want to end
up but not the steps to get there. The output is decisions, not increments.

## The unit is a decision

Godpowers has always had one board-shaped work unit, and it was a build slice:
`STORY-<slug>-NNN` with a user story, acceptance criteria, and a slice plan.
That shape cannot hold "decide whether the queue is a Postgres table" without
lying about the format. So decision work lived in `.godpowers/spikes/` and
`.godpowers/discussions/`, invisible to `/god-stories`, to dependency
resolution, and to a second parallel session.

A work unit's `kind` decides what it delivers:

| Kind | Delivers | Human in the loop by default |
|---|---|---|
| `slice` | Code | no |
| `decision` | A resolved decision | yes |
| `research` | A fact a decision waits on | no |
| `prototype` | A cheap artifact to react to | yes |
| `grilling` | A decision reached in conversation | yes |
| `task` | Manual work that unblocks a decision | yes |

Decision units share the id space, the deps, the statuses, and the board with
build slices. A unit with no `kind` is a slice, so nothing written before
kinds existed changed meaning.

`lib/story-validator.js` picks the section contract from the kind: a `slice`
is checked for `## User Story` and `## Acceptance Criteria`, everything else
for `## Question` and `## What Would Answer It`. A decision unit that carries
acceptance criteria is flagged, because that is a build slice wearing a
decision label.

## The destination fixes the scope

Charting starts by naming what reaching the end looks like: the spec to hand
off, the decision to lock, the change to make in place. Not the idea restated.

The destination is settled before any unit is written, because it is what
every later scope judgement is made against. Without it, "is this in scope"
has no answer and the chart grows until the session runs out.

Bad: "Figure out the notifications system."
Good: "A written spec for notification delivery that names the transport, the
retry policy, and the per-user opt-out model, ready to hand to `/god-prd`."

## Plan, do not do

A chart produces decisions. The pull to skip a unit and just build it is the
signal you have reached the edge of the chart, not a reason to widen it.

When nothing is left to decide, the chart is done and the work hands off to
`/god-prd`, `/god-feature`, or `/god-build`. A chart that has started shipping
behavior has stopped being a chart.

The `task` kind is the one exception, and it is a narrow one: manual work that
must happen before a decision can be made. Signing up for a service so its API
can be judged, provisioning access, moving data so its shape can be seen. It
earns its place by unblocking a decision, not by delivering the destination.

## Index, not store

The chart lists the decisions made and points at the units that hold their
detail. A decision lives in exactly one place: its unit. The chart gists it
and links.

This is the discipline godpowers already applies between the PRD and the
roadmap (the roadmap lists requirement ids, never requirement text) and
between artifacts and code (`// Implements: P-MUST-01`). Restating a decision
in the chart creates a second copy that drifts, and `/god-reconcile` exists
because copies drift.

## Fog of war

The chart is deliberately incomplete. Beyond the live units is fog: decisions
you can tell are coming but cannot yet pin down, because they hang on
questions still open.

The map's `## Not Yet Specified` section is where that dim view is written
down. It doubles as a signpost for whoever reads the chart next.

**The test is whether you can state the question precisely now, not whether
you can answer it.**

- Unit when the question is already sharp, even if it is blocked and you
  cannot act on it yet.
- Not Yet Specified when you cannot phrase it that sharply.

Do not pre-slice the fog into unit-sized pieces. Fog is coarser than a unit,
and one patch may graduate into several units, or none, once the frontier
reaches it.

Resolving a unit clears the fog ahead of it. Whatever became specifiable
graduates into fresh units, and the graduated patch is deleted from Not Yet
Specified so it lives in exactly one place.

Not Yet Specified excludes what is already decided, what is already a live
unit, and what is out of scope.

### Why this needed an exemption

Have-nots P-08 and P-09 require every PRD open question to carry a named owner
and a real due date. That is correct for a PRD: an open question with no owner
and no date is a question nobody is going to answer.

Fog is a different object. It is the bucket for in-scope questions you cannot
yet phrase sharply, and therefore cannot assign or date. Before the exemption,
a known-unknown had to be sharpened, dropped, or fail the gate, so the honest
answer ("something about retries is going to bite us and I cannot say what
yet") had nowhere legal to live.

P-08 and P-09 do not apply to `## Not Yet Specified`. They apply everywhere
else unchanged, including the PRD's own Open Questions table.

## Out of scope

Fog only ever gathers toward the destination. The destination fixes the scope,
so work beyond it is out of scope: it is not fog, and it does not belong in
Not Yet Specified. Scope, not sharpness, lands it there.

Out-of-scope work never graduates. It returns only if the destination is
redrawn, and then as a fresh chart, not a resumption.

This is the opposite of `/god-add-backlog` and `/god-plant-seed`, which are
deferral pipelines: a backlog item is something you might do later, and it has
a promotion path. Out of scope is a terminal judgement about this effort.

When a unit turns out to sit past the destination, close it (`status: closed`
with a `closed-reason`) and leave one line in Out of Scope: the gist plus why,
linking the closed unit. A closed unit is unambiguously off the frontier.

It stays out of Decisions so far, which records the route actually walked. A
scope boundary is not a step on it. `/god-stories` excludes closed units from
done counts for the same reason: counting them overstates progress.

Close it, do not delete it. Deleting discards the evidence that the judgement
was made, and leaves the next session to rediscover the same dead end.

## Claim before work

A unit is claimed by writing the holder into it, before any work, so a
concurrent session skips it. The claim IS the assignment: an open unit with no
owner is unclaimed.

Before this existed, `/god-story-build` set status `in-progress` but recorded
no holder, so two sessions running `--next` could not tell their own claim
from another's, and an abandoned claim had no expiry.

A claim carries `owner` and `claimed-at`. `isClaimStale` treats a claim older
than the TTL as abandoned, mirroring the state-lock reclaim path in
[LOCKING.md](../shared/LOCKING.md). Reclaiming is a user decision, not an
automatic one: the selector reports staleness and the caller decides.

Godpowers still prefers isolation for parallel *build* work: `/god-workstream`
forks a branch and a state directory. Claiming is for the shared decision
board, where forking would defeat the point, because the whole value is that
two sessions see the same map.

## The frontier

The frontier is the edge of the known: units that are open, unblocked, and
unclaimed.

- Open: status is `pending`
- Unblocked: every dep is `done` or `closed`
- Unclaimed: no owner

A dep that was closed as out of scope no longer blocks the work waiting on it.
A dep naming a unit that does not exist does NOT count as satisfied: a
dangling dep is a map error, and treating it as clear would silently open work
whose prerequisite was never charted. `findDanglingDeps` surfaces them.

`/god-stories --frontier` renders it. `/god-chart --work` and
`/god-story-build --next` select from it.

## One unit per session

A unit is sized to one agent session. Resolve one, record it, stop.

The exception is `research`: it carries no conversation, so several can run in
parallel in isolated fresh contexts, on the same terms as the divergence pass
in [DIVERGENCE.md](DIVERGENCE.md). Isolation is the invariant there too. If
the research branches see each other they anchor on each other, and the fan-out
collapses into one thought with extra steps.

This is deliberately narrower than `/god-mode`, which runs an entire arc
autonomously. `/god-mode` runs work that is already understood. Charting is
what happens when it is not.

## Human in the loop

Every unit is either worked with a human who speaks for themselves (`hitl:
true`) or driven by the agent alone (`hitl: false`).

`--yolo` auto-resolves preference pauses. It cannot auto-resolve a unit marked
`hitl: true`, alongside safe-sync blockers and unresolved Critical harden
findings. A grilling unit whose questions the agent answered itself has
produced nothing: it looks like a resolved decision and is actually a guess
with a timestamp.

Set `hitl:` explicitly only when it differs from the kind's default.

## What godpowers did not adopt

Two ideas from the wayfinder skill this reference is descended from are
deliberately left out.

**Refer by name, never by id.** Wayfinder forbids bare-id reference because a
wall of `#42, #43` is illegible. Godpowers makes ids load-bearing instead:
`lib/code-scanner.js` and `lib/linkage.js` scan for `P-MUST-01`, `M-billing`,
`STORY-auth-001` to build the linkage map. Godpowers' mitigation is that ids
are slugged rather than numeric, and every rendered board pairs the id with
the title.

**One map artifact.** Wayfinder keeps everything on a single issue to avoid
needing a reconciler. Godpowers runs many surfaces (ROADMAP, REQUIREMENTS,
TODOS, BACKLOG, SEEDS, THREADS, the unit board) and has `/god-reconcile` for
exactly the contradictions that creates. Collapsing to one artifact would
mean dismantling the reconciler, which is the more valuable of the two.

## Related

- [ROADMAP-ANATOMY.md](ROADMAP-ANATOMY.md): what happens after the chart is
  complete and the work is sequenced.
- [DIVERGENCE.md](DIVERGENCE.md): the isolated fan-out pattern research units
  reuse.
- [../shared/LOCKING.md](../shared/LOCKING.md): the state-lock TTL contract
  claims mirror.
- [../HAVE-NOTS.md](../HAVE-NOTS.md): W-01 through W-08.
