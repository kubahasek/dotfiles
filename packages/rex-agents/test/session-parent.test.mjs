import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { exec } from '../src/adapters.mjs';
import { resolveParentSession, parentKey, validRexSession } from '../src/session-config.mjs';
import { installSessionParent } from '../src/session-parent.mjs';
import { installParent } from '../src/parent.mjs';
import { connect } from '../src/client.mjs';
import { Journal } from '../src/journal.mjs';
import { temp, p, fixture } from './support.mjs';
import { host, available, sleep } from './loop-support.mjs';
const rex1 = 'session:00000000-0000-0000-0000-000000000001', rex2 = 'session:00000000-0000-0000-0000-000000000002';
function api() {
  const handlers = new Map(), tools = new Map(); let active = [];
  return {
    tools, handlers,
    pi: {
      on(name, fn) { const list = handlers.get(name) ?? []; list.push(fn); handlers.set(name, list); return () => { const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); }; },
      registerTool(tool) { tools.set(tool.name, tool); active = active.filter(name => name !== tool.name); if (tool.exposure !== 'hidden') active.push(tool.name); },
      getActiveTools: () => [...active], setActiveTools: names => { active = names; },
    },
    async emit(name, ctx) { for (const fn of [...(handlers.get(name) ?? [])]) await fn({}, ctx); },
  };
}
function context(cwd, sessionId = 'parent-one', hasUI = true) {
  const statuses = [];
  return { cwd, hasUI, statuses, ui: { setStatus(key, value) { statuses.push({ key, value }); } }, sessionManager: { getSessionId: () => sessionId, getEntries: () => [] } };
}
function setup(t, { cleanup = true } = {}) {
  const dir = fs.realpathSync(temp()); if (cleanup) t.after(() => fs.rmSync(dir, { recursive: true }));
  const repo = path.join(dir, 'repo'), secondRepo = path.join(dir, 'second-repo');
  for (const root of [repo, secondRepo]) { fs.mkdirSync(root); exec('git', ['init', '-q'], root); fs.writeFileSync(path.join(root, 'README.md'), 'synthetic fixture'); exec('git', ['add', 'README.md'], root); exec('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'base'], root); }
  const source = path.join(dir, 'auth.json'); fs.writeFileSync(source, JSON.stringify({ test: { type: 'api_key', key: 'SYNTHETIC-PRIVATE-KEY-NEVER-COPIED' } }), { mode: 0o600 });
  const settings = { version: 3, piExecutable: path.join(host, 'dist/cli.js'), profiles: { reader: p }, stateRoot: path.join(dir, 'state'), worktreeRoot: path.join(dir, 'worktrees'), panesPerTab: 3 };
  const file = path.join(dir, 'settings.json'); const save = value => fs.writeFileSync(file, JSON.stringify(value), { mode: 0o600 }); save(settings);
  const env = { PATH: process.env.PATH, HOME: dir, REX_AGENTS_SETTINGS: file, REX_SESSION: rex1 };
  const resolve = (ctx, overrides = {}) => resolveParentSession(ctx, { env: { ...env, ...overrides }, inspectRex: s => [rex1, rex2].includes(s) });
  return { dir, repo, secondRepo, source, settings, file, env, resolve, save };
}

test('global resolver binds canonical Git/current Rex/session identity; resume is stable, new parents and projects isolate state', t => {
  const f = setup(t), ctx = context(f.repo), subdir = path.join(f.repo, 'subdir'); fs.mkdirSync(subdir);
  const alias = path.join(f.dir, 'alias'); fs.symlinkSync(f.repo, alias);
  const a = f.resolve(ctx), resumed = f.resolve(context(path.join(alias, 'subdir')));
  assert.equal(a.enabled, true); assert.equal(a.configFile, resumed.configFile);
  const first = JSON.parse(fs.readFileSync(a.configFile)); assert.equal(first.repo, f.repo); assert.equal(first.rexSession, rex1);
  const b = f.resolve(context(f.secondRepo, 'parent-two'), { REX_SESSION: rex2 }); const second = JSON.parse(fs.readFileSync(b.configFile));
  assert.notEqual(a.key, b.key); assert.notEqual(first.stateDir, second.stateDir); assert.notEqual(first.worktreeRoot, second.worktreeRoot); assert.equal(second.repo, f.secondRepo); assert.equal(second.rexSession, rex2);
  const fresh = f.resolve(context(f.repo, 'new-parent')); assert.notEqual(fresh.configFile, a.configFile);
  assert.equal(f.resolve(context(f.secondRepo)).enabled, false); assert.equal(f.resolve(ctx, { REX_SESSION: rex2 }).enabled, false);
  assert.equal(fs.statSync(a.configFile).mode & 0o777, 0o600); assert.equal(fs.statSync(first.stateDir).mode & 0o777, 0o700);
  assert.ok(!fs.readFileSync(a.configFile, 'utf8').includes('SYNTHETIC-PRIVATE-KEY-NEVER-COPIED'));
  assert.equal(fs.existsSync(path.join(first.stateDir, 'auth.json')), false);
  assert.match(parentKey(context(f.repo, '../../arbitrary\nidentity')), /^parent-[0-9a-f]{32}$/);
  f.save({ ...f.settings, panesPerTab: 4 }); assert.equal(f.resolve(ctx).enabled, false); assert.equal(JSON.parse(fs.readFileSync(a.configFile)).panesPerTab, 3);
});

test('live parent block routing changes on resume without rewriting the immutable runtime binding', t => {
  const f = setup(t), ctx = context(f.repo);
  const firstBlock = 'block:00000000-0000-0000-0000-000000000001', nextBlock = 'block:00000000-0000-0000-0000-000000000002';
  const first = f.resolve(ctx, { REX_BLOCK: firstBlock }), before = fs.readFileSync(first.configFile, 'utf8');
  const resumed = f.resolve(ctx, { REX_BLOCK: nextBlock });
  assert.equal(first.parentBlock, firstBlock); assert.equal(resumed.parentBlock, nextBlock); assert.equal(resumed.enabled, true); assert.equal(resumed.configFile, first.configFile);
  assert.equal(fs.readFileSync(first.configFile, 'utf8'), before); assert.equal(JSON.parse(before).parentBlock, undefined);
  assert.equal(f.resolve(ctx, { REX_BLOCK: 'arbitrary-alias' }).parentBlock, undefined);
});

test('global pane capacity accepts only 1..8 before runtime directories or metadata probes', t => {
  const f = setup(t); let probes = 0;
  for (const value of [0, 9, 16, 1.5, '3', null]) {
    f.save({ ...f.settings, panesPerTab: value });
    const result = resolveParentSession(context(f.repo), { env: f.env, inspectRex() { probes++; return true; }, resolveGit() { probes++; return f.repo; } });
    assert.equal(result.enabled, false); assert.equal(result.reason, 'invalid private settings');
    assert.equal(fs.existsSync(f.settings.stateRoot), false); assert.equal(fs.existsSync(f.settings.worktreeRoot), false);
  }
  assert.equal(probes, 0);
  for (const value of [1, 8]) {
    f.save({ ...f.settings, panesPerTab: value }); const result = f.resolve(context(f.repo, `capacity-${value}`));
    assert.equal(result.enabled, true); assert.equal(JSON.parse(fs.readFileSync(result.configFile)).panesPerTab, value);
  }
});

test('unconfigured/outside Rex/non-Git/invalid settings disable cleanly without runtime state or secret diagnostics', t => {
  const f = setup(t), ctx = context(f.dir);
  for (const overrides of [{ REX_AGENTS_SETTINGS: path.join(f.dir, 'absent') }, { REX_SESSION: undefined }, { REX_SESSION: 'session:unrelated' }, {}]) {
    const result = f.resolve(ctx, overrides); assert.equal(result.enabled, false); assert.ok(!JSON.stringify(result).includes('SYNTHETIC-PRIVATE-KEY-NEVER-COPIED'));
    assert.equal(fs.existsSync(f.settings.stateRoot), false);
  }
  fs.chmodSync(f.file, 0o644); assert.equal(f.resolve(context(f.repo)).reason, 'invalid private settings'); fs.chmodSync(f.file, 0o600);
  f.save({ ...f.settings, repo: f.repo }); assert.equal(f.resolve(context(f.repo)).enabled, false);
  fs.writeFileSync(f.file, '{"secret":"SYNTHETIC-SETTINGS-PARSE-CANARY"', { mode: 0o600 });
  assert.ok(!JSON.stringify(f.resolve(context(f.repo))).includes('CANARY'));
  assert.equal(fs.existsSync(f.settings.stateRoot), false);
});

async function rexMetadata(t) {
  const f = setup(t, { cleanup: false }), servers = [], bin = path.join(f.dir, 'bin'); fs.mkdirSync(bin);
  t.after(async () => { for (const server of servers) await new Promise(resolve => server.close(resolve)); fs.rmSync(f.dir, { recursive: true }); });
  const directory = path.join(f.dir, 'Application Support/rex'); fs.mkdirSync(directory, { recursive: true });
  const sockets = [path.join(directory, 'server.sock'), path.join(directory, 'other.sock')];
  for (const socket of sockets) { const server = net.createServer(); servers.push(server); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); }); }
  const url = file => pathToFileURL(file).href.replace(/^file:/, 'unix:');
  const endpoint = url(sockets[0]), log = path.join(f.dir, 'rex-argv.jsonl'), reply = path.join(f.dir, 'rex-reply.json');
  const respond = value => fs.writeFileSync(reply, JSON.stringify(value), { mode: 0o600 }); respond({ endpoint, session: rex1 });
  fs.writeFileSync(path.join(bin, 'rex'), `#!${process.execPath}\nconst fs=require('fs'),a=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({args:a,server:process.env.REX_SERVER,secret:process.env.REX_TEST_SECRET,home:process.env.HOME})+'\\n',{mode:0o600});const r=JSON.parse(fs.readFileSync(${JSON.stringify(reply)}));console.log(JSON.stringify(a[1]==='whoami'?{endpoint:r.endpoint}:{session_id:r.session}));`, { mode: 0o700 });
  const env = { ...f.env, PATH: bin, REX_TEST_SECRET: 'DO-NOT-INHERIT' };
  const calls = () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
  const clear = () => { if (fs.existsSync(log)) fs.unlinkSync(log); };
  return { ...f, env, endpoint, sockets, url, respond, calls, clear };
}

