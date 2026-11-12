import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fixture } from './support.mjs';
import { available, loop, tool, until, sleep } from './loop-support.mjs';
const options = { skip: !available, timeout: 15000 };
test('real AgentSession mixed question/read/progress batch pauses whole run without fatal; all early answers retained', options, async t => {
  const l = await loop({ responses: [[tool('rex_question', { question: 'q1', kind: 'question', scope: 't', text: 'First?' }, 'q1'), tool('read', { path: 'file' }), tool('rex_progress', { text: 'Progress' }), tool('rex_question', { question: 'q2', kind: 'question', scope: 't', text: 'Second?' }, 'q2')], [{ type: 'text', text: 'Answers received' }], [{ type: 'text', text: 'Second answer received' }]] });
  t.after(() => l.close());
  await until(() => l.session.isIdle && l.calls === 1, 'question batch settlement');
  assert.equal(l.failures.length, 0); assert.equal(l.calls, 1);
  assert.ok(l.d.store.state.agents.a.requests.q1); assert.ok(l.d.store.state.agents.a.requests.q2);
  await l.bridge.pump();
  const initial = l.d.store.state.agents.a.commands.find(c => c.type === 'task'); assert.equal(initial.ack, true);
  l.request('answer', { question: 'q1', text: 'First answer' }); await l.bridge.pump();
  assert.equal(l.d.store.state.agents.a.commands.find(c => c.question === 'q1').ack, false);
  assert.equal(l.calls, 1);
  l.request('answer', { question: 'q2', text: 'Second answer' }); await l.bridge.pump();
  await until(() => l.session.isIdle && l.calls >= 2, 'answers run'); await l.bridge.pump();
  const users = l.manager.getEntries().filter(e => e.type === 'message' && e.message.role === 'user').map(e => typeof e.message.content === 'string' ? e.message.content : e.message.content.map(c => c.text ?? '').join(''));
  assert.ok(users.some(s => s.includes('First answer'))); assert.ok(users.some(s => s.includes('Second answer')), JSON.stringify({users,calls:l.calls,errors:l.hostErrors,commands:l.d.store.state.agents.a.commands,pause:l.journal.state.pause}));
  assert.ok(l.d.store.state.agents.a.commands.filter(c => c.type === 'answer').every(c => c.ack));
  assert.equal(l.failures.length, 0);
});
test('real async input rejection never ACKs a void sendUserMessage return; uncertainty survives until reconciliation', options, async t => {
  let release; const preflight = new Promise(resolve => release = resolve);
  const l = await loop({ responses: [], extra: pi => pi.on('input', async () => { await preflight; return { action: 'handled' }; }) }); t.after(() => l.close());
  const command = l.d.store.state.agents.a.commands[0]; assert.equal(command.ack, false);
  assert.equal(l.manager.getEntries().some(e => e.type === 'message' && e.message.role === 'user'), false);
  release(); await until(() => l.session.isIdle, 'rejected prompt idle'); await sleep(1100); await l.bridge.pump();
  assert.equal(command.ack, false); assert.equal(l.d.store.state.agents.a.commands[0].ack, false); assert.equal(l.calls, 0); assert.equal(l.d.store.state.agents.a.lifecycle, 'AMBIGUOUS'); assert.equal(l.failures.length, 0);
});
test('real void abort with delayed provider settlement defers stop ACK/followup; stop works during ambiguity', options, async t => {
  let release;
  const blocked = new Promise(resolve => release = resolve);
  const l = await loop({ responses: [async () => { await blocked; return [{ type: 'text', text: 'late' }]; }, [{ type: 'text', text: 'Followup' }]] }); t.after(() => l.close());
  await until(() => l.calls === 1, 'provider started'); await l.bridge.pump();
  l.childRequest('ambiguous'); l.request('stop'); await l.bridge.pump();
  const stop = l.d.store.state.agents.a.commands.find(c => c.type === 'stop'); assert.equal(stop.ack, false); assert.equal(l.session.isIdle, false);
  assert.throws(() => l.request('followup', { task: 'next', text: 'Too early' }), /Previous task/);
  release(); await until(() => l.session.isIdle, 'actual abort settlement'); await l.bridge.pump();
  assert.equal(l.d.store.state.agents.a.commands.find(c => c.type === 'stop').ack, true);
  assert.throws(() => l.request('followup', { task: 'next', text: 'Followup' }), /Previous task/);
  await l.bridge.pump(); assert.equal(l.calls, 1); assert.equal(l.failures.length, 0);
});
test('permanent outbox rejection is quarantined and real child still handles stop; historical transcript usage survives child queue', options, async t => {
  const l = await loop({ responses: [[{ type: 'text', text: 'done' }]], knownFreeModels: ['proposal/model'] }); t.after(() => l.close());
  await until(() => l.calls === 1 && l.session.isIdle); await l.bridge.pump();
  l.journal.enqueue('request', { question: 'existing', kind: 'question', scope: 't', text: 'Duplicate' }, { group: 'g', agent: 'a', task: 't', generation: 1 });
  l.childRequest('request', { question: 'existing', kind: 'question', scope: 't', text: 'Original' });
  l.request('stop'); await l.bridge.pump();
  assert.ok(l.journal.state.rejected.some(r => /Request exists/.test(r.reason)));
  assert.ok(l.d.store.state.agents.a.commands.find(c => c.type === 'stop').ack);
  // Real persisted history entry before current-generation identity.
  l.manager.appendCustomEntry('rex-task', { task: 'historic' });
  l.manager.appendMessage({ role: 'assistant', api: 'openai-completions', provider: 'proposal', model: 'model', timestamp: Date.now(), stopReason: 'error', content: [], usage: { input: 7, output: 1, cacheRead: 2, cacheWrite: 0, totalTokens: 10, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });
  l.manager.appendCustomEntry('rex-task', { task: 't' }); await l.bridge.pump();
  const usage = l.request('overview').children; assert.ok(usage.tokens.input >= 7); assert.equal(usage.estimate, 0);
});
test('real host-loaded child descriptor forwards immutable known-free prices into actual loop usage ingestion', options, async t => {
  const l = await loop({ descriptorAdapter: true, knownFreeModels: ['proposal/model'], responses: [[{ type: 'text', text: 'Free local evidence' }]] }); t.after(() => l.close());
  await until(() => l.calls === 1 && l.session.isIdle);
  await until(() => l.request('overview').children.messages === 1, 'descriptor-driven usage ingestion');
  assert.equal(l.request('overview').children.estimate, 0);
});
test('real concurrent question reports and parent early answer cannot pass the uncommitted second-question frontier', options, async t => {
  let release, secondSeen = false; const hold = new Promise(resolve => release = resolve);
  const l = await loop({ responses: [[tool('rex_question', { question: 'first', kind: 'question', scope: 't', text: 'One?' }, 'one'), tool('rex_question', { question: 'second', kind: 'question', scope: 't', text: 'Two?' }, 'two')], [{ type: 'text', text: 'Answers one' }], [{ type: 'text', text: 'Answers two' }]], sendOverride: async (r, f) => {
    if (r.op === 'request' && r.question === 'second') { secondSeen = true; await hold; }
    return f.d.dispatch({ ...r, token: f.child });
  } }); t.after(() => l.close());
  await until(() => secondSeen && l.d.store.state.agents.a.requests.first);
  l.request('answer', { question: 'first', text: 'Early one' }); const pump = l.bridge.pump(); await sleep(30);
  assert.equal(l.d.store.state.agents.a.commands.find(c => c.question === 'first').ack, false);
  assert.equal(l.manager.getEntries().filter(e => e.type === 'message' && e.message.role === 'user').length, 1);
  release(); await pump; await until(() => l.session.isIdle && l.calls === 1); await l.bridge.pump();
  assert.equal(l.d.store.state.agents.a.commands.find(c => c.question === 'first').ack, false);
  l.request('answer', { question: 'second', text: 'Early two' }); await l.bridge.pump();
  await until(() => l.d.store.state.agents.a.commands.filter(c => c.type === 'answer').every(c => c.ack), 'both early replies persisted and ACKed');
  assert.equal(l.failures.length, 0);
});

for (const report of ['question', 'result']) test(`TUI queue-clearing abort: all early answers persist in one batch before resumed ${report}`, options, async t => {
  let providerUsers;
  const resumed = report === 'question' ? tool('rex_question', { question: 'next', kind: 'question', scope: 't', text: 'Next question?' }) : tool('rex_result', { status: 'incomplete', text: 'Explicit resumed result' });
  const l = await loop({ responses: [[tool('rex_question', { question: 'one', kind: 'question', scope: 't', text: 'One?' }, 'one'), tool('rex_question', { question: 'two', kind: 'question', scope: 't', text: 'Two?' }, 'two')], ({ context }) => {
    providerUsers = context.messages.filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : m.content.map(c => c.text ?? '').join(''));
    return [resumed, tool('rex_progress', { text: 'Mixed batch forces ordinary turn-end pause' })];
  }] }); t.after(() => l.close());
  await until(() => l.calls === 1 && l.session.isIdle);
  l.request('answer', { question: 'one', text: 'FIRST EARLY ANSWER' }); await l.bridge.pump();
  assert.equal(l.d.store.state.agents.a.commands.find(c => c.question === 'one').ack, false);
  l.request('answer', { question: 'two', text: 'SECOND EARLY ANSWER' }); await l.bridge.pump();
  await until(() => l.calls === 2 && l.session.isIdle, 'resumed provider immediately pauses via real TUI abort'); await l.bridge.pump();
  assert.ok(providerUsers.some(s => s.includes('FIRST EARLY ANSWER') && s.includes('SECOND EARLY ANSWER')));
  const persisted = fs.readFileSync(l.manager.getSessionFile(), 'utf8'); assert.ok(persisted.includes('FIRST EARLY ANSWER') && persisted.includes('SECOND EARLY ANSWER'));
  assert.ok(l.d.store.state.agents.a.commands.filter(c => c.type === 'answer').every(c => c.ack));
  assert.notEqual(l.d.store.state.agents.a.lifecycle, 'AMBIGUOUS'); assert.equal(l.failures.length, 0); assert.ok(l.tuiAbortCalls >= 2);
  assert.ok(l.restored.every(s => !s.includes('EARLY ANSWER'))); assert.equal(l.session.pendingMessageCount, 0);
});

