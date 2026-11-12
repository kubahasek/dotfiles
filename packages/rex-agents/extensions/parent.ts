import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { installSessionParent } from '../src/session-parent.mjs';

export default function (pi: ExtensionAPI) {
  if (process.env.REX_AGENT_DESCRIPTOR) return;
  installSessionParent(pi);
}
