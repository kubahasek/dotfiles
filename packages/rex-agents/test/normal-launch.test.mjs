import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { childInvocation } from '../src/child-launch.mjs';
import { Store } from '../src/storage.mjs';
import { readConfig } from '../src/coordinator.mjs';
import { profile } from '../src/domain.mjs';
import { assertSharedWriterAvailable } from '../src/workspaces.mjs';
import { temp, p } from './support.mjs';

test('one normal CLI invocation preserves HOME, auth and resources and appends role guidance', () => {
  const ambient = { HOME: '/normal/home', PATH: '/bin', PROVIDER_API_KEY: 'synthetic', PI_CODING_AGENT_DIR: '/operator/pi' };
  const c = { version: 3, piExecutable: '/bin/pi', profile: p, sessionFile: '/state/session.jsonl', root: '/repo' };
  const launch = childInvocation(c, '/state/descriptor.json', ambient);
  assert.equal(launch.executable, '/bin/pi'); assert.equal(launch.cwd, '/repo');
  assert.deepEqual(launch.env, { ...ambient, REX_AGENT_DESCRIPTOR: '/state/descriptor.json' });
  assert.ok(launch.argv.includes('--append-system-prompt')); assert.ok(launch.argv.includes(p.model));
  assert.ok(!launch.argv.some(x => x.startsWith('--no-')));
  for (const option of ['--tools', '--system-prompt']) assert.ok(!launch.argv.includes(option));
  assert.equal(launch.argv.at(-2), '-e'); assert.match(launch.argv.at(-1), /extensions\/child\.ts$/);
  assert.deepEqual(ambient, { HOME: '/normal/home', PATH: '/bin', PROVIDER_API_KEY: 'synthetic', PI_CODING_AGENT_DIR: '/operator/pi' });
});
test('legacy runtime/config/state cannot be reinterpreted, overwritten or relaunched', () => {
  const dir = temp();
  try {
    const file = path.join(dir, 'state.json'), content = JSON.stringify({ version: 2, retained: 'old records' });
    fs.writeFileSync(file, content, { mode: 0o600 }); assert.throws(() => new Store(dir), /Unsupported state version/); assert.equal(fs.readFileSync(file, 'utf8'), content);
    fs.writeFileSync(file, JSON.stringify({ version: 3, usage: { retained: 'historical receipt' } }), { mode: 0o600 });
    const historical = fs.readFileSync(file, 'utf8'); assert.throws(() => new Store(dir), /Unsupported state version/); assert.equal(fs.readFileSync(file, 'utf8'), historical);
    const config = path.join(dir, 'config.json'); fs.writeFileSync(config, '{"panesPerTab":3}', { mode: 0o600 }); assert.throws(() => readConfig(config), /Unsupported configuration version/);
    assert.throws(() => childInvocation({ profile: p }, '/old'), /Unsupported child descriptor/);
    fs.writeFileSync(config, JSON.stringify({ version: 3, stateDir: dir, worktreeRoot: path.join(dir, 'trees'), repo: dir, piExecutable: '/bin/pi', group: 'g', rexSession: 'session:fixture', profiles: { reader: p } }), { mode: 0o600 });
    assert.throws(() => readConfig(config), /Unsupported state version/);
    assert.equal(fs.readFileSync(file, 'utf8'), historical);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test('roles are initial model and guidance, not capability ceilings', () => {
  assert.deepEqual(profile(p), p);
  assert.throws(() => profile({ ...p, tools: ['read'], ceiling: 'observer' }), /only model and instructions/);
});
test('shared agents serialize irrespective of legacy role name or group', () => {
  const workspace = { mode: 'shared', root: '/repo' };
  const agents = { observer: { group: 'other', workspace, profile: { ceiling: 'observer' }, lifecycle: 'running', commands: [], requests: {} } };
  assert.throws(() => assertSharedWriterAvailable(agents, 'g', workspace, p), /unfinished agent/);
  assert.doesNotThrow(() => assertSharedWriterAvailable(agents, 'g', { mode: 'worktree', root: '/isolated' }, p));
});
