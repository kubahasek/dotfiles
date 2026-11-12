# Rex Agents — normal Pi, reusable children

Node >=22. Ordinary interactive Pi CLI children run in Rex-owned panes with a detached local coordinator. Normal launch, reusable interaction/inspection and simple cumulative child usage are implemented here.

## Setup and transition

Use `examples/settings.json` for session-aware settings or `examples/operator.json` with `REX_AGENTS_CONFIG=/absolute/private/operator.json pi -e /absolute/package/extensions/parent.ts`. Settings default to `~/.config/rex-agents/settings.json` (or XDG_CONFIG_HOME), overridable with `REX_AGENTS_SETTINGS`. Files must be owned/private (0600); absolute canonical state/worktree roots owned/private (0700). Choose a normal executable Pi CLI and actual provider/model IDs. Profiles contain only initial `model` and appended role `instructions`, not capability ceilings.

Configuration and child descriptors use **version 3**; coordinator/bridge state uses **version 4**. Version-3 accounting state is incompatible and retained unchanged; use new state roots, never rewrite version numbers. Legacy isolated-auth settings/state remain unsupported and must be retained unchanged; provision new private roots instead of changing old state versions. No migration, credential copying/deletion or old runtime cleanup occurs. Existing detached old coordinators/children require compatible runtimes, not replacement launches. Active global settings/instructions are never edited by this package.

Children inherit ordinary HOME/environment/Pi authentication/tools/resources. Rex supplies the initial model, `--append-system-prompt`, persistent session file and child reporting bridge. It does not replace the builtin prompt, create an isolated auth store, enforce models/tool lists, intercept shell use or confine file paths. Role instructions are guidance, not a sandbox. Parent extension registration skips `REX_AGENT_DESCRIPTOR`-managed children to prevent recursion. Never globally register the child extension.

## Six parent tools

- **rex_launch**: `requestId`, fresh `agent`, `task`, `text`, configured `profileName`, full committed `base`, explicit `workspace` (`shared` or `worktree`). No workspace default. Shared uses the current dirty checkout and requires base=HEAD; worktree uses a clean committed base. No stash/reset/copy/merge.
- **rex_followup**: `requestId`, existing `agent`, new `task`, `text`. Reuses the same conversation, workspace and open pane. Requires explicit previous result plus actual idle, or confirmed cooperative stop, and no unanswered questions/pending commands/uncertainty.
- **rex_steer**: `requestId`, `agent`, `text`; queued via Pi steering for ongoing work. Completed or stopping tasks reject steering; use follow-up after settlement.
- **rex_reply**: `requestId`, `agent`, `question`, `text`; durable answer, not an authority grant.
- **rex_stop**: `requestId`, `agent`; cooperative abort. Stop remains available during uncertainty and when a pane is missing, but missing/disconnected children cannot acknowledge it. A queued stop or idle pane alone is not stop proof.
- **rex_inspect**: `offset` (start 0), optional `agent`, optional `questionOffset`. Returns up to 10 children and `next`; includes lifecycle, explicit result, unanswered-question count/previews, recent progress previews, pending-command count, delivery/launch uncertainty, pane presence and heartbeat age. `panePresent:null` means public Rex discovery unavailable, not absence. Heartbeat age is unknown after coordinator restart until a new hello.

Inspection summaries show two question previews per child. Select `agent` for full text/scope detail, five questions per page; follow `nextQuestionOffset` with that same agent and `offset:0` until null. Every pending question remains reachable. Previews explicitly mark truncation. Recent progress is capped at five 256-character previews. Result reports are previewed at 512 characters with `resultTruncated`; select the agent for the full result. This keeps legal reports/questions within transport limits. Questions may change between live pages; inspect again after mutations.

Mutation request IDs remain explicit: reuse the **same complete request** and ID after a lost reply. IDs are bounded ASCII letters/digits/underscore/hyphen, excluding reserved names; launch IDs max60, others max80. Text max16,000 UTF-8 bytes. Inspection is live/read-only and needs no caller-generated mutation ID. No separate status/events/inbox/liveness/ledger/totals/reconciliation model tools exist. Internal read-only control queries and child aggregate snapshot publication support the bridge; obsolete usage/ledger/totals operations are rejected.

Errors use fixed safe categories including `PANE_MISSING`, `PANE_UNAVAILABLE`, `DELIVERY_UNCERTAIN`, `LAUNCH_UNCERTAIN`, `SHARED_WORKSPACE_BUSY`, `TASK_NOT_SETTLED`, `UNANSWERED_QUESTION`, `IDENTITY_CONFLICT`, `INVALID_ID`, `INVALID_REQUEST`, `STORE_UNAVAILABLE`. Raw subprocess/config/credential diagnostics are never returned through tools.

## Lifecycle, delivery and ownership

Parent disconnect leaves coordinator and children running. Resume reconnects to the same durable binding; settings/repository/Rex changes do not overwrite an existing runtime. One active parent controller per identity is required. Rex retains existing pane placement/focus behavior (`panesPerTab` 1..8), owned labels, parent-adjacent splits, managed tabs and overflow.

