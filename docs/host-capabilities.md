# Host Capabilities

Godpowers relies on your AI tool to do things: spawn specialist workers, run
shell commands, reach git and npm. Not every tool can do all of it.

Rather than assuming the best case and quietly producing worse results, Godpowers
checks what your setup can actually do and tells you. If it cannot spawn a real
fresh-context agent, it says the word "simulated" out loud instead of letting
you believe otherwise.

## Purpose

- [DECISION] Godpowers reports runtime guarantees instead of assuming every AI
  host can spawn agents, run shell commands, or use release tooling.
- [DECISION] Host capability status appears in the dashboard action brief and
  proactive checks.
- [DECISION] Capability gaps are actionable release and workflow signals, not
  hidden implementation details.
- [DECISION] MCP availability appears in the host guarantee line without
  changing whether the host is `full`, `degraded`, or `unknown`.

## The three levels

| Level | What it means |
|---|---|
| `full` | Everything works. Shell, git, npm, and real fresh-context agent spawning all confirmed. |
| `degraded` | The basics work, but specialists cannot get genuinely fresh contexts. Output is still useful; the isolation guarantee is not there. |
| `unknown` | Something baseline could not be confirmed. Treat results with suspicion until you know why. |

- [DECISION] `full` means shell, git, npm, and fresh-context Godpowers agent
  metadata are detected.
- [DECISION] `degraded` means shell, git, and npm are detected, but true
  fresh-context agent spawning is not detected.
- [DECISION] `unknown` means one or more baseline runtime capabilities could
  not be confirmed.

## What gets detected

`lib/host-capabilities.js` works this out from local signals only. No network
access is required, and nothing is sent anywhere.

- [DECISION] `lib/host-capabilities.js` detects host identity from environment
  signals.
- [DECISION] It records installed Codex agent metadata at
  `~/.codex/agents/god-orchestrator.toml`.
- [DECISION] It records installed Claude agent metadata at
  `~/.claude/agents/god-orchestrator.md`.
- [DECISION] It checks local availability of `git`, `npm`, and `gh` without
  requiring network access.
- [DECISION] It reports optional code intelligence from
  `lib/code-intelligence.js`, including `ast-grep`, `sg`, and detected LSP
  tool commands.
- [DECISION] Missing code intelligence is an optional enhancement gap and does
  not downgrade `full` or `degraded` host levels.
- [DECISION] It reports MCP availability from `GODPOWERS_MCP`, the
  `@godpowers/mcp` package, the local `packages/mcp` workspace, or a Codex
  `[mcp_servers.godpowers]` registration.
- [DECISION] It reports extension authoring and suite release dry-run support
  from shipped runtime files.

### Installed is not the same as working

This distinction is the reason the detection is fussier than it looks. Finding
agent metadata on disk proves the files are there. It does not prove that the
session you are sitting in can actually spawn one.

- [DECISION] Installed agent metadata proves availability on disk, not that the
  active host session can spawn a fresh agent.
- [DECISION] A full guarantee requires an identified active host plus explicit
  active-session spawn evidence.
- [DECISION] An unidentified active host cannot receive a full guarantee.

## What you see

```text
Action brief:
  Next: /god-prd
  Why: PRD is the next planning gate.
  Readiness: needs attention
  Attention: Host: degraded on codex, fresh-context agent spawn not confirmed for active session
  Host guarantees: degraded on codex, fresh-context agent spawn not confirmed for active session; MCP not configured
  Code intelligence: ast-grep via ast-grep
```

- [DECISION] Full host guarantees do not block the action brief.
- [DECISION] Degraded or unknown host guarantees appear as attention items.
- [DECISION] The compact dashboard mode includes host guarantees so compressed
  output still tells the truth about autonomy.
- [DECISION] MCP unavailability is reported as host context, not as a blocker
  for non-MCP workflows.

That last point matters when output gets compressed: the honesty survives the
squeeze. A compact view that dropped the host line would be a view that quietly
overstates what just happened.

## Tests

```bash
node scripts/test-host-capabilities.js
node scripts/test-dashboard.js
```
