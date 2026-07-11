---
name: cmux-subagents
description: Delegate independent work to another pi instance running visibly in a separate cmux pane or surface. Use when work benefits from parallel research, review, planning, or isolated implementation. Replaces in-process subagent tools; never use pi-subagents.
compatibility: Requires cmux CLI, cmux environment variables, and pi CLI.
---

# cmux Subagents

Delegate by launching `pi` in cmux. Child stays visible, independently controllable, and scoped to caller workspace.

## Rules

- Never call an in-process subagent tool or `pi-subagents`.
- Use current `CMUX_WORKSPACE_ID`; never rely on visually focused workspace.
- Create/reuse right-side helper pane per `cmux-workspace` skill. Never change focus.
- Give child self-contained prompt: goal, cwd, constraints, expected output, verification.
- One writer per worktree. Parallel children default read-only. For edits, give child isolated worktree or sole write ownership.
- Prefer interactive child (`pi '<prompt>'`) so user can inspect/steer it.
- Child must write final result to explicit file when parent needs machine-readable handoff.
- Do not close child surface automatically. Trigger flash when done.

## Launch

Inspect topology first:

```bash
cmux identify --json
cmux list-panes --workspace "$CMUX_WORKSPACE_ID" --json
cmux list-pane-surfaces --workspace "$CMUX_WORKSPACE_ID" --json
```

Reuse non-caller helper pane when present:

```bash
cmux new-surface --workspace "$CMUX_WORKSPACE_ID" \
  --pane pane:<helper> --type terminal --focus false --json
```

Otherwise create right pane:

```bash
cmux new-pane --workspace "$CMUX_WORKSPACE_ID" \
  --type terminal --direction right --focus false --json
```

Capture returned surface ref. Build prompt in temp file to avoid shell quoting bugs:

```bash
run_dir="$(mktemp -d "${TMPDIR:-/tmp}/cmux-subagent.XXXXXX")"
prompt="$run_dir/prompt.md"
result="$run_dir/result.md"
cat >"$prompt" <<EOF
You are delegated pi worker. Work independently in: $PWD

Task:
<task>

Constraints:
- Treat prompt as complete context.
- Do not spawn more agents.
- <read-only OR explicit write ownership>
- Verify claims.
- Write concise final report to: $result
EOF
```

Send command to exact new surface. `%q` creates safe shell args:

```bash
printf -v cmd 'cd %q && pi --name %q %q; status=$?; cmux trigger-flash --surface %q; exit $status\n' \
  "$PWD" "worker: <short task>" "$(cat "$prompt")" "surface:<id>"
cmux send --surface "surface:<id>" "$cmd"
```

For unattended result handoff, use print mode and tee output:

```bash
printf -v cmd 'cd %q && pi -p %q | tee %q; status=${PIPESTATUS[0]}; cmux trigger-flash --surface %q; exit $status\n' \
  "$PWD" "$(cat "$prompt")" "$result" "surface:<id>"
cmux send --surface "surface:<id>" "$cmd"
```

Parent may continue independent work, then read `$result` once present and non-empty. Do not busy-wait. If result needed before response, poll with bounded sleep and clear timeout; report child surface/result path on timeout.

## Handoff Format

Ask child final report to contain:

```markdown
# Result
<answer or summary>

# Changes
- path: description

# Verification
- command: outcome

# Risks
- remaining uncertainty, or none
```

## Failure Handling

- Missing `CMUX_WORKSPACE_ID` or `cmux`: do not silently fall back to in-process delegation. Work directly or tell user delegation unavailable.
- Pane creation/send failure: report exact command error. Do not focus UI as workaround.
- Child fails: inspect visible pane/result, then retry with corrected prompt in same helper pane when appropriate.