Every shared role potentially writes. Unfinished shared agents serialize within a coordinator, including followups; parent edits and independent coordinators require operator serialization. No cross-process repository lock is claimed. Normal tools can act at ordinary OS-user authority.

Child `rex_progress`, `rex_question`, `rex_result` durably report through the bridge. Questions pause the whole run until all answers arrive. Multiple ready answers enter one bounded persisted user message so TUI abort cannot drop queued siblings. A result is semantic completion, **not** process settlement. Cooperative stop waits for actual idle after abort before reporting/ACKing stop. Generation checks reject delayed old-task events/results. If steering races with a result, completion is rejected until that accepted steering is processed; it cannot become a stranded command behind a paused result. Terminal provider errors publish safe failure metadata after settlement, without copying raw diagnostics.

Stable input markers and local delivery intent preserve uncertainty across restart. Only an actual persisted marked user message proves acceptance; neither intent nor a void send return is proof. Unproved attempted input is visible uncertainty and is **never replayed automatically**. Selective retries, reconciliation decisions and member retry histories are removed entirely. Stop still works; inspection does not clear uncertainty, adopt missing resources, silently relaunch or grant replay authority. Missing-pane followup/steer/reply reject before queueing input. A duplicate launch never repeats the launch side effect, even if its pane disappeared.

Inspection, polling, overview and heartbeat never rewrite serialized coordinator state or retain query receipts. Heartbeats are ephemeral. All queries and mutations reject if the store is fail-stopped after an uncertain commit. Mutation receipts remain for stable command identity. Pane cleanup is parent-managed only after accepting the result and deciding no followup remains; transcripts/worktrees/branches are retained.

## Available parent and wake-ups

Launch and follow-up return after launch/enqueue, not child task completion. The parent can do other work or answer the user instead of waiting or repeatedly polling.

The existing lightweight polling cadence notices unanswered questions, settled explicit results, reported failures and launch/delivery uncertainty. In interactive TUI mode, new notices enter one bounded custom-message batch using Pi's native follow-up queue. An idle parent starts a turn; a busy parent finishes its active work first, without abort or steering. The parent inspects current state before acting within the approved task scope.

Progress, heartbeat and cost-only changes do not start model turns. Headless/print/JSON/RPC sessions do not receive automatic wake-ups. Notices contain only bounded identity/status metadata, not child report text or permission grants. Stable identities and persisted parent custom messages suppress repeated polls/reloads; a volatile set suppresses notices still queued in this runtime. At most ten notices are coalesced per tick, with later notices handled on later ticks. No exactly-once crash claim or notification retry framework is added. A queued notice may describe an older task by the time it is read; always inspect current generation.

## Child usage estimates

Inspection includes each child's cumulative `usage`: input/output/cacheRead/cacheWrite tokens, message count, `knownEstimate`, `unknownPrices`, and `estimate` (null if any prices are unknown). The existing `rex-agents` status slot shows the combined child known estimate plus an explicit unknown-price count. Estimates are not invoices; a partial known estimate is not a complete total. Missing or all-zero prices are unknown unless the model is explicitly configured known-free.

Children rescan stable session/leaf entry identities (never nested tool-result aggregates), publishing complete per-session snapshots. Repeated scans are idle no-ops; reconnect/retries do not double-count and stale revisions cannot replace newer snapshots. Same-pane followups retain cumulative totals. Only aggregate snapshots are persisted, not entry ledgers or per-task accounting. Children continue publishing while the parent is disconnected. The parent neither scans its own usage nor opens a cost journal; headless parents safely skip the status UI. Existing report/control outboxes remain durable. Receipt/event retention is still unbounded; no historical cleanup is authorized.

## Validation and limits

```sh
cd packages/rex-agents
npm test
npm run check # syntax checks, NOT lint
npm run exercise # optional installed Rex + Pi offline smoke; no paid provider
```

Use deterministic local SDK fixtures and disposable Git/socket/HOME state, never paid prompts. The optional exercise resolves the installed Pi executable (or `PI_HOST_PACKAGE`), creates its own temporary Rex session and coordinator, and runs a local fake provider under an empty credential environment. It verifies question/reply/result, reconnect, same-pane follow-up, focus, read-only inspection, cost totals, stop and closed-pane rejection, then removes only its own fixtures. `PI_HOST_PACKAGE` selects the installed host for SDK tests; unavailable host tests skip. The real offline CLI PTY test follows production child-process startup, asserts heartbeat/zero usage/cooperative stop, and drains the PTY during teardown. The deterministic host queue tests prove that wake-ups wait behind active parent work without aborting it, and also start an idle parent. No real provider call is required.

No exactly-once delivery guarantee, automatic restart, force-kill guarantee, deployment, integration, merge, retention/compaction or credential administration is supplied. Git/Rex calls can block to their timeout. Do not steal daemon locks based solely on PID; verified-dead coordinator recovery and any pane closure require operator authority. Rollback disables only the approved parent extension entry and restarts Pi; preserve unrelated settings/instructions, credentials, state, worktrees and transcripts.