test('Rex metadata uses only the exact session and verified default Unix endpoint without inherited overrides, credentials or autostart', async t => {
  const f = await rexMetadata(t);
  assert.equal(validRexSession(rex1, f.env), true); // Missing REX_SERVER remains supported.
  assert.deepEqual(f.calls(), [
    { args: ['--autostart=false', 'whoami', '--json'], home: f.dir },
    { args: ['--autostart=false', 'session', 'inspect', rex1, '--json'], home: f.dir },
  ]);
  f.clear(); assert.equal(validRexSession('unrelated-label', f.env), false); assert.equal(f.calls().length, 0);
  assert.match(f.endpoint, /Application%20Support/);
  const native = { ...f.env, REX_SERVER: f.endpoint }, before = { ...native };
  assert.equal(validRexSession(rex1, native), true); assert.deepEqual(native, before);
  assert.equal(f.calls().length, 2); assert.ok(f.calls().every(c => !Object.hasOwn(c, 'server') && !Object.hasOwn(c, 'secret')));
  f.clear(); assert.equal(validRexSession(rex1, { ...native, REX_SERVER: decodeURIComponent(f.endpoint) }), true);
  const alias = path.join(f.dir, 'alias.sock'); fs.symlinkSync(f.sockets[0], alias);
  assert.equal(validRexSession(rex1, { ...native, REX_SERVER: f.url(alias) }), true);
});

