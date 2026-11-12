import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture } from './support.mjs';
import { available, loop, tool, until } from './loop-support.mjs';

test('result/steer ordering never strands a late command behind an explicit result', () => {
  const f = fixture();
  try {
    f.request('steer', { text: 'Check one more thing' });
    const command = f.d.store.state.agents.a.commands[0];
    assert.throws(() => f.childRequest('result', { status: 'success', text: 'Premature' }), /Invalid result: pending steering/);
    f.childRequest('ack', { command: command.id });
    f.childRequest('result', { status: 'success', text: 'Complete' });
    const before = fs.readFileSync(f.d.store.file, 'utf8');
    assert.throws(() => f.request('steer', { text: 'Late work' }), /Previous task/);
    assert.equal(fs.readFileSync(f.d.store.file, 'utf8'), before);
  } finally { fs.rmSync(f.dir, { recursive: true }); }
});

test('real result preflight race processes accepted steering before reporting completion', { skip: !available, timeout: 15000 }, async t => {
  const f = fixture(); let injected = false;
  const afterRace = async ({ context }) => {
    if (JSON.stringify(context.messages).includes('Steer instruction')) {
      await until(() => f.d.store.state.agents.a.commands.find(c => c.type === 'steer')?.ack);
      return [tool('rex_result', { status: 'success', text: 'Updated result' })];
    }
    return [{ type: 'text', text: 'Ready for pending parent input' }];
  };
  const l = await loop({ existingFixture: f, responses: [[tool('rex_result', { status: 'success', text: 'Premature result' })], afterRace, afterRace, afterRace], extra(pi) {
    pi.on('tool_call', e => { if (e.toolName === 'rex_result' && !injected) { injected = true; f.request('steer', { text: 'Steer instruction' }); } });
  } });
  t.after(() => l.close());
  await until(() => f.d.store.state.agents.a.result?.report === 'Updated result' && l.session.isIdle);
  await l.bridge.pump();
  assert.ok(l.journal.state.rejected.some(r => r.reason.startsWith('Invalid result: pending steering')));
  assert.ok(f.d.store.state.agents.a.commands.every(c => c.ack));
  assert.doesNotThrow(() => f.request('followup', { task: 'next', text: 'New task' }));
});

test('terminal provider failures create safe wake-up metadata rather than leaking diagnostics', { skip: !available, timeout: 15000 }, async t => {
  const l = await loop({ responses: [() => { throw Error('private-diagnostic'); }] }); t.after(() => l.close());
  await until(() => l.calls === 1 && l.session.isIdle); await l.bridge.pump();
  const notices = l.request('notifications');
  assert.deepEqual(notices.items.map(n => n.kind), ['failure']);
  assert.ok(!JSON.stringify(notices).includes('private-diagnostic'));
  assert.ok(!JSON.stringify(l.d.store.state.events).includes('private-diagnostic'));
});
