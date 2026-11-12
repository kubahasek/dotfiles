import fs from 'node:fs';
import path from 'node:path';

export function privateDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const st = fs.lstatSync(dir);
  if (st.isSymbolicLink() || st.uid !== process.getuid() || (st.mode & 0o077)) throw Error('State directory must be private and owned');
  return fs.realpathSync(dir);
}
export function privateJSON(file, fallback) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.isSymbolicLink() || st.uid !== process.getuid() || (st.mode & 0o077)) throw Error('Unsafe private file');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { if (e.code === 'ENOENT') return fallback; if (e instanceof SyntaxError) throw Error('Invalid private JSON; inspect the owned file locally'); throw e; }
}
// Atomic rename is the commit point. Any uncertainty after it poisons this writer.
export class Store {
  constructor(dir, io = fs, name = 'state') {
    this.dir = privateDirectory(dir); this.io = io; this.name = name; this.failed = false;
    this.file = path.join(this.dir, `${name}.json`);
    for (const n of [`${name}.json`, `${name}.tmp`, 'coordinator.lock', 'control.sock']) {
      try { if (fs.lstatSync(path.join(this.dir, n)).isSymbolicLink()) throw Error('Unsafe state symlink'); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    this.state = privateJSON(this.file, { version: 4, groups: {}, agents: {}, receipts: {}, events: [] });
    if (this.state.version !== 4) throw Error('Unsupported state version; retain old state and use new directory');
  }
  save(state) {
    if (this.failed) throw Error('Store fail-stop; restart and reconcile');
    const io = this.io, tmp = path.join(this.dir, `${this.name}.tmp`);
    let renamed = false;
    try {
      const fd = io.openSync(tmp, fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
      try { io.writeFileSync(fd, JSON.stringify(state)); io.fsyncSync(fd); } finally { io.closeSync(fd); }
      io.renameSync(tmp, this.file); renamed = true;
      const d = io.openSync(this.dir, 'r');
      try { io.fsyncSync(d); } finally { io.closeSync(d); }
      this.state = state;
    } catch (e) { if (renamed) this.failed = true; throw e; }
  }
  transaction(fn) {
    if (this.failed) throw Error('Store fail-stop; restart and reconcile');
    const next = structuredClone(this.state), value = fn(next);
    this.save(next); return structuredClone(value);
  }
}
