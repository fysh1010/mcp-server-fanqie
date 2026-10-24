#!/usr/bin/env node
import { startLocalServer } from './index.mjs';

// No fixed port and no reliance on an already running service.
let server;
if (!process.env.FANQIE_API_BASE) {
  ({ server } = await startLocalServer({ port: 0, quiet: true }));
  process.env.FANQIE_API_BASE = `http://127.0.0.1:${server.address().port}`;
  process.env.FANQIE_API_TOKEN = process.env.FANQIE_LOCAL_TOKEN || '';
  process.stdin.once('end', () => server.close());
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
}
try { await import('../build/index.js'); }
catch (error) { server?.close(); throw error; }
