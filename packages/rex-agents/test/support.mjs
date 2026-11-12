import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Domain } from '../src/domain.mjs';
import { Store } from '../src/storage.mjs';
export const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rex-test-'));
export const p = { model: 'proposal/model', instructions: 'Investigate only' };
export function fixture(agent = 'a') {
  const dir = temp(), d = new Domain(new Store(dir)), token = d.bootstrap('g'); let seq = 0;
  const request = (op, data = {}, secret = token) => d.dispatch({ group: 'g', agent, requestId: `r${++seq}`, op, ...data, token: secret });
  const child = request('create', { task: 't', profile: p }).token;
  const childRequest = (op, data = {}) => request(op, { task: d.store.state.agents[agent].task, generation: d.store.state.agents[agent].generation, ...data }, child);
  return { dir, d, token, child, request, childRequest };
}
