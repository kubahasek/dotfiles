import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Coordinator } from '../src/coordinator.mjs';
import { connect } from '../src/client.mjs';
import { exec } from '../src/adapters.mjs';
import { temp, p } from './support.mjs';
function setup() {
  const dir = temp(), repo = path.join(dir, 'repo'); fs.mkdirSync(repo); exec('git', ['init', '-q'], repo); fs.writeFileSync(path.join(repo, 'file'), 'base'); exec('git', ['add', 'file'], repo); exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base'], repo);
  const base = exec('git', ['rev-parse', 'HEAD'], repo).trim(); fs.writeFileSync(path.join(repo, 'file'), 'unrelated dirty');
  const stateDir = path.join(dir, 'state'), worktreeRoot = path.join(dir, 'worktrees'); fs.mkdirSync(stateDir, { mode: 0o700 }); fs.mkdirSync(worktreeRoot, { mode: 0o700 });
  return { dir, base, config: { version: 3, stateDir, worktreeRoot, repo, group: 'g', rexSession: 'session:fake', profiles: { reader: p }, piExecutable: '/operator/pi', panesPerTab: 2 } };
}
test('detached coordinator reconnect uses same daemon after parent disconnect', async t => {
  const f = setup(), file = path.join(f.dir, 'operator.json'); fs.writeFileSync(file, JSON.stringify(f.config), { mode: 0o600 }); let pid;
  t.after(async () => { if (pid) { try { process.kill(pid, 'SIGTERM'); } catch {} for (let i = 0; i < 40 && fs.existsSync(path.join(f.config.stateDir, 'coordinator.lock')); i++) await new Promise(r => setTimeout(r, 50)); } fs.rmSync(f.dir, { recursive: true }); });
  const first = await connect(file); pid = Number(fs.readFileSync(path.join(f.config.stateDir, 'coordinator.lock')));
  const second = await connect(file); assert.equal(Number(fs.readFileSync(path.join(f.config.stateDir, 'coordinator.lock'))), pid);
  assert.equal((await first.request('overview')).totalChildren, 0); assert.equal((await second.request('overview')).totalChildren, 0);
});
test('lost launch reply stays visible across restart without replacement launch or reconciliation', async () => {
  const f = setup(); let launches = 0;
  const rex = { launch() { launches++; throw Error('private subprocess diagnostic'); }, list() { return { blocks: [{ block_id: 'block:existing', label: 'rex-agent-1_g_a' }] }; } };
  let c = new Coordinator(f.config.stateDir, f.config, { rex }); const token = c.domain.bootstrap('g');
  const launch = { group: 'g', token, agent: 'a', task: 't', requestId: 'launch1', op: 'launch', text: 'Inspect', workspace: 'worktree', profileName: 'reader', base: f.base };
  await assert.rejects(c.dispatch(launch), e => /LAUNCH_UNCERTAIN/.test(e.message) && !e.message.includes('private subprocess'));
  c = new Coordinator(f.config.stateDir, f.config, { rex }); await c.dispatch(launch); assert.equal(launches, 1);
  const before = fs.readFileSync(c.store.file, 'utf8');
  const inspected = await c.dispatch({ group: 'g', token, requestId: 'inspect1', op: 'inspect', offset: 0 });
  assert.equal(inspected.items[0].launchUncertain, true); assert.equal(inspected.items[0].panePresent, true); assert.equal(fs.readFileSync(c.store.file, 'utf8'), before);
  await assert.rejects(c.dispatch({ ...launch, requestId: 'retired', op: 'reconcile-launch' }), /Unknown operation/);
  assert.equal(fs.readFileSync(path.join(f.config.worktreeRoot, '1_g_a/file'), 'utf8'), 'base'); assert.equal(fs.readFileSync(path.join(f.config.repo, 'file'), 'utf8'), 'unrelated dirty');
  fs.rmSync(f.dir, { recursive: true });
});