test('native Unix endpoint mismatch, remote aliases/URLs and malformed socket references reject without session inspection or runtime state', async t => {
  const f = await rexMetadata(t);
  const invalid = ['remote', 'localhost:1234', 'tcp://127.0.0.1:1234', 'http://localhost:1234', 'https://example.invalid', f.sockets[0], 'unix:relative', 'unix://localhost/tmp/server.sock', 'unix://user@host/tmp/server.sock', 'unix:///', 'unix:////tmp/server.sock', `${f.endpoint}?query`, `${f.endpoint}#fragment`, `${f.endpoint}%00`, `${f.endpoint}%ZZ`, `${f.endpoint}\n`, `${f.endpoint}/../server.sock`, f.url(path.join(f.dir, 'absent.sock')), f.url(f.file), f.url(f.dir)];
  for (const endpoint of invalid) { assert.equal(validRexSession(rex1, { ...f.env, REX_SERVER: endpoint }), false); assert.equal(f.calls().length, 0); }
  assert.equal(validRexSession(rex1, { ...f.env, REX_SERVER: f.url(f.sockets[1]) }), false);
  assert.deepEqual(f.calls().map(c => c.args), [['--autostart=false', 'whoami', '--json']]); f.clear();
  const disabled = resolveParentSession(context(f.repo), { env: { ...f.env, REX_SERVER: f.url(f.sockets[1]) }, resolveGit: () => f.repo });
  assert.equal(disabled.enabled, false); assert.equal(fs.existsSync(f.settings.stateRoot), false); assert.equal(fs.existsSync(f.settings.worktreeRoot), false);
});

