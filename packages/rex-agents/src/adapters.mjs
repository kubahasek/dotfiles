import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { planPanePlacement, measurePaneSizes } from './pane-layout.mjs';
export const exec = (bin, args, cwd) => execFileSync(bin, args, { cwd, encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024 });
export function paneCapacity(value = 3) {
  if (!Number.isInteger(value) || value < 1 || value > 8) throw Error('Invalid pane capacity');
  return value;
}
export function executableSpelling(input) {
  if (typeof input !== 'string' || input.includes('\0')) throw Error('Unsafe path');
  // Pi resolves paths again after tool_call. Normalize to a fixed point AFTER
  // URL decoding too, so its second pass cannot change the checked spelling.
  for (let i = 0; i < 8; i++) {
    const previous = input;
    input = input.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ').replace(/^@/, '');
    if (input === '~') input = os.homedir();
    else if (input.startsWith('~/')) input = path.join(os.homedir(), input.slice(2));
    if (input.startsWith('file://')) input = fileURLToPath(input);
    if (input === previous) break;
    if (i === 7) throw Error('Unstable path spelling');
  }
  return input;
}
// Validate complete canonical roots, not just relative tool inputs. Pi resolves
// the absolute path again, including every character introduced by the cwd.
export function stableDirectoryPath(directory) {
  const absolute = path.resolve(directory); let existing = absolute;
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing); if (parent === existing) throw Error('Missing root'); existing = parent;
  }
  const canonical = path.resolve(fs.realpathSync(existing), path.relative(existing, absolute));
  if (executableSpelling(canonical) !== canonical) throw Error('Unsupported normalization-unstable root');
  return canonical;
}
export class Git {
  constructor(run = exec) { this.run = run; }
  create(repo, destination, agent, base) {
    if (typeof agent !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(agent)) throw Error('Invalid worktree resource id');
    if (!/^[a-f0-9]{40}$/.test(base)) throw Error('Explicit full commit SHA required');
    if (fs.existsSync(destination)) throw Error('Destination exists; reconcile retained worktree');
    // Dirty parent changes are not copied, staged, stashed, or reset.
    const commit = this.run('git', ['rev-parse', '--verify', `${base}^{commit}`], repo).trim();
    if (commit !== base) throw Error('Base mismatch');
    this.run('git', ['worktree', 'add', '-b', `rex/${agent}`, destination, base], repo);
    return { destination, branch: `rex/${agent}`, base };
  }
}
export class Rex {
  constructor(session, run = exec) { this.session = session; this.run = run; this.viewports = new Map(); }
  placement({ parentBlock, managedBlocks, capacity }) {
    try {
      const layout = JSON.parse(this.run('rex', ['session', 'inspect', this.session, '--json']));
      const sizes = measurePaneSizes(layout.windows, block => JSON.parse(this.run('rex', ['block', 'call', '-s', this.session, '-b', block, 'size'])), this.viewports);
      return planPanePlacement({ ...layout, parentBlock, managedBlocks, capacity, sizeOf: block => sizes.get(block) });
    } catch { return { tab: 'Agents' }; } // Read-only discovery failure: standalone pane, never retry a launch.
  }
  // Caller persists launch intent BEFORE this side effect. Pending intent is never automatically retried.
  launch({ label, cwd, argv, anchor, split = 'right', tab = 'Agents' }) {
    const args = ['run', '-s', this.session, '--label', label];
    if (anchor) {
      if (!['right', 'below'].includes(split)) throw Error('Invalid managed split direction');
      args.push(`--split=${split}`, '-b', anchor);
    }
    const result = JSON.parse(this.run('rex', [...args, '--cwd', cwd, '--focus=false', '--shell=none', '--json', '--', ...argv]));
    if (!anchor && result.window_id) this.run('rex', ['window', 'rename', '-s', this.session, result.window_id, tab]);
    return result;
  }
  list() { return JSON.parse(this.run('rex', ['block', 'ls', '-s', this.session, '--json', '--short=false'])); }
  stop(block) { return this.run('rex', ['block', 'close', '-s', this.session, block]); }
}
export function piArgs({ model, instructions }, sessionFile, bridge) {
  return ['--model', model, '--append-system-prompt', `${instructions}\nUse rex_progress, rex_question, rex_result. Questions pause the entire run until all answers arrive. Explicit result required. No authority inheritance.`, '--session', sessionFile, '-e', bridge];
}
