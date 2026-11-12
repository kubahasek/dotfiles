import fs from 'node:fs';
import path from 'node:path';
import { Store } from './storage.mjs';
import { Domain } from './domain.mjs';
import { Coordinator, readConfig } from './coordinator.mjs';
import { serve, call } from './transport.mjs';
const [command, dir, group] = process.argv.slice(2);
if (!dir) throw Error('Usage: node src/cli.mjs init|daemon|request PRIVATE_STATE_DIR [GROUP]');
if (command === 'service') {
  const config = readConfig(dir);
  const service = await serve(new Coordinator(config.stateDir, config), config.stateDir, { frameMs: 60000 });
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await service.close(); process.exit(0); });
} else if (command === 'request') {
  const r = JSON.parse(fs.readFileSync(0, 'utf8'));
  console.log(JSON.stringify(await call(path.join(dir, 'control.sock'), r)));
} else if (command === 'init') {
  if (fs.existsSync(path.join(dir, 'coordinator.lock'))) throw Error('Stop daemon before bootstrap');
  console.log(new Domain(new Store(dir)).bootstrap(group));
} else if (command === 'daemon') {
  const service = await serve(new Domain(new Store(dir)), fs.realpathSync(dir));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { await service.close(); process.exit(0); });
} else throw Error('Unknown command');