test('untrusted default endpoint or wrong inspected session fails closed; matching native Unix environment enables global settings', async t => {
  const f = await rexMetadata(t), env = { ...f.env, REX_SERVER: f.endpoint };
  for (const endpoint of ['tcp://localhost:1234', 'remote-alias', 'unix://localhost/tmp/server.sock', `${f.endpoint}%ZZ`, f.url(f.file)]) {
    f.respond({ endpoint, session: rex1 }); f.clear(); assert.equal(validRexSession(rex1, env), false); assert.equal(f.calls().length, 1);
  }
  f.respond({ endpoint: f.endpoint, session: rex2 }); f.clear(); assert.equal(validRexSession(rex1, env), false); assert.equal(f.calls().length, 2);
  f.respond({ endpoint: f.endpoint, session: rex1 }); f.clear();
  const enabled = resolveParentSession(context(f.repo), { env, resolveGit: () => f.repo }); assert.equal(enabled.enabled, true);
  assert.equal(JSON.parse(fs.readFileSync(enabled.configFile)).rexSession, rex1);
  assert.ok(f.calls().every(c => !Object.hasOwn(c, 'server') && !Object.hasOwn(c, 'secret')));
});

test('session-managed adapter has no factory resources; new/resume replacement withdraws stale tools and unsubscribes old polling', async t => {
  const f = setup(t), a = api(); let connections = 0;
  installSessionParent(a.pi, { resolve: f.resolve, intervalMs: 100000, connectSession: async file => {
    connections++; const config = JSON.parse(fs.readFileSync(file));
    return { config, request: async op => op === 'overview' ? { activeChildren: 0, totalChildren: 0, pendingRequests: 0, children: { knownEstimate: 0, unknownPrices: 0 } } : { group: config.group } };
  } });
  assert.equal(connections, 0); assert.equal(a.tools.size, 0); assert.equal(fs.existsSync(f.settings.stateRoot), false);
  const first = context(f.repo); await a.emit('session_start', first); assert.equal(connections, 1); assert.ok(a.pi.getActiveTools().includes('rex_launch'));
  const oldTool = a.tools.get('rex_inspect');
  await a.emit('session_shutdown', first); assert.equal(a.pi.getActiveTools().length, 0); assert.equal(a.handlers.get('turn_end').length, 0);
  assert.equal((await oldTool.execute('stale', {})).isError, true);
  const second = context(f.secondRepo, 'parent-two'); await a.emit('session_start', second); assert.equal(connections, 2);
  assert.equal(a.handlers.get('turn_end').length, 1); const result = await a.tools.get('rex_inspect').execute('new', { offset: 0 }); assert.equal(result.details.group, parentKey(second));
  await a.emit('session_shutdown', second);
  await a.emit('session_start', first); assert.equal(connections, 3); assert.equal(a.handlers.get('turn_end').length, 1);
  await a.emit('session_start', context(f.dir, 'outside')); assert.equal(a.pi.getActiveTools().length, 0); assert.equal(a.handlers.get('turn_end').length, 0); assert.equal(connections, 3);
  await a.emit('session_shutdown');
});

