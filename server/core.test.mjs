import test from 'node:test';
import assert from 'node:assert/strict';
import { WebsiteClient, initialState, dispatch } from './core.mjs';
import { createApiServer } from './http.mjs';
import { LocalIndex } from './local-index.mjs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('JSON extraction handles nested structures, escaped quotes and semicolons without evaluating scripts', () => {
  assert.deepEqual(initialState('x window.__INITIAL_STATE__={"x":"a;\\\"b}","y":[{}]};process.exit()'), { x: 'a;"b}', y: [{}] });
  assert.throws(() => initialState('window.__INITIAL_STATE__=process.exit();'), /有效 JSON/);
});
test('chapter decoding rejects locked chapters and unknown fonts', async () => {
  const fixture = (chapter, css = '') => new WebsiteClient({ fetcher: async () => new Response('window.__INITIAL_STATE__=' + JSON.stringify({ reader: { chapterData: chapter }, common: { css } }) + ';') });
  await assert.rejects(fixture({ itemId: '1', isChapterLock: true }).chapter('1'), e => e.code === 403);
  await assert.rejects(fixture({ itemId: '1', content: '<p>\ue4de</p>' }, 'font-family:newFont;').chapter('1'), e => e.kind === 'FONT_CHANGED');
  const ch = await fixture({ itemId: '1', content: '<p>\ue4de\ue4fc</p>', chapterWordNumber: '2' }, 'font-family:DNMrHsV173Pd4pgy;').chapter('1');
  assert.equal(ch.content, '一时');
});
test('batch validates IDs, limits and book membership', async () => {
  await assert.rejects(dispatch({}, '/api/chapter', new URLSearchParams({ item_id: '../x' })), e => e.code === 400);
  await assert.rejects(dispatch({}, '/api/content', new URLSearchParams({ tab: 'batch', book_id: '1', item_ids: Array(21).fill('2').join(',') })), e => e.code === 400);
  await assert.rejects(dispatch({ chapter: async () => ({ book_id: '3' }) }, '/api/content', new URLSearchParams({ tab: 'batch', book_id: '1', item_ids: '2' })), e => e.code === 400);
});
test('unsupported capabilities report 501 instead of fake success', async () => {
  for (const route of ['/api/device/register', '/api/ios/register', '/api/ios/content', '/api/manga/progress/1']) {
    await assert.rejects(dispatch({}, route, new URLSearchParams()), e => e.code === 501);
  }
});
test('HTTP wrapper preserves old envelopes and enforces localhost, origin and token', async t => {
  const server = createApiServer({}, { token: 'test-secret' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url + '/health')).status, 401);
  assert.equal((await fetch(url + '/health', { headers: { Authorization: 'Bearer test-secret', Origin: 'https://example.com' } })).status, 403);
  const response = await fetch(url + '/health', { headers: { Authorization: 'Bearer test-secret' } });
  const body = await response.json(); assert.equal(body.code, 200); assert.equal(body.data.status, 'ok');
  const unsupported = await fetch(url + '/api/ios/register', { headers: { Authorization: 'Bearer test-secret' } });
  assert.equal(unsupported.status, 501); assert.equal((await unsupported.json()).error, 'UNSUPPORTED_CAPABILITY');
});
test('duplicate concurrent upstream requests are coalesced', async () => {
  let calls = 0;
  const client = new WebsiteClient({ fetcher: async () => { calls++; return new Response('ok'); } });
  assert.deepEqual(await Promise.all([client.request('/'), client.request('/')]), ['ok', 'ok']);
  assert.equal(calls, 1);
});
test('official search sends the requested keyword and cursor without a local index', async () => {
  let called;
  const client = new WebsiteClient({ fetcher: async url => {
    called = new URL(url);
    return Response.json({ code: 0, data: { ret_data: [{ book_id: '42', title: '测试书' }], offset: 20, has_more: true } });
  } });
  const result = await client.search('测试', 3, 10);
  assert.equal(called.hostname, 'novel.snssdk.com');
  assert.equal(called.searchParams.get('q'), '测试');
  assert.equal(called.searchParams.get('offset'), '10');
  assert.equal(result.source, 'official_search');
  assert.equal(result.results[0].book_name, '测试书');
  assert.equal(result.next_offset, 20);
  await assert.rejects(client.request('/', false, 'https://example.com'), e => e.kind === 'INVALID_ORIGIN');
});
test('local index persists metadata and explicitly limits search scope', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'fanqie-index-test-'));
  const path = join(folder, 'index.json');
  const index = new LocalIndex(path);
  await index.add({ book_id: '123', book_name: '本地测试书', author: '作者甲' });
  const reloaded = new LocalIndex(path);
  const result = await reloaded.search('作者甲', 0);
  assert.equal(result.results[0].book_id, '123');
  assert.equal(result.whole_platform, false);
  assert.equal(result.source, 'local_index');
  assert.equal((await reloaded.search('没有收录', 0)).total, 0);
});
