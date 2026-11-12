import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
for (const directory of ['src', 'test', 'scripts']) for (const name of fs.readdirSync(directory)) {
  if (name.endsWith('.mjs')) execFileSync(process.execPath, ['--check', `${directory}/${name}`], { stdio: 'inherit' });
}
console.log('JavaScript syntax checks passed (no lint)');
