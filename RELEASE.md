# Godpowers 5.14.0 Release

> Status: Publishing via tag-triggered provenance workflow
> Date: 2026-08-03

- [DECISION] Godpowers 5.14.0 gives the architecture tier its behavioral half: how a flow runs in order, what load its targets are measured under, and what happens when a dependency or a container stops answering.
- [DECISION] The public surface contains 123 slash commands, 41 specialist agents, 13 workflows, and 45 recipes; no command or agent was added.
- [DECISION] The core package contains 101 runtime library modules and keeps zero production dependencies.
- [DECISION] The `@godpowers/mcp` companion remains read-only and shares version 5.14.0.

## Changes

- [DECISION] `references/planning/ARCH-ANATOMY.md` gains **Critical Flows**, an ordered interaction for every flow that crosses a trust boundary or touches more than two containers, with the writing steps marked; C4 Levels 1 and 2 are static topologies and cannot express ordering, so nothing before this said where a partial failure strands the system mid-flow.
- [DECISION] It gains **Capacity Envelope**, the load inputs behind each NFR target with a source for each, the arithmetic from those inputs to per-container load, and the container that saturates first; the chain from PRD NFR through A-03 to A-12 produced a target mapped to a choice and never the derivation, which is why the anatomy's own worked example shipped a bare "handles up to ~5000" with nothing under it.
- [DECISION] It gains **Failure and Degradation**, the timeout as a number, the retry stance with the key that makes the write idempotent, and the user-visible degraded state per dependency, plus backpressure, recovery rate, and what happens when each of our own containers dies; harden, build, observe, and deploy each consume a resilience posture that no tier decided, and `references/building/API-DESIGN.md` already said these belong "at architecture time" while not being one of `god-architect`'s inputs.
- [DECISION] Four architecture have-nots move the catalog from 179 to 183. A-15 is not A-05: A-05 fires on the word "scalable" carrying no number, A-15 on a number carrying nothing underneath it. A-16 is not A-06: A-06 covers that edge being breached, A-16 covers it being unavailable, and only one of those happens weekly. A-17 covers a container whose loss stops the system and is neither addressed nor accepted in writing.
- [DECISION] A-17 also gives antipattern 7, "Hidden Single Points of Failure", the have-not code it never had; it was the one entry in `references/planning/ARCH-ANTIPATTERNS.md` with nothing behind it, and adding three neighbours while leaving it orphaned would have reproduced the asymmetry this release closes.
- [DECISION] A-14, A-15, and A-16 are mechanical in `lib/have-nots-validator.js` and report `warning` rather than `error`, because `lib/gate.js` blocks a tier on lint errors and an ARCH written before this release is missing all three sections through no fault of its author; the code says so at the registry so the next reader does not promote them.
- [DECISION] The mechanical NFR-map check emitted `A-04`, which the canonical catalog defines as "ADR without flip point"; a reader who looked up the code they were shown got a different failure mode than the one that fired. It now emits `A-03`.
- [DECISION] Six have-not totals had each rotted to a different wrong number with nothing watching: 200 in the glossary (a total the catalog never reached), 158 twice, 115 in the orchestrator runbook, 99 in `/god-lint`. `scripts/test-doc-surface-counts.js` now derives the total from the catalog, the mechanical count from the check registries, and the architecture range from the catalog's top A-code.
- [DECISION] `scripts/test-have-nots-tally.js` now checks that every code in a route's `standards.have-nots` exists in the catalog and that a route claiming a prefix claims all of it; this caught `/god-docs` still checking `DC-01..DC-05` after 5.13.0 added six more, and `/god-roadmap-update` stopping at `R-07` against a ten-entry tier.
- [DECISION] `specialists/god-auditor.md` scored seven architecture have-nots and silently skipped A-08 through A-13, so the retroactive auditor never once scored architecture theater, cargo-cult cloud-native, stackitecture, resume-driven architecture, paper-tiger architecture, or ADR inflation.
- [DECISION] `fast-uri` is pinned to `^3.1.5` in the root `overrides` block; it arrives through `@godpowers/mcp` to `@modelcontextprotocol/sdk` to `ajv`, and earlier versions carry GHSA-7p8r-x3mc-p8w7 at CVSS 7.5, which was failing `npm audit --omit=dev` inside the release gate.

## Validation

- [DECISION] `scripts/test-artifact-linter.js` adds 12 tests covering all three new checks: missing section, section present but empty of the thing that makes it a section, numbered and unnumbered headings, a labeled hypothesis as a valid source, and the absence of an idempotency demand where no retry is claimed.
- [DECISION] `scripts/test-golden-artifacts.js` adds 4 tests asserting the two shipped example projects carry the three sections and pass the three checks, because a warning severity would otherwise let the examples stop demonstrating the standard without failing anything.
- [DECISION] The new checks add no uncovered branches: `lib/have-nots-validator.js` stays above the 90 percent line and 75 percent branch release floors and the 70 percent per-file gate.
- [DECISION] The static check, self-project truth, public-surface counts, have-nots tally, route standards guard, golden-artifact tests, and `npm audit --omit=dev` are green on the tagged commit.
- [DECISION] The complete release gate and the official Agent Skills validator run in the GitHub publication workflow before the artifact is published.

## Upgrade

- [DECISION] Install with `npm install -g godpowers@5.14.0` or `npx godpowers@5.14.0`.
- [DECISION] Existing 5.x projects need no `.godpowers` artifact migration. An ARCH written before this release reports three warnings for the missing sections and still passes `npx godpowers gate --tier=arch`; re-run `/god-arch` when you want the sections filled.
- [DECISION] Re-run the installer for each host runtime so the updated references and templates replace installed copies.

## Publication Evidence

- [DECISION] Pushing tag `v5.14.0` triggers the identity-bound provenance publication workflow, which verifies the tag against both package versions and against `origin/main`, runs the release and pre-publication gates, and publishes `godpowers@5.14.0` and `@godpowers/mcp@5.14.0` with npm provenance.
- [DECISION] The GitHub Release is created by hand from this file after the workflow goes green; the workflow does not create it.
- [DECISION] Post-publication registry integrity, tarball digests, and isolated exact-version install verification are recorded in a follow-up publication-evidence commit, consistent with the 5.10.x release flow.
