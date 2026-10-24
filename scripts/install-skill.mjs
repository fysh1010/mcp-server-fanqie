#!/usr/bin/env node
import { access, cp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function installSkill(targetParent) {
  if (!targetParent) throw new Error('需要指定技能父目录：node scripts/install-skill.mjs --target "<技能父目录>"');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const destination = resolve(targetParent, 'fanqie-novel');
  try { await access(destination); throw new Error(`目标已存在，未覆盖任何文件：${destination}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await access(join(root, 'skills/fanqie-novel/scripts/runtime/server/cli.mjs'));
  await cp(join(root, 'skills/fanqie-novel'), destination, { recursive: true, errorOnExist: true, force: false });
  return destination;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--target') throw new Error('用法：node scripts/install-skill.mjs --target "<技能父目录>"');
    console.log(JSON.stringify({ installed: await installSkill(args[1]), requires: 'Node.js >=22', runtime_dependencies: [] }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
