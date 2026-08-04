# Quick Proof

This is the fastest way to see what Godpowers adds on top of a normal AI coding
prompt. No essay, no trust required: run one small command, read one real
transcript, then look at the files that make the run accountable.

It takes about ten minutes and changes nothing on your machine.

You will notice that the statements below are tagged `[DECISION]`,
`[HYPOTHESIS]`, and `[OPEN QUESTION]`. That is not decoration. Godpowers
requires every sentence in its own documents to declare which of the three it
is, so that guesses cannot quietly pass themselves off as conclusions. This page
follows its own rule.

## What This Proves

- [DECISION] A normal AI coding prompt can produce code, but Godpowers also
  leaves disk state, artifacts, validation gates, host guarantees, and a next
  action.
- [DECISION] Godpowers treats the file system as the source of truth, so a
  session can resume from `.godpowers/` instead of depending on chat memory.
- [DECISION] Godpowers reports degraded host behavior instead of pretending
  every AI coding tool can provide the same agent-spawning guarantees.
- [HYPOTHESIS] A new user should be able to see this difference in 10 minutes
  without waiting for a full multi-hour project run.

## Ten Minute Path

Run these from a project directory after installing Godpowers.

```bash
npx godpowers quick-proof --project=. --brief
npx godpowers quick-proof --project=. --inspect-project --brief
npx godpowers status --project=. --brief
npx godpowers next --project=. --brief
npx godpowers mcp-info --project=.
```

Here is what each one is doing.

The **first** reads a bundled sample project, works out what its next command
would be, and reports what your own environment can guarantee. Be clear about
what this is: evidence about the sample, not about your project.

The **second** points that same read-only view at your actual project.

The **third and fourth** show live status and the recommended next action for
where you are standing right now.

The **fifth** prints optional setup for the read-only companion package. It does
not write any host configuration.

When a project has reached a given stage, you can run its gate directly:

```bash
npx godpowers gate --tier=prd --project=.
```

Add `--json` and it returns structured output (`{tier, verdict, artifacts,
checks, findings, summary}`). It exits with a non-zero code when required
evidence is missing or when a blocking finding is present, which is what makes
it usable in a script or a CI pipeline.

**No `.godpowers/` directory yet?** Start with the smallest thing that produces
state. Inside your AI coding tool:

```text
/god-init
/god-next
```

Then look at what appeared:

```bash
find .godpowers -maxdepth 2 -type f | sort
```

The point is not that every command has already run. The point is that Godpowers
can tell you what exists, what is missing, what your host can actually
guarantee, and the single next move, without guessing at any of it.

## Outcome Metrics

- [DECISION] Quick Proof reports commands to first signal, state source,
  tracked steps, missing planning artifacts, next command, host level, and host
  gap count.
- [DECISION] Default Quick Proof metrics describe the shipped fixture, while
  `--inspect-project` describes the named current project without writing it.
- [DECISION] These metrics separate observable adoption evidence from broader
  claims about a full autonomous project run.
- [DECISION] A useful first run should produce at least one next command, one
  host guarantee, and one inspectable disk-state path.

## External CLI Canaries

Proof against a bundled sample is a weaker claim than proof against somebody
else's real repository, so we run both and label them differently.

- [DECISION] Three external repositories now have CLI-verifiable canary
  reports: [sindresorhus/is](case-studies/sindresorhus-is-adoption-canary.md),
  [expressjs/cors](case-studies/expressjs-cors-adoption-canary.md), and
  [tinyhttp/tinyhttp](case-studies/tinyhttp-adoption-canary.md).
- [DECISION] These canaries prove first-contact status and next-action signals
  against real cloned repositories.
- [OPEN QUESTION] They do not yet prove host slash-command execution inside
  those repositories. Owner: maintainer. Due: before broad product proof
  claims.

## Before And After

### Unguided AI Prompt

```text
User: Build a SaaS for solo founders to track MRR.

AI: Here are the files for a dashboard application.
```

You may well get useful code out of this. What you do not get is any durable
record of the plan, any independent review of the work, any honest statement of
what your tooling could and could not do, or any way to pick this up again next
week without re-explaining it.

### Godpowers Prompt

```text
User: /god-mode
User: A SaaS for solo founders to track MRR breakdown by new, expansion, and churn.
```

