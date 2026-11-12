---
id: 3
title: "refactor(rex): simplify reusable child interaction and inspection"
status: closed
labels: [enhancement, rex-agents]
mode: AFK
created: 2026-11-12
---

Parent: [#1 — Simplify Rex Agents](001-simplify-rex-agents.md)
Blocked by: [#2 — Normal Pi launch and reconnect](002-normal-pi-launch-and-reconnect.md).

## Summary
Provide a small parent interface for controlling reusable children and inspecting their state.

## Problem / Motivation
Thirteen tools and selective-retry recovery expose too much internal machinery to the parent. The user wants reusable children, not a general delivery-recovery service.

## Proposed Solution
Expose launch, follow-up, steer, reply, stop, and inspect. Inspection combines lifecycle, pending questions, explicit results, pane presence, and delivery uncertainty. Leave room for the usage fields added by #4.

Simplify `src/parent.mjs`, `src/bridge.mjs`, `src/journal.mjs`, and `src/domain.mjs` under `packages/rex-agents/`. Adjust coordinator and session-parent integration where required. Remove selective answer-batch retry and reconciliation interfaces. Do not remove safe handling of multiple questions merely because selective retry is retired.

Keep only the persistence needed to support the approved lifecycle. Live queries must not acquire immutable durable receipts.

### Alternatives Considered
Automatically replay uncertain commands: rejected because it can repeat work. Preserve member-scoped selective retries: rejected because the user accepted inspection instead of automatic replay.

### Implementation Constraints
- A result is not proof of process settlement.
- Preserve stale-task rejection and duplicate-launch protection.
- Keep status queries read-only: no permanent receipt or snapshot write for each inspection.
- Return specific safe error codes; never expose raw credential or subprocess diagnostics.
- Reuse the same child conversation, workspace, and open pane for follow-up work.
- Keep pane cleanup parent-managed after the result is accepted and no follow-up remains. Preserve transcripts, branches, and worktrees.
- Do not send follow-ups to a closed pane without explicit resumption.
- Normal Pi tools/authentication remain as established by #2; do not reintroduce custom isolation.
- Do not change active global configuration or instructions.

## Acceptance Criteria
- [x] A child completes a task, receives a follow-up in the same conversation/pane, and reports another result.
- [x] Steering, question/reply, and cooperative stop work through the parent interface.
- [x] Uncertain delivery is visible and never automatically replayed; selective-retry machinery is removed.
- [x] Repeated inspection does not grow persisted receipts or rewrite state; pane cleanup remains parent-managed.
- [x] Interaction/restart tests, documentation, `npm test`, and `npm run check` pass.

## Verification
Use the existing loop, answer-retry, recovery, core, and parent tests as regression evidence. Update tests for deliberately removed APIs rather than preserving those APIs for tests. Cover multiple pending questions, delayed old-task events, parent reconnect, delivery uncertainty, and actual abort settlement with deterministic fixtures.
```sh
cd packages/rex-agents
npm test
npm run check
```
Do not run lint or paid provider prompts.
