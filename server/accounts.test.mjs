import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AccountClient, AccountStore, accountJSON, dispatchAccount } from './accounts.mjs';
import { createApiServer } from './http.mjs';
import { executeCLI } from './cli.mjs';

const makeStore = async () => new AccountStore(await mkdtemp(join(tmpdir(), 'fanqie-accounts-test-')));
const ok = data => Response.json({ code: 0, data });
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=';

test('account JSON preserves integer IDs and leaves quoted strings untouched', () => {
  const result = accountJSON('{"book_id":7143038691944959011,"text":"number 7143038691944959011","small":10,"ratio":0.5}');
  assert.equal(result.book_id, '7143038691944959011');
  assert.equal(result.text, 'number 7143038691944959011');
  assert.equal(result.small, 10); assert.equal(result.ratio, 0.5);
});

test('QR login preserves cookies on redirects, verifies the session and does not expose secrets', async () => {
  const store = await makeStore();
  const client = new AccountClient({ store, fetcher: async (url, options) => {
    const path = new URL(url).pathname;
    if (path === '/main/writer/login') return new Response('<html></html>');
    if (path.includes('get_qrcode')) return Response.json({ message: 'success', data: { token: 'private-qr-token', qrcode: png, expire_time: Date.now() / 1000 + 60 } }, { headers: { 'Set-Cookie': 'passport_csrf_token=csrf-test; Domain=fanqienovel.com; Path=/' } });
    if (path.includes('check_qrconnect')) {
      assert.equal(options.headers['x-tt-passport-csrf-token'], 'csrf-test');
      return new Response('', { status: 302, headers: { Location: '/complete-login', 'Set-Cookie': 'prelogin=yes; Path=/' } });
    }
    if (path === '/complete-login') {
      assert.match(options.headers.Cookie, /prelogin=yes/);
      return new Response('', { status: 302, headers: { Location: '/', 'Set-Cookie': 'sessionid=private-session; Path=/' } });
    }
    if (path === '/api/reader/book/progress') {
      assert.match(options.headers.Cookie, /sessionid=private-session/);
      return ok([{ book_id: '1', item_id: '2', read_progress: 0.7 }]);
    }
    assert.fail('unexpected request');
  } });
  const login = await client.loginStart('alice');
  assert.ok((await readFile(login.qrcode_path)).length > 0);
  assert.ok(!JSON.stringify(login).includes('private-qr-token'));
  const result = await client.loginPoll('alice', login.login_id);
  assert.equal(result.status, 'connected');
  assert.ok(!JSON.stringify(result).includes('private-session'));
  assert.equal((await store.read('alice')).cookies.sessionid, 'private-session');
  assert.equal((await client.status('alice')).status, 'connected');
  assert.equal((await client.status('bob')).status, 'disconnected');
});

test('private bookshelf and progress are isolated by profile and missing values are not invented', async () => {
  const store = await makeStore();
  await store.write('alice', { cookies: { sessionid: 'alice-secret' } });
  await store.write('bob', { cookies: { sessionid: 'bob-secret' } });
  let calls = 0;
  const client = new AccountClient({ store, fetcher: async (url, options) => {
    calls++;
    const account = options.headers.Cookie.includes('alice-secret') ? 'alice' : 'bob';
    const book = account === 'alice' ? '1111111111111111111' : '2222222222222222222';
    if (url.includes('/bookshelf/info/')) return ok({ book_shelf_info: [{ book_id: book }, { book_id: '3' }] });
    if (url.includes('/book/progress')) return ok([{ book_id: book, item_id: '44', index: 12, read_progress: 0.2, read_timestamp: 123 }]);
    if (url.includes('/bookshelf/multidetail')) {
      assert.equal(JSON.parse(options.body).books[0].book_id, book);
      return ok({ detail_list: [{ book_id: book, book_name: account + ' book' }] });
    }
    assert.fail('unexpected request');
  } });
  const alice = await client.bookshelf('alice', 0, 1), bob = await client.bookshelf('bob', 0, 1);
  assert.equal(alice.books[0].book_name, 'alice book');
  assert.equal(bob.books[0].book_name, 'bob book');
  assert.equal(alice.next_offset, 1); assert.equal(alice.total, 2);
  assert.equal(alice.books[0].chapter_count, null);
  assert.equal((await client.progress('alice', '999')).records.length, 0);
  const before = calls;
  await assert.rejects(client.bookshelf('unconnected'), e => e.code === 401);
  assert.equal(calls, before);
});

test('session expiry does not become an empty successful bookshelf and logout prevents old login reuse', async () => {
  const store = await makeStore();
  await store.write('alice', { cookies: { sessionid: 'expired' }, pending: { login_id: 'old', token: 'token', expires_at: Date.now() + 60000 } });
  const client = new AccountClient({ store, fetcher: async () => Response.json({ code: -1, message: '请先登录' }) });
  await assert.rejects(client.progress('alice'), e => e.code === 401);
  assert.equal((await client.status('alice')).status, 'expired');
  await client.logout('alice');
  assert.deepEqual(await store.read('alice'), {});
  await assert.rejects(client.loginPoll('alice', 'old'), e => e.kind === 'ACCOUNT_LOGIN_NOT_FOUND');
});

