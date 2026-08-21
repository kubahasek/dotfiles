---
name: herdr
description: "Control Herdr terminal layout and ordinary terminal processes. Use for panes, tabs, workspaces, shells, tests, and dev servers. Never use Herdr to create or coordinate subagents; use Pi's pi-subagents extension instead. Requires HERDR_ENV=1."
---

# Herdr

Herdr organizes terminals into workspaces, tabs, and panes and exposes current session through `herdr` CLI.

## Subagent boundary

Do not start, prompt, monitor, or coordinate coding agents through Herdr panes. All subagent work must use Pi's `pi-subagents` extension (`subagent`, `subagent_wait`, and supervisor tools). Herdr remains available only for terminal layout and ordinary processes such as shells, tests, and dev servers.

Before issuing any control command, verify that agent runs inside Herdr-managed pane:

```bash
test "${HERDR_ENV:-}" = 1
```

If check fails, say you are not running inside Herdr and stop. Do not inspect or control focused Herdr session from outside Herdr.

When check passes, `herdr` binary in `PATH` talks to current session. Use it to inspect neighboring work, create terminal layout, start agents and commands, read output, and wait for state changes.

## Learn current CLI

Installed binary is authority for command syntax. Start with:

```bash
herdr --help
```

Then print relevant command group by running group without subcommand:

```bash
herdr pane
herdr workspace
herdr tab
herdr worktree
herdr terminal
herdr notification
herdr integration
herdr session
```

Do not run bare `herdr` for discovery; it launches or attaches TUI. Do not probe mutating nested command by omitting arguments. Commands such as `herdr workspace create` are valid with defaults and execute.

Most control commands return JSON. Read identifiers and state from responses instead of predicting them.

## Understand layout and panes

Choose primitive that matches job:

- Workspace, tab, and pane topology organize terminal locations.
- Pane commands control raw terminals, shells, tests, servers, input, and output.
Pane exists whether or not it contains a foreground process. Use pane commands only for ordinary terminal processes. Coding-agent delegation belongs to Pi's `pi-subagents` extension.

## Use IDs and caller context

Public IDs are opaque stable handles:

- workspace: `w1`
- tab: `w1:t1`
- pane: `w1:p1`

Closed tab and pane IDs are not reused. Pane moved into another workspace receives new workspace-qualified pane ID. After `pane move`, continue with `.result.move_result.pane.pane_id` or live agent name. Old value is reported as `.result.move_result.previous_pane_id`; only moved process's inherited caller context keeps resolving old ID, so do not use it as general agent target.

Herdr injects caller context into each managed pane:

```bash
printf '%s\n' "$HERDR_WORKSPACE_ID" "$HERDR_TAB_ID" "$HERDR_PANE_ID"
```

Prefer `--current` when pane command should target calling pane. Omitting target may use UI-focused pane, which can belong to user or another client.

Discover live state with:

```bash
herdr workspace list
herdr tab list --workspace "$HERDR_WORKSPACE_ID"
herdr pane current --current
herdr pane list --workspace "$HERDR_WORKSPACE_ID"
```

Creation responses expose IDs to use next. `workspace create` returns `.result.workspace`, `.result.tab`, and `.result.root_pane`. `tab create` returns `.result.tab` and `.result.root_pane`. `pane split` returns new pane as `.result.pane`.

## Run ordinary command in another pane

Create sibling pane with same geometry rule, preserve caller working directory, and keep user focus unchanged:

```bash
herdr pane split --current --direction right --cwd "$PWD" --no-focus
```

Read new pane ID from `.result.pane.pane_id`, then run and inspect command:

```bash
herdr pane run <returned-pane-id> "just test"
herdr pane wait-output <returned-pane-id> --match "test result" --timeout 120000
herdr pane read <returned-pane-id> --source recent-unwrapped --lines 120
```

`pane run` atomically sends command text and Enter. `pane wait-output` searches selected snapshot immediately, so output that already exists can match. Use `--match <text>` for literal substring or `--regex <pattern>` for Rust regular expression. Omitting `--timeout` allows indefinite wait.

Use read source that matches task:

- `visible`: currently rendered viewport.
- `recent`: recent rendered output, including soft wraps.
- `recent-unwrapped`: recent output with soft wraps joined; prefer it for logs and transcripts.
- `detection`: plain-text bottom-buffer snapshot used for agent detection.

Use `--format ansi` when colors and terminal styling are evidence. Otherwise use text.

`--lines` asks Herdr for more rows from pane available screen and host scrollback. If increasing it does not reveal more of completed response, pane probably runs agent on terminal alternate screen. Rows that leave alternate screen do not enter Herdr host scrollback, so larger line count cannot recover them.

After failed read, ask agent to write complete response as Markdown in temporary directory and reply only with file path, then read file directly. Use this only as fallback; do not request file output in initial prompt.

## Safety and coordination rules

- Use `--no-focus` for background work unless user asked to switch context.
- Use `--current`, explicit pane ID, or unique agent name. Do not rely on another client's focused pane.
- Parse IDs from JSON responses. Do not derive them from sidebar order or examples.
- Do not close workspaces, tabs, panes, or sessions you did not create unless user explicitly asked.
- Never run `herdr server stop` from active session unless user explicitly intends to stop server and its pane processes.
- Never kill main Herdr process. Use named test sessions for experiments that need isolated server.
- CLI server errors are JSON on stderr with exit status 1. CLI syntax errors exit with status 2.
