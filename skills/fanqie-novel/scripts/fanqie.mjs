#!/usr/bin/env node
import { access } from 'node:fs/promises';

// Installed skill includes a self-contained runtime. Repository use reuses source.
const candidates = [new URL('./runtime/server/cli.mjs', import.meta.url), new URL('../../../server/cli.mjs', import.meta.url)];
let entry;
for (const candidate of candidates) {
  try { await access(candidate); entry = candidate; break; } catch {}
}
if (!entry) {
  console.log(JSON.stringify({ code: 500, message: '技能运行文件缺失，请使用仓库的 scripts/install-skill.mjs 安装完整 Skill', data: null }));
  process.exitCode = 1;
} else {
  const { main } = await import(entry.href);
  await main();
}
