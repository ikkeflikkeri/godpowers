# MCP Companion

**Short version:** an optional add-on that lets MCP-capable tools read your
Godpowers project state. It can only read. It cannot change anything.

You do not need it. Godpowers works fully without it. Install it when you want
another tool to see your project status, next action, or gate results without
going through a slash command.

## Why it is a separate package

The main `godpowers` package has zero runtime dependencies, and keeping it that
way is a deliberate architectural commitment. Supporting MCP requires the MCP
SDK, which is a dependency. Putting it in a companion package means people who
want MCP get it, and people who do not keep a dependency-free install.

- [DECISION] `@godpowers/mcp` is the first-party MCP companion package for Godpowers.
- [DECISION] The companion package exposes read-only MCP tools over stdio.
- [DECISION] The main `godpowers` package remains dependency-free at runtime.
- [DECISION] The MCP SDK dependency is isolated in `@godpowers/mcp`.

## What it exposes

Nine read-only tools:

| Tool | What it tells you |
|---|---|
| `status` | The full dashboard state, read from disk |
| `next` | The recommended next command, and why |
| `gate_check` | Whether a given stage passes its gate |
| `lint_artifact` | Lint results for one file inside the project |
| `trace_requirement` | A requirement traced through roadmap, linkage, and ledger evidence |
| `work_report` | What work has been done |
| `change_metrics` | The accepted-change rate and related loop health numbers |
| `route` | Which command a given intent routes to |
| `verification_history` | What was verified, when, and with what result |

Details on the first five:

- [DECISION] `status` wraps `lib/dashboard.js` and returns dashboard state from disk.
- [DECISION] `next` wraps `lib/dashboard.js` and returns the recommended next command.
- [DECISION] `gate_check` wraps `lib/gate.js` and returns the executable tier gate verdict.
- [DECISION] `lint_artifact` wraps `lib/artifact-linter.js` for one file inside the project root.
- [DECISION] `trace_requirement` wraps `lib/requirements.js` and returns requirement, roadmap, linkage, and ledger evidence.

## The read-only boundary

This is the important part. There is no way to change your project through this
surface, by design.

- [DECISION] The companion does not expose state mutation, artifact writes, route edits, or package publish actions.
- [DECISION] The companion resolves the Godpowers runtime from `--runtime-root`, `GODPOWERS_RUNTIME_ROOT`, a local checkout, or an installed `godpowers` package.

Actions that change the outside world do not live here either. Those are
delegated to your host's own connectors through `/god-connect`, where you
control the permissions.

## Setup

Look before you install. This command is read-only and does not even load the
MCP SDK:

```bash
npx godpowers mcp-info --project=.
```

To run the server:

```bash
npx -y -p godpowers@5.15.0 -p @godpowers/mcp@5.15.0 godpowers-mcp serve --project=.
```

- [DECISION] `godpowers mcp-info` is read-only and does not load the MCP SDK.
- [DECISION] The server command starts `@godpowers/mcp` over stdio for MCP-capable hosts.

## Registering with Codex

Registration is opt-in and never happens automatically. Run it once to preview
the config block, then again with `--write` to apply it:

```bash
npx -y -p godpowers@5.15.0 -p @godpowers/mcp@5.15.0 godpowers-mcp setup --host=codex --project=.
npx -y -p godpowers@5.15.0 -p @godpowers/mcp@5.15.0 godpowers-mcp setup --host=codex --project=. --write
```

- [DECISION] The first setup command prints the managed Codex config block without writing files.
- [DECISION] The second setup command writes the managed `[mcp_servers.godpowers]` block to `~/.codex/config.toml`.
- [DECISION] No automatic MCP registration runs during package install.

## Verification

```bash
npm --workspace @godpowers/mcp test
npm --workspace @godpowers/mcp run pack:check
```

- [DECISION] The protocol test spawns the server over stdio, completes MCP initialization, lists tools, and calls each tool against `fixtures/quick-proof/project`.
- [DECISION] The package check verifies the companion tarball contains only its runtime files, README, and license.
