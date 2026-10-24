import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { executeCLI } from './cli.mjs';
import { installSkill } from '../scripts/install-skill.mjs';
const exec = promisify(execFile);

test('CLI uses shared dispatch and preserves string IDs and directory pagination', async () => {
  const createClient = async () => ({ client: { directory: async book_id => ({ book_id, total: 3,
    chapters: [{ item_id: '1' }, { item_id: '2' }, { item_id: '3' }] }) } });
  const result = await executeCLI(['directory', '7143038691944959011', '--offset', '1', '--limit', '1'], { createClient });
  assert.equal(result.data.book_id, '7143038691944959011');
  assert.deepEqual(result.data.chapters, [{ item_id: '2' }]);
  assert.equal(result.data.has_more, true);
});
test('CLI rejects misspelled commands, extra arguments and incompatible options', async () => {
  for (const args of [['unknown'], ['detail', '1', '2'], ['chapter', '1', '--limit', '3'], ['search', 'x', '--offset']]) {
    await assert.rejects(executeCLI(args), e => e.code === 400);
  }
});
test('installed skill runs independently of repository and npm dependencies', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'fanqie-skill-test-'));
  const installed = await installSkill(parent);
  const script = join(installed, 'scripts/fanqie.mjs');
  const { stdout, stderr } = await exec(process.execPath, [script, 'capabilities'], { cwd: parent });
  assert.equal(stderr, '');
  assert.equal(JSON.parse(stdout).data.mode, 'direct_website');
  assert.ok((await readFile(join(installed, 'SKILL.md'), 'utf8')).includes('fanqie-novel'));
  await assert.rejects(installSkill(parent), /目标已存在/);
  try { await exec(process.execPath, [script, 'chapter', '../bad'], { cwd: parent }); assert.fail('invalid ID was accepted'); }
  catch (error) { assert.equal(error.code, 1); assert.equal(JSON.parse(error.stdout).code, 400); }
});
