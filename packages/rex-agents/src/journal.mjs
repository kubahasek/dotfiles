import { randomUUID, createHash } from 'node:crypto';
import { Store } from './storage.mjs';
// Only explicit protocol rejection is permanent. Socket/deadline/write uncertainty retries.
export function permanent(error) {
  return error.code === 'REJECTED' || /^(Request exists|Invalid |Unknown command|Unanswered request|Stale task generation|Usage snapshot conflict|Idempotency conflict)/.test(error.message);
}
export class Journal {
  constructor(dir) {
    this.store = new Store(dir, undefined, 'bridge');
    if (!this.store.state.outbox) this.store.transaction(s => { Object.assign(s, { outbox: [], rejected: [], deliveries: {}, usageSnapshots: {}, active: null, pause: false }); return null; });
  }
  get state() { return this.store.state; }
  update(fn) { return this.store.transaction(fn); }
  enqueue(op, payload, identity) {
    const request = { ...payload, op, ...identity, requestId: randomUUID() };
    this.update(s => { s.outbox.push(request); return null; }); return request.requestId;
  }
  flush(send) {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.drain(send).finally(() => { this.flushPromise = undefined; });
    return this.flushPromise;
  }
  async drain(send) {
    // Drain arrivals during an in-flight submission too. Concurrent question
    // reporters and the control pump wait for the same durable report frontier.
    while (this.state.outbox.length) {
      const r = this.state.outbox[0];
      try { await send(r); }
      catch (e) {
        if (permanent(e)) {
          this.update(s => { (s.rejected ??= []).push({ request: r, reason: e.message }); s.outbox = s.outbox.filter(x => x.requestId !== r.requestId); return null; }); continue;
        }
        throw e;
      }
      this.update(s => { s.outbox = s.outbox.filter(x => x.requestId !== r.requestId); return null; });
    }
  }
}
export function marker(command) { return `[rex:${command.id}:${command.generation}]`; }
export function delivered(entries, command) {
  const prefix = `${marker(command)}\n`;
  return entries.some(e => e.type === 'message' && e.message.role === 'user' && (typeof e.message.content === 'string' ? e.message.content : e.message.content.filter(c => c.type === 'text').map(c => c.text).join('')).startsWith(prefix));
}
// Live attempts are volatile on purpose. After restart a local sent flag does not
// prove acceptance; only the actual persisted Pi user entry can release the ACK.
export class Delivery {
  constructor(journal) { this.journal = journal; this.live = new Map(); }
  observe(ctx, command, queue) {
    const batch = this.journal.state.answerBatches?.[this.journal.state.deliveries[command.id]?.batchId];
    const proof = [command, batch].filter(Boolean).find(candidate => delivered(ctx.sessionManager.getEntries(), candidate));
    if (!proof) return false;
    for (const member of command.members ?? [command.id]) queue('ack', { command: member });
    this.live.delete(proof.id); return true;
  }
  prepareAnswers(commands) {
    const j = this.journal;
    if (!commands.length || new Set(commands.map(c => c.id)).size !== commands.length || commands.some(c => c.task !== commands[0].task || c.generation !== commands[0].generation)) throw Error('Invalid answer batch');
    const previous = commands.map(c => j.state.deliveries[c.id]?.batchId).filter(Boolean);
    if (previous.length) {
      if (new Set(previous).size !== 1) throw Error('DELIVERY_UNCERTAIN: Conflicting answer batch');
      return j.state.answerBatches[previous[0]];
    }
    const text = commands.map(c => `Question ${c.question}:\n${c.text}`).join('\n\n');
    if (commands.length > 64 || Buffer.byteLength(text) > 256000) throw Error('Answer batch exceeds bounded delivery');
    const body = { type: 'answer', task: commands[0].task, generation: commands[0].generation, text, members: commands.map(c => c.id) };
    const batch = { id: `answers-${createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32)}`, ...body };
    j.update(s => {
      (s.answerBatches ??= {})[batch.id] = batch;
      for (const c of commands) s.deliveries[c.id] = { batchId: batch.id };
      return null;
    });
    return batch;
  }
  async deliver(pi, ctx, command, queue, { now = Date.now() } = {}) {
    const j = this.journal;
    if (this.observe(ctx, command, queue)) return 'observed';
    const previous = j.state.deliveries[command.id];
    if (previous) {
      const started = this.live.get(command.id);
      if (started !== undefined && (!ctx.isIdle() || ctx.hasPendingMessages?.() || now - started < 1000)) return 'pending';
      queue('ambiguous'); return 'AMBIGUOUS';
    }
    j.update(s => { s.deliveries[command.id] = { phase: 'attempting', generation: command.generation }; return null; });
    this.live.set(command.id, now);
    pi.appendEntry('rex-delivery', { command: command.id, generation: command.generation, phase: 'intent' });
    try {
      pi.sendUserMessage(`${marker(command)}\n${command.text}`, { deliverAs: command.type === 'steer' || command.type === 'answer' ? 'steer' : 'followUp' });
    } catch { this.live.delete(command.id); queue('ambiguous'); return 'AMBIGUOUS'; }
    j.update(s => { s.deliveries[command.id].phase = 'submitted'; return null; });
    return 'pending'; // API is void; never ACK its return.
  }
}
