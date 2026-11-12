// Geometry is observed at launch time, not inferred from historical agent counts.
export const MIN_PANE_COLUMNS = 100;
export const MIN_PANE_ROWS = 24;
function leaves(node, depth = 0) {
  if (!node || depth > 64) return [];
  if (typeof node.block_id === 'string') return [node];
  return node.split ? [...leaves(node.split.before, depth + 1), ...leaves(node.split.after, depth + 1)] : [];
}
// Hidden/background panes can retain their pre-split PTY size. Bound those
// readings by the last coherent window viewport and the current normalized rect.
export function measurePaneSizes(windows, sizeOf, viewports) {
  const measured = new Map(), present = new Set();
  for (const window of Array.isArray(windows) ? windows : []) {
    present.add(window.window_id);
    const panes = (window.layers ?? []).filter(layer => layer.kind === 'tiled').flatMap(layer => leaves(layer.layout));
    const readings = panes.map(pane => {
      try {
        const size = sizeOf(pane.block_id), rect = pane.rect;
        if (!size || ![size.columns, size.rows].every(n => Number.isInteger(n) && n > 0 && n <= 65535) || !Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) || rect[0] < 0 || rect[1] < 0 || rect[2] <= 0 || rect[3] <= 0 || rect[0] + rect[2] > 1.001 || rect[1] + rect[3] > 1.001) return null;
        return { pane, size, columns: size.columns / rect[2], rows: size.rows / rect[3] };
      } catch { return null; }
    });
    const valid = readings.filter(Boolean);
    if (valid.length && valid.length === panes.length) {
      const columns = Math.min(...valid.map(r => r.columns)), rows = Math.min(...valid.map(r => r.rows));
      // Only refresh the viewport when every leaf agrees (within cell rounding).
      // Otherwise, a new 80x24 PTY or a stale parent must not inflate the space.
      if (valid.every(r => Math.abs(r.columns - columns) <= 2 && Math.abs(r.rows - rows) <= 2)) viewports.set(window.window_id, { columns, rows });
    }
    const viewport = viewports.get(window.window_id);
    if (viewport) for (const r of valid) measured.set(r.pane.block_id, {
      columns: Math.min(r.size.columns, Math.floor(viewport.columns * r.pane.rect[2])),
      rows: Math.min(r.size.rows, Math.floor(viewport.rows * r.pane.rect[3])),
    });
  }
  for (const key of viewports.keys()) if (!present.has(key)) viewports.delete(key);
  return measured;
}
export function planPanePlacement({ windows = [], parentBlock, managedBlocks = [], capacity = 3, sizeOf }) {
  const views = (Array.isArray(windows) ? windows : []).map(window => ({
    window, blocks: [...new Set((window.layers ?? []).filter(layer => layer.kind === 'tiled').flatMap(layer => leaves(layer.layout).map(pane => pane.block_id)))],
  }));
  const managed = new Set(managedBlocks);
  const parent = views.find(view => view.blocks.includes(parentBlock));
  // Never split arbitrary focused panes, floating panes, or another parent's agents.
  const eligible = [parent, ...views.filter(view => view !== parent && view.blocks.some(block => managed.has(block)))].filter(Boolean);
  for (const view of eligible) {
    if (view.blocks.filter(block => managed.has(block)).length >= capacity) continue;
    const candidates = view.blocks.filter(block => block === parentBlock || managed.has(block)).flatMap(block => {
      try {
        const size = sizeOf(block);
        if (!size || ![size.columns, size.rows].every(value => Number.isInteger(value) && value > 0 && value <= 65535)) return [];
        return [{ block, ...size }];
      } catch { return []; } // Missing/unmeasurable panes do not justify a speculative split.
    }).sort((a, b) => b.columns * b.rows - a.columns * a.rows);
    for (const pane of candidates) {
      // Reserve two cells for divider/rounding. Both halves must remain readable.
      if (Math.floor((pane.columns - 2) / 2) >= MIN_PANE_COLUMNS && pane.rows >= MIN_PANE_ROWS) return { anchor: pane.block, split: 'right' };
      if (pane.columns >= MIN_PANE_COLUMNS && Math.floor((pane.rows - 2) / 2) >= MIN_PANE_ROWS) return { anchor: pane.block, split: 'below' };
    }
  }
  const labels = new Set(views.map(view => view.window.label));
  let number = 1;
  while (labels.has(number === 1 ? 'Agents' : `Agents ${number}`)) number++;
  return { tab: number === 1 ? 'Agents' : `Agents ${number}` };
}
