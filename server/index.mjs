#!/usr/bin/env node
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { integer } from './core.mjs';
import { createLocalClient } from './client.mjs';
import { createApiServer } from './http.mjs';

export async function startLocalServer({ port = integer(process.env.FANQIE_LOCAL_PORT, 5000, 1, 65535), quiet = false } = {}) {
  const { client, index, accounts } = await createLocalClient();
  const server = createApiServer(client, { index, accounts });
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  if (!quiet) console.error(`番茄本地 API 已启动：http://127.0.0.1:${server.address().port}（官网直连）`);
  return { server, client, index };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startLocalServer().then(({ server }) => {
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
  }).catch(error => { console.error('本地 API 启动失败：', error.message); process.exitCode = 1; });
}
