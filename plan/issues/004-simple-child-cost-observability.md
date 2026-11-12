---
id: 4
title: "feat(rex): show simple transcript-based child usage and cost estimates"
status: closed
labels: [enhancement, rex-agents]
mode: AFK
created: 2026-11-12
---

Parent: [#1 — Simplify Rex Agents](001-simplify-rex-agents.md)
Blocked by: [#3 — Reusable interaction and inspection](003-reusable-interaction-and-inspection.md).

## Summary
Show token usage and estimated cost per child, plus a combined child estimate in the parent status bar.

## Problem / Motivation
Useful cost visibility does not require a durable accounting ledger or per-task financial reporting. The user chose simple reporting initially, with expansion deferred until needed.

## Proposed Solution
Calculate child usage from Pi transcript entries using stable session/entry identity. Expose it through inspection and the existing status slot.

Relevant code under `packages/rex-agents/`:
- `src/usage.mjs`
- `src/parent.mjs`
- Usage-related operations in `src/domain.mjs`
- Child/session integration where usage is collected or refreshed

Reuse transcript leaf-usage semantics and avoid nested tool-result aggregate double-counting. Remove obsolete detailed accounting interfaces and persistence from the supported path without deleting historical data.

### Alternatives Considered
Retain detailed ledger and parent-plus-child accounting: deferred until a concrete need exists. Streaming-only counters: insufficient because reporting must remain correct after reconnect.

### Implementation Constraints
- Estimates are not invoices.
- Missing prices are unknown, not zero.
- Known partial cost must not be presented as a complete total when some prices are unknown.
- Do not add per-task totals, parent-plus-child accounting, budgets, invoice import, or model turns for reporting.
- Preserve the existing status slot rather than replacing the entire Pi footer.
- Headless sessions must remain safe.
- Preserve existing historical data without deletion.
- Do not change active global configuration or instructions.

## Acceptance Criteria
- [x] Inspection shows each child's input, output, cache usage, and estimated cost.
- [x] Parent status shows combined child cost, with an explicit unknown-price count.
- [x] Reconnect and repeated scans do not double-count transcript entries; follow-ups retain cumulative child totals.
- [x] Detailed ledger, per-task totals, and parent-plus-child accounting are absent from the supported interface.
- [x] Synthetic pricing/reconnect tests, documentation, `npm test`, and `npm run check` pass.

## Verification
Extend deterministic usage and parent-status test patterns. Cover priced, unknown-price, and explicitly known-free models; repeated scans; reconnect; follow-up reuse; and headless mode. No actual credentials, invoice data, or paid prompts are needed.
```sh
cd packages/rex-agents
npm test
npm run check
```
Do not run lint.