The work routes through project state and leaves artifacts behind:

```text
.godpowers/state.json
.godpowers/PROGRESS.mdx
.godpowers/prd/PRD.mdx
.godpowers/arch/ARCH.mdx
.godpowers/roadmap/ROADMAP.mdx
.godpowers/stack/DECISION.mdx
.godpowers/build/PLAN.mdx
.godpowers/harden/FINDINGS.mdx
```

The difference is the audit trail. Code is one output among several. The project
memory, the validation record, and the next action are outputs too.

## Transcript Excerpts

Real output, trimmed for length. This is what the tool actually prints.

### Next Action

```text
Godpowers Quick Proof

Action brief:
  Next: /god-prd
  Why: Prep exists, but no PRD artifact is complete.
  Readiness: ready
  Attention: none
  Host guarantees: full on codex; MCP available via workspace package
```

Note the `Why`. Godpowers does not just tell you what to do next; it tells you
what on disk led it to that conclusion, so you can disagree with it.

### Dashboard Closeout

```text
Godpowers Dashboard

Current status:
  State: partial
  Phase: Planning
  Progress: 20% (1 of 5 tracked planning steps complete)
  Worktree: modified files unstaged

Planning visibility:
  PRD: pending
  Roadmap: missing
```

### Host Guarantee

```text
Host guarantees: degraded
First gap: this host can install skills, but true fresh-context agent spawning
is not available. Godpowers will report Agent: simulated in current context.
```

This is the honesty guarantee in action. A tool that quietly degraded here would
still look like it was working. Godpowers says the word "simulated" out loud.

### Review Finding

```text
Reviews:
  1 pending, suggest /god-review-changes

Finding:
  Severity: warning
  Surface: build plan
  Reason: acceptance criteria exist, but the runtime verification URL is missing.
```

### Release Gate

```text
Release readiness:
  State: blocked
  Attention: package payload check failed
  Next: npm run pack:check
```

## Starter Paths

Pick one of these before you go near the full command reference. Learn the next
command only when Godpowers recommends it.

| Goal | Start here |
|---|---|
| Start a product | `/god-first-run`, `/god-init`, `/god-plan`, `/god-build` |
| Try safely | `/god-demo`, `/god-first-run`, `/god-init` |
| Add a feature | `/god-reconcile`, `/god-feature`, `/god-sync`, `/god-review` |
| Fix production | `/god-fix`, `/god-postmortem`, `/god-status` |
| Audit an existing repo | `/god-preflight`, `/god-archaeology`, `/god-reconstruct`, `/god-audit`, `/god-tech-debt` |
| Ship a release | `/god-ship`, `/god-sync`, `/god-docs`, `/god-version`, `npm run release:check` |
| Maintain health | `/god-hygiene`, `/god-update-deps`, `/god-docs`, `/god-check-todos` |
| Extend Godpowers | `/god-extend scaffold --name=@godpowers/my-pack --output=.`, `/god-extend test`, `/god-extend add`, `/god-extend list` |

## Runtime Expectations

Godpowers depends on your AI tool to run its specialists, and tools differ. It
tells you which guarantees it can offer rather than assuming the best case.

| Runtime class | What to expect |
|---|---|
| Claude Code | Strong reference path when native agent spawning is available. |
| Codex | Strong installed support through `agents/*.toml` metadata backed by the same Markdown agent contracts. |
| Other install targets | Skills and agent contracts install, while host-native spawning depends on the tool. |
| Degraded hosts | Godpowers must report local-only or simulated agent behavior instead of hiding the limitation. |

See [host-capabilities.md](host-capabilities.md) for the full capability model,
and [mcp.md](mcp.md) for optional companion setup.

## What To Inspect Next

- [Getting Started](getting-started.md) walks through install and your first project.
- [First 10 Minute Proof Case Study](case-studies/first-10-minute-proof.md)
  tells this same story as a public case study, including what it does not prove.
- [Reference](reference.md) lists every slash command.
- [Validation](validation.md) explains the static, linkage, and runtime checks.
- [Proof Transcript](proof-transcript.md) captures the full runnable output.
- [Dogfooding](dogfooding.md) explains the messy-repo checks that prove behavior
  against fixtures.
- [Adoption Canary](adoption-canary.md) defines the next real-world proof loop.
