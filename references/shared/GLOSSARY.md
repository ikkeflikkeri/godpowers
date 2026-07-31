# Godpowers Glossary

> Canonical vocabulary. Every doc, agent prompt, error message, and command
> must use these consistently.

## Core abstractions

**Tier**: a phase of the development workflow (0: Orchestration, 1: Planning, 2: Building, 3: Shipping).

**Sub-step**: a bounded unit within a tier (PRD, ARCH, Roadmap, Stack, Repo, Build, Deploy, Observe, Launch, Harden).

**Artifact**: a file on disk produced by a sub-step. Has a contract.

**Skill**: a slash command. Thin handle that spawns agents.

**Agent**: a specialist that turns sub-step inputs into the artifact. Fresh context per spawn.

**Gate**: a passing upstream artifact required for a downstream sub-step.

**Have-not**: a named, grep-testable failure mode. 200 in the catalog.

**Mode**: a run flavor (greenfield A, gap-fill B, audit C, multi-repo D-future).

**Scale**: project size (trivial, small, medium, large, enterprise). Drives which tiers and personas activate.

## Quality concepts

**Substitution test**: replace product name with competitor's; if sentence still reads true, it decides nothing. Rewrite.

**Three-label test**: every sentence is exactly DECISION, HYPOTHESIS, or OPEN QUESTION. Anything unlabeled is theater.

**Theater**: sentences that read fine but say nothing measurable, decidable, or testable.

**AI-slop**: output that passes substitution test. Reads generic.

**Paper artifact**: document exists but mechanism does not (e.g., "runbook" never executed, "SLO" with no error budget policy).

**Phantom resume**: agent claims tier is done but artifact is missing from disk.

**Ghost handoff**: tier invoked before its upstream artifact exists.

**Drift**: gap between what state.json claims and what disk actually contains.

## Workflow concepts

**Pause**: a genuine human-in-the-loop checkpoint. Five legitimate categories (ambiguous intent, human-only flip-point, statistical tie, Critical security finding, brand voice).

**YOLO**: auto-resolve all pauses except security Criticals. Logs to YOLO-DECISIONS.md.

**Workstream**: an isolated parallel branch with its own state.

**Vertical slice**: one user-visible behavior end-to-end. Not "set up the database".

**Wave**: a set of slices that can run in parallel within a build phase.

## Wayfinding concepts

**Chart**: an index of the decisions between here and a named destination, at `.godpowers/charts/<slug>/CHART.mdx`. Written by `/god-chart` when work is too big for one session and too foggy to sequence.

**Destination**: what reaching the end of a chart looks like. An end state, not a restatement of the idea. It fixes the scope, so it is settled before any unit is written.

**Work unit**: a `STORY-<slug>-NNN` file. Its `kind` decides what it delivers.

**Decision unit**: a work unit whose deliverable is a resolved decision, not code. Kinds: `decision`, `research`, `prototype`, `grilling`, `task`. Shares the board, ids, deps, and statuses with build slices.

**Frontier**: the units that are open, unblocked, and unclaimed. The edge of the known. `/god-stories --frontier`.

**Claim**: writing an `owner` and `claimed-at` into a unit before doing any work on it, so a concurrent session skips it. An unheld claim is not a claim. Stale claims are reclaimable, like state locks.

**Fog of war**: in-scope questions you can tell are coming but cannot yet phrase sharply. Lives in `## Not Yet Specified`. Graduates to a unit when you can state the question precisely, not when you can answer it.

**Out of scope**: work ruled beyond the destination. Terminal; never graduates. A mis-scoped unit is closed with a `closed-reason`, not deleted, and stays out of the decisions log.

**HITL unit**: a unit marked `hitl: true`, which resolves only through a live exchange with a human. `--yolo` cannot auto-resolve one.

**Reflog**: append-only log of state-changing operations. Enables /god-undo.

**Trash**: recoverable deletion to `.godpowers/.trash/`.

## Agent concepts

**Fresh context**: each spawned agent gets a new context window. Defeats context rot.

**TDD enforcement**: tests written before implementation. Code-before-test triggers rewrite.

**Two-stage review**: god-spec-reviewer (compliance) then god-quality-reviewer (craft). Both must pass for commit.

**Atomic commit**: one slice = one commit. Never multiple slices in one commit.

**Critical-finding gate**: launch is blocked if god-harden-auditor finds Critical. Even --yolo.

## Extension concepts

**Extension**: a skill pack from npm. Adds new agents, skills, workflows, have-nots.

**Lazy activation**: extension files don't load until a slash command from that extension is invoked.

**Capability handshake**: extension declares `engines.godpowers: "^X.Y.0"` and install fails on mismatch.

**Skill pack**: another name for an extension. Same thing.
