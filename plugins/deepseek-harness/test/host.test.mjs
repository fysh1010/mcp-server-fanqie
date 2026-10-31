/**
 * 插件 Host 半离线测试：通道注册、输入校验与错误信封。
 * 不访问网络、不读写账号数据（只触碰 ping/capabilities 与非法输入路径）。
 * 运行：node --test plugins/deepseek-harness/test/host.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, inject } from '../index.js';

/** 构造最小 Host 上下文，捕获 connection.fetch.register 注册的路由与模型工具。 */
function fakeHost() {
  const routes = new Map();
  const tools = new Map();
  const labels = [];
  const ctx = {
    effect(fn, label) {
      labels.push(label);
      const dispose = fn();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    connection: {
      fetch: {
        register(route) {
          routes.set(route.path, route);
          return async () => {};
        },
      },
    },
    tools: {
      register(definition) {
        tools.set(definition.name, definition);
        return () => tools.delete(definition.name);
      },
    },
  };
  return { ctx, routes, tools, labels };
}

async function post(route, body) {
  const request = new Request(`http://local${route.path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return route.fetch(request);
}

test('Host 半声明 connection+tools 硬依赖并注册四个 /api/fanqie 通道', () => {
  assert.deepEqual(inject, ['connection', 'tools']);
  const { ctx, routes, labels } = fakeHost();
  apply(ctx);
  assert.deepEqual([...routes.keys()].sort(), [
    '/api/fanqie/account',
    '/api/fanqie/capabilities',
    '/api/fanqie/dispatch',
    '/api/fanqie/ping',
  ]);
  for (const route of routes.values()) {
    assert.deepEqual(route.methods, ['POST']);
    assert.equal(route.requestBody, 'buffered');
    assert.equal(typeof route.fetch, 'function');
  }
  assert.equal(labels.length, 11);
});

test('注册七个 AI 问答工具，输出渲染不抛错且不泄露实现细节', () => {
  const { ctx, tools } = fakeHost();
  apply(ctx);
  assert.deepEqual([...tools.keys()].sort(), [
    'fanqie_book_comments',
    'fanqie_book_detail',
    'fanqie_book_directory',
    'fanqie_my_bookshelf',
    'fanqie_my_highlights',
    'fanqie_read_chapter',
    'fanqie_search_books',
  ]);
  for (const definition of tools.values()) {
    assert.equal(typeof definition.description, 'string');
    assert.equal(typeof definition.execute, 'function');
    assert.equal(typeof definition.output.render, 'function');
    assert.equal(typeof definition.output.schema, 'object');
  }
  // render 是纯展示层：给合成数据不应抛错，并输出可读文本
  const rendered = tools.get('fanqie_search_books').output.render({}, {
    results: [{ book_id: '7143038691944959011', book_name: '测试书', author: '测试作者' }],
    has_more: true, next_offset: 10, source: 'official_search',
  });
  assert.equal(rendered[0].type, 'text');
  assert.match(rendered[0].text, /7143038691944959011/);
  assert.match(rendered[0].text, /offset=10/);
});

test('ping 与 capabilities 返回 ok 信封且不缓存', async () => {
  const { ctx, routes } = fakeHost();
  apply(ctx);
  const ping = await post(routes.get('/api/fanqie/ping'), {});
  assert.equal(ping.status, 200);
  assert.equal(ping.headers.get('cache-control'), 'no-store');
  const pingBody = await ping.json();
  assert.equal(pingBody.ok, true);
  assert.equal(pingBody.value.name, 'fanqie-reader');

  const caps = await post(routes.get('/api/fanqie/capabilities'), {});
  const capsBody = await caps.json();
  assert.equal(capsBody.ok, true);
  assert.equal(typeof capsBody.value.endpoints, 'object');
});

test('非法请求体返回结构化错误信封，不触碰业务核心', async () => {
  const { ctx, routes } = fakeHost();
  apply(ctx);
  const dispatch = routes.get('/api/fanqie/dispatch');

  const notJson = await post(dispatch, 'not-json');
  const notJsonBody = await notJson.json();
  assert.equal(notJsonBody.ok, false);
  assert.equal(notJsonBody.error.kind, 'INVALID_ARGUMENT');

  const missingPath = await post(dispatch, {});
  const missingBody = await missingPath.json();
  assert.equal(missingBody.ok, false);
  assert.equal(missingBody.error.kind, 'INVALID_ARGUMENT');
  assert.match(missingBody.error.message, /pathname/);

  const badParams = await post(dispatch, { pathname: '/api/search', params: ['x'] });
  const badParamsBody = await badParams.json();
  assert.equal(badParamsBody.ok, false);
  assert.match(badParamsBody.error.message, /params/);

  const nestedParams = await post(dispatch, { pathname: '/api/search', params: { key: { a: 1 } } });
  const nestedBody = await nestedParams.json();
  assert.equal(nestedBody.ok, false);
  assert.match(nestedBody.error.message, /只接受字符串或数字/);

  const account = routes.get('/api/fanqie/account');
  const missingAction = await post(account, {});
  const actionBody = await missingAction.json();
  assert.equal(actionBody.ok, false);
  assert.match(actionBody.error.message, /action/);
});
