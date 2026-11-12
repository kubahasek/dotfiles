import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Coordinator } from '../src/coordinator.mjs';
import { Git, exec } from '../src/adapters.mjs';
import { installParent } from '../src/parent.mjs';
import { temp, p } from './support.mjs';
function setup(t) {
  const dir = fs.realpathSync(temp()); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repo = path.join(dir, 'repo'); fs.mkdirSync(repo); exec('git', ['init', '-q'], repo);
  fs.writeFileSync(path.join(repo, 'file'), 'committed'); exec('git', ['add', 'file'], repo);
  exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base'], repo);
  const base = exec('git', ['rev-parse', 'HEAD'], repo).trim(); fs.writeFileSync(path.join(repo, 'file'), 'uncommitted parent work');
  const config = { version: 3, panesPerTab: 3, repo, stateDir: path.join(dir, 'state'), worktreeRoot: path.join(dir, 'worktrees'), group: 'g', rexSession: 'session:fixture', piExecutable: '/operator/pi', profiles: { reader: p, writer: p } };
  fs.mkdirSync(config.worktreeRoot, { mode: 0o700 });
  let creates = 0; const launched = [], git = new Git();
  const c = new Coordinator(config.stateDir, config, { git: { create(...args) { creates++; return git.create(...args); } }, rex: { list() { return { blocks: launched.map((_, i) => ({ block_id: `block:${i + 1}` })) }; }, launch(args) { launched.push(args); return { block_id: `block:${launched.length}` }; } } });
  const token = c.domain.bootstrap('g');
  const launch = (workspace, agent = 'a', extra = {}) => c.dispatch({ op: 'launch', group: 'g', token, requestId: `launch-${agent}`, agent, task: 't', text: 'Approved task', profileName: 'reader', base, workspace, ...extra });
  const descriptor = agent => JSON.parse(fs.readFileSync(path.join(config.stateDir, `children/1_g_${agent}/descriptor.json`)));
  return { dir, repo, base, config, c, token, launch, launched, descriptor, get creates() { return creates; } };
}
test('workspace choice and shared HEAD are explicit; invalid choices have no launch effects', async t => {
  const f = setup(t), before = fs.readFileSync(path.join(f.config.stateDir, 'state.json'), 'utf8');
  for (const mode of [undefined, null, 'auto', '']) await assert.rejects(f.launch(mode), /Explicit workspace choice/);
  await assert.rejects(f.launch('shared', 'a', { base: '0'.repeat(40) }), /must match current HEAD/);
  assert.equal(fs.readFileSync(path.join(f.config.stateDir, 'state.json'), 'utf8'), before); assert.equal(f.creates, 0); assert.equal(f.launched.length, 0);
  assert.equal(fs.existsSync(path.join(f.config.stateDir, 'children')), false); assert.equal(fs.readFileSync(path.join(f.repo, 'file'), 'utf8'), 'uncommitted parent work');
});
test('shared launch preserves dirty files and duplicate identity includes workspace', async t => {
  const f = setup(t), result = await f.launch('shared');
  assert.deepEqual(result.workspace, { mode: 'shared', root: f.repo, base: f.base }); assert.equal(f.creates, 0); assert.equal(f.launched[0].cwd, f.repo);
  assert.equal(f.descriptor('a').workspace, 'shared'); assert.equal(fs.readFileSync(path.join(f.repo, 'file'), 'utf8'), 'uncommitted parent work');
  assert.equal(exec('git', ['branch', '--list', 'rex/*'], f.repo).trim(), '');
  await f.launch('shared'); assert.equal(f.launched.length, 1); await assert.rejects(f.launch('worktree'), /identity conflict/);
});
test('worktree is a clean committed-base option without disturbing dirty parent files', async t => {
  const f = setup(t), result = await f.launch('worktree');
  assert.equal(f.creates, 1); assert.equal(result.workspace.mode, 'worktree'); assert.notEqual(result.workspace.root, f.repo);
  assert.equal(fs.readFileSync(path.join(result.workspace.root, 'file'), 'utf8'), 'committed'); assert.equal(fs.readFileSync(path.join(f.repo, 'file'), 'utf8'), 'uncommitted parent work');
});
test('all shared roles serialize; isolated agents can run and shared followups recheck ownership', async t => {
  const f = setup(t); await f.launch('shared', 'one');
  await assert.rejects(f.launch('shared', 'two', { profileName: 'writer' }), /unfinished agent/);
  assert.equal(f.c.store.state.agents.two, undefined); await f.launch('worktree', 'isolated');
  const descriptor = f.descriptor('one'); let seq = 0;
  const child = (op, payload) => f.c.domain.dispatch({ group: 'g', agent: 'one', task: 't', generation: 1, token: descriptor.token, requestId: `child-${++seq}`, op, ...payload });
  for (const command of f.c.store.state.agents.one.commands) child('ack', { command: command.id });
  child('result', { status: 'success', text: 'Complete' }); child('event', { kind: 'idle', text: 'Settled' });
  await f.launch('shared', 'two');
  await assert.rejects(f.c.dispatch({ group: 'g', token: f.token, agent: 'one', requestId: 'resume-one', op: 'followup', task: 'next', text: 'Continue' }), /unfinished agent/);
  assert.equal(f.c.store.state.agents.one.generation, 1);
  const second = f.descriptor('two'); let secondSeq = 0;
  const secondChild = (op, payload) => f.c.domain.dispatch({ group: 'g', agent: 'two', task: 't', generation: 1, token: second.token, requestId: `second-${++secondSeq}`, op, ...payload });
  f.c.domain.dispatch({ group: 'g', token: f.token, agent: 'two', requestId: 'stop-two', op: 'stop' });
  for (const command of f.c.store.state.agents.two.commands) secondChild('ack', { command: command.id });
  secondChild('event', { kind: 'stopped', text: 'Confirmed cooperative stop' });
  await f.launch('shared', 'three');
});
test('model-visible launch requires an explicit workspace without a default', () => {
  const tools = {}, pi = { on() {}, registerTool(t) { tools[t.name] = t; } }; installParent(pi, { request() {}, journal: {} });
  const schema = tools.rex_launch.parameters; assert.ok(schema.required.includes('workspace')); assert.deepEqual(schema.properties.workspace.enum, ['shared', 'worktree']); assert.equal(schema.properties.workspace.default, undefined);
});
