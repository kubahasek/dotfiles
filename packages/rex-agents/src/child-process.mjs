import { spawn } from 'node:child_process';
import { privateJSON } from './storage.mjs';
import { childInvocation } from './child-launch.mjs';
try {
  const descriptor = process.argv[2], c = privateJSON(descriptor);
  if (!c) throw Error('Missing descriptor');
  const { executable, argv, env, cwd } = childInvocation(c, descriptor);
  const child = spawn(executable, argv, { cwd, env, stdio: 'inherit' });
  child.on('error', () => { console.error('Managed Pi startup failed; inspect private configuration'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
} catch {
  console.error('Managed Pi startup failed; inspect private configuration'); process.exitCode = 1;
}
