---
id: 5
title: "feat(rex): wake the available parent when children need attention"
status: closed
labels: [enhancement, rex-agents]
mode: AFK
created: 2026-11-12
---

Parent: [#1 — Simplify Rex Agents](001-simplify-rex-agents.md)
Blocked by: [#4 — Simple child cost observability](004-simple-child-cost-observability.md).

## Summary
Keep the parent available for user work while children run. Wake it when a child has a question, result, or failure, without interrupting an active parent run.

## Problem / Motivation
The user explicitly added this requirement during implementation: the parent must not be stuck waiting on subagents, and children must be able to wake it. Launch already returns after pane creation, not task completion; periodic model-driven polling must not be the normal workflow.

## Proposed Solution
Extend the existing lightweight parent polling integration with semantic notifications. Use normal Pi custom-message delivery with `triggerTurn: true` and `deliverAs: "followUp"`: wake an idle parent, or queue behind active work. Coalesce newly observed notices. Keep the six-tool interface; notifications tell the parent to inspect rather than inject raw child reports as instructions.

Use stable notification identities and persisted parent transcript entries to suppress repeated polling/reload notifications. Track queued notices in memory until persistence is observable. No new broker, workflow engine, selective retry framework, or exactly-once claim.

Relevant code: `packages/rex-agents/src/parent.mjs`, `src/session-parent.mjs`, `src/domain.mjs`, and existing Pi host/parent tests.

### Alternatives Considered
- Blocking launch until completion: prevents useful parent work and user conversation.
- Steering/aborting the busy parent: interrupts unrelated user work.
- Model turns for every progress/cost update: unnecessary noise and expense.

### Implementation Constraints
- Wake for questions, explicit results (including failure/incomplete), reported failures, and delivery/launch uncertainty requiring attention.
- Never trigger a model turn solely for progress, heartbeat, or cost changes.
- Do not start model turns in headless/non-interactive sessions.
- Do not copy child report/question text into automatic instructions; use bounded identity/status metadata and inspection.
- Do not automatically launch more agents, merge changes, close panes, or expand task scope.
- Respect parent session replacement/shutdown; stale polling must not notify a new session.
- Keep existing active configuration/global instructions unchanged.

## Acceptance Criteria
- [x] Control tools return without waiting for child task completion; tool guidance tells the parent to continue useful work or answer the user instead of repeatedly polling.
- [x] A child's question/result/failure wakes an idle interactive parent; the same notice queues as follow-up without aborting or steering a busy parent.
- [x] Repeated polls and reload with persisted notification proof do not duplicate notices; simultaneous notices are coalesced and queued-but-unpersisted notices are not repeatedly queued in one runtime.
- [x] Progress/cost-only updates, headless mode, and stale activation/shutdown trigger no parent model turn.
- [x] Deterministic host/queue tests, updated documentation, `npm test`, and `npm run check` pass without paid provider prompts.

## Plan Revision
Added at the user's explicit request during implementation on 2026-11-12. This revises the earlier no-background-model-turn reporting scope only for semantic parent wake-ups; it does not authorize schedules or autonomous integration.