test('shutdown during asynchronous activation cannot install stale tools, a journal or a poller', async t => {
  const f = setup(t), a = api(); let release, entered;
  const began = new Promise(resolve => { entered = resolve; });
  const waiting = new Promise(resolve => { release = resolve; });
  const bridge = installSessionParent(a.pi, { resolve: f.resolve, connectSession: async file => { entered(); await waiting; return { config: JSON.parse(fs.readFileSync(file)), request: async () => { throw Error('Stale request'); } }; } });
  const starting = a.emit('session_start', context(f.repo)); await began;
  const shuttingDown = a.emit('session_shutdown'); release(); await Promise.all([starting, shuttingDown]);
  assert.equal(a.tools.size, 0); assert.equal(a.handlers.get('turn_end'), undefined);
  const config = JSON.parse(fs.readFileSync(f.resolve(context(f.repo)).configFile)); assert.equal(fs.existsSync(path.join(config.stateDir, 'parent-bridge')), false);
  await bridge.stop();
});

test('explicit config remains authoritative without global settings/Rex environment and needs no parent journal', async t => {
  const f = setup(t), file = path.join(f.dir, 'explicit.json'); fs.writeFileSync(file, '{}', { mode: 0o600 });
  const resolve = ctx => resolveParentSession(ctx, { env: { REX_AGENTS_CONFIG: file } });
  const ctx = context(f.dir), resolved = resolve(ctx); assert.equal(resolved.mode, 'explicit'); assert.equal(resolved.configFile, file);
  const a = api(); let seen;
  installSessionParent(a.pi, { resolve, connectSession: async value => { seen = value; return { config: { stateDir: path.join(f.dir, 'explicit-state') }, request: async () => ({ activeChildren: 0, totalChildren: 0, pendingRequests: 0, children: { knownEstimate: 0, unknownPrices: 0 } }) }; } });
  await a.emit('session_start', ctx); assert.equal(seen, file); assert.equal(fs.existsSync(path.join(f.dir, 'explicit-state/parent-bridge')), false); await a.emit('session_shutdown', ctx);
  const broken = api(); installSessionParent(broken.pi, { resolve, connectSession: async () => { throw Error('PRIVATE-CONFIG-CANARY'); } }); await broken.emit('session_start', ctx);
  assert.equal(broken.tools.size, 0); assert.ok(!JSON.stringify(ctx.statuses).includes('CANARY'));
});

