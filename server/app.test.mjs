import test from 'node:test';
import assert from 'node:assert/strict';
import { WebsiteClient, dispatch } from './core.mjs';
import { signRequest } from './sign.mjs';
import { executeCLI } from './cli.mjs';

test('native signer matches fixed independent protocol vectors', () => {
  const query = new URLSearchParams({ device_id: '2187355326004404', version_name: '7.0.1.32', aid: '1967' });
  const options = { now: 1792846000000, nonce: Buffer.from([1, 2, 3, 4]), randomValue: 12345 };
  const headers = signRequest('https://reading.snssdk.com/?' + query, '', options);
  assert.equal(headers['x-ladon'], 'AQIDBNCWTBorPahqcKWcurBE2mabuge4sBwUJsyHVivhtMsH');
  assert.equal(headers['x-argus'], '8oGtly/q30zomF9jsMsfO3JH1WF7TLiPqtHvN1FuiHsrhc+PdIrYefXosEK6ZZjO/HCkxwJspyIXnhYnyKAcSaD2KqIqT+psmCfSh8e3Z9gbeeYOq4HyXojpxDSMGfqI/6Y4YOz7PXEUovWGy02uBQ2LWiou7KJE7fI+Ty5TfvgpnwQUMEa8JzG1z0LZUVn5Kz60rjzx+tWkmfZFcljS2y9F23QhqaCgAlW1tPfbJhufyvqBKPkn87igp6O8X8xGEQK71csm2uiA/qRSMdIZ0gn+');
  const post = signRequest('https://reading.snssdk.com/?' + query, '{}', options);
  assert.equal(post['X-SS-STUB'], '99914b932bd37a50b983c5e7c90ae93b');
  assert.notEqual(post['x-argus'], headers['x-argus']);
});
test('comments return the entire upstream text and preserve opaque next-page cursor', async () => {
  const text = '完整评论正文。'.repeat(1000); const cursor = '{"session_id":"test-session","offset":2}';
  let posted;
  const client = new WebsiteClient({ fetcher: async (url, options) => {
    posted = JSON.parse(options.body);
    assert.equal(options.method, 'POST'); assert.ok(options.headers['x-argus']);
    return Response.json({ code: 0, data: { common_list_info: { cursor, has_more: true, total: 9 },
      data_list: [{ comment: { comment_id: '12345678901234567890', common: { content: { text } }, stat: { digg_count: 12 } } }] } });
  } });
  const result = await dispatch(client, '/api/comment', new URLSearchParams({ book_id: '1', count: '2', cursor }));
  assert.equal(posted.cursor, cursor);
  assert.equal(result.comments[0].text, text); assert.equal(result.comments[0].content, text);
  assert.equal(result.comments[0].comment_id, '12345678901234567890');
  assert.equal(result.cursor, cursor); assert.equal(result.client_truncated, false);
  await assert.rejects(dispatch(client, '/api/comment', new URLSearchParams({ book_id: '1', count: '101' })), e => e.code === 400);
});
test('category search reads video_data for dramas and book_data for manga', async () => {
  for (const type of [8, 11]) {
    const client = new WebsiteClient({ fetcher: async () => Response.json({ code: 0, search_tabs: [{ tab_type: type, passback: 10, has_more: true,
      data: [{ book_id: '20', book_data: [{ book_id: '20', book_name: '漫画' }], video_data: [{ series_id: '21', title: '短剧', vid: '22' }] }] }] }) });
    const result = await client.search('关键词', type, 0);
    assert.equal(result.results[0].book_name, type === 8 ? '漫画' : '短剧');
    assert.equal(result.source, 'official_app_search'); assert.equal(result.next_offset, 10);
  }
});
test('Skill CLI passes comment cursors and media search type to the shared implementation', async () => {
  const createClient = async () => ({ client: {
    search: async (key, type, offset, cursor) => ({ key, type, offset, cursor }),
    comments: async (book, count, offset, cursor) => ({ book, count, offset, cursor }),
  } });
  assert.equal((await executeCLI(['search', '重生', '--type', 'drama'], { createClient })).data.type, 11);
  assert.equal((await executeCLI(['search', '重生', '--type', 'drama', '--cursor', 'opaque+/='], { createClient })).data.cursor, 'opaque+/=');
  assert.equal((await executeCLI(['comments', '1', '--count', '3', '--cursor', 'opaque'], { createClient })).data.cursor, 'opaque');
});

test('category pagination passes opaque tokens through unchanged instead of coercing them into offsets', async () => {
  const cursor = '{"offset":10,"session":"a+b/c="}';
  let called;
  const client = new WebsiteClient({ fetcher: async url => {
    called = new URL(url);
    return Response.json({ code: 0, search_tabs: [{ tab_type: 11, data: [], passback: cursor, has_more: '0' }] });
  } });
  const result = await dispatch(client, '/api/search', new URLSearchParams({ key: '重生', tab_type: '11', cursor }));
  assert.equal(called.searchParams.get('passback'), cursor);
  assert.equal(result.cursor, cursor);
  assert.equal(result.next_offset, cursor);
  assert.equal(result.has_more, false);
  await assert.rejects(client.search('重生', 11, 0, 'bad\ncursor'), e => e.code === 400);
});
