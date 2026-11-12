import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createWakeups, wakeupType } from '../src/notifications.mjs';
import { installParent } from '../src/parent.mjs';
import { fixture } from './support.mjs';
import { available, loop, until } from './loop-support.mjs';

const notice = (id, kind = 'question') => ({ id, agent: 'a', task: 't', generation: 1, kind });
const context = entries => ({ mode: 'tui', hasUI: true, sessionManager: { getEntries: () => entries }, ui: { setStatus() {} } });

test('semantic notices are read-only, bounded, authorized and contain no report text', () => {
  const f = fixture();
  try {
    f.childRequest('event', { kind: 'progress', text: 'private progress' });
    f.childRequest('hello');
    assert.deepEqual(f.request('notifications').items, []);
    for (let i = 0; i < 12; i++) f.childRequest('request', { question: `q${i}`, kind: 'question', text: 'private question', scope: 'private scope' });
    const before = fs.readFileSync(f.d.store.file, 'utf8');
    const first = f.request('notifications', { offset: 0 });
    const second = f.request('notifications', { offset: first.next });
    assert.equal(first.items.length, 10); assert.equal(second.items.length, 2);
    assert.equal(new Set([...first.items, ...second.items].map(n => n.id)).size, 12);
    assert.ok(!JSON.stringify(first).includes('private'));
    assert.equal(fs.readFileSync(f.d.store.file, 'utf8'), before);
    assert.throws(() => f.childRequest('notifications'), /Parent required/);
    for (let i = 0; i < 12; i++) f.request('answer', { question: `q${i}`, text: 'Approved fixture answer' });
    f.childRequest('result', { status: 'failure', text: 'private result' });
    assert.equal(f.request('notifications').items.length, 0, 'result notice waits for actual settlement');
    f.childRequest('event', { kind: 'idle', text: 'Settled' });
    assert.equal(f.request('notifications').items[0].kind, 'result');
    f.childRequest('event', { kind: 'failure', text: 'private diagnostic' });
    f.childRequest('ambiguous');
    assert.deepEqual(f.request('notifications').items.map(n => n.kind), ['failure', 'uncertainty']);
    f.d.store.failed = true; assert.throws(() => f.request('notifications'), /fail-stop/);
  } finally { fs.rmSync(f.dir, { recursive: true }); }
});

test('coalesced follow-up notices deduplicate queued and persisted delivery, including reload', () => {
  const entries = [], sent = [], ctx = context(entries);
  let throwing = false;
  const pi = { sendMessage(message, options) { if (throwing) throw Error('Send unavailable'); sent.push({ message, options }); } };
  const wake = createWakeups(pi), notices = [notice('q'), notice('r', 'result')];
  assert.equal(wake.notify(ctx, notices), 2);
  assert.equal(sent.length, 1); assert.deepEqual(sent[0].options, { triggerTurn: true, deliverAs: 'followUp' });
  assert.equal(wake.notify(ctx, notices), 0, 'do not duplicate native queued messages');
  assert.equal(wake.notify({ ...ctx, hasUI: false }, [notice('hidden')]), 0);
  assert.equal(wake.notify({ ...ctx, mode: 'rpc' }, [notice('rpc')]), 0);
  entries.push({ type: 'custom_message', ...sent[0].message });
  assert.equal(createWakeups(pi).notify(ctx, notices), 0, 'persisted transcript proof survives extension reload');
  throwing = true; assert.throws(() => wake.notify(ctx, [notice('retry')]), /Send unavailable/);
  throwing = false; assert.equal(wake.notify(ctx, [notice('retry')]), 1, 'synchronous rejection does not suppress the notice forever');
  const many = Array.from({ length: 15 }, (_, i) => notice(`many-${i}`));
  assert.equal(wake.notify(ctx, many), 10); assert.equal(wake.notify(ctx, many), 5);
});

test('parent paginates notices without blocking task tools and suppresses stale/shutdown wakeups', async () => {
  const sent = [], tools = {}, entries = [], statuses = [];
  const pi = { on() {}, registerTool(t) { tools[t.name] = t; }, sendMessage(message, options) { sent.push({ message, options }); } };
  let notifications = [], hold, release;
  const request = async (op, payload = {}) => {
    if (op === 'overview') return { activeChildren: 1, totalChildren: 1, pendingRequests: 0, children: { knownEstimate: 0, unknownPrices: 0 } };
    if (op === 'notifications') {
      if (hold) { hold = false; await new Promise(r => { release = r; }); }
      return { items: notifications.slice(payload.offset, payload.offset + 10), next: payload.offset + 10 < notifications.length ? payload.offset + 10 : null };
    }
    return { lifecycle: 'queued' };
  };
  const parent = installParent(pi, { request, lifecycle: false, intervalMs: 100000 });
  const ctx = context(entries); ctx.ui.setStatus = (_key, text) => statuses.push(text);
  await parent.start(ctx);
  assert.equal((await tools.rex_launch.execute('call', { agent: 'a' })).details.lifecycle, 'queued');
  assert.match(tools.rex_launch.promptGuidelines.join(' '), /do not poll/i);
  notifications = Array.from({ length: 12 }, (_, i) => notice(`page-${i}`));
  await parent.tick(); await parent.tick();
  assert.equal(sent.flatMap(s => s.message.details.notificationIds).length, 12);
  hold = true; notifications = [notice('stale')]; const tick = parent.tick(); await until(() => release);
  const stopping = parent.stop(); release(); await tick; await stopping;
  assert.ok(!sent.some(s => s.message.details.notificationIds.includes('stale')));
  assert.equal(statuses.at(-1), undefined);
  await parent.tick(); assert.equal(sent.length, 2);
});

test('actual Pi queue finishes foreground work before a wake-up and also wakes an idle parent', { skip: !available, timeout: 15000 }, async t => {
  let wake, ctx, release, foregroundSignal;
  const l = await loop({ childBridge: false, initial: false, responses: [async ({ signal }) => { foregroundSignal = signal; await new Promise(r => { release = r; }); return [{ type: 'text', text: 'User work complete' }]; }, [{ type: 'text', text: 'Question inspected' }], [{ type: 'text', text: 'Result inspected' }]], extra(pi) { wake = createWakeups(pi); pi.on('session_start', (_event, c) => { ctx = { ...c, mode: 'tui', hasUI: true }; }); } });
  t.after(() => l.close());
  const work = l.session.prompt('Do user work'); await until(() => release);
  wake.notify(ctx, [notice('busy')]);
  assert.equal(l.calls, 1); assert.equal(foregroundSignal.aborted, false); assert.equal(l.tuiAbortCalls, 0);
  release(); await work; await until(() => l.calls === 2 && l.session.isIdle);
  const proof = l.manager.getEntries().find(e => e.type === 'custom_message' && e.customType === wakeupType);
  assert.ok(proof); assert.equal(createWakeups(l.pi).notify(ctx, [notice('busy')]), 0);
  wake.notify(ctx, [notice('idle', 'result')]); await until(() => l.calls === 3 && l.session.isIdle);
  assert.equal(l.tuiAbortCalls, 0); assert.equal(l.hostErrors.length, 0);
});
