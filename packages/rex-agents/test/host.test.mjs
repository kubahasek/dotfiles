import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { serve } from '../src/transport.mjs';
import { childInvocation } from '../src/child-launch.mjs';
import { fixture } from './support.mjs';
import { available, host, loop, until } from './loop-support.mjs';

test('installed Pi loader loads the reporting bridge but skips recursive parent registration', { skip: !available }, async () => {
  const f = fixture(), descriptor = path.join(f.dir, 'descriptor.json');
  fs.writeFileSync(descriptor, JSON.stringify({ version: 3, stateDir: path.join(f.dir, 'child'), profile: f.d.store.state.agents.a.profile, root: f.dir, socket: path.join(f.dir, 'control.sock'), group: 'g', agent: 'a', token: f.child }), { mode: 0o600 });
  const previous = process.env.REX_AGENT_DESCRIPTOR; process.env.REX_AGENT_DESCRIPTOR = descriptor;
  try {
    const { loadExtensions } = await import(pathToFileURL(path.join(host, 'dist/core/extensions/loader.js')));
    const result = await loadExtensions([path.resolve('extensions/parent.ts'), path.resolve('extensions/child.ts')], f.dir);
    assert.deepEqual(result.errors, []); assert.equal(result.extensions.length, 2);
    assert.equal(result.extensions[0].tools.size, 0); assert.equal(result.extensions[1].tools.size, 3);
  } finally {
    if (previous === undefined) delete process.env.REX_AGENT_DESCRIPTOR; else process.env.REX_AGENT_DESCRIPTOR = previous;
    fs.rmSync(f.dir, { recursive: true });
  }
});
test('normal Pi CLI interactive PTY starts with ordinary disposable HOME and no task/provider request', { skip: !available, timeout: 20000 }, async t => {
  const f = fixture(), service = await serve(f.d, f.dir), descriptor = path.join(f.dir, 'descriptor.json');
  const config = { version: 3, piExecutable: path.join(host, 'dist/cli.js'), stateDir: path.join(f.dir, 'child'), sessionFile: path.join(f.dir, 'session.jsonl'), profile: { model: 'anthropic/claude-sonnet-4-5', instructions: 'Startup only; no provider requests' }, root: f.dir, socket: path.join(f.dir, 'control.sock'), group: 'g', agent: 'a', token: f.child };
  fs.writeFileSync(descriptor, JSON.stringify(config), { mode: 0o600 });
  const invocation = childInvocation(config, descriptor, { PATH: process.env.PATH, HOME: f.dir, TERM: 'xterm-256color', PI_OFFLINE: '1' });
  // Offline is a fixture-only switch, never a production launch restriction.
  const argv = [process.execPath, path.resolve('src/child-process.mjs'), descriptor];
  assert.equal(invocation.env.HOME, f.dir); assert.equal(invocation.env.PI_OFFLINE, '1');
  const script = `import pty,os,sys,json,select,time,signal\na=json.loads(sys.argv[1]);e=json.loads(sys.argv[2]);pid,fd=pty.fork()\nif pid==0:\n os.chdir(e['HOME']);os.execve(a[0],a,e)\nend=time.time()+12\nwhile time.time()<end:\n r,_,_=select.select([fd,sys.stdin],[],[],0.1)\n if sys.stdin in r:\n  os.write(fd,b'\\x04');break\n if fd in r:\n  try: os.read(fd,65536)\n  except OSError: break\ntry: os.kill(pid,signal.SIGTERM)\nexcept ProcessLookupError: pass\nlimit=time.time()+2\nwhile time.time()<limit:\n if os.waitpid(pid,os.WNOHANG)[0]: os._exit(0)\n r,_,_=select.select([fd],[],[],0.05)\n if fd in r:\n  try: os.read(fd,65536)\n  except OSError: pass\ntry: os.killpg(pid,signal.SIGKILL)\nexcept ProcessLookupError: pass\nos.close(fd)\nos.waitpid(pid,0)\n`;
  const child = spawn('python3', ['-c', script, JSON.stringify(argv), JSON.stringify(invocation.env)], { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = ''; child.stderr.on('data', b => stderr += b.toString());
  t.after(async () => { child.stdin.end(); if (child.exitCode === null) child.kill('SIGTERM'); await service.close(); fs.rmSync(f.dir, { recursive: true }); });
  let heartbeat = false;
  for (let i = 0; i < 100; i++) { if (f.d.heartbeat('a')) { heartbeat = true; break; } if (child.exitCode !== null) break; await new Promise(r => setTimeout(r, 100)); }
  assert.ok(heartbeat, `No host session handshake: ${stderr}`); assert.equal(f.request('overview').children.messages, 0);
  f.request('stop');
  for (let i = 0; i < 40 && !f.d.store.state.agents.a.commands.find(c => c.type === 'stop')?.ack; i++) await new Promise(r => setTimeout(r, 100));
  assert.ok(f.d.store.state.agents.a.commands.find(c => c.type === 'stop')?.ack);
  child.stdin.write('stop\n'); await new Promise(resolve => child.once('exit', resolve));
  assert.equal(child.exitCode, 0, stderr);
});

test('production descriptor bridge runs deterministic SDK task with no paid provider calls', { skip: !available, timeout: 15000 }, async t => {
  const l = await loop({ descriptorAdapter: true, responses: [[{ type: 'text', text: 'Normal Pi bridge task' }]] });
  t.after(() => l.close()); await until(() => l.calls === 1 && l.session.isIdle);
  assert.ok(l.d.heartbeat('a')); assert.equal(l.calls, 1);
});