test('account paths and login redirects cannot escape the permitted storage and origin', async () => {
  const store = await makeStore(); let calls = 0;
  const client = new AccountClient({ store, fetcher: async () => { calls++; assert.fail('must not send cookies'); } });
  await assert.rejects(client.status('../outside'), e => e.kind === 'INVALID_ARGUMENT');
  await assert.rejects(client.request('https://example.com/steal', { sessionid: 'secret' }), e => e.kind === 'ACCOUNT_REDIRECT_DENIED');
  await assert.rejects(client.request('https://user:secret@fanqienovel.com/', {}), e => e.kind === 'ACCOUNT_REDIRECT_DENIED');
  assert.equal(calls, 0);
});

test('expired and replaced QR sessions cannot be polled and personal highlights require login', async () => {
  const store = await makeStore();
  await store.write('alice', { pending: { login_id: 'new', expires_at: Date.now() - 1 } });
  const client = new AccountClient({ store, fetcher: async () => assert.fail('must not call expired login') });
  await assert.rejects(client.loginPoll('alice', 'old'), e => e.code === 404);
  assert.equal((await client.loginPoll('alice', 'new')).status, 'expired');
  assert.equal((await store.read('alice')).pending, undefined);
  await assert.rejects(dispatchAccount(client, 'highlights', new URLSearchParams({ book_id: '1' })), e => e.code === 401);
});

test('saved underlines use next_id=0, keep full text and carry both paging fields in an account-bound cursor', async () => {
  const store = await makeStore(); await store.write('alice', { cookies: { sessionid: 'test' } });
  const longText = '完整收藏原文，不截断。'.repeat(500);
  let calls = 0;
  const client = new AccountClient({ store, fetcher: async url => {
    calls++;
    const params = new URL(url).searchParams;
    if (calls === 1) {
      assert.equal(params.get('next_id'), '0'); assert.equal(params.get('offset'), '0');
      return ok({ bookmark_data: [{ bookmark_id: '100', book_id: '1', item_id: '2', bookmark_form_type: 1 }], has_more: true, next_id: '100', next_offset: 2 });
    }
    assert.equal(params.get('next_id'), '100'); assert.equal(params.get('offset'), '2');
    return ok({ bookmark_data: [{ bookmark_id: '101', book_id: '1', item_id: '2', bookmark_form_type: 2, para_content: longText,
      item_info: { title: '章节名' }, line_pos: { start_word_pos: 3 } }], has_more: false, next_id: '101', next_offset: 4 });
  } });
  const first = await client.highlights('alice', '1');
  assert.equal(first.returned, 0); assert.equal(first.has_more, true);
  assert.ok(first.cursor);
  const next = await client.highlights('alice', '1', 20, first.cursor);
  assert.equal(next.highlights[0].text, longText);
  assert.equal(next.highlights[0].chapter_title, '章节名');
  assert.equal(next.highlights[0].line_position.start_word_pos, 3);
  assert.equal(next.cursor, null); assert.equal(next.client_truncated, false);
  await assert.rejects(client.highlights('bob', '1', 20, first.cursor), e => e.code === 400);
  await assert.rejects(client.highlights('alice', '2', 20, first.cursor), e => e.code === 400);
  assert.equal(calls, 2);
});

test('separate client instances cannot overwrite a pending login or logout concurrently', async () => {
  const store = await makeStore(); const release = await store.lock('alice');
  const another = new AccountClient({ store: new AccountStore(store.root) });
  try { await assert.rejects(another.logout('alice'), e => e.kind === 'ACCOUNT_BUSY'); }
  finally { await release(); }
  assert.equal((await another.logout('alice')).status, 'disconnected');
});

test('HTTP account operations require POST and reject cross-origin requests; CLI uses the same account dispatch', async t => {
  let starts = 0;
  const accounts = { loginStart: async account => { starts++; return { account, status: 'waiting_scan' }; },
    bookshelf: async (account, offset, limit) => ({ account, offset, limit }) };
  const server = createApiServer({}, { accounts, token: '' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/account/login/start?account=alice`;
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await fetch(url, { method: 'POST', headers: { Origin: 'https://example.com' } })).status, 403);
  assert.equal(starts, 0);
  assert.equal((await (await fetch(url, { method: 'POST' })).json()).data.account, 'alice');
  const page = await executeCLI(['bookshelf', '--account', 'bob', '--offset', '2', '--limit', '3'], { createClient: async () => ({ accounts }) });
  assert.deepEqual(page.data, { account: 'bob', offset: 2, limit: 3 });
  await assert.rejects(executeCLI(['bookshelf', '--cursor', 'x']), e => e.code === 400);
});
