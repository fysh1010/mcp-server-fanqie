/**
 * 把番茄核心（零依赖纯 ESM）从仓库源码同步到插件包的 vendor/ 目录，
 * 使插件包在与仓库分离的干净目录中也能独立加载。
 *
 * 用法：node scripts/vendor.mjs [--check]
 *   --check  只校验 vendor/ 与源码是否一致（CI/回归用），不写文件。
 *
 * 布局保持与仓库一致（vendor/server/*.mjs + vendor/build/fontDecrypt.js），
 * 因此核心文件里的相对导入（'./core.mjs'、'../build/fontDecrypt.js'）无需改动。
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(here, '..');
const repoRoot = resolve(packageDir, '..', '..');
const vendorDir = join(packageDir, 'vendor');

/** 同步清单：仓库相对路径 → 期望的 sha256（留空表示不做固定，只做同步）。 */
const FILES = [
  'server/core.mjs',
  'server/client.mjs',
  'server/accounts.mjs',
  'server/local-index.mjs',
  'server/app.mjs',
  'server/sign.mjs',
  'build/fontDecrypt.js',
];

const checkOnly = process.argv.includes('--check');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// 干净目录安装的包里没有仓库源码：此时 vendor/ 是唯一事实来源，跳过校验。
if (!process.env.FANQIE_SKIP_VENDOR_CHECK && !FILES.some((rel) => existsSync(join(repoRoot, rel)))) {
  console.log('仓库源码不在上两级目录（独立安装包），跳过 vendor 校验；vendor/ 自包含可用。');
  process.exit(0);
}

let mismatched = 0;
for (const rel of FILES) {
  const source = join(repoRoot, rel);
  const target = join(vendorDir, rel);
  const buf = await readFile(source);
  let identical = false;
  try {
    identical = sha256(buf) === sha256(await readFile(target));
  } catch { /* 目标不存在 */ }
  if (identical) {
    console.log(`ok      ${rel}`);
    continue;
  }
  if (checkOnly) {
    mismatched += 1;
    console.log(`MISMATCH ${rel}`);
    continue;
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buf);
  console.log(`copied  ${rel}`);
}

if (checkOnly && mismatched > 0) {
  console.error(`vendor/ 与源码不一致（${mismatched} 个文件）。运行 node scripts/vendor.mjs 重新同步。`);
  process.exitCode = 1;
} else if (!checkOnly) {
  const entries = await readdir(join(vendorDir, 'server'));
  console.log(`vendor/server: ${entries.join(', ')}`);
  console.log('vendor 同步完成。');
}
