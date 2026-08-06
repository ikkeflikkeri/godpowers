# Blind Comparison

> Judge two visual artifacts without knowing which one is yours. A judge
> that can see the label grades the label; every review agent in this repo
> is biased toward the work it is embedded next to, and this protocol is
> the mechanical countermeasure.

## When this fires

- **Runtime audit against a reference anchor.** DESIGN.md declares a
  `reference:` block with a `url`; `lib/runtime-audit.auditPage` captures
  the reference product beside the candidate screenshot and seals a pair.
- **Design review of a visual change.** god-design-reviewer has a rendered
  before and after (current vs proposed) and the change is visual rather
  than structural.
- **Divergence over design-shaped candidates.** A widened candidate pool
  produced rendered variants; pairs are judged blind instead of reviewed
  in a labeled list (see `references/planning/DIVERGENCE.md`).

## When this does not fire

- No rendered artifacts exist. Do not screenshot something just to have a
  pair; the playable build stays central and asset generation is not the
  work.
- The two artifacts are trivially distinguishable by content (one has the
  product's own logo or copy). Blindness that cannot survive one glance is
  ceremony; say so and review labeled instead.
- The comparison would decide a non-visual question. Correctness, spec
  fit, and acceptance criteria have their own gates.

## Protocol

The mechanics live in `lib/blind-compare.js`. The sequence is fixed:

1. **Prepare.** `preparePair({ roles, outDir, salt })` with exactly two
   role-named artifacts (`candidate`/`reference`, `current`/`proposed`,
   `round-3`/`round-4`). The module copies them to neutral `a.*` and `b.*`
   files and seals the role assignment in `assignment.json`.
2. **Judge.** Read ONLY `pair.json`, `a.*`, and `b.*`. Never read
   `assignment.json`, `result.json`, or the source paths while judging.
   Grade against the declared focus (the `focus` line of the reference
   anchor, or the review's stated dimension), not overall taste.
3. **Record.** `recordVerdict(pairDir, { winner: 'a' | 'b' | 'tie',
   rationale })`. The rationale must cite concrete visual evidence
   (hierarchy, density, contrast, spacing rhythm, motion), not "a looks
   better". The verdict is immutable once written.
4. **Unseal.** `unseal(pairDir)` resolves the winner back to a role and
   writes `result.json`. Only now may the assignment be read.

The ordering is enforced mechanically: unseal refuses before a verdict,
a second verdict is refused, and a verdict after unseal is refused.
Honest framing: `assignment.json` sits on disk during judging, so the
blindness is procedural, a seatbelt against accidental peeking and
after-the-fact edits, not cryptography. An agent that reads the sidecar
mid-judgment has broken the protocol even though nothing crashed; say so
in the review record.

## What the outcome means

- **Reference wins**: file a warning-severity `reference-comparison`
  finding into REVIEW-REQUIRED.md naming what the reference does better,
  in the rationale's own words. It is advisory. An external bar losing a
  round is not a build failure and never trips the critical-finding gate
  by itself.
- **Candidate wins or tie**: record it and move on. Do not loosen the
  anchor to keep losing; do not tighten it to keep winning. The anchor
  changes only when DESIGN.md changes, through god-design-reviewer.
- **Every verdict** lands in the artifact that owns the comparison (audit
  report, review record, or divergence table), with the rationale. A
  verdict that stays in the console is worthless six months later.

## Failure modes

- Judging with the assignment already known. The verdict is real but the
  blindness is theater; label the comparison as sighted.
- "Utterly wowed" style bars. A verdict is a/b/tie with evidence, not an
  emotional threshold that can never be met or always be claimed.
- Screenshot farming: rounds of capture that never change the build. The
  pair exists to direct the next edit, not to decorate the report.
- Re-preparing a judged pair to fish for a different verdict. The module
  refuses; a new round is a new pair with a new salt.

## Provenance

Godpowers-authored. The blind side-by-side framing against a named shipped
reference was influenced by the gauntlet-loop skill (see
`INSPIRATION.md`). No code or prose is taken from it; the sealed
verdict-before-unseal ordering and the advisory-severity rule are
godpowers' own.