test('parent footer summarizes all group children, pending requests and known/unknown estimates; updates, disconnect, headless and stop are safe', async t => {
  const f = fixture(); t.after(() => fs.rmSync(f.dir, { recursive: true }));
  f.childRequest('request', { question: 'q', kind: 'question', text: 'Fixture question', scope: 'fixture' });
  const tokens = { input: 200, output: 20, cacheRead: 0, cacheWrite: 0 };
  f.childRequest('usage-snapshot', { session: 'child-session', revision: 1, summary: { messages: 2, tokens, knownEstimate: 0.012154, unknownPrices: 1 } });
  // Counts do not silently truncate at a ten-agent status page, or include another group.
  for (let i = 0; i < 11; i++) f.request('create', { agent: `other${i}`, task: 't', profile: p });
  const other = f.d.bootstrap('other'); f.d.dispatch({ op: 'create', group: 'other', token: other, requestId: 'other-create', agent: 'hidden', task: 't', profile: p });
  const a = api(), ctx = context(f.dir); let fail = false;
  const parent = installParent(a.pi, { journal: new Journal(path.join(f.dir, 'parent-journal')), lifecycle: false, intervalMs: 100000, request: async (op, args) => { if (fail) throw Error('PRIVATE-ERROR-CANARY'); return f.request(op, args); } });
  await parent.start(ctx); assert.match(ctx.statuses.at(-1).value, /Agents 12\/12 active · 1 pending · child est \$0.0122 \+1 unknown/);
  const totals = f.request('overview'); assert.equal(totals.children.estimate, null); assert.equal(totals.children.knownEstimate, 0.012154);
  assert.throws(() => f.childRequest('overview'), /Parent required/);
  f.request('answer', { question: 'q', text: 'Fixture answer' }); await parent.tick(); assert.match(ctx.statuses.at(-1).value, /0 pending/);
  fail = true; await parent.tick(); assert.equal(ctx.statuses.at(-1).value, 'Agents disconnected · inspect status'); assert.ok(!JSON.stringify(ctx.statuses).includes('CANARY'));
  fail = false; await parent.tick(); assert.match(ctx.statuses.at(-1).value, /child est/);
  await parent.stop(); assert.equal(ctx.statuses.at(-1).value, undefined); const count = ctx.statuses.length; await parent.tick(); assert.equal(ctx.statuses.length, count);
  const noUI = context(f.dir, 'headless', false); noUI.ui.setStatus = () => { throw Error('Must not call UI'); };
  const headless = installParent(api().pi, { journal: new Journal(path.join(f.dir, 'headless-journal')), lifecycle: false, request: async (op, args) => f.request(op, args) });
  await headless.start(noUI); await headless.stop(); assert.equal(noUI.statuses.length, 0);
});

test('two generated global configs connect production detached coordinators independently and resume the same daemon', { skip: !available, timeout: 15000 }, async t => {
  const f = setup(t, { cleanup: false }), pids = [];
  t.after(async () => { for (const [pid, stateDir] of pids) { try { process.kill(pid, 'SIGTERM'); } catch {} for (let i = 0; i < 50 && fs.existsSync(path.join(stateDir, 'coordinator.lock')); i++) await sleep(20); } fs.rmSync(f.dir, { recursive: true }); });
  const one = f.resolve(context(f.repo)), two = f.resolve(context(f.secondRepo, 'second-parent'), { REX_SESSION: rex2 });
  const first = await connect(one.configFile); pids.push([Number(fs.readFileSync(path.join(first.config.stateDir, 'coordinator.lock'))), first.config.stateDir]);
  const second = await connect(two.configFile); pids.push([Number(fs.readFileSync(path.join(second.config.stateDir, 'coordinator.lock'))), second.config.stateDir]);
  assert.notEqual(pids[0][0], pids[1][0]); assert.equal((await first.request('overview')).totalChildren, 0); assert.equal((await second.request('overview')).children.messages, 0);
  const resumed = await connect(f.resolve(context(f.repo)).configFile); assert.equal(Number(fs.readFileSync(path.join(resumed.config.stateDir, 'coordinator.lock'))), pids[0][0]);
  assert.notEqual(first.config.group, second.config.group); assert.equal(fs.existsSync(path.join(first.config.stateDir, 'auth.json')), false);
});
