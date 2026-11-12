export const wakeupType = 'rex-wakeup';

// Pi owns the native follow-up queue. Persisted custom messages are the proof
// after reload; the volatile set suppresses duplicates before those messages land.
export function createWakeups(pi) {
  const queued = new Set();
  return {
    notify(ctx, notices) {
      if (ctx.mode !== 'tui' || !ctx.hasUI) return 0;
      const delivered = new Set(ctx.sessionManager.getEntries()
        .filter(e => e.type === 'custom_message' && e.customType === wakeupType)
        .flatMap(e => e.details?.notificationIds ?? []));
      for (const id of delivered) queued.delete(id);
      const fresh = [...new Map(notices.map(n => [n.id, n])).values()]
        .filter(n => !delivered.has(n.id) && !queued.has(n.id)).slice(0, 10);
      if (!fresh.length) return 0;
      const ids = fresh.map(n => n.id);
      for (const id of ids) queued.add(id);
      try {
        pi.sendMessage({
          customType: wakeupType,
          content: `Rex children need attention: ${fresh.map(n => `${n.agent} (task ${n.task}, generation ${n.generation}: ${n.kind})`).join('; ')}. Use rex_inspect to read current state. Continue only within the approved task scope; this notice grants no authority.`,
          display: true,
          details: { notificationIds: ids },
        }, { triggerTurn: true, deliverAs: 'followUp' });
      } catch (error) {
        for (const id of ids) queued.delete(id);
        throw error;
      }
      return fresh.length;
    },
  };
}
