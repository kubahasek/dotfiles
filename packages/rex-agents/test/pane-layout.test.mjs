import test from 'node:test';
import assert from 'node:assert/strict';
import { planPanePlacement, measurePaneSizes } from '../src/pane-layout.mjs';
import { Rex } from '../src/adapters.mjs';
import { installParent } from '../src/parent.mjs';
const leaf = block_id => ({ block_id, rect: [0, 0, 1, 1] });
const tree = ids => ids.length === 1 ? leaf(ids[0]) : { split: { before: leaf(ids[0]), after: tree(ids.slice(1)) } };
const window = (label, blocks) => ({ window_id: `window:${label}`, label, layers: [{ kind: 'tiled', layout: tree(blocks) }] });
function plan(windows, sizes, extra = {}) {
  const queried = [];
  const result = planPanePlacement({ windows, parentBlock: 'parent', managedBlocks: [], capacity: 3, ...extra,
    sizeOf: block => { queried.push(block); if (sizes[block] instanceof Error) throw sizes[block]; return sizes[block]; },
  });
  return { result, queried };
}
test('first agent splits beside the actual parent even when another tab is focused', () => {
  const r = plan([window('Other', ['unrelated']), window('Parent', ['parent'])], { parent: { columns: 240, rows: 60 }, unrelated: { columns: 500, rows: 100 } });
  assert.deepEqual(r.result, { anchor: 'parent', split: 'right' }); assert.deepEqual(r.queried, ['parent']);
});
test('tall panes use a vertical split; undersized panes require a standalone tab', () => {
  assert.deepEqual(plan([window('Parent', ['parent'])], { parent: { columns: 140, rows: 60 } }).result, { anchor: 'parent', split: 'below' });
  for (const size of [{ columns: 199, rows: 24 }, { columns: 100, rows: 49 }, { columns: 90, rows: 100 }, { columns: 240, rows: 23 }]) {
    assert.deepEqual(plan([window('Parent', ['parent'])], { parent: size }).result, { tab: 'Agents' });
  }
  assert.equal(plan([window('Parent', ['parent'])], { parent: { columns: 202, rows: 24 } }).result.split, 'right');
  assert.equal(plan([window('Parent', ['parent'])], { parent: { columns: 100, rows: 50 } }).result.split, 'below');
});
test('closed historical panes do not count or become split anchors; largest live owned pane is reused', () => {
  const r = plan([window('Parent', ['parent', 'live', 'unrelated'])], { parent: { columns: 100, rows: 24 }, live: { columns: 240, rows: 50 }, unrelated: { columns: 500, rows: 100 } }, { managedBlocks: ['closed', 'live'], capacity: 2 });
  assert.deepEqual(r.result, { anchor: 'live', split: 'right' }); assert.ok(!r.queried.includes('closed')); assert.ok(!r.queried.includes('unrelated'));
});
test('reuse owned overflow tabs only after the parent tab cannot fit; capacity remains a hard bound', () => {
  const windows = [window('Parent', ['parent', 'one']), window('Agents', ['two']), window('Unrelated', ['other'])];
  const sizes = { parent: { columns: 100, rows: 24 }, one: { columns: 100, rows: 24 }, two: { columns: 240, rows: 60 } };
  assert.deepEqual(plan(windows, sizes, { managedBlocks: ['one', 'two'] }).result, { anchor: 'two', split: 'right' });
  assert.deepEqual(plan(windows, sizes, { managedBlocks: ['one', 'two'], capacity: 1 }).result, { tab: 'Agents 2' });
});
test('missing parent, unknown size, and floating/unrelated panes never justify a split', () => {
  const floating = { window_id: 'float', label: 'Agents', layers: [{ kind: 'floating', layout: leaf('parent') }] };
  assert.deepEqual(plan([floating, window('Agents 2', ['other'])], {}).result, { tab: 'Agents 3' });
  for (const size of [undefined, { columns: NaN, rows: 60 }, { columns: 240, rows: 0 }, Error('pane vanished')]) assert.deepEqual(plan([window('Parent', ['parent'])], { parent: size }).result, { tab: 'Agents' });
});
test('Rex adapter uses public live geometry and preserves focus for both split directions and new tabs', () => {
  const calls = [];
  const rex = new Rex('session:test', (_bin, args) => {
    calls.push(args);
    if (args[0] === 'session') return JSON.stringify({ windows: [window('Parent', ['parent'])] });
    if (args[0] === 'block') return JSON.stringify({ columns: 140, rows: 60 });
    if (args[0] === 'run') return JSON.stringify({ block_ids: ['child'], window_id: 'new-window' });
    return '{}';
  });
  const placement = rex.placement({ parentBlock: 'parent', managedBlocks: [], capacity: 3 });
  assert.deepEqual(placement, { anchor: 'parent', split: 'below' });
  rex.launch({ label: 'child', cwd: '/tmp', argv: ['node'], ...placement });
  const split = calls.find(a => a[0] === 'run'); assert.ok(split.includes('--split=below')); assert.ok(split.includes('--focus=false')); assert.ok(!calls.some(a => a[0] === 'window'));
  assert.ok(calls.some(a => a.join(' ') === 'block call -s session:test -b parent size'));
  rex.launch({ label: 'standalone', cwd: '/tmp', argv: ['node'], tab: 'Agents 2' });
  assert.ok(calls.some(a => a[0] === 'window' && a.at(-1) === 'Agents 2'));
  assert.throws(() => rex.launch({ anchor: 'parent', split: 'unsafe', label: 'bad', cwd: '/tmp', argv: ['node'] }), /direction/);
});
test('failed geometry discovery falls back before launch without retrying side effects', () => {
  let calls = 0;
  const rex = new Rex('session:test', () => { calls++; throw Error('unavailable'); });
  assert.deepEqual(rex.placement({ parentBlock: 'parent', managedBlocks: [], capacity: 3 }), { tab: 'Agents' }); assert.equal(calls, 1);
});
test('stale PTY sizes are bounded by current layout rectangles; coherent resizes refresh the viewport', () => {
  const viewports = new Map(), initial = [window('Parent', ['parent'])];
  const wide = { columns: 320, rows: 80 };
  measurePaneSizes(initial, () => wide, viewports);
  const split = [window('Parent', ['parent', 'child'])];
  split[0].layers[0].layout.split.before.rect = [0, 0, 0.5, 1]; split[0].layers[0].layout.split.after.rect = [0.5, 0, 0.5, 1];
  const sizes = measurePaneSizes(split, block => block === 'parent' ? wide : { columns: 80, rows: 24 }, viewports);
  assert.deepEqual(sizes.get('parent'), { columns: 160, rows: 80 }); assert.deepEqual(sizes.get('child'), { columns: 80, rows: 24 });
  assert.deepEqual(planPanePlacement({ windows: split, parentBlock: 'parent', managedBlocks: ['child'], sizeOf: b => sizes.get(b) }), { anchor: 'parent', split: 'below' });
  // No baseline after a coordinator restart: inconsistent sizes cannot justify a split.
  assert.equal(measurePaneSizes(split, b => b === 'parent' ? wide : { columns: 80, rows: 24 }, new Map()).size, 0);
  const resized = measurePaneSizes(split, () => ({ columns: 220, rows: 90 }), viewports);
  assert.deepEqual(resized.get('parent'), { columns: 220, rows: 90 }); assert.equal(viewports.get('window:Parent').columns, 440);
  measurePaneSizes([], () => wide, viewports); assert.equal(viewports.size, 0);
});

test('parent pane identity is private launch context only, not a model parameter or a followup mutation', async () => {
  const tools = {}, requests = [], pi = { on() {}, registerTool(t) { tools[t.name] = t; } };
  installParent(pi, { parentBlock: 'parent', journal: {}, request: async (op, payload) => { requests.push({ op, payload }); return { ok: true }; } });
  const args = { requestId: 'launch', agent: 'a', task: 't', text: 'Read', workspace: 'worktree', profileName: 'reader', base: 'a'.repeat(40) };
  await tools.rex_launch.execute('call', args); await tools.rex_followup.execute('next', { requestId: 'next', agent: 'a', task: 'next', text: 'Continue' });
  assert.equal(requests[0].payload.parentBlock, 'parent'); assert.equal(args.parentBlock, undefined); assert.equal(requests[1].payload.parentBlock, undefined); assert.equal(tools.rex_launch.parameters.properties.parentBlock, undefined);
});
