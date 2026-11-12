import { randomUUID } from 'node:crypto';
import { id } from './domain.mjs';
import { Delivery } from './journal.mjs';
import { ingestUsage } from './usage.mjs';
const string = { type: 'string', minLength: 1, maxLength: 16000 };
export const schema = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
export const output = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], details: value });
export const childToolNames = ['rex_progress', 'rex_question', 'rex_result'];
export function installChild(pi, { journal, send, group, agent, intervalMs = 750, knownFreeModels = [] }) {
  let context, timer, pumping = false, blocked = true, ambiguous = false, stopping = false, stopped = false, pendingPump = false;
  const delivery = new Delivery(journal), stoppingCommands = new Map();
  let providerFailed = false;
  const identity = () => ({ group, agent, ...journal.state.active });
  const queue = (op, data = {}) => journal.enqueue(op, data, identity());
  const flush = () => journal.flush(send);
  const query = (op, data = {}) => send({ ...data, ...identity(), op, requestId: randomUUID() });
  const pause = value => journal.update(s => { s.pause = value; return null; });
  const ready = async ctx => {
    const state = await query('poll'); blocked = state.agent.blocked; ambiguous = state.agent.lifecycle === 'AMBIGUOUS';
    return state.agent.generation === journal.state.active?.generation && !blocked && !ambiguous && !stopping && !stopped && !journal.state.pause;
  };
  const scanUsage = () => { if (context && journal.state.active) ingestUsage(context, journal, queue, { identity: identity(), knownFreeModels }); };
  const settleStops = () => {
    if (!context?.isIdle()) return;
    for (const c of stoppingCommands.values()) {
      queue('event', { kind: 'stopped', text: 'Abort requested and Pi observed idle; TUI retained' }); queue('ack', { command: c.id });
    }
    if (stoppingCommands.size) { stoppingCommands.clear(); stopping = false; stopped = true; }
  };
  const pump = async () => {
    if (!context) return; if (pumping) { pendingPump = true; return; } pumping = true;
    try {
      // Permanent report rejections are quarantined; transport uncertainty must
      // not prevent a fresh control poll (particularly stop).
      try { await flush(); } catch {}
      const state = await query('poll');
      blocked = state.agent.blocked; ambiguous = state.agent.lifecycle === 'AMBIGUOUS';
      const commands = state.commands.items;
      // Control is orthogonal to delivery ambiguity/pause and always runs first.
      for (const c of commands.filter(c => c.type === 'stop')) {
        stoppingCommands.set(c.id, c); stopping = true; pause(true); context.abort(); // void; NOT settlement
      }
      settleStops();
      if (stopped && commands.some(c => c.type === 'followup' && c.generation !== journal.state.active?.generation)) stopped = false;
      // All ready answers enter ONE persisted user message before any provider
      // resumption. TUI abort restores/clears queued steering, so sequential
      // answer prompts are not safe even when each send uses an explicit mode.
      let answerSubmitted = false;
      if (!stopping && !stopped && !blocked && context.isIdle() && !journal.state.outbox.some(r => r.op === 'request')) {
        const inbox = await query('answer-inbox');
        if (inbox.overflow) queue('event', { kind: 'failure', text: 'Answer batch exceeds reply, byte or transport limits; replies retained for parent intervention' });
        else if (!inbox.agent.blocked && inbox.agent.generation === journal.state.active?.generation) {
          const replies = inbox.items.filter(c => !delivery.observe(context, c, queue));
          if (replies.length && !ambiguous) {
            try {
              const batch = delivery.prepareAnswers(replies); pause(false);
              const outcome = await delivery.deliver(pi, context, batch, queue);
              answerSubmitted = outcome === 'pending'; if (outcome === 'AMBIGUOUS') ambiguous = true;
            } catch (e) {
              queue('ambiguous'); ambiguous = true;
              queue('event', { kind: 'failure', text: 'Answer delivery uncertain; retained without replay' });
            }
          }
        }
      }
      for (const c of commands.filter(c => c.type !== 'stop')) {
        if (delivery.observe(context, c, queue)) continue;
        if (c.type === 'answer' || answerSubmitted) continue;
        if (stopping || stopped || blocked || journal.state.outbox.some(r => r.op === 'request' && r.generation === journal.state.active?.generation) || ambiguous) continue;
        if (c.generation !== journal.state.active?.generation) {
          if (!context.isIdle() || !['task', 'followup'].includes(c.type)) continue;
          journal.update(s => { s.active = { task: c.task, generation: c.generation }; s.pause = false; return null; });
          pi.appendEntry('rex-task', journal.state.active);
        }
        if (['task', 'followup'].includes(c.type)) pause(false);
        if (journal.state.pause) continue;
        const outcome = await delivery.deliver(pi, context, c, queue);
        if (outcome === 'AMBIGUOUS') ambiguous = true;
        if (outcome === 'pending' || outcome === 'AMBIGUOUS') break; // Serialize dispatch around observed persistence.
      }
      await query('hello'); scanUsage(); try { await flush(); } catch {}
    } catch { /* durable state retained; tools fail closed, no terminal scraping */ }
    finally { pumping = false; if (pendingPump) { pendingPump = false; queueMicrotask(pump); } }
  };
  pi.on('session_start', async (_e, ctx) => {
    context = ctx; const state = await send({ group, agent, op: 'poll', requestId: randomUUID() });
    if (!journal.state.active) { journal.update(s => { s.active = { task: state.agent.task, generation: state.agent.generation }; return null; }); pi.appendEntry('rex-task', journal.state.active); }
    await pump(); timer = setInterval(pump, intervalMs); timer.unref?.();
  });
  pi.on('session_shutdown', async () => { clearInterval(timer); scanUsage(); context = undefined; try { await flush(); } catch {} });
  pi.on('tool_call', async (e, ctx) => {
    try {
      // Sibling reporting tools may already have passed preflight before the
      // first question executes. They remain durable and pause at turn_end.
      if (e.toolName !== 'rex_progress' && !(await ready(ctx))) return { block: true, reason: 'Task paused or awaiting parent', terminate: true };
    } catch (e) { return { block: true, reason: e.message }; }
  });
  pi.on('before_agent_start', async (e, ctx) => {
    if (!(await ready(ctx))) ctx.abort();
  });
  pi.on('before_provider_request', async (_e, ctx) => {
    try { if (!(await ready(ctx))) ctx.abort(); } catch { ctx.abort(); } // Expected pause/disconnect is NOT corruption.
  });
  pi.on('input', e => {
    if (blocked || stopped || stopping || ambiguous || journal.state.pause) return { action: 'handled' };
    if (e.source !== 'extension') queue('event', { kind: 'manual', text: 'Direct human input received (content not logged)' });
    return { action: 'continue' };
  });
  pi.on('message_end', e => {
    if (e.message.role === 'assistant') providerFailed = e.message.stopReason === 'error';
    if (e.message.role === 'user') queueMicrotask(pump);
  });
  pi.on('agent_start', () => queue('event', { kind: 'running', text: 'Pi started' }));
  pi.on('agent_settled', async () => {
    settleStops();
    if (providerFailed && !stopped && !stopping) queue('event', { kind: 'failure', text: 'Pi settled after a provider failure; inspect the child' });
    providerFailed = false;
    if (!stopped && !stopping) queue('event', { kind: 'idle', text: 'Pi settled; not semantic success' });
    scanUsage(); await pump();
  });
  pi.on('auto_retry_start', () => queue('event', { kind: 'retry', text: 'Pi automatic retry' }));
  pi.on('turn_end', (_e, ctx) => {
    // Abort synchronously at the whole-turn boundary, independent of whether
    // every sibling tool result has terminate=true. Never await own idle here.
    if (journal.state.pause || stopping) ctx.abort(); scanUsage();
  });
  for (const [name, op, parameters] of [
    ['rex_progress', 'event', schema({ text: string })],
    ['rex_question', 'request', schema({ question: string, kind: { enum: ['question', 'approval', 'permission'], type: 'string' }, scope: string, text: string })],
    ['rex_result', 'result', schema({ status: { enum: ['success', 'failure', 'incomplete'], type: 'string' }, text: string })],
  ]) pi.registerTool({ name, label: name, description: `Durably report ${op} to parent; no authority expansion`, parameters, async execute(_id, params) {
    if (op === 'request') {
      id(params.question);
      const key = `${journal.state.active.generation}:${params.question}`;
      if (journal.state.questions?.[key]) throw Error('Request exists locally');
      journal.update(s => { (s.questions ??= {})[key] = true; return null; });
    }
    for (const value of Object.values(params)) if (typeof value === 'string' && (!value.length || Buffer.byteLength(value) > 16000)) throw Error('Report fields must be nonempty and <=16000 UTF-8 bytes');
    const receipt = queue(op, op === 'event' ? { kind: 'progress', ...params } : params);
    if (op !== 'event') pause(true);
    try { await flush(); } catch {}
    const rejection = journal.state.rejected?.find(r => r.request.requestId === receipt);
    const steeringPending = rejection?.reason.startsWith('Invalid result: pending steering');
    if (steeringPending) pause(false); // Accepted parent input must run before completion can be reported.
    return { ...output({ queued: !rejection, requestId: receipt, delivery: steeringPending ? 'parent steering pending; process it before reporting result' : rejection ? 'rejected; retained privately' : journal.state.outbox.some(r => r.requestId === receipt) ? 'pending retry' : 'accepted' }), ...(rejection ? { isError: true } : {}), terminate: op !== 'event' && !steeringPending };
  } });
  return { pump };
}
