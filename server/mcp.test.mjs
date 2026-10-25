import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { createApiServer } from './http.mjs';

test('MCP publishes pagination schemas and passes directory pages and search cursors to the HTTP API', async () => {
  const cursor = '{"offset":10,"session":"a+b"}';
  const server = createApiServer({
    directory: async book_id => ({ book_id, total: 60, chapters: Array.from({ length: 60 }, (_, i) => ({ item_id: String(i + 1) })) }),
    search: async (key, type, offset, actualCursor) => ({ key, type, offset, cursor: actualCursor }),
  }, { token: '', accounts: {
    status: async account => ({ account, status: 'connected' }),
    loginStart: async account => ({ account, status: 'waiting_scan', login_id: 'id', qrcode: 'data:image/png;base64,aGVsbG8=' }),
    bookshelf: async (account, offset, limit) => ({ account, offset, limit, books: [] }),
    highlights: async (account, bookId, limit, cursor) => ({ account, bookId, limit, cursor, highlights: [{ text: '本人划线' }] }),
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const mcp = new Client({ name: 'pagination-test', version: '1' }, { capabilities: {} });
  try {
    await mcp.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('server/mcp-local.mjs')],
      env: { ...process.env, FANQIE_API_BASE: `http://127.0.0.1:${server.address().port}` }, stderr: 'pipe' }));
    const list = await mcp.request({ method: 'tools/list' }, ListToolsResultSchema);
    assert.ok(list.tools.find(tool => tool.name === 'search_books').inputSchema.properties.cursor);
    const call = async (name, args) => {
      const result = await mcp.request({ method: 'tools/call', params: { name, arguments: args } }, CallToolResultSchema);
      assert.ok(!result.isError, JSON.stringify(result));
      return JSON.parse(result.content[0].text);
    };
    const first = (await call('get_book_directory', { book_id: '1' })).directory;
    assert.equal(first.returned, 50);
    assert.equal(first.next_offset, 50);
    const last = (await call('get_simple_directory', { book_id: '1', offset: 50, limit: 20 })).simple_directory;
    assert.equal(last.returned, 10);
    assert.equal(last.chapters[0].item_id, '51');
    assert.equal(last.next_offset, null);
    assert.equal((await call('search_books', { key: '重生', tab_type: 11, cursor })).results.cursor, cursor);
    assert.equal((await call('get_account_status', { account: 'alice' })).account, 'alice');
    assert.equal((await call('get_my_bookshelf', { account: 'alice', offset: 2, limit: 5 })).offset, 2);
    assert.equal((await call('get_my_highlights', { account: 'alice', book_id: '1', cursor: 'opaque' })).cursor, 'opaque');
    const qr = await mcp.request({ method: 'tools/call', params: { name: 'start_account_login', arguments: { account: 'alice' } } }, CallToolResultSchema);
    assert.equal(qr.content[1].type, 'image');
    assert.ok(!qr.content[0].text.includes('qrcode'));
  } finally {
    await mcp.close();
    await new Promise(resolve => server.close(resolve));
  }
});
