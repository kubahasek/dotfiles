import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Domain, id, own, profile, publicAgent, resourceKey } from './domain.mjs';
import { Store, privateDirectory, privateJSON } from './storage.mjs';

import { workspaceMode, planWorkspace, assertSharedWriterAvailable } from './workspaces.mjs';
import { Git, Rex, piArgs, stableDirectoryPath, paneCapacity } from './adapters.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const writePrivate = (file, data) => { fs.writeFileSync(file, JSON.stringify(data), { flag: 'wx', mode: 0o600 }); };
export class Coordinator {
  constructor(dir, config, { git = new Git(), rex = new Rex(config.rexSession) } = {}) {
    if (config.version !== 3) throw Error('Unsupported configuration version; retain legacy state/config and use a new directory');
    for (const key of ['authSourceFile', 'providerEnvFile', 'piPackagePath', 'offline']) if (key in config) throw Error('Legacy authentication/runtime configuration is unsupported');
    paneCapacity(config.panesPerTab);
    dir = stableDirectoryPath(dir);
    config = { ...config, repo: stableDirectoryPath(config.repo), worktreeRoot: stableDirectoryPath(config.worktreeRoot) };
    this.store = new Store(dir); this.domain = new Domain(this.store); this.config = config; this.git = git; this.rex = rex; this.queue = Promise.resolve();
  }
  dispatch(r) {
    const run = this.queue.then(() => this.handle(r)); this.queue = run.catch(() => {}); return run;
  }
  panes() {
    try { const blocks = this.rex.list().blocks; if (!Array.isArray(blocks)) throw Error(); return blocks; }
    catch { throw Error('PANE_UNAVAILABLE: Cannot verify managed panes'); }
  }
  handle(r) {
    if (this.store.failed) throw Error('STORE_UNAVAILABLE: State commit uncertain; restart after inspection');
    if (['followup', 'steer', 'answer'].includes(r.op)) {
      const auth = this.domain.authorize(r);
      if (!auth.parent) throw Error('PARENT_REQUIRED: Parent required');
      if (!auth.a || auth.a.group !== r.group) throw Error('UNKNOWN_AGENT: Unknown agent');
      const receiptKey = JSON.stringify([r.group, ['parent'], r.requestId]);
      if (own(this.store.state.receipts, receiptKey)) return this.domain.dispatch(r);
      if (!this.panes().some(b => b.block_id === auth.a.launch?.block)) throw Error('PANE_MISSING: Child pane is closed; no input queued');
      if (auth.a.ambiguities?.delivery || auth.a.ambiguities?.launch) throw Error('DELIVERY_UNCERTAIN: Inspect retained child; no replay');
    }
    if (r.op === 'followup') {
      const auth = this.domain.authorize(r);
      if (auth.parent && auth.a) assertSharedWriterAvailable(this.store.state.agents, r.group, auth.a.workspace, auth.a.profile, r.agent);
    }
    if (!['launch', 'inspect'].includes(r.op)) return this.domain.dispatch(r);
    const auth = this.domain.authorize(r); if (!auth.parent) throw Error('Parent required');
    if (r.op === 'inspect') {
      const result = this.domain.dispatch(r); let blocks;
      try { blocks = this.panes(); } catch { blocks = null; }
      return { ...result, items: result.items.map(a => ({ ...a, panePresent: blocks ? blocks.some(b => b.block_id === a.launch?.block || (a.launchUncertain && b.label === a.launch?.label)) : null, heartbeatAgeMs: this.domain.heartbeat(a.agent) === null ? null : Date.now() - this.domain.heartbeat(a.agent), paneInspectionUnavailable: blocks === null })) };
    }
    id(r.agent); id(r.task); id(r.profileName); if (r.requestId.length > 60) throw Error('Launch requestId maximum 60 characters');
    if (typeof r.text !== 'string' || !r.text.length || Buffer.byteLength(r.text) > 16000 || !/^[a-f0-9]{40}$/.test(r.base)) throw Error('Bounded task text and full base SHA required');
    workspaceMode(r.workspace);
    const p = own(this.config.profiles, r.profileName); if (!p) throw Error('Unapproved profile');
    profile(p);
    const fingerprint = JSON.stringify({ task: r.task, text: r.text, base: r.base, profileName: r.profileName, workspace: r.workspace });
    const existing = own(this.store.state.agents, r.agent);
    if (existing?.launch) {
      if (existing.group !== r.group || existing.launch.requestId !== r.requestId || existing.launch.fingerprint !== fingerprint) throw Error('Launch identity conflict; use fresh id');
      return { agent: r.agent, ...publicAgent(existing) }; // Never retry a side effect from a pending intent.
    }
    const capacity = paneCapacity(this.config.panesPerTab);
    const workspace = planWorkspace({ mode: r.workspace, repo: this.config.repo, worktreeRoot: this.config.worktreeRoot, resource: resourceKey(r.group, r.agent), base: r.base });
    assertSharedWriterAvailable(this.store.state.agents, r.group, workspace, p);
    const created = this.domain.dispatch({ ...r, op: 'create', profile: p });
    this.domain.dispatch({ ...r, requestId: `${r.requestId}-intent`, op: 'launch-intent' });
    this.store.transaction(s => {
      s.agents[r.agent].workspace = workspace;
      Object.assign(s.agents[r.agent].launch, { requestId: r.requestId, fingerprint }); return null;
    });
    const agentDir = path.join(this.store.dir, 'children', resourceKey(r.group, r.agent));
    try {
      privateDirectory(agentDir);
      const destination = workspace.root;
      if (workspace.mode === 'worktree') this.git.create(this.config.repo, destination, resourceKey(r.group, r.agent), r.base);
      const descriptor = path.join(agentDir, 'descriptor.json');
      writePrivate(descriptor, { version: 3, socket: path.join(this.store.dir, 'control.sock'), group: r.group, agent: r.agent, token: created.token, profile: p, workspace: workspace.mode, root: destination, stateDir: agentDir, sessionFile: path.join(agentDir, 'session.jsonl'), piExecutable: this.config.piExecutable, knownFreeModels: structuredClone(this.config.knownFreeModels ?? []) });
      this.domain.dispatch({ ...r, op: 'task', requestId: `${r.requestId}-task` });
      const managedBlocks = Object.values(this.store.state.agents).filter(a => a.group === r.group && a.launch?.status === 'recorded').map(a => a.launch.block);
      const placement = this.rex.placement?.({ parentBlock: r.parentBlock ?? this.config.parentBlock, managedBlocks, capacity }) ?? { tab: 'Agents' };
      const result = this.rex.launch({ label: this.store.state.agents[r.agent].launch.label, cwd: destination, argv: [process.execPath, path.join(here, 'child-process.mjs'), descriptor], ...placement });
      const block = result.block_ids?.[0] ?? result.block_id;
      if (typeof block !== 'string') throw Error('Unexpected Rex launch reply');
      this.domain.dispatch({ ...r, requestId: `${r.requestId}-record`, op: 'launch-record', block });
    } catch {
      this.domain.dispatch({ ...r, requestId: `${r.requestId}-ambiguous`, op: 'ambiguous' });
      // Do not return subprocess diagnostics: credentials may appear in third-party errors.
      throw Error('LAUNCH_UNCERTAIN: Retained private state/worktree; inspect, do not relaunch');
    }
    return { agent: r.agent, ...publicAgent(this.store.state.agents[r.agent]) };
  }
}
export function readConfig(file) {
  const c = privateJSON(file); if (!c) throw Error('Missing private operator config');
  if (c.version !== 3) throw Error('Unsupported configuration version; retain legacy state/config and use a new directory');
  for (const key of ['authSourceFile', 'providerEnvFile', 'piPackagePath', 'offline']) if (key in c) throw Error('Legacy authentication/runtime configuration is unsupported');
  paneCapacity(c.panesPerTab);
  for (const k of ['stateDir', 'repo', 'worktreeRoot', 'piExecutable']) if (typeof c[k] !== 'string' || !path.isAbsolute(c[k])) throw Error(`Absolute ${k} required`);
  id(c.group); if (!c.rexSession || !c.profiles || typeof c.profiles !== 'object' || Array.isArray(c.profiles)) throw Error('Missing session/profiles');
  for (const [name, value] of Object.entries(c.profiles)) { id(name); profile(value); }
  for (const key of ['stateDir', 'repo', 'worktreeRoot']) c[key] = stableDirectoryPath(c[key]);
  // Validate retained state before connecting to a possibly older live daemon.
  new Store(c.stateDir); privateDirectory(c.worktreeRoot);
  return c;
}
export { piArgs };
