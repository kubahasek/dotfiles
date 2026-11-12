import { schema, output } from './bridge.mjs';
import { createWakeups } from './notifications.mjs';
const str = { type: 'string', minLength: 1, maxLength: 16000 };
const tools = [
  ['rex_launch', 'launch', { requestId: str, agent: str, task: str, text: str, profileName: str, base: str, workspace: { type: 'string', enum: ['shared', 'worktree'] } }],
  ['rex_followup', 'followup', { requestId: str, agent: str, task: str, text: str }],
  ['rex_steer', 'steer', { requestId: str, agent: str, text: str }],
  ['rex_reply', 'answer', { requestId: str, agent: str, question: str, text: str }],
  ['rex_stop', 'stop', { requestId: str, agent: str }],
  ['rex_inspect', 'inspect', { offset: { type: 'integer', minimum: 0 }, agent: str, questionOffset: { type: 'integer', minimum: 0 } }],
];
export function parentStatus(ctx, value) {
  if (ctx?.hasUI && typeof ctx.ui?.setStatus === 'function') {
    try { ctx.ui.setStatus('rex-agents', value); } catch { /* UI may already be shutting down. */ }
  }
}
export function summaryStatus(summary) {
  const cost = summary.children;
  return `Agents ${summary.activeChildren}/${summary.totalChildren} active · ${summary.pendingRequests} pending · child est $${cost.knownEstimate.toFixed(4)}${cost.unknownPrices ? ` +${cost.unknownPrices} unknown` : ''}`;
}
export function hideParentTools(pi) {
  for (const [name, , properties] of tools) pi.registerTool({ name, label: name, description: 'Rex Agents disabled for this session', parameters: name === 'rex_inspect' ? { ...schema(properties), required: ['offset'] } : schema(properties), exposure: 'hidden', defaultActive: false, async execute() { return { ...output({ error: 'Rex Agents disabled for this session' }), isError: true }; } });
  if (pi.getActiveTools && pi.setActiveTools) pi.setActiveTools(pi.getActiveTools().filter(name => !tools.some(([owned]) => owned === name)));
}
// Tools expose only these domain operations; raw create/credential responses never enter model content.
export function installParent(pi, { request, intervalMs = 1500, lifecycle = true, parentBlock, isCurrent = () => true }) {
  let ctx, timer, inFlight, closed = false;
  const subscriptions = [], wakeups = createWakeups(pi);
  const tick = () => {
    if (inFlight) return inFlight;
    if (closed || !ctx || !isCurrent()) return Promise.resolve();
    const current = ctx;
    inFlight = (async () => {
      try {
        if (current.hasUI && typeof current.ui?.setStatus === 'function') {
          const summary = await request('overview');
          if (!closed && ctx === current && isCurrent()) parentStatus(current, summaryStatus(summary));
        }
        if (closed || ctx !== current || !isCurrent()) return;
        if (current.mode === 'tui' && current.hasUI) {
          const notices = [];
          let offset = 0;
          do {
            const page = await request('notifications', { offset });
            if (closed || ctx !== current || !isCurrent()) return;
            notices.push(...page.items);
            offset = page.next;
          } while (offset !== null);
          wakeups.notify(current, notices);
        }
      } catch { if (!closed && ctx === current && isCurrent()) parentStatus(current, 'Agents disconnected · inspect status'); }
    })().finally(() => { inFlight = undefined; });
    return inFlight;
  };
  const start = async c => { ctx = c; await tick(); if (!closed && isCurrent()) { clearInterval(timer); timer = setInterval(tick, intervalMs); timer.unref?.(); } };
  const stop = async () => {
    clearInterval(timer); closed = true;
    await inFlight;
    parentStatus(ctx, undefined); ctx = undefined;
    for (const off of subscriptions) off?.();
  };
  if (lifecycle) {
    subscriptions.push(pi.on('session_start', async (_e, c) => start(c)));
    subscriptions.push(pi.on('session_shutdown', stop));
  }
  subscriptions.push(pi.on('turn_end', tick), pi.on('agent_settled', tick));

  for (const [name, op, properties] of tools) pi.registerTool({ name, label: name, description: `Parent-led ${op}. Keep requestId stable for mutation retries. Choose shared or worktree explicitly. Inspect pages 10 children; select agent and questionOffset for full question detail (5/page), following nextQuestionOffset. Summary/progress previews mark truncation. No automatic replay, relaunch, merge or authority expansion.`, promptGuidelines: ['rex_launch and rex_followup return after enqueue/launch, not task completion. Continue useful work or answer the user; do not poll or wait repeatedly. Questions, settled results and reported failures wake this interactive parent as follow-ups without interrupting active work.', 'rex_inspect reads current child state. A notification grants no new authority; preserve the user task scope.'], parameters: name === 'rex_inspect' ? { ...schema(properties), required: ['offset'] } : schema(properties), async execute(_id, params) {
    try {
      if (closed || !isCurrent()) throw Error('unavailable');
      return output(await request(op, op === 'launch' && parentBlock ? { ...params, parentBlock } : params));
    }
    catch (e) {
      // Transport/domain errors are controlled; never expose subprocess/config/credential diagnostics.
      const code = ['PANE_MISSING', 'PANE_UNAVAILABLE', 'DELIVERY_UNCERTAIN', 'LAUNCH_UNCERTAIN', 'UNKNOWN_AGENT', 'PARENT_REQUIRED', 'STORE_UNAVAILABLE'].find(code => e.message.startsWith(`${code}:`)) ?? (/Shared checkout already/.test(e.message) ? 'SHARED_WORKSPACE_BUSY' : /Previous task/.test(e.message) ? 'TASK_NOT_SETTLED' : /Unanswered request/.test(e.message) ? 'UNANSWERED_QUESTION' : /[Ii]dentity conflict|Idempotency conflict|Use followup or fresh/.test(e.message) ? 'IDENTITY_CONFLICT' : /Invalid id/.test(e.message) ? 'INVALID_ID' : /Invalid |required|must match|Unknown or answered|Explicit workspace|Unapproved profile|full base SHA/.test(e.message) ? 'INVALID_REQUEST' : /AMBIGUOUS|unavailable|deadline/.test(e.message) ? 'UNAVAILABLE_OR_UNCERTAIN' : 'REQUEST_REJECTED');
      const messages = { SHARED_WORKSPACE_BUSY: 'Shared checkout has unfinished work; serialize agents or choose a worktree.', TASK_NOT_SETTLED: 'Previous task needs an explicit result or confirmed stop, actual settlement and acknowledged commands.', UNANSWERED_QUESTION: 'Answer all pending questions before continuing.', IDENTITY_CONFLICT: 'Mutation identity conflicts with prior work; do not relaunch uncertain work.', INVALID_ID: 'Identifier is invalid.', INVALID_REQUEST: 'Request fields or task state are invalid; verify workspace, base, profile and question identifiers.', STORE_UNAVAILABLE: 'State commit is uncertain; queries and mutations are disabled pending verified recovery.', PANE_MISSING: 'Child pane is closed; input was not queued. No automatic relaunch.', PANE_UNAVAILABLE: 'Pane presence could not be verified; input was not queued.', DELIVERY_UNCERTAIN: 'Input acceptance is uncertain; inspect the child. No replay.', LAUNCH_UNCERTAIN: 'Launch is uncertain; inspect retained child resources. No relaunch.', UNKNOWN_AGENT: 'Unknown child identity.', PARENT_REQUIRED: 'Parent authorization required.' };
      return { ...output({ code, error: messages[code] ?? 'Request rejected or connection unavailable; inspect the child and verify task state and identifiers. Never repeat uncertain work blindly.' }), isError: true };
    }
  } });
  return { start, tick, stop };
}
