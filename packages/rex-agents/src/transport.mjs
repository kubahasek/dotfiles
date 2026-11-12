import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
export async function serve(domain, dir, { maxClients = 32, frameMs = 5000, maxBytes = 64000 } = {}) {
  const lock = path.join(dir, 'coordinator.lock');
  const fd = fs.openSync(lock, 'wx', 0o600); fs.writeFileSync(fd, String(process.pid)); fs.closeSync(fd);
  const socket = path.join(dir, 'control.sock'), clients = new Set();
  const server = net.createServer(c => {
    if (clients.size >= maxClients) { c.destroy(); return; }
    clients.add(c); let data = Buffer.alloc(0), done = false;
    const timer = setTimeout(() => c.destroy(), frameMs); // absolute, not inactivity-based
    c.on('close', () => { clearTimeout(timer); clients.delete(c); }); c.on('error', () => {});
    c.on('data', async chunk => {
      if (done) return;
      if (data.length + chunk.length > maxBytes) { done = true; c.destroy(); return; }
      data = Buffer.concat([data, chunk]); const end = data.indexOf(10); if (end < 0) return;
      done = true;
      try {
        const value = await domain.dispatch(JSON.parse(data.subarray(0, end).toString('utf8')));
        const response = JSON.stringify({ value }) + '\n';
        if (Buffer.byteLength(response) > 512000) throw Error('Response too large; use paging');
        c.end(response);
      } catch (e) { c.end(JSON.stringify({ error: e.message, code: /^(Request exists|Invalid |Unknown |Unanswered |Stale |Usage snapshot conflict|Idempotency conflict|Parent required|Unauthorized)/.test(e.message) ? 'REJECTED' : 'UNCERTAIN' }) + '\n'); }
    });
  });
  try {
    if (fs.existsSync(socket)) fs.unlinkSync(socket);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socket, resolve); }); fs.chmodSync(socket, 0o600);
  } catch (e) { fs.unlinkSync(lock); throw e; }
  return { server, clients, close: async () => { for (const c of clients) c.destroy(); await new Promise(resolve => server.close(resolve)); fs.rmSync(lock, { force: true }); } };
}
export function call(socket, request, timeout = 20000) {
  const frame = JSON.stringify(request) + '\n';
  if (Buffer.byteLength(frame) > 64000) return Promise.reject(Error('Input too large'));
  return new Promise((resolve, reject) => {
    const c = net.createConnection(socket); let data = Buffer.alloc(0);
    const timer = setTimeout(() => c.destroy(Error('Coordinator deadline')), timeout);
    c.on('close', () => clearTimeout(timer)); c.on('error', reject);
    c.on('connect', () => c.write(frame));
    c.on('data', b => { if (data.length + b.length > 512000) { c.destroy(Error('Response too large')); return; } data = Buffer.concat([data, b]); });
    c.on('end', () => { try { const r = JSON.parse(data.toString('utf8')); if (r.error) reject(Object.assign(Error(r.error), { code: r.code })); else resolve(r.value); } catch (e) { reject(e); } });
  });
}
