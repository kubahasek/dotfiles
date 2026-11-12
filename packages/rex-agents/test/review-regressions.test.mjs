import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { initializeController } from '../src/client.mjs';
import { Store, privateJSON } from '../src/storage.mjs';
import { Domain } from '../src/domain.mjs';
import { stableDirectoryPath } from '../src/adapters.mjs';
import { temp } from './support.mjs';
import { available, loop, tool, until, sleep } from './loop-support.mjs';
const options = { skip: !available, timeout: 15000 };
test('controller bootstrap durable secret intent recovers every crash boundary', () => {
  for (const stage of ['secret-durable', 'group-durable', 'controller-durable']) {
    const stateDir = temp(), c = { stateDir, group: 'g' };
    assert.throws(() => initializeController(c, point => { if (point === stage) throw Error('simulated crash'); }), /crash/);
    const auth = initializeController(c); assert.deepEqual(auth, initializeController(c));
    const d = new Domain(new Store(stateDir)); assert.deepEqual(d.dispatch({ op: 'status', group: 'g', token: auth.token, requestId: 'status1' }).items, []);
    fs.rmSync(stateDir, { recursive: true });
  }
});
test('real mixed result/read/progress batch settles with explicit result', options, async t => {
  const l = await loop({ responses: [[tool('rex_result', { status: 'success', text: 'Explicit evidence' }), tool('read', { path: 'file' }), tool('rex_progress', { text: 'Reviewed' })]] }); t.after(() => l.close());
  await until(() => l.session.isIdle && l.calls === 1); await l.bridge.pump();
  assert.equal(l.failures.length, 0); assert.equal(l.d.store.state.agents.a.result.status, 'success'); assert.equal(l.calls, 1);
});
test('real auth-preflight rejection is unacknowledged and visibly uncertain', options, async t => {
  let release; const hold = new Promise(resolve => release = resolve);
  const l = await loop({ responses: [], extra: pi => pi.on('input', async () => { await hold; return { action: 'continue' }; }) }); t.after(() => l.close());
  l.modelRuntime.hasConfiguredAuth = () => false; l.modelRuntime.checkAuth = async () => undefined; release();
  await until(() => l.session.isIdle); await sleep(1100); await l.bridge.pump();
  assert.equal(l.calls, 0); assert.equal(l.d.store.state.agents.a.commands[0].ack, false); assert.ok(l.hostErrors.some(e => e.event === 'send_user_message')); assert.equal(l.d.store.state.agents.a.lifecycle, 'AMBIGUOUS');
});
test('queued steering without persisted acceptance is never replayed after restart', options, async t => {
  let release; const hold = new Promise(resolve => release = resolve);
  const first = await loop({ responses: [async () => { await hold; return [{ type: 'text', text: 'late' }]; }] });
  await until(() => first.calls === 1); await first.bridge.pump(); first.request('steer', { text: 'Unpersisted steering' }); await first.bridge.pump();
  await until(() => first.session.pendingMessageCount > 0);
  const command = first.d.store.state.agents.a.commands.find(c => c.type === 'steer'); assert.equal(command.ack, false);
  const file = first.manager.getSessionFile(); assert.equal(fs.readFileSync(file, 'utf8').includes('Unpersisted steering'), false);
  const abort = first.session.abort(); release(); await abort; await first.dispose();
  const second = await loop({ existingFixture: first, initial: false, sessionFile: file, responses: [] }); t.after(() => second.close());
  await second.bridge.pump(); assert.equal(second.calls, 0); assert.equal(second.d.store.state.agents.a.commands.find(c => c.id === command.id).ack, false); assert.equal(second.d.store.state.agents.a.lifecycle, 'AMBIGUOUS');
});
test('private JSON parse diagnostics do not echo contents; unstable roots stay rejected', () => {
  const dir = temp(), file = path.join(dir, 'private.json'), secret = 'SENSITIVE-CANARY';
  fs.writeFileSync(file, `{ "token": "${secret}", broken }`, { mode: 0o600 });
  assert.throws(() => privateJSON(file), error => !error.message.includes(secret) && /Invalid private JSON/.test(error.message));
  assert.throws(() => stableDirectoryPath(path.join(dir, 'root\u00a0name')), /normalization-unstable/);
  fs.rmSync(dir, { recursive: true });
});
