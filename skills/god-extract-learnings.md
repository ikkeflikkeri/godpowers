---
name: god-extract-learnings
description: |
  Extract decisions, lessons, patterns, and surprises from completed phase
  artifacts. Captures institutional knowledge for future projects.

  Triggers on: "god extract learnings", "/god-extract-learnings", "lessons learned",
  "what did we learn"
---

# /god-extract-learnings

Capture institutional knowledge from a completed phase or milestone.

## When to use

- After completing a milestone (Now -> Done)
- After a successful /god-mode project run
- Before a /god-postmortem (different focus: that's for incidents)

## Process

1. Read all artifacts from the completed phase:
   - PRD, ARCH, ROADMAP, STACK, build PLAN, deploy STATE, etc.
2. Extract:
   - **Decisions made**: with their flip points
   - **Lessons learned**: what would you do differently next time
   - **Patterns established**: techniques that worked, worth reusing
   - **Surprises**: things you didn't expect (good or bad)
3. Write to `.godpowers/learnings/<milestone>/LEARNINGS.mdx`
4. Record each **Lessons Learned** bullet in the structured lessons store so
   later planner runs can recall it mechanically:
   - First run `npx godpowers lesson list --json --scope=project` and skip any
     bullet already recorded under the same milestone tag (dedupe; re-running
     this skill must not double-write).
   - For each new bullet: `npx godpowers lesson add "<bullet text>"
     --tags=<milestone>` (project scope is the default; the store is
     `.godpowers/ledger/lessons.jsonl` via `lib/evidence.js`).
   - After each successful add, record it in the event ledger:
     `npx godpowers event emit lesson.recorded
     --attrs='{"milestone":"<milestone>"}'` so `/god-metrics` can prove the
     learning loop is writing (`lib/learning-metrics.js`). The first emit
     prints a run id; pass it back via `--run=<run-id>` on subsequent emits
     so one extraction session stays one run instead of minting a run per
     bullet.
5. Optionally append summary to a global `~/.godpowers-knowledge.md` for
   cross-project learning (opt-in)
6. Optionally draft an improvement proposal. When a lesson clearly implicates
   a specific prompt surface (a `skills/*.md`, `specialists/*.md`, or
   `references/**.md` file), draft the patch, but NEVER edit the file: prompt
   surfaces carry `frozen` cadence (`lib/artifact-map.js PROMPT_SURFACES`).
   Write a spec file `{ "targetFile": "...", "rationale": "...",
   "patchText": "..." }` and queue it with `npx godpowers proposal propose
   --file=<spec.json>`. That escalates a warning-severity item into
   `.godpowers/REVIEW-REQUIRED.mdx` and emits `proposal.proposed`; only a
   human applies it in `/god-review-changes`. The proposer never grades or
   applies its own proposal. Skip when no lesson names a prompt surface;
   never force one.

## Output

```markdown
# Learnings: [milestone]

## Decisions
- [DECISION] Used Postgres over MongoDB. Flip point: document data.
  Outcome: held up; no flip needed.

## Lessons Learned
- The Stripe webhook signature verification took 2 days longer than estimated;
  budget more for crypto-related work.

## Patterns Worth Reusing
- The "1 user_id, multiple stripe_account_id" data model. Reusable for any
  multi-account integration.

## Surprises
- Users wanted CSV export much earlier than we expected. Bumped from COULD
  to MUST in V1.1.
```

## Have-Nots

- Generic lessons ("communicate better")
- No flip-point references (decisions without context)
- Missing surprises (everything went perfectly: implausible)

## Applying recalled lessons

Recorded lessons and memory (the `lib/evidence.js` lessons and memory stores)
are applied silently on later runs, per the Voice and Craft contract
(`references/shared/VOICE.md`). Do the right thing the lesson implies; do not
narrate the recall with "based on your memory" or "according to prior runs".
Surface a recalled fact only when the person asks what you remember, or when it
changes a decision, and then state the decision, not the retrieval. A recalled
lesson reflects what was true when recorded, so verify any file, flag, or command
it names still exists before acting on it.
