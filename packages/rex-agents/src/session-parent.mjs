import { connect } from './client.mjs';
import { installParent, hideParentTools, parentStatus } from './parent.mjs';
import { resolveParentSession } from './session-config.mjs';

// Factory only registers handlers. No sockets, journals, timers, or config writes.
export function installSessionParent(pi, { resolve = resolveParentSession, connectSession = connect, intervalMs } = {}) {
  let active, context, hadTools = false, epoch = 0, transition = Promise.resolve();
  const stop = async () => {
    const previous = active; active = undefined;
    if (previous) await previous.stop();
    if (hadTools) hideParentTools(pi);
    parentStatus(context, undefined); context = undefined;
  };
  const schedule = work => { transition = transition.then(work, work); return transition; };
  pi.on('session_shutdown', () => { epoch++; return schedule(stop); });
  pi.on('session_start', (_event, ctx) => {
    const current = ++epoch;
    return schedule(async () => {
      await stop(); if (current !== epoch) return; context = ctx;
      try {
        const resolved = await resolve(ctx);
        if (current !== epoch) return;
        if (!resolved.enabled) { parentStatus(ctx, `Agents disabled: ${resolved.reason}`); return; }
        const c = await connectSession(resolved.configFile);
        if (current !== epoch) return;
        active = installParent(pi, { request: c.request, parentBlock: resolved.parentBlock, intervalMs, lifecycle: false, isCurrent: () => current === epoch });
        hadTools = true;
        await active.start(ctx);
      } catch {
        if (active) await active.stop(); active = undefined;
        if (hadTools) hideParentTools(pi);
        if (current === epoch) parentStatus(ctx, 'Agents disabled: configuration/connection unavailable');
      }
    });
  });
  return { stop: () => { epoch++; return schedule(stop); } };
}
