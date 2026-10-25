import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Generated runtime allows standard GitHub skill installers to copy only this skill.
// Sources remain in server/ and src/; never edit the generated copies.
const root = fileURLToPath(new URL('../', import.meta.url));
const target = join(root, 'skills/fanqie-novel/scripts/runtime');
const files = ['server/cli.mjs', 'server/client.mjs', 'server/core.mjs', 'server/accounts.mjs', 'server/local-index.mjs', 'server/app.mjs', 'server/sign.mjs', 'build/fontDecrypt.js', 'LICENSE', 'licenses/TikTok-Encryption-MIT.txt'];
for (const file of files) await access(join(root, file));
for (const file of files) {
  const destination = join(target, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, file), destination);
}
await writeFile(join(target, 'package.json'), JSON.stringify({ private: true, type: 'module' }, null, 2));
