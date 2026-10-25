import test from 'node:test';
import assert from 'node:assert/strict';
import { WebsiteClient } from './core.mjs';
import { createApiServer } from './http.mjs';

test('transient network and HTTP failures retry once, then cache successful results', async () => {
  for (const failure of [() => { throw new TypeError('connection reset'); }, () => new Response('', { status: 503 })]) {
    let calls = 0;
    const client = new WebsiteClient({ fetcher: async () => ++calls === 1 ? failure() : new Response('ok') });
    assert.deepEqual(await Promise.all([client.request('/'), client.request('/')]), ['ok', 'ok']);
    assert.equal(await client.request('/'), 'ok');
    assert.equal(calls, 2);
  }
});

test('failed response streams produce an upstream error, are retried once, and are not cached', async () => {
  let calls = 0;
  const client = new WebsiteClient({ fetcher: async () => {
    calls++;
    return new Response(new ReadableStream({ start(controller) { controller.error(new Error('broken body')); } }));
  } });
  await assert.rejects(client.request('/'), e => e.code === 502 && e.kind === 'UPSTREAM_UNAVAILABLE');
  assert.equal(calls, 2);
  assert.equal(client.pending.size, 0);
  assert.equal(client.cache.size, 0);
});

test('HTTP rate limits are surfaced and enforce a per-origin cooldown without fallback or retry', async t => {
  let calls = 0;
  const client = new WebsiteClient({ fetcher: async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '60' } }); },
    searchFallback: () => assert.fail('must not hide rate limiting with local search') });
  const server = createApiServer(client, { token: '' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/api/search?key=test');
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal((await response.json()).error, 'UPSTREAM_RATE_LIMIT');
  await assert.rejects(client.search('different', 3, 0), e => e.code === 429 && e.retry_after > 0);
  assert.equal(calls, 1);
});

test('permission errors, long Retry-After and malformed JSON are not retried', async () => {
  for (const [response, expected] of [
    [new Response('', { status: 403 }), 'UPSTREAM_ACCESS_DENIED'],
    [new Response('', { status: 503, headers: { 'Retry-After': '60' } }), 'UPSTREAM_HTTP'],
    [Response.json(null), 'UPSTREAM_FORMAT'],
    [Response.json([]), 'UPSTREAM_FORMAT'],
    [new Response('<html>verify</html>'), 'UPSTREAM_VERIFICATION'],
  ]) {
    let calls = 0;
    const client = new WebsiteClient({ fetcher: async () => { calls++; return response; } });
    await assert.rejects(client.request('/', true), e => e.kind === expected);
    assert.equal(calls, 1);
    assert.equal(client.cache.size, 0);
  }
});

test('oversized response bodies are stopped while streaming and counted in bytes', async () => {
  for (const declared of [true, false]) {
    let cancelled = false; let pulls = 0;
    const chunk = new TextEncoder().encode('汉'.repeat(1_000_000));
    const response = new Response(new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(chunk); },
      cancel() { cancelled = true; },
    }), { headers: declared ? { 'Content-Length': '9000000' } : {} });
    const client = new WebsiteClient({ fetcher: async () => response });
    await assert.rejects(client.request('/'), e => e.kind === 'UPSTREAM_FORMAT');
    assert.equal(cancelled, true);
    assert.ok(pulls <= 4);
    assert.equal(client.cache.size, 0);
  }
});

test('bounded queue rejects overload while allowing duplicate request coalescing', async () => {
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  const client = new WebsiteClient({ fetcher: async () => { await gate; return new Response('', { status: 429, headers: { 'Retry-After': '60' } }); } });
  const requests = Array.from({ length: 32 }, (_, i) => client.request(`/item/${i}`));
  const duplicate = client.request('/item/0');
  const settled = Promise.allSettled([...requests, duplicate]);
  await assert.rejects(client.request('/overflow'), e => e.code === 503 && e.kind === 'LOCAL_BUSY');
  unblock();
  assert.ok((await settled).every(result => result.status === 'rejected' && result.reason.code === 429));
  assert.equal(client.pending.size, 0);
});
