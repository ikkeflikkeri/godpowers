---
name: god-polish
description: |
  Bounded post-green polish loop. Repeats audit, design-scoped fix, and
  re-audit rounds against DESIGN.md and its optional reference anchor
  (blind A/B judged), until the rounds cap, a dry round, a human stop, or
  a critical finding ends it. Two brakes always: the human and the cap.

  Triggers on: "god polish", "/god-polish", "polish the ui", "polish
  pass", "keep improving the design", "make it hold up against",
  "reference polish loop", "climb toward the reference"
---

# /god-polish

Iterative visual polish for an app whose build is already green. Each
round audits the running app, turns the findings into one design-scoped
fix slice, applies it, and re-audits. When DESIGN.md declares a
`reference:` anchor, every round also captures the reference product and
judges a blind screenshot pair (`references/design/BLIND-COMPARISON.md`),
so the loop climbs toward a real shipped bar instead of its own taste.

The loop never runs open-ended. The gauntlet-style "human is the brake"
idea (see INSPIRATION.md) keeps the human brake and adds a second one:
a rounds cap and a dry-round detector, because unbounded iteration is
also unbounded cost.

## Forms

| Form | What it does |
|---|---|
| `/god-polish` | Run or resume a polish loop with the default rounds cap |
| `/god-polish --rounds N` | Override the cap for this loop (hard max 10) |
| `/god-polish --url <url>` | Audit this URL instead of the detected dev server |
| `/god-polish --status` | Show the open loop's ledger without running a round |
| `/god-polish --stop` | Close the open loop and summarize what changed |

The default cap is the `polish-rounds-limit` loop parameter (default 3,
tuned via `/god-budget --loop polish-rounds-limit=N`).

## Preconditions (refuse, do not degrade)

1. `.godpowers/` exists. If not: "Run `/god-init` first."
2. The build is green: `state.json` tier-2 build status is done and the
   test suite passes now. Polish is for after the build works; a polish
   round on a red build buries real failures under visual diffs.
3. A runtime backend resolves (`lib/browser-bridge.getActiveBackend`).
   No backend: report the install instructions and stop.
4. `DESIGN.md` exists. No design contract means nothing to polish
   against; suggest `/god-design`.

## Round structure

Each round appends one entry to `.godpowers/polish/POLISH.mdx`:

1. **Audit.** Spawn god-browser-tester (Mode 1, audit only) against the
   target URL. This produces `audit-report.json`, screenshots, and, when
   a reference anchor with a `url` is declared, a sealed blind pair the
   tester judges before returning (verdict, rationale, unsealed result).
2. **Harvest.** Turn the audit findings and the blind-verdict rationale
   into a design-scoped worklist: tokens, spacing, contrast, typography,
   motion, interaction states, UX copy. Anything outside that surface
   (schema, routes, features, dependencies) is out of scope; record it
   as a captured idea (`/god-capture`) instead of fixing it here.
3. **Fix.** Spawn god-executor with the worklist as one slice, TDD rules
   unchanged. The slice must not touch DESIGN.md itself; if the harvest
   says the contract (not the app) is wrong, stop the loop and route to
   `/god-design`, because the anchor and tokens change only through
   god-design-reviewer.
4. **Re-audit.** Run the audit again. Record the delta: findings count
   before and after, blind verdict before and after, screenshots kept as
   evidence. The re-audit is the round's proof; a round without one did
   not happen.

## Stop conditions (first hit wins)

- **Cap.** Round count reaches the cap. Close with a summary.
- **Human.** `--stop`, or any interactive halt. The loop state stays
  resumable until closed.
- **Dry round.** The re-audit shows no improvement (findings did not
  decrease and the blind verdict did not move toward the candidate).
  One dry round closes the loop: diminishing returns, say so plainly.
- **Critical finding.** WCAG fail, > 10% drift, or a broken acceptance
  flow surfaced by the audit fires the critical-finding gate and pauses
  everything, exactly as it does everywhere else. A lost blind verdict
  is NOT critical; it is the loop's normal fuel.

## State and resume

`.godpowers/polish/POLISH.mdx` holds the loop header (target URL, cap,
anchor name, opened) and one entry per round (worklist, files touched,
findings delta, blind result, evidence paths). `/god-polish` with an open
loop resumes at the next round number; `--status` renders the ledger;
`--stop` closes it with a final summary. Closed loops stay in the file as
history. Ledger events: `polish.round` per round and `polish.closed` on
close, via `godpowers event emit`.

## Have-Nots (you fail if)

- You ran a round on a red build or without a re-audit
- You touched anything outside the design surface in a fix slice
- You edited DESIGN.md, the anchor, or the cap from inside the loop
- You continued past a critical finding, a dry round, or the cap
- You treated a lost blind verdict as a critical finding
- You read a pair's `assignment.json` before its verdict was recorded

## Output (per round)

```
/god-polish round 2/3

Audit: 4 findings (was 7). Blind vs Linear: reference (was reference).
  Rationale: denser nav, tighter vertical rhythm above the fold.
Fix slice: 5 files, tokens + hero spacing + nav padding.
Re-audit: 3 findings. Blind vs Linear: tie.
Evidence: .godpowers/runtime/<run-id>/, POLISH.mdx updated.

Next: 1 round remains. /god-polish to continue, /god-polish --stop to close.
```
