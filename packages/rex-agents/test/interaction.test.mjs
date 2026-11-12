import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Coordinator } from '../src/coordinator.mjs';
import { installParent } from '../src/parent.mjs';
import { temp, p, fixture } from './support.mjs';
import { available, loop, tool, until } from './loop-support.mjs';

test('six parent tools and fixed safe meaningful errors', async () => {
  const tools = {}, pi = { on() {}, registerTool(t) { tools[t.name] = t; } };
  let message = '';
  installParent(pi, { journal: {}, request: async () => { throw Error(message); } });
  assert.deepEqual(Object.keys(tools), ['rex_launch', 'rex_followup', 'rex_steer', 'rex_reply', 'rex_stop', 'rex_inspect']);
  assert.deepEqual(tools.rex_inspect.parameters.required, ['offset']); assert.ok(tools.rex_inspect.parameters.properties.agent);
  const cases = [['Shared checkout already has unfinished agent', 'SHARED_WORKSPACE_BUSY'], ['Previous task must be settled', 'TASK_NOT_SETTLED'], ['Unanswered request', 'UNANSWERED_QUESTION'], ['Invalid id', 'INVALID_ID'], ['Invalid page', 'INVALID_REQUEST'], ['Launch identity conflict', 'IDENTITY_CONFLICT'], ['PANE_MISSING: secret', 'PANE_MISSING'], ['STORE_UNAVAILABLE: secret', 'STORE_UNAVAILABLE']];
  for (const [text, code] of cases) { message = text; const out = await tools.rex_inspect.execute('call', { offset: 0 }); assert.equal(out.details.code, code); assert.ok(!JSON.stringify(out).includes('secret')); }
});
test('all queries and heartbeat are read-only, receipt-free and fail-stop', () => {
  const f = fixture(); f.childRequest('request', { question: 'one', kind: 'question', scope: 't', text: 'One?' });
  const before = fs.readFileSync(f.d.store.file, 'utf8'), count = Object.keys(f.d.store.state.receipts).length;
  for (let i = 0; i < 10; i++) {
    for (const op of ['inspect', 'poll', 'answer-inbox', 'status', 'events', 'overview']) f.request(op, { offset: 0 });
    f.childRequest('hello');
  }
  assert.ok(f.d.heartbeat('a')); assert.equal(Object.keys(f.d.store.state.receipts).length, count); assert.equal(fs.readFileSync(f.d.store.file, 'utf8'), before);
  f.d.store.failed = true;
  for (const op of ['inspect', 'poll', 'answer-inbox', 'overview']) assert.throws(() => f.request(op), /fail-stop/);
  assert.throws(() => f.childRequest('hello'), /fail-stop/); fs.rmSync(f.dir, { recursive: true });
});
test('large legal questions stay bounded and every pending question can be reached with agent detail pages', () => {
  const f = fixture(), report = 'x'.repeat(16000);
  for (let i = 0; i < 23; i++) f.childRequest('request', { question: `q${i}`, kind: 'question', scope: report, text: report });
  for (let i = 0; i < 6; i++) f.childRequest('event', { kind: 'progress', text: report });
  const summary = f.request('inspect', { agent: undefined, offset: 0 }); assert.equal(summary.items[0].pendingQuestionCount, 23); assert.ok(summary.items[0].pendingQuestions[0].truncated);
  const seen = []; let offset = 0;
  do { const result = f.request('inspect', { agent: 'a', questionOffset: offset, offset: 0 }); assert.ok(Buffer.byteLength(JSON.stringify(result)) < 512 * 1024); const a = result.items[0]; seen.push(...a.pendingQuestions.map(q => q.question)); assert.ok(a.pendingQuestions.every(q => q.text === report && q.scope === report)); offset = a.nextQuestionOffset; } while (offset !== null);
  assert.equal(new Set(seen).size, 23); fs.rmSync(f.dir, { recursive: true });
});
test('closed pane rejects input without writes; stop remains available and inspection does not relaunch', async () => {
  const dir = temp(), root = path.join(dir, 'root'); fs.mkdirSync(root);
  let pane = true, launches = 0;
  const c = new Coordinator(path.join(dir, 'state'), { version: 3, panesPerTab: 3, repo: root, worktreeRoot: path.join(dir, 'trees'), profiles: { reader: p }, piExecutable: '/pi' }, { git: { create() {} }, rex: { launch() { launches++; return { block_id: 'block:a' }; }, list() { return { blocks: pane ? [{ block_id: 'block:a' }] : [] }; } } });
  const token = c.domain.bootstrap('g');
  const req = (op, data = {}) => c.dispatch({ op, group: 'g', token, agent: 'a', requestId: `${op}-${Math.random().toString(16).slice(2)}`, ...data });
  await req('launch', { task: 't', text: 'Work', workspace: 'worktree', profileName: 'reader', base: 'a'.repeat(40) });
  pane = false; const before = fs.readFileSync(c.store.file, 'utf8');
  for (const op of ['followup', 'steer', 'answer']) await assert.rejects(req(op, { task: 'next', text: 'Input', question: 'q' }), /PANE_MISSING/);
  assert.equal(fs.readFileSync(c.store.file, 'utf8'), before);
  for (let i = 0; i < 10; i++) assert.equal((await req('inspect', { offset: 0 })).items[0].panePresent, false);
  assert.equal(fs.readFileSync(c.store.file, 'utf8'), before); assert.equal(launches, 1);
  await req('stop'); assert.ok(c.store.state.agents.a.commands.some(c => c.type === 'stop' && !c.ack));
  c.store.failed = true; await assert.rejects(req('inspect'), /STORE_UNAVAILABLE/); fs.rmSync(dir, { recursive: true });
});
test('real followup reuses conversation and rejects delayed old task events', { skip: !available, timeout: 15000 }, async t => {
  const l = await loop({ responses: [[tool('rex_result', { status: 'success', text: 'First done' })], [tool('rex_result', { status: 'success', text: 'Second done' })]] }); t.after(() => l.close());
  await until(() => l.calls === 1 && l.session.isIdle); await l.bridge.pump();
  const file = l.manager.getSessionFile(); l.request('followup', { task: 'second', text: 'Reuse this child' }); await l.bridge.pump();
  await until(() => l.calls === 2 && l.session.isIdle); await l.bridge.pump();
  assert.equal(l.manager.getSessionFile(), file); assert.equal(l.d.store.state.agents.a.result.task, 'second');
  assert.throws(() => l.childRequest('event', { task: 't', generation: 1, kind: 'idle', text: 'Late old idle' }), /Stale task generation/);
});
