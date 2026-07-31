---
name: god-story
description: |
  Write a new STORY.md - a fine-grained slice of work, smaller than
  /god-feature. Story-file workflow for incremental delivery. Spawns
  god-storyteller in fresh context.

  Triggers on: "god story", "/god-story", "write a story", "user story",
  "story file"
---

# /god-story

Add a new story under `.godpowers/stories/<feature-slug>/`.

## Forms

| Form | Action |
|---|---|
| `/god-story <description>` | Auto-generate ID, write story |
| `/god-story --feature <slug>` | Attach to a feature (chains to roadmap milestone) |
| `/god-story --deps STORY-x-001,STORY-y-002` | Declare deps |
| `/god-story --kind <kind>` | Write a decision unit instead of a build slice |

## Kinds

`--kind` decides what the unit delivers, and therefore which contract it is
checked against.

| Kind | Delivers | Section contract |
|---|---|---|
| `slice` (default) | Code | `## User Story` + `## Acceptance Criteria` |
| `decision` | A resolved decision | `## Question` + `## What Would Answer It` |
| `research` | A fact a decision waits on | same |
| `prototype` | A cheap artifact to react to | same |
| `grilling` | A decision reached in conversation | same |
| `task` | Manual work that unblocks a decision | same |

A unit with no `kind` is a slice, so every story written before kinds existed
still validates. Decision units are usually created by `/god-chart`, which
charts them against a destination; `--kind` is the manual path for a single
unit that has no chart.

## Process

1. Verify `.godpowers/state.json` exists. If not: `/god-init` first.
2. Spawn `god-storyteller` agent in fresh context.
3. Storyteller reads PRD/ARCH for context, then validates the format for the
   requested kind with `lib/story-validator.validateForAuthoring()`. The
   section contract for that kind is an error at write time, so a malformed
   unit is surfaced instead of written. Reading an existing unit keeps those
   findings as warnings, so units written before a rule existed still list.
4. Report back to user with the new unit ID, kind, and path.

## Output

`.godpowers/stories/<feature-slug>/STORY-{slug}-{NNN}.mdx`

## Suggested next

- `/god-story-build <id>` to start implementation
- `/god-stories` to see all stories


Locking: See `<runtimeRoot>/references/shared/LOCKING.md` for the shared state-lock contract.
