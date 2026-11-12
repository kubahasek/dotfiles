import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Coordinator } from '../src/coordinator.mjs';
import { Rex, exec } from '../src/adapters.mjs';
import { Journal, Delivery, marker } from '../src/journal.mjs';
import { installChild } from '../src/bridge.mjs';
import { installParent } from '../src/parent.mjs';
import { ingestUsage } from '../src/usage.mjs';
import { serve, call } from '../src/transport.mjs';
import { temp, p, fixture } from './support.mjs';
function api() {
  const handlers = {}, tools = {}, entries = [], visible = [], deliveries = [];
  const pi = { on(n, f) { (handlers[n] ??= []).push(f); }, registerTool(t) { tools[t.name] = t; }, setActiveTools(names) { pi.active = names; }, appendEntry(customType, data) { entries.push({ type: 'custom', customType, data, id: `e${entries.length}` }); }, sendUserMessage(text, options) { deliveries.push({ text, options }); visible.push(text); }, sendMessage(m) { visible.push(m.content); } };
  let idle = true, aborts = 0;
  const ctx = { model: { provider: 'proposal', id: 'model' }, isIdle: () => idle, abort: () => { aborts++; }, modelRegistry: { find: () => null }, sessionManager: { getSessionId: () => 'session1', getEntries: () => entries }, ui: { notify() {} } };
  const emit = async (n, e = {}) => { const results = []; for (const f of handlers[n] ?? []) results.push(await f(e, ctx)); return results; };
  return { pi, ctx, emit, tools, entries, visible, deliveries, handlers, setIdle: value => idle = value, get aborts() { return aborts; } };
}
function repo(dir) {
  const r = path.join(dir, 'repo'); fs.mkdirSync(r); exec('git', ['init', '-q'], r); fs.writeFileSync(path.join(r, 'file'), 'base'); exec('git', ['add', 'file'], r); exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base'], r); return { repo: r, base: exec('git', ['rev-parse', 'HEAD'], r).trim() };
}
test('composed parent launch tool -> coordinator -> real Git + fake Rex subprocess; secrets excluded from actual model content', async t => {
  const dir = temp(), state = path.join(dir, 'state'); fs.mkdirSync(state, { mode: 0o700 }); const git = repo(dir);
  const fake = path.join(dir, 'rex.cjs'), log = path.join(dir, 'argv.jsonl');
  fs.writeFileSync(fake, "const fs=require('fs');const a=process.argv.slice(2);fs.appendFileSync(LOG,JSON.stringify(a)+'\\n');const runs=fs.readFileSync(LOG,'utf8').trim().split('\\n').map(JSON.parse).filter(x=>x[0]==='run');const blocks=runs.slice(0,2).map(x=>({block_id:'block:'+x[x.indexOf('--label')+1],rect:runs.length===1?[0,0,1,1]:[0,0,0.5,1]}));if(a[0]==='run')console.log(JSON.stringify({block_ids:['block:'+a[a.indexOf('--label')+1]],window_id:'window:1'}));else if(a[0]==='session')console.log(JSON.stringify({windows:blocks.length?[{window_id:'window:1',label:'Agents',layers:[{kind:'tiled',layout:blocks.length===1?blocks[0]:{split:{before:blocks[0],after:blocks[1]}}}]}]:[]}));else if(a[0]==='block'&&a[1]==='call')console.log(JSON.stringify({columns:400,rows:100}));else if(a[0]==='block')console.log(JSON.stringify({blocks:[]}));else console.log('{}');".replaceAll('LOG', JSON.stringify(log)));
  const rex = new Rex('session:fake', (_bin, args) => execFileSync(process.execPath, [fake, ...args], { encoding: 'utf8' }));
  const config = { version: 3, ...git, stateDir: state, worktreeRoot: path.join(dir, 'worktrees'), rexSession: 'session:fake', profiles: { reader: p }, piExecutable: '/operator/pi', knownFreeModels: ['proposal/model'], panesPerTab: 2 };
  fs.mkdirSync(config.worktreeRoot);
  let coordinator = new Coordinator(state, config, { rex }); const token = coordinator.domain.bootstrap('g');
  let service = await serve(coordinator, state, { frameMs: 10000 });
  t.after(async () => { await service.close(); fs.rmSync(dir, { recursive: true }); });
  const request = (op, payload = {}) => call(path.join(state, 'control.sock'), { ...payload, requestId: payload.requestId ?? `q${Math.random().toString(16).slice(2)}`, group: 'g', token, op });
  const parent = api(), journal = new Journal(path.join(dir, 'parent-journal')); installParent(parent.pi, { request, journal });
  const args = { requestId: 'launch1', agent: 'a', task: 't', text: 'Inspect file', workspace: 'worktree', profileName: 'reader', base: git.base };
  const result = await parent.tools.rex_launch.execute('tool1', args);
  const descriptor = JSON.parse(fs.readFileSync(path.join(state, 'children/1_g_a/descriptor.json')));
  assert.deepEqual(descriptor.knownFreeModels, ['proposal/model']); assert.ok(descriptor.token); assert.equal(result.isError, undefined);
  // Inspect actual tool/custom model-visible content and details, not implementation source strings.
  assert.ok(!JSON.stringify({ result, visible: parent.visible, entries: parent.entries }).includes(descriptor.token));
  assert.ok(!JSON.stringify(result).includes(token));
  assert.equal(fs.readFileSync(path.join(config.worktreeRoot, '1_g_a/file'), 'utf8'), 'base');
  await parent.tools.rex_launch.execute('retry', args);
  assert.equal(fs.readFileSync(log, 'utf8').trim().split('\n').filter(l => JSON.parse(l)[0] === 'run').length, 1);
  for (const [agent, requestId] of [['b', 'launch2'], ['c', 'launch3']]) await request('launch', { ...args, agent, requestId });
  const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse), launches = calls.filter(a => a[0] === 'run');
  assert.equal(launches.length, 3); assert.ok(launches.every(a => a.includes('--label') && a.includes('--focus=false') && a.includes('--shell=none')));
  assert.ok(launches[1].includes('--split=right')); assert.ok(!launches[2].includes('--split=right'));
  assert.ok(calls.some(a => a[0] === 'window' && a.at(-1) === 'Agents 2'));
  // Restart retains launch receipt and pending initial command; no duplicate Git/Rex launch.
  await service.close(); coordinator = new Coordinator(state, config, { rex }); service = await serve(coordinator, state);
  await request('launch', args); assert.equal((await request('poll', { agent: 'a' })).commands.items.length, 1);
});
test('journal recovery requires persisted proof and never replays uncertain input', async () => {
  const dir = temp(), a = api(), j = new Journal(dir), q = [], queue = (op, payload) => q.push({ op, payload });
  const command = { id: 'c', generation: 1, task: 't', type: 'task', text: 'Work' };
  j.update(s => { s.deliveries.c = { phase: 'attempting', generation: 1 }; return null; });
  assert.equal(await new Delivery(new Journal(dir)).deliver(a.pi, a.ctx, command, queue), 'AMBIGUOUS'); assert.equal(a.visible.length, 0);
  assert.equal(await new Delivery(new Journal(dir)).deliver(a.pi, a.ctx, command, queue), 'AMBIGUOUS');
  assert.equal(q.some(r => r.op === 'ack'), false);
  a.entries.push({ type: 'message', id: 'persisted', message: { role: 'user', content: `${marker(command)}\nWork` } });
  assert.equal(await new Delivery(new Journal(dir)).deliver(a.pi, a.ctx, command, queue), 'observed'); assert.equal(a.visible.length, 0);
  fs.rmSync(dir, { recursive: true });
});
test('restored transcript leaf accounting includes failure/cache/manual run and dedups replay; no nested aggregates', () => {
  const dir = temp(), a = api(), journal = new Journal(dir);
  const usage = { input: 10, output: 2, cacheRead: 30, cacheWrite: 4 };
  a.entries.push({ type: 'custom', customType: 'rex-task', data: { task: 'old' }, id: 'mark' }, { type: 'message', id: 'm1', message: { role: 'assistant', provider: 'proposal', model: 'model', stopReason: 'error', usage } }, { type: 'message', id: 'nested', message: { role: 'toolResult', usage } }, { type: 'usage', id: 'warm', provider: 'proposal', model: 'model', usage }, { type: 'custom', customType: 'rex-task', data: { task: 'new' }, id: 'mark2' }, { type: 'message', id: 'manual-model', message: { role: 'assistant', provider: 'unknown', model: 'unknown', usage } });
  a.ctx.modelRegistry.find = provider => provider === 'proposal' ? { cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 } } : null;
  ingestUsage(a.ctx, journal);
  ingestUsage(a.ctx, new Journal(dir));
  assert.equal(journal.state.outbox.length, 1);
  const summary = journal.state.usageSnapshots.session1.summary;
  assert.equal(summary.messages, 3); assert.equal(summary.unknownPrices, 1);
  assert.equal(summary.estimate, null); assert.equal(summary.tokens.cacheRead, 90);
  fs.rmSync(dir, { recursive: true });
});
test('normal Pi model changes and resources remain available while bridge control stays installed', async () => {
  const f = fixture(), a = api(), journal = new Journal(path.join(f.dir, 'normal'));
  installChild(a.pi, { profile: p, journal, group: 'g', agent: 'a', send: async r => f.d.dispatch({ ...r, token: f.child }) });
  await a.emit('session_start'); a.ctx.model = { provider: 'other', id: 'model' };
  await a.emit('model_select'); await a.emit('before_provider_request');
  assert.equal(journal.state.guardFailure, undefined); assert.equal(a.pi.active, undefined);
  for (const name of ['model_select', 'user_bash', 'project_trust', 'session_before_switch']) assert.equal(a.handlers[name], undefined);
  assert.ok(a.tools.rex_result); await a.emit('session_shutdown'); fs.rmSync(f.dir, { recursive: true });
});

