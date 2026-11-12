import { randomBytes, createHash } from 'node:crypto';
import { combineUsage, tokenKeys } from './usage.mjs';
const token = () => randomBytes(32).toString('hex');
const hash = x => createHash('sha256').update(x).digest('hex');
export const own = (o, k) => Object.hasOwn(o, k) ? o[k] : undefined;
export const id = x => { if (typeof x !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(x) || ['__proto__', 'prototype', 'constructor'].includes(x)) throw Error('Invalid id'); return x; };
export const resourceKey = (group, agent) => `${id(group).length}_${group}_${id(agent)}`;
const text = x => { if (typeof x !== 'string' || !x.length || Buffer.byteLength(x) > 16000) throw Error('Invalid text'); return x; };
export function profile(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).some(k => !['model', 'instructions'].includes(k))) throw Error('Normal Pi profile requires only model and instructions');
  text(p.model); text(p.instructions);
  return structuredClone(p);
}
const agentUsage = a => combineUsage(Object.values(a.usageSnapshots ?? {}).map(s => s.summary));
const page = (rows, r) => {
  const offset = r.offset ?? 0, limit = r.limit ?? 10;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 10) throw Error('Invalid page');
  return { items: structuredClone(rows.slice(offset, offset + limit)), next: offset + limit < rows.length ? offset + limit : null };
};
export function publicAgent(a) {
  return { task: a.task, generation: a.generation, workspace: a.workspace, lifecycle: a.lifecycle, result: a.result, blocked: Object.values(a.requests).some(q => !q.answer), launch: a.launch && { status: a.launch.status, block: a.launch.block, label: a.launch.label }, ambiguities: a.ambiguities ?? {} };
}
export class Domain {
  constructor(store) { this.store = store; this.heartbeats = new Map(); }
  heartbeat(agent) { return this.heartbeats.get(agent) ?? null; }
  query(r, { parent, child, a }) {
    const s = this.store.state;
    const requireParent = () => { if (!parent) throw Error('PARENT_REQUIRED: Parent required'); };
    const owned = () => { if (!a || a.group !== r.group) throw Error('UNKNOWN_AGENT: Unknown agent'); };
    const agents = Object.entries(s.agents).filter(([, a]) => a.group === r.group);
    const childrenUsage = () => combineUsage(agents.map(([, a]) => agentUsage(a)));
    const inspection = (agent, value) => {
      const questions = Object.entries(value.requests).filter(([, q]) => !q.answer), offset = r.questionOffset ?? 0;
      if (!Number.isSafeInteger(offset) || offset < 0 || (offset && !r.agent)) throw Error('Invalid question offset; select agent for detail');
      const detail = !!r.agent, size = detail ? 5 : 2;
      return { agent, ...publicAgent(value), result: value.result && { ...value.result, report: detail ? value.result.report : value.result.report.slice(0, 512) }, resultTruncated: !!value.result && !detail && value.result.report.length > 512, usage: agentUsage(value), pendingQuestionCount: questions.length, pendingQuestions: questions.slice(offset, offset + size).map(([question, q]) => ({ question, kind: q.kind, task: q.task, generation: q.generation, text: detail ? q.text : q.text.slice(0, 128), scope: detail ? q.scope : q.scope.slice(0, 128), truncated: !detail && (q.text.length > 128 || q.scope.length > 128) })), nextQuestionOffset: offset + size < questions.length ? offset + size : null, recentProgress: s.events.filter(e => e.group === r.group && e.agent === agent && e.kind === 'progress').slice(-5).map(e => ({ id: e.id, task: e.task, generation: e.generation, text: e.text.slice(0, 256), truncated: e.text.length > 256 })), pendingCommandCount: value.commands.filter(c => !c.ack).length, deliveryUncertain: !!value.ambiguities?.delivery, launchUncertain: value.launch?.status !== 'recorded', stopConfirmed: value.stopConfirmed === true };
    };
    switch (r.op) {
      case 'hello':
        owned(); if (!child || r.generation !== a.generation || r.task !== a.task) throw Error('STALE_GENERATION: Stale task generation');
        this.heartbeats.set(r.agent, Date.now()); return publicAgent(a);
      case 'poll': owned(); return { agent: publicAgent(a), commands: page(a.commands.filter(c => !c.ack).sort((x, y) => Number(y.type === 'stop') - Number(x.type === 'stop')), { ...r, limit: 5 }) };
      case 'answer-inbox': {
        owned(); const replies = a.commands.filter(c => !c.ack && c.type === 'answer');
        const overflow = replies.length > 64 || replies.reduce((n, c) => n + Buffer.byteLength(c.text), 0) > 256000 || Buffer.byteLength(JSON.stringify(replies)) > 400000;
        return { agent: publicAgent(a), items: overflow ? [] : structuredClone(replies), overflow };
      }
      case 'inspect':
        requireParent(); if (r.agent) owned();
        return page(agents.filter(([agent]) => !r.agent || agent === r.agent).map(([agent, value]) => inspection(agent, value)), r);
      case 'notifications': {
        requireParent();
        const notices = [];
        for (const [agent, value] of agents) {
          const add = (kind, detail = '') => notices.push({ id: hash(JSON.stringify([r.group, agent, value.generation, kind, detail])), agent, task: value.task, generation: value.generation, kind });
          for (const [question, q] of Object.entries(value.requests)) if (!q.answer) add('question', question);
          if (value.result && ['idle', 'stopped'].includes(value.lifecycle)) add('result', value.result.status);
          if (s.events.some(e => e.group === r.group && e.agent === agent && e.generation === value.generation && e.kind === 'failure')) add('failure');
          if (Object.keys(value.ambiguities ?? {}).length) add('uncertainty');
        }
        return page(notices, r);
      }
      case 'status': requireParent(); return page(agents.map(([agent, a]) => ({ agent, ...publicAgent(a) })), r);
      case 'events': requireParent(); return page(s.events.filter(e => e.group === r.group && (!r.agent || e.agent === r.agent)), r);
      case 'overview': requireParent(); return { totalChildren: agents.length, activeChildren: agents.filter(([, a]) => !['idle', 'stopped'].includes(a.lifecycle)).length, pendingRequests: agents.reduce((n, [, a]) => n + Object.values(a.requests).filter(q => !q.answer).length, 0), children: childrenUsage() };
    }
  }
  bootstrap(group, suppliedSecret) {
    id(group);
    return this.store.transaction(s => { const secret = suppliedSecret ?? token(); if (own(s.groups, group)) { if (suppliedSecret && s.groups[group].secret === hash(secret)) return secret; throw Error('Group exists'); } s.groups[group] = { secret: hash(secret) }; return secret; });
  }
  authorize(r) {
    if (!r || Buffer.byteLength(JSON.stringify(r)) > 64000) throw Error('Input too large');
    id(r.group); id(r.requestId); if (r.agent !== undefined) id(r.agent);
    const s = this.store.state, a = own(s.agents, r.agent), parent = own(s.groups, r.group)?.secret === hash(String(r.token));
    const child = a?.group === r.group && a.secret === hash(String(r.token));
    if (!parent && !child) throw Error('Unauthorized');
    return { parent, child, a };
  }
  dispatch(r) {
    if (this.store.failed) throw Error('Store fail-stop; verify retained state before restart');
    const auth = this.authorize(r), { parent, child } = auth, s = this.store.state;
    if (['hello', 'poll', 'answer-inbox', 'inspect', 'notifications', 'status', 'events', 'overview'].includes(r.op)) return structuredClone(this.query(r, auth));
    if (r.op === 'usage-snapshot') {
      const { a } = auth;
      if (!child || parent || !a || a.group !== r.group) throw Error('Child required');
      id(r.session);
      const u = r.summary;
      if (!Number.isSafeInteger(r.revision) || r.revision < 1 || !u || !Number.isSafeInteger(u.messages) || u.messages < 0 || !Number.isSafeInteger(u.unknownPrices) || u.unknownPrices < 0 || u.unknownPrices > u.messages || !Number.isFinite(u.knownEstimate) || u.knownEstimate < 0 || !u.tokens || tokenKeys.some(k => !Number.isSafeInteger(u.tokens[k]) || u.tokens[k] < 0)) throw Error('Invalid usage snapshot');
      const summary = combineUsage([u]);
      const previous = a.usageSnapshots?.[r.session];
      if (previous && r.revision <= previous.revision) {
        if (r.revision === previous.revision && JSON.stringify(summary) !== JSON.stringify(previous.summary)) throw Error('Usage snapshot conflict');
        return { ok: true };
      }
      return this.store.transaction(n => {
        (n.agents[r.agent].usageSnapshots ??= {})[r.session] = { revision: r.revision, summary };
        return { ok: true };
      });
    }
    const key = JSON.stringify([r.group, parent ? ['parent'] : ['child', r.agent], r.requestId]);
    const fingerprint = hash(JSON.stringify({ ...r, token: undefined }));
    const receipt = own(s.receipts, key);
    if (receipt) { if (receipt.fingerprint !== fingerprint) throw Error('Idempotency conflict'); return structuredClone(receipt.value); }
    return this.store.transaction(n => {
      const a = own(n.agents, r.agent);
      const requireParent = () => { if (!parent) throw Error('Parent required'); };
      const owned = () => { if (!a || a.group !== r.group) throw Error('Unknown agent'); };
      const current = () => { owned(); if (!child) throw Error('Child required'); if (r.generation !== a.generation || r.task !== a.task) throw Error('Stale task generation'); };
      const command = (type, body = {}) => a.commands.push({ id: r.requestId, type, task: a.task, generation: a.generation, ack: false, ...body });
      let value = { ok: true };
      switch (r.op) {
        case 'create': {
          requireParent(); id(r.agent); id(r.task); if (a) throw Error('Use followup or fresh agent id');
          const p = profile(r.profile), secret = token();
          n.agents[r.agent] = { group: r.group, task: r.task, generation: 1, profile: p, secret: hash(secret), lifecycle: 'planned', result: null, requests: {}, commands: [], launch: null };
          value = { token: secret }; break;
        }
        case 'launch-intent':
          requireParent(); owned(); if (a.launch) throw Error('Launch already reserved; inspect retained child');
          a.launch = { label: `rex-agent-${resourceKey(r.group, r.agent)}`, status: 'pending' }; break;
        case 'launch-record':
          requireParent(); owned(); if (!a.launch) throw Error('No intent');
          a.launch = { ...a.launch, status: 'recorded', block: text(r.block) };
          if (a.lifecycle === 'planned') a.lifecycle = 'starting'; break;
        case 'ambiguous':
          owned(); if (!parent) current(); (a.ambiguities ??= {})[parent ? 'launch' : 'delivery'] = true; a.lifecycle = 'AMBIGUOUS'; if (parent && a.launch) a.launch.status = 'AMBIGUOUS'; break;
        case 'task':
          requireParent(); owned(); if (a.lifecycle !== 'starting' && a.lifecycle !== 'planned') throw Error('Initial task already started');
          if (a.commands.length) throw Error('Initial task already queued'); command('task', { text: text(r.text) }); a.lifecycle = 'queued'; break;
        case 'followup':
          requireParent(); owned(); id(r.task); text(r.text);
          if (Object.values(a.requests).some(q => !q.answer)) throw Error('Unanswered request');
          if (!['idle', 'stopped'].includes(a.lifecycle) || (!a.result && !a.stopConfirmed) || a.commands.some(c => !c.ack)) throw Error('Previous task must be settled, reported, and acknowledged');
          a.task = r.task; a.generation++; a.stopConfirmed = false; a.result = null; a.requests = {}; command('followup', { text: r.text }); a.lifecycle = 'queued'; break;
        case 'steer':
          requireParent(); owned(); if (a.ambiguities?.delivery || a.ambiguities?.launch) throw Error('DELIVERY_UNCERTAIN: Inspect child; uncertain input will not be replayed');
          if (a.result || a.stopConfirmed || a.commands.some(c => c.type === 'stop' && !c.ack)) throw Error('Previous task is complete or stopping; use followup after settlement');
          command('steer', { text: text(r.text) }); break;
        case 'stop':
          requireParent(); owned(); command('stop'); break;
        case 'ack':
          current(); { const c = a.commands.find(c => c.id === r.command); if (!c || c.generation !== r.generation) throw Error('Unknown command'); c.ack = true; } break;
        case 'request':
          current(); id(r.question); if (!['question', 'approval', 'permission'].includes(r.kind)) throw Error('Invalid request kind');
          if (own(a.requests, r.question)) throw Error('Request exists');
          a.requests[r.question] = { kind: r.kind, text: text(r.text), scope: text(r.scope), task: a.task, generation: a.generation, answer: null };
          a.lifecycle = 'blocked'; break;
        case 'answer':
          requireParent(); owned(); id(r.question);
          { const q = own(a.requests, r.question); if (!q || q.answer) throw Error('Unknown or answered request'); q.answer = text(r.text); if (!Object.values(a.requests).some(q => !q.answer)) a.lifecycle = 'running'; command('answer', { text: q.answer, question: r.question }); }
          break;
        case 'event':
          current();
          if (!['progress', 'running', 'idle', 'stopped', 'failure', 'manual', 'retry'].includes(r.kind)) throw Error('Invalid event');
          if (r.kind === 'stopped') { if (!a.commands.some(c => c.type === 'stop' && c.generation === a.generation)) throw Error('STOP_NOT_REQUESTED: No cooperative stop requested'); a.stopConfirmed = true; }
          if (['running', 'idle', 'stopped'].includes(r.kind) && !['blocked', 'AMBIGUOUS'].includes(a.lifecycle)) a.lifecycle = r.kind;
          n.events.push({ group: r.group, agent: r.agent, task: a.task, generation: a.generation, kind: r.kind, text: text(r.text), id: r.requestId }); break;
        case 'result':
          current(); if (Object.values(a.requests).some(q => !q.answer)) throw Error('Unanswered request');
          if (a.commands.some(c => c.type === 'steer' && !c.ack)) throw Error('Invalid result: pending steering must be accepted first');
          if (!['success', 'failure', 'incomplete'].includes(r.status)) throw Error('Invalid result'); a.result = { task: a.task, generation: a.generation, status: r.status, report: text(r.text) }; break;
        default: throw Error('Unknown operation');
      }
      n.receipts[key] = { fingerprint, value: structuredClone(value) }; return value;
    });
  }
}
