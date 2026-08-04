# Tutorial: Your First Project

A complete walkthrough, from an empty folder to a deployed product.

This tutorial builds a real thing: a small SaaS product for tracking revenue.
You can follow it exactly, or swap in your own idea at the first prompt and
follow the same shape.

---

## Setup (1 minute)

```bash
mkdir my-saas && cd my-saas
git init
npx godpowers --claude --global
```

Now open Claude Code inside `my-saas/`.

That is the whole setup. No account, no configuration file to edit.

---

## The fast path: let it run

```
/god-mode
```

Claude asks what you want to build. Answer in plain English. Here is the sample
answer this tutorial uses:

> A SaaS for solo founders to track their MRR breakdown by new, expansion, and
> churn. Connect Stripe, see a dashboard. Solo, no team auth. Web only.

Notice what makes that a good answer: it names who it is for, what it does, and
what it deliberately leaves out. "No team auth" and "web only" are as useful as
the features, because they close off decisions nobody has to revisit later.

Godpowers works out two things immediately:

- **Mode: A** (greenfield, since there is no existing code)
- **Scale: medium** (which determines how much process to apply)

Then it runs the whole arc. Expect roughly ten pauses across the run, each one a
genuine question. They look like this:

> TypeScript and Python scored 9.2 and 9.0. That is a statistical tie, so I
> cannot break it on merit. Does your team prefer TypeScript?

Answer "go" and it takes the default. Answer with a preference and it takes
yours. Either way the decision gets written down with your reasoning attached.

**When it finishes**, you have a working app in `src/`, tests in `tests/`, a
deploy pipeline in `.github/workflows/`, monitoring configuration, a clean
security audit, and launch materials.

Budget roughly two to three hours of autonomous work, plus a few minutes of your
attention spread across the pauses.

---

## The slower path: drive it yourself

Prefer to review each step before the next one starts? Run the commands
individually. Here it is spread across a week.

### Day 1: Plan

```
/god-init      detects mode and scale, creates .godpowers/
/god-prd       writes the plan. Pauses to pin down who this is for.
/god-arch      designs the system. Pauses on monolith versus services.
/god-roadmap   puts the milestones in order.
/god-stack     picks the technology. Pauses on a scoring tie.
```

At the end of day 1 the planning documents are on disk. **Read them.** Edit
anything you disagree with. This is the cheapest possible moment to change your
mind, and it is the whole reason the planning stage exists as a separate step.

### Days 2 and 3: Build

```
/god-repo      scaffolds the repository: package.json, CI, linting, README
/god-build     plans the work into slices and builds them
```

`/god-build` is the heavy one. It breaks the milestone into slices, runs them in
parallel waves, and puts each one through tests-first development and two rounds
of independent review.

You will watch commits land one slice at a time, each with a clean message. That
is deliberate: a reviewable history is worth more than a single enormous commit
that nobody will ever read.

### Day 4: Ship

```
/god-deploy    sets up the deploy pipeline
/god-observe   wires up monitoring and alerting targets
/god-harden    security review. Blocks launch on critical findings.
/god-launch    launch copy and runbook. Only runs if hardening passed.
```

The ordering here is load-bearing. `/god-launch` will not run while
`/god-harden` has unresolved critical findings, which means you cannot
accidentally launch something with a known hole in it.

By the end of day 4 you are live.

### Day 5 onward: Keep it healthy

```
/god-feature       add new features
/god-update-deps   weekly, for security patches
/god-hygiene       monthly health check
```

---

## When things go wrong

They will. Here is your recovery kit:

| Situation | Command |
|---|---|
| What is the current state? | `/god-status` |
| Something about my install seems broken | `/god-doctor` |
| Undo the last operation | `/god-undo` |
| Walk back the plan and everything downstream | `/god-rollback prd` |
| Recover something that got deleted | `/god-restore` |

State always lives on disk, so you can close everything, come back later, and
resume by reopening the directory.

### The plan came out wrong

```
/god-redo prd
```

This rewrites the plan and marks everything downstream as needing another look,
since those steps were built on the old version. You will re-run `/god-arch` and
the rest against the new plan.

### You want to skip a stage

```
/god-skip launch --reason "private internal tool, no public launch"
```

The reason is required. Skipping is fine; skipping silently is not, so it is
recorded with an audit trail.

### You do not want to think about which command to run

```
/god-next
```

It reads the state from disk and tells you what makes sense next. You can also
just describe what you want in plain English and let it route you.

---

## Closing the loop

### After a feature ships

```
/god-extract-learnings
```

Captures the decisions, the surprises, and the things you would do differently
into `.godpowers/learnings/`. This is the institutional knowledge that normally
evaporates the moment a feature ships.

### When production breaks

```
/god-hotfix
```

Runs a tight emergency sequence: debug, write a regression test, make the
minimal fix, compressed review, expedited deploy, verify in production, then
schedule a postmortem within 48 hours.

Note that the postmortem is scheduled automatically. That is on purpose: the
intention to review an incident properly does not survive contact with the next
week unless something writes it down.

### A week later

```
/god-postmortem
```

Builds the timeline, identifies the root cause **and the class of bug it
belongs to**, drafts blameless action items with owners and due dates, and
updates the runbooks.

The class-of-bug part matters more than the root cause. Fixing one bug fixes one
bug; recognizing its class stops the next five.

---

## What now?

Repeat the cycle. Add features. Hotfix when you must. Run `/god-hygiene`
monthly and `/god-audit` before milestones.

Over time, your `.godpowers/` directory becomes the memory of the product:
every decision, every artifact, every run, every lesson. On disk, searchable,
and traceable back to the moment someone decided it.
