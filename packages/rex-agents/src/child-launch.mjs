import { fileURLToPath } from 'node:url';
import { piArgs } from './adapters.mjs';
export function childInvocation(c, descriptor, ambient = process.env) {
  if (c.version !== 3) throw Error('Unsupported child descriptor version; retain legacy data');
  const bridge = fileURLToPath(new URL('../extensions/child.ts', import.meta.url));
  return { executable: c.piExecutable, argv: piArgs(c.profile, c.sessionFile, bridge), env: { ...ambient, REX_AGENT_DESCRIPTOR: descriptor }, cwd: c.root };
}