test('TUI pause preserves all 12 ready answers beyond a poll page in one persisted provider-visible batch', options, async t => {
  const f = fixture();
  for (let n = 1; n <= 12; n++) f.childRequest('request', { question: `q${n}`, kind: 'question', scope: 't', text: `Question ${n}` });
  let providerText;
  const l = await loop({ existingFixture: f, initial: false, responses: [({ context }) => {
    providerText = context.messages.filter(m => m.role === 'user').map(m => typeof m.content === 'string' ? m.content : m.content.map(c => c.text ?? '').join('')).join('\n');
    return [tool('rex_question', { question: 'again', kind: 'question', scope: 't', text: 'Pause immediately' }), tool('rex_progress', { text: 'Mixed pause' })];
  }] }); t.after(() => l.close());
  for (let n = 1; n <= 12; n++) l.request('answer', { question: `q${n}`, text: `VALUE[${n}]` });
  await l.bridge.pump();
  await until(() => l.calls === 1 && l.session.isIdle); await l.bridge.pump();
  await until(() => l.d.store.state.agents.a.commands.filter(c => c.type === 'answer').every(c => c.ack), 'every member ACK from persisted batch proof');
  for (let n = 1; n <= 12; n++) assert.ok(providerText.includes(`VALUE[${n}]`));
  const users = l.manager.getEntries().filter(e => e.type === 'message' && e.message.role === 'user'); assert.equal(users.length, 1);
  assert.notEqual(l.d.store.state.agents.a.lifecycle, 'AMBIGUOUS'); assert.ok(l.tuiAbortCalls > 0); assert.equal(l.restored.length, 0);
});
