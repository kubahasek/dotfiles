import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { serve, call } from '../src/transport.mjs';
import { fixture, p } from './support.mjs';

test('escaped legal result reports remain inspectable through the real socket frame cap', async t => {
  const f = fixture(), service = await serve(f.d, f.dir);
  t.after(async () => { await service.close(); fs.rmSync(f.dir, { recursive: true }); });
  const report = '\0'.repeat(9000);
  f.childRequest('result', { status: 'success', text: report });
  for (let i = 0; i < 9; i++) {
    const agent = `b${i}`, secret = f.request('create', { agent, task: 't', profile: p }).token;
    f.request('result', { agent, task: 't', generation: 1, status: 'success', text: report }, secret);
  }
  const socket = path.join(f.dir, 'control.sock');
  const request = (data = {}) => call(socket, { group: 'g', token: f.token, requestId: 'inspect', op: 'inspect', offset: 0, ...data });
  const summary = await request();
  assert.equal(summary.items.length, 10); assert.ok(summary.items.every(a => a.resultTruncated));
  assert.ok(Buffer.byteLength(JSON.stringify(summary)) < 512000);
  assert.equal((await request({ agent: 'a' })).items[0].result.report, report);
});

test('escaped answer backlog has a bounded control page and explicit retained overflow', () => {
  const f = fixture(), reply = '\0'.repeat(9000);
  try {
    for (let i = 0; i < 10; i++) {
      f.childRequest('request', { question: `q${i}`, kind: 'question', scope: 'fixture', text: 'Question' });
      f.request('answer', { question: `q${i}`, text: reply });
    }
    const before = fs.readFileSync(f.d.store.file, 'utf8');
    const poll = f.request('poll');
    assert.equal(poll.commands.items.length, 5); assert.equal(poll.commands.next, 5);
    assert.ok(Buffer.byteLength(JSON.stringify(poll)) < 512000);
    assert.deepEqual(f.request('answer-inbox').items, []); assert.equal(f.request('answer-inbox').overflow, true);
    assert.equal(f.d.store.state.agents.a.commands.filter(c => !c.ack).length, 10);
    assert.equal(fs.readFileSync(f.d.store.file, 'utf8'), before);
  } finally { fs.rmSync(f.dir, { recursive: true }); }
});
