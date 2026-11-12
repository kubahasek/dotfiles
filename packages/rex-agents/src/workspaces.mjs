import path from 'node:path';
import { exec } from './adapters.mjs';
export function workspaceMode(value) {
  if (!['shared', 'worktree'].includes(value)) throw Error('Explicit workspace choice required: shared or worktree');
  return value;
}
export function planWorkspace({ mode, repo, worktreeRoot, resource, base }, run = exec) {
  workspaceMode(mode);
  if (mode === 'shared') {
    const head = run('git', ['rev-parse', '--verify', 'HEAD^{commit}'], repo).trim();
    if (head !== base) throw Error('Shared workspace base must match current HEAD; dirty files are preserved');
  }
  return { mode, root: mode === 'shared' ? repo : path.join(worktreeRoot, resource), base };
}
export function assertSharedWriterAvailable(agents, group, workspace, profile, except) {
  if (workspace?.mode !== 'shared') return;
  const conflict = Object.entries(agents).some(([name, a]) => name !== except && a.workspace?.mode === 'shared' && a.workspace.root === workspace.root && (
    !(a.result || a.stopConfirmed) || !['idle', 'stopped'].includes(a.lifecycle) || a.commands.some(c => !c.ack) || Object.values(a.requests).some(q => !q.answer)
  ));
  if (conflict) throw Error('Shared checkout already has an unfinished agent; serialize writes or choose a worktree');
}
