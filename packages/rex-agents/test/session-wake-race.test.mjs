import test from 'node:test';
import assert from 'node:assert/strict';
import { installSessionParent } from '../src/session-parent.mjs';
import { until } from './loop-support.mjs';

for (const replacement of [false, true]) test(`session ${replacement ? 'replacement' : 'shutdown'} invalidates the initial wake-up before serialized teardown`, async () => {
  const handlers = new Map(), tools = new Map(), sent = [], requests = [];
  let release;
  const pi = {
    on(name, handler) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); return () => {}; },
    registerTool(tool) { tools.set(tool.name, tool); },
    sendMessage(message) { sent.push(message); },
    getActiveTools: () => [...tools.keys()], setActiveTools() {},
  };
  const parent = installSessionParent(pi, {
    intervalMs: 100000,
    resolve: async ctx => ({ enabled: ctx.id === 'old', key: 'parent', configFile: '/unused', reason: 'fixture disabled' }),
    connectSession: async () => ({ request: async op => {
      requests.push(op);
      if (op === 'overview') return { activeChildren: 1, totalChildren: 1, pendingRequests: 1, children: { knownEstimate: 0, unknownPrices: 0 } };
      if (op === 'notifications') { await new Promise(r => { release = r; }); return { items: [{ id: 'stale', agent: 'a', task: 't', generation: 1, kind: 'question' }], next: null }; }
      return { lifecycle: 'queued' };
    } }),
  });
  const ctx = id => ({ id, mode: 'tui', hasUI: true, ui: { setStatus() {} }, sessionManager: { getEntries: () => [] } });
  const start = handlers.get('session_start')[0]({}, ctx('old'));
  await until(() => release);
  const transition = replacement ? handlers.get('session_start')[0]({}, ctx('new')) : handlers.get('session_shutdown')[0]();
  const staleTool = await tools.get('rex_launch').execute('call', { agent: 'a' });
  release(); await start; await transition; await parent.stop();
  assert.equal(staleTool.isError, true, 'invalidated tools must not mutate the old group');
  assert.deepEqual(sent, []); assert.ok(!requests.includes('launch'));
});