test('local outbox restart retries exactly the same durable report id after lost coordinator reply', async () => {
  const f = fixture(), dir = path.join(f.dir, 'outbox');
  const j = new Journal(dir), requestId = j.enqueue('event', { kind: 'progress', text: 'Recoverable report' }, { group: 'g', agent: 'a', task: 't', generation: 1 });
  await assert.rejects(j.flush(async r => { f.d.dispatch({ ...r, token: f.child }); throw Error('lost response'); }), /lost/);
  const recovered = new Journal(dir); assert.equal(recovered.state.outbox[0].requestId, requestId);
  await recovered.flush(async r => f.d.dispatch({ ...r, token: f.child }));
  assert.equal(new Journal(dir).state.outbox.length, 0); assert.equal(f.d.store.state.events.length, 1);
  fs.rmSync(f.dir, { recursive: true });
});

test('answer batch journal restart requires the single persisted user proof before ACKing every member', async () => {
  const dir = temp(), a = api(), journal = new Journal(dir), messages = [], queue = (op, data) => messages.push({ op, data });
  const replies = [1, 2].map(n => ({ id: `reply${n}`, type: 'answer', question: `q${n}`, generation: 1, task: 't', text: `Answer ${n}` }));
  const delivery = new Delivery(journal), batch = delivery.prepareAnswers(replies);
  assert.equal(await delivery.deliver(a.pi, a.ctx, batch, queue), 'pending'); assert.equal(messages.some(m => m.op === 'ack'), false);
  const restarted = new Delivery(new Journal(dir));
  assert.equal(await restarted.deliver(a.pi, a.ctx, restarted.prepareAnswers(replies), queue), 'AMBIGUOUS'); assert.equal(a.visible.length, 1);
  a.entries.push({ type: 'message', message: { role: 'user', content: `${marker(batch)}\n${batch.text}` } });
  for (const reply of replies) assert.equal(restarted.observe(a.ctx, reply, queue), true);
  assert.deepEqual(messages.filter(m => m.op === 'ack').map(m => m.data.command).sort(), ['reply1', 'reply2']);
  fs.rmSync(dir, { recursive: true });
});
