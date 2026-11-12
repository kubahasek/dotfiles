---
id: 1
title: "refactor(rex): simplify parent-led subagents in Rex panes"
status: closed
labels: [enhancement, rex-agents]
mode: AFK
created: 2026-11-12
---

## Summary
Reduce Rex Agents to a thin integration around normal Pi sessions. Preserve persistent, reusable children and simple cost observability.

## Problem / Motivation
The current implementation combines pane management with custom authentication, enforced runtime restrictions, and selective delivery recovery. The required product is simpler: launch children, interact with them, inspect results, and see estimated costs.

## Proposed Solution
Complete the following four sub-issues in order. Remove superseded code within each slice rather than maintaining two permanent implementations.

### Sub-issues
- [x] [#2 — Normal Pi launch and reconnect](002-normal-pi-launch-and-reconnect.md)
- [x] [#3 — Reusable interaction and inspection](003-reusable-interaction-and-inspection.md)
- [x] [#4 — Simple child cost observability](004-simple-child-cost-observability.md)
- [x] [#5 — Nonblocking parent wake-ups](005-nonblocking-parent-wakeups.md)

### Dependency Order
```text
#2 Normal Pi launch + reconnect
└─ #3 Reusable interaction + inspection
   └─ #4 Simple cost observability
      └─ #5 Nonblocking parent wake-ups
```

### Alternatives Considered
- Preserve all guarantees and only refactor internals: retains most complexity.
- Stop children when the parent exits: rejected; children must survive disconnection.
- One-shot children: rejected; conversations and panes must support reuse.

### Implementation Constraints
- Preserve explicit shared-checkout/worktree selection.
- Preserve pane-first placement, focus, and unrelated panes.
- Never automatically merge, reset, discard, or delete retained work.
- No changes to active global settings, agent definitions, or instructions.
- Retain old state safely; never silently reinterpret incompatible records.
- Do not reinstall retired orchestration or add a workflow engine.
- Use synthetic/offline tests; paid provider prompts require separate approval.

## Acceptance Criteria
- [x] All four sub-issues complete.
- [x] One supported child startup path and simplified parent interface remain.
- [x] Package tests and syntax checks pass: `cd packages/rex-agents && npm test && npm run check`. Do not run lint.
- [x] README and architecture documentation describe the new behavior and compatibility limits.

## Plan Revision
The user added nonblocking parent use and child-triggered wake-ups during implementation on 2026-11-12. Issue #5 adds semantic follow-up notifications without interrupting active parent work; progress and cost updates remain passive.

## Completion
All four implementation slices are complete on the isolated implementation branch. Final validation: 78 tests passed with zero skips; all-source line coverage 98.01%; syntax checks and the real offline Rex exercise passed. Fresh read-only review passed after fixing a parent session-replacement wake-up race. Active configuration and the original checkout remain unchanged; activation requires separate operator approval.

See [package documentation](../../packages/rex-agents/README.md) for the supported interface and version transition.

## Authorization
The user approved these drafts and requested local Markdown issues. This authorizes recording the issues, not implementation, active configuration changes, publication, or deployment.
