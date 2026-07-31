---
name: god-stories
description: |
  List all work units grouped by status (pending, in-progress, blocked,
  done, closed). Covers build slices and decision units on one board.
  Useful for "what am I working on" and "what is takeable now".

  Triggers on: "god stories", "/god-stories", "list stories",
  "show stories", "what stories are open", "what is takeable", "frontier"
---

# /god-stories

Show all work units with kind, status, owner, deps. Read-only; no agent spawn.

The board holds two shapes of unit. A `slice` delivers code. A decision unit
(`decision`, `research`, `prototype`, `grilling`, `task`) delivers a resolved
decision. Both carry the same ids, deps, and statuses, so `/god-chart` work
and `/god-build` work are visible in one place.

## Forms

| Form | Action |
|---|---|
| `/god-stories` | All units grouped by status |
| `/god-stories --frontier` | Only what is takeable now: pending, unblocked, unclaimed |
| `/god-stories --status pending` | Filter to one status |
| `/god-stories --kind decision` | Filter to one kind |
| `/god-stories --feature <slug>` | Units for one feature or chart |
| `/god-stories --json` | Structured output |

## Process

1. Verify `.godpowers/` exists.
2. Call `lib/story-validator.listStories(projectRoot)`.
3. For `--frontier`, call `lib/story-validator.frontier(projectRoot)` instead.
   The frontier is pending AND every dep terminal (`done` or `closed`) AND no
   owner. A dep that was closed as out of scope no longer blocks the work
   waiting on it.
4. Group by status; render. Mark human-in-the-loop units so an autonomous run
   knows not to take them.
5. Call `lib/story-validator.findDanglingDeps(projectRoot)` and
   `detectDepCycles(projectRoot)`; surface both at the end. A dangling dep
   keeps a unit permanently off the frontier, so it is reported rather than
   silently treated as satisfied.
6. Flag stale claims via `lib/story-validator.isClaimStale(story)`: an
   in-progress unit whose claim has outlived the TTL is likely abandoned and
   can be reclaimed.

## Output (default)

```
Units (14 total)

In progress (2)
  STORY-auth-001    [slice]     [alice]  Add OAuth flow
    deps: STORY-auth-000
  STORY-notif-002   [grilling]  [bob]    Retry policy shape       hitl

Pending (5)
  STORY-billing-001 [slice]     [bob]    Stripe webhook handler
  STORY-billing-002 [slice]     [bob]    MRR calculator
  STORY-notif-003   [research]  -        Transport latency budgets
  ...

Blocked (1)
  STORY-search-001  [slice]     [alice]  Indexing - waiting on SearchKit upgrade

Done (4)
  STORY-auth-000    [slice]              Connect button
  ...

Closed (2)
  STORY-notif-005   [decision]           Per-device delivery
    reason: beyond the destination; this chart stops at per-user opt-out

Cycles detected: none
Dangling deps: none
```

Closed units are excluded from done counts. A unit ruled beyond the
destination is not completed work, and counting it as such overstates
progress.

## Output (--frontier)

```
Frontier (3 takeable)

  STORY-notif-003   [research]  Transport latency budgets            afk
  STORY-billing-001 [slice]     Stripe webhook handler
  STORY-notif-004   [prototype] Opt-out screen shape                 hitl

Claimed but stale (1)
  STORY-auth-001    [slice]     [alice]  claimed 4h ago - reclaimable
```

## What this does NOT do

- Modify any unit (use /god-story-close, /god-story-verify, or /god-chart
  --close to change status)
- Spawn agents (read-only)
- Trigger reverse-sync
