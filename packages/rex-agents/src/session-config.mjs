import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { privateDirectory, privateJSON } from './storage.mjs';
import { id, profile } from './domain.mjs';
import { stableDirectoryPath, paneCapacity } from './adapters.mjs';

const sessionPattern = /^session:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const disabled = reason => ({ enabled: false, reason });
const allowed = new Set(['version', 'piExecutable', 'profiles', 'stateRoot', 'worktreeRoot', 'panesPerTab', 'knownFreeModels']);
const canonicalJSON = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export function parentKey(ctx) {
  const value = ctx.sessionManager.getSessionId();
  if (typeof value !== 'string' || !value.length || Buffer.byteLength(value) > 1024) throw Error('Invalid parent identity');
  return `parent-${createHash('sha256').update(value).digest('hex').slice(0, 32)}`;
}
function metadata(bin, args, env) {
  return execFileSync(bin, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 512 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: env.PATH, HOME: env.HOME, GIT_OPTIONAL_LOCKS: '0' } });
}
export function gitRoot(cwd, env) {
  const directory = fs.realpathSync(cwd);
  const raw = metadata('git', ['-c', 'core.fsmonitor=false', '-C', directory, 'rev-parse', '--show-toplevel'], env);
  const root = stableDirectoryPath(fs.realpathSync(raw.replace(/\n$/, '')));
  const relative = path.relative(root, directory);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw Error();
  return root;
}
function localSocketEndpoint(value) {
  if (typeof value !== 'string' || value.length > 4096 || !value.startsWith('unix:///') || /[?#]/.test(value)) throw Error();
  const url = new URL(value);
  if (url.protocol !== 'unix:' || url.host || url.username || url.password) throw Error();
  const socket = decodeURIComponent(value.slice('unix://'.length));
  if (!path.isAbsolute(socket) || socket.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(socket) || path.normalize(socket) !== socket) throw Error();
  const canonical = fs.realpathSync(socket);
  if (!fs.statSync(canonical).isSocket()) throw Error();
  return canonical;
}
export function validRexSession(session, env) {
  if (!sessionPattern.test(session ?? '')) return false;
  try {
    const inherited = env.REX_SERVER === undefined || env.REX_SERVER === '' ? undefined : localSocketEndpoint(env.REX_SERVER);
    // Use only the sanitized CLI default, exactly as the detached daemon does.
    // Native panes set REX_SERVER even locally; accept it only if it names that
    // same real Unix socket. Never follow an inherited override to another host.
    const identity = JSON.parse(metadata('rex', ['--autostart=false', 'whoami', '--json'], env));
    const endpoint = localSocketEndpoint(identity.endpoint);
    if (inherited !== undefined && inherited !== endpoint) return false;
    const result = JSON.parse(metadata('rex', ['--autostart=false', 'session', 'inspect', session, '--json'], env));
    return (result.session_id ?? result.session?.session_id) === session;
  } catch { return false; }
}
// Atomic, non-overwriting publication: a running daemon's config is never rewritten.
function publish(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`; let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    try { fs.linkSync(temporary, file); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const directory = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
export function resolveParentSession(ctx, { env = process.env, resolveGit = gitRoot, inspectRex = validRexSession } = {}) {
  let key;
  try { key = parentKey(ctx); } catch { return disabled('parent identity unavailable'); }
  // Live pane routing is deliberately outside the immutable runtime config: a
  // resumed parent can move panes without changing its durable session binding.
  const parentBlock = /^block:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.REX_BLOCK ?? '') ? env.REX_BLOCK : undefined;
  // Explicit opt-in retains its operator-selected repository/session and auth mode.
  if (env.REX_AGENTS_CONFIG) {
    if (!path.isAbsolute(env.REX_AGENTS_CONFIG)) return disabled('explicit config must be absolute');
    return { enabled: true, mode: 'explicit', configFile: env.REX_AGENTS_CONFIG, key, parentBlock };
  }
  const configRoot = env.XDG_CONFIG_HOME ?? path.join(env.HOME ?? os.homedir(), '.config');
  const settingsFile = env.REX_AGENTS_SETTINGS ?? path.join(configRoot, 'rex-agents/settings.json');
  let settings;
  try {
    if (!path.isAbsolute(settingsFile)) throw Error();
    if (fs.existsSync(settingsFile) && fs.lstatSync(settingsFile).size > 262144) throw Error();
    settings = privateJSON(settingsFile);
    if (!settings) return disabled('private settings not configured');
    if (!settings || typeof settings !== 'object' || Array.isArray(settings) || Object.keys(settings).some(k => !allowed.has(k))) throw Error();
    if (settings.version !== 3) return disabled('unsupported settings version; retain legacy settings/state and explicitly configure version 3 with new state roots');
    for (const field of ['piExecutable', 'stateRoot', 'worktreeRoot']) if (typeof settings[field] !== 'string' || !path.isAbsolute(settings[field])) throw Error();
    const profiles = settings.profiles;
    if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles) || !Object.keys(profiles).length || Object.keys(profiles).length > 32) throw Error();
    for (const [name, value] of Object.entries(profiles)) { id(name); profile(value); }
    if (settings.panesPerTab === undefined) throw Error();
    paneCapacity(settings.panesPerTab);
    if (settings.knownFreeModels !== undefined && (!Array.isArray(settings.knownFreeModels) || settings.knownFreeModels.length > 128 || settings.knownFreeModels.some(v => typeof v !== 'string' || !v.length || v.length > 256))) throw Error();
  } catch { return disabled('invalid private settings'); }
  if (!env.REX_SESSION) return disabled('outside Rex');
  try { if (!inspectRex(env.REX_SESSION, env)) return disabled('invalid local Rex session'); } catch { return disabled('local Rex session unavailable'); }
  let repo;
  try { repo = resolveGit(ctx.cwd, env); } catch { return disabled('outside supported Git worktree'); }
  try {
    const stateRoot = stableDirectoryPath(privateDirectory(settings.stateRoot));
    const worktreeRoot = stableDirectoryPath(privateDirectory(settings.worktreeRoot));
    const stateDir = privateDirectory(path.join(stateRoot, key));
    const worktrees = privateDirectory(path.join(worktreeRoot, key));
    const config = { version: 3, repo, rexSession: env.REX_SESSION, group: key, stateDir, worktreeRoot: worktrees, piExecutable: settings.piExecutable, profiles: settings.profiles, panesPerTab: settings.panesPerTab, ...(settings.knownFreeModels ? { knownFreeModels: settings.knownFreeModels } : {}) };
    const configFile = path.join(stateDir, 'runtime.json');
    if (!fs.existsSync(configFile)) publish(configFile, config);
    if (canonicalJSON(privateJSON(configFile)) !== canonicalJSON(config)) return disabled('parent binding/settings changed; restore or start a new parent');
    return { enabled: true, mode: 'global', configFile, key, parentBlock };
  } catch { return disabled('unsafe or unavailable runtime state'); }
}
