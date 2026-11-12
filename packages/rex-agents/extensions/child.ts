import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { installChild } from '../src/bridge.mjs';
import { Journal } from '../src/journal.mjs';
import { privateJSON } from '../src/storage.mjs';
import { call } from '../src/transport.mjs';

export default function (pi: ExtensionAPI) {
  const file = process.env.REX_AGENT_DESCRIPTOR;
  if (!file) throw new Error('Missing private managed-child descriptor');
  const c = privateJSON(file);
  if (c.version !== 3) throw new Error('Unsupported managed-child descriptor version; retain legacy data');
  const journal = new Journal(c.stateDir);
  installChild(pi, {
    knownFreeModels: c.knownFreeModels ?? [], profile: c.profile, root: c.root, journal, group: c.group, agent: c.agent,
    send: request => call(c.socket, { ...request, token: c.token }),
  });
}
