import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Coordinator, readConfig } from '../src/coordinator.mjs';
import { exec, paneCapacity } from '../src/adapters.mjs';
import { temp, p } from './support.mjs';

test('explicit/direct capacity validation precedes state creation; valid boundaries launch, invalid updates have no launch effects', async t => {
  const dir = fs.realpathSync(temp()); t.after(() => fs.rmSync(dir, { recursive: true }));
  const repo = path.join(dir, 'repo'); fs.mkdirSync(repo); exec('git', ['init', '-q'], repo);
  fs.writeFileSync(path.join(repo, 'README.md'), 'synthetic fixture'); exec('git', ['add', 'README.md'], repo);
  exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base'], repo);
  const base = exec('git', ['rev-parse', 'HEAD'], repo).trim();
  const providerEnvFile = path.join(dir, 'provider.json'); fs.writeFileSync(providerEnvFile, '{}', { mode: 0o600 });
  let creates = 0, launches = 0;
  const adapters = { git: { create() { creates++; } }, rex: { launch() { launches++; return { block_id: 'block:fixture' }; } } };
  const config = index => ({ version: 3, repo, stateDir: path.join(dir, `state-${index}`), worktreeRoot: path.join(dir, `worktrees-${index}`), group: 'g', rexSession: 'session:fixture', profiles: { reader: p }, piExecutable: '/operator/pi' });
  const invalid = [0, 9, 16, 1.5, '3', null];
  for (const [index, value] of invalid.entries()) {
    const c = { ...config(index), panesPerTab: value }, file = path.join(dir, `operator-${index}.json`);
    fs.writeFileSync(file, JSON.stringify(c), { mode: 0o600 });
    assert.throws(() => readConfig(file), /Invalid pane capacity/);
    assert.throws(() => new Coordinator(c.stateDir, c, adapters), /Invalid pane capacity/);
    assert.equal(fs.existsSync(c.stateDir), false); assert.equal(fs.existsSync(c.worktreeRoot), false);
  }
  assert.equal(creates, 0); assert.equal(launches, 0); assert.equal(paneCapacity(), 3);
  for (const capacity of [1, 8]) {
    const c = { ...config(`valid-${capacity}`), panesPerTab: capacity }, file = path.join(dir, `valid-${capacity}.json`);
    fs.writeFileSync(file, JSON.stringify(c), { mode: 0o600 });
    const coordinator = new Coordinator(c.stateDir, readConfig(file), adapters), token = coordinator.domain.bootstrap('g');
    const launch = agent => coordinator.dispatch({ op: 'launch', group: 'g', token, requestId: `launch-${agent}`, agent, task: 't', text: 'Approved fixture task', workspace: 'worktree', profileName: 'reader', base });
    const before = fs.readFileSync(path.join(c.stateDir, 'state.json'), 'utf8');
    for (const value of invalid) {
      coordinator.config.panesPerTab = value;
      await assert.rejects(launch('rejected'), /Invalid pane capacity/);
      assert.deepEqual(Object.keys(coordinator.store.state.agents), []);
      assert.equal(fs.readFileSync(path.join(c.stateDir, 'state.json'), 'utf8'), before);
      assert.equal(fs.existsSync(path.join(c.stateDir, 'children')), false); assert.deepEqual(fs.readdirSync(c.worktreeRoot), []);
    }
    assert.equal(creates, launches); assert.equal(creates, capacity === 1 ? 0 : 1);
    coordinator.config.panesPerTab = capacity; const result = await launch('accepted');
    assert.equal(result.launch.status, 'recorded');
  }
  assert.equal(creates, 2); assert.equal(launches, 2);
});
