import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes } from 'node:crypto';
import { Store, privateJSON } from './storage.mjs';
import { Domain } from './domain.mjs';
import { call } from './transport.mjs';
import { readConfig } from './coordinator.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function connect(configFile) {
  const c = readConfig(configFile), socket = path.join(c.stateDir, 'control.sock');
  // Initialization/start serialized among reconnecting parents; no stale-lock stealing.
  const start = path.join(c.stateDir, 'startup.lock'); let fd;
  for (let i = 0; i < 50; i++) {
    try { fd = fs.openSync(start, 'wx', 0o600); break; } catch (e) { if (e.code !== 'EEXIST') throw e; await sleep(100); }
  }
  if (fd === undefined) throw Error('Startup locked; verify daemon before operator recovery');
  try {
    const auth = initializeController(c);
    const request = (op, payload = {}) => call(socket, { ...payload, op, group: auth.group, token: auth.token, requestId: payload.requestId ?? randomUUID() });
    try { await request('status'); }
    catch {
      if (fs.existsSync(path.join(c.stateDir, 'coordinator.lock'))) throw Error('Coordinator unavailable with retained lock: operator must verify process dead and reconcile before removing lock');
      const log = fs.openSync(path.join(c.stateDir, 'daemon.log'), 'a', 0o600);
      try {
        const daemon = spawn(process.execPath, [fileURLToPath(new URL('./cli.mjs', import.meta.url)), 'service', configFile], { detached: true, stdio: ['ignore', log, log], env: { PATH: process.env.PATH, HOME: process.env.HOME } }); daemon.unref();
      } finally { fs.closeSync(log); }
      let ready = false;
      for (let i = 0; i < 50; i++) { try { await request('status'); ready = true; break; } catch { await sleep(100); } }
      if (!ready) throw Error('Coordinator did not start; inspect private daemon log');
    }
    return { request, config: c };
  } finally { fs.closeSync(fd); fs.unlinkSync(start); }
}

// Caller holds startup.lock. Secret intent commits BEFORE group hash, and is
// retained until after final controller commit. Every crash window is replayable.
export function initializeController(c, checkpoint = () => {}) {
  const file = path.join(c.stateDir, 'controller.json');
  const existing = privateJSON(file);
  if (existing) { const auth = existing.auth ?? existing; if (auth.group !== c.group) throw Error('Controller group mismatch; choose explicit matching state directory'); return auth; }
  if (fs.existsSync(path.join(c.stateDir, 'coordinator.lock'))) throw Error('Coordinator exists without controller reference');
  const intent = new Store(c.stateDir, undefined, 'controller-intent');
  if (!intent.state.auth) intent.transaction(s => { s.auth = { group: c.group, token: randomBytes(32).toString('hex') }; return null; });
  const auth = intent.state.auth;
  if (auth.group !== c.group) throw Error('Controller intent group mismatch');
  checkpoint('secret-durable');
  new Domain(new Store(c.stateDir)).bootstrap(auth.group, auth.token);
  checkpoint('group-durable');
  const final = new Store(c.stateDir, undefined, 'controller');
  final.transaction(s => { s.auth = auth; return null; });
  checkpoint('controller-durable');
  return auth;
}
