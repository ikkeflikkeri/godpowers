# Roadmap Anatomy

## Now / Next / Later (Shape Up flavor)

**Now**: currently building. Committed. Has a target date but slippage is OK.
**Next**: planned to start when Now ships. Order is set, scope is flexible.
**Later**: intent. May change. Captures direction without commitment.

## Not Yet Specified (fog of war)

The roadmap also carries what it deliberately has NOT sequenced: in-scope
questions you can tell are coming but cannot yet phrase sharply, because they
hang on decisions still open.

The graduation test is whether you can **state the question precisely now**,
not whether you can answer it. A line leaves Not Yet Specified when it becomes
a sharp question (it graduates to an open question, a decision unit via
`/god-chart`, or a delivery increment), not when someone finds the answer.

Have-nots P-08 and P-09 (open question needs an owner and a real due date) do
not apply here. A question you cannot yet phrase cannot be assigned or dated,
and forcing it to be either pushes honest known-unknowns off the artifact.

This section is not the backlog. Backlog items are things you might do later
and have a promotion path (`/god-add-backlog promote`). Fog is about clarity,
not commitment. See [WAYFINDING.md](WAYFINDING.md).

## Milestone Structure

Each milestone has:
- **Goal**: what users can DO when this ships (substitution-tested)
- **Completion gate**: observable criterion ("not feels done")
- **Size**: S / M / L (T-shirt; no day-precision without capacity input)
- **Depends on**: explicit upstream milestones
- **Features**: from PRD (no speculative features)

## Examples

### Good
> Milestone 1 (Now): Connect Stripe + see basic MRR
> - Goal: User can connect Stripe in <60s and see current MRR breakdown by new/expansion/churn
> - Gate: 5 friendly users complete onboarding without help
> - Size: M
> - Depends on: none
> - Features: PRD-MUST-1, PRD-MUST-2

### Bad
> Milestone 1: Build the dashboard
> - Goal: have a dashboard
> - Gate: it works
> - Size: ?
> - Features: dashboard, charts, things

## Velocity Tracking

After 2 sprints, you have a baseline. Use it for Next milestones.

| Sprint | Committed | Delivered | Notes |
|--------|-----------|-----------|-------|
| 1 | 5 slices | 4 | Auth slice underestimated |
| 2 | 5 slices | 6 | Recovered the auth overhang |
| Avg | 5/sprint | 5/sprint | Stable baseline |
