---
id: 2
title: "refactor(rex): launch normal Pi children and reconnect after parent restart"
status: closed
labels: [enhancement, rex-agents]
mode: AFK
created: 2026-11-12
---

Parent: [#1 — Simplify Rex Agents](001-simplify-rex-agents.md)
Blocked by: none.

## Summary
Launch ordinary interactive Pi children through Rex and reconnect to them after parent disconnection.

## Problem / Motivation
The shared-auth SDK bootstrap duplicates Pi runtime responsibilities and requires a version-specific authentication adapter. The user chose normal Pi authentication and tools instead of enforced runtime isolation.

## Proposed Solution
Use normal Pi startup and authentication instead of rebuilding its credential/runtime stack. Retain a small coordinator and persistent records sufficient to identify each child, workspace, transcript, and pane.

Relevant code under `packages/rex-agents/`:
- `src/child-launch.mjs`, `src/child-process.mjs`, and `src/shared-child-entry.mjs`
- `src/interactive-child.mjs`, `src/shared-auth.mjs`, and `src/pi-host.mjs`
- `src/coordinator.mjs`, `src/client.mjs`, and `src/session-config.mjs`
- `src/bridge.mjs` and `extensions/child.ts` where startup and enforcement interact

Remove obsolete startup/authentication paths as the normal Pi path replaces them. Keep interaction and cost behavior needed by later issues operational; their simplification belongs to #3 and #4.

### Alternatives Considered
Keep both SDK and CLI startup paths: rejected because it retains duplicate lifecycle and compatibility work.

### Implementation Constraints
- Assign the initial model and role instructions without enforcing immutable runtime isolation.
- Use Pi's normal authentication mechanism; do not copy or expose credentials.
- Children must survive parent disconnection and remain interactive in Rex.
- Preserve explicit shared-checkout/worktree choice, uncommitted shared files, owned-pane placement, and focus.
- Preserve existing children and state during the transition. Unsupported legacy records must produce a clear diagnostic, not a replacement launch.
- Do not alter active global settings, agent definitions, or instructions.
- No paid provider prompts or automatic removal of retained state/worktrees.

## Acceptance Criteria
- [x] Launch works with both explicit workspace choices; dirty shared-checkout files remain intact.
- [x] Child runs in an owned Rex pane with existing placement and focus behavior.
- [x] Parent disconnection leaves the child running; resume reconnects without duplication.
- [x] Custom credential adapters, SDK bootstrap, and enforced capability/model guards are removed from the new path.
- [x] Disposable integration tests, updated documentation, `npm test`, and `npm run check` pass from `packages/rex-agents`; no paid prompts are required.

## Verification
Extend the existing recovery, integration, workspace, host, and session-parent test patterns. Replace tests for intentionally retired restrictions with tests for the approved normal-Pi behavior; preserve unrelated regression coverage. Read the installed Pi extension/SDK documentation before changing host integration. Run:
```sh
cd packages/rex-agents
npm test
npm run check
```
The check script performs JavaScript syntax checks, not lint. Do not run lint.
