import { randomUUID } from 'node:crypto';
// Scan leaf entries only: toolResult usage may aggregate the same assistant turns.
export const tokenKeys = ['input', 'output', 'cacheRead', 'cacheWrite'];
export function combineUsage(rows) {
  const knownEstimate = rows.reduce((n, r) => n + r.knownEstimate, 0);
  const unknownPrices = rows.reduce((n, r) => n + r.unknownPrices, 0);
  return { messages: rows.reduce((n, r) => n + r.messages, 0), tokens: Object.fromEntries(tokenKeys.map(k => [k, rows.reduce((n, r) => n + r.tokens[k], 0)])), knownEstimate, unknownPrices, estimate: unknownPrices ? null : knownEstimate, pricing: 'estimate-not-invoice' };
}
export function transcriptUsage(ctx, { knownFreeModels = [] } = {}) {
  const seen = new Set(), rows = [];
  for (const e of ctx.sessionManager.getEntries()) {
    if (!e.id || seen.has(e.id)) continue;
    seen.add(e.id);
    const message = e.type === 'message' && e.message.role === 'assistant' ? e.message : null;
    const u = message?.usage ?? (['usage', 'compaction', 'branch_summary'].includes(e.type) ? e.usage : null);
    if (!u) continue;
    const provider = message?.provider ?? e.provider, modelId = message?.model ?? e.model;
    const rates = provider && modelId ? ctx.modelRegistry.find(provider, modelId)?.cost : null;
    const priced = rates && tokenKeys.every(k => Number.isFinite(rates[k]) && rates[k] >= 0) && (tokenKeys.some(k => rates[k] > 0) || knownFreeModels.includes(`${provider}/${modelId}`));
    const tokens = Object.fromEntries(tokenKeys.map(k => [k, Number.isSafeInteger(u[k]) && u[k] >= 0 ? u[k] : 0]));
    rows.push({ messages: 1, tokens, knownEstimate: priced ? tokenKeys.reduce((sum, k) => sum + tokens[k] * rates[k] / 1e6, 0) : 0, unknownPrices: priced ? 0 : 1 });
  }
  return combineUsage(rows);
}
export function ingestUsage(ctx, journal, _enqueue, options = {}) {
  const session = ctx.sessionManager.getSessionId(), summary = transcriptUsage(ctx, options);
  const previous = journal.state.usageSnapshots?.[session];
  if (previous && JSON.stringify(previous.summary) === JSON.stringify(summary)) return;
  // Keep only complete snapshots, never a permanent per-entry accounting ledger.
  journal.update(s => {
    const revision = (previous?.revision ?? 0) + 1;
    (s.usageSnapshots ??= {})[session] = { revision, summary };
    s.outbox = s.outbox.filter(r => r.op !== 'usage-snapshot' || r.session !== session);
    s.outbox.push({ op: 'usage-snapshot', session, revision, summary, ...options.identity, requestId: randomUUID() });
    return null;
  });
}
