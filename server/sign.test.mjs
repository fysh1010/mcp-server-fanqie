// 签名与 SM3 兜底实现的回归测试（离线、确定性）。
// 运行随 npm test：node --test server/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { signRequest, _sm3Js } from './sign.mjs';

test('纯 JS SM3 与国标测试向量一致', () => {
  // GB/T 32905 及主流实现（sm-crypto、OpenSSL）的公认向量
  assert.equal(_sm3Js(Buffer.from('abc')).toString('hex'), '66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0');
  assert.equal(_sm3Js(Buffer.from('abcd'.repeat(16))).toString('hex'), 'debe9ff92275b8a138604889c18e5a4d6fdb70e5387e5765293dcba39c0c5732');
});

test('纯 JS SM3 与原生实现（可用时）对多种长度逐字节一致', () => {
  let native;
  try { native = createHash('sm3'); } catch { return; } // 原生缺失时跳过比对，向量测试仍然生效
  const cases = ['', 'a', 'abc', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(63), 'w'.repeat(64), 'v'.repeat(65), 'u'.repeat(200)];
  for (const text of cases) {
    const bytes = Buffer.from(text);
    assert.equal(_sm3Js(bytes).toString('hex'), createHash('sm3').update(bytes).digest().toString('hex'), `length=${text.length}`);
  }
  assert.ok(native);
});

test('signRequest 输出结构稳定且确定性参数结果可复现', () => {
  const opts = { now: 1700000000000, nonce: Buffer.from([1, 2, 3, 4]), randomValue: 42 };
  const first = signRequest('https://reading.snssdk.com/reading/bookapi/search/tab/v?aid=1967&device_id=1', '{"a":1}', opts);
  const second = signRequest('https://reading.snssdk.com/reading/bookapi/search/tab/v?aid=1967&device_id=1', '{"a":1}', opts);
  assert.deepEqual(first, second);
  for (const key of ['x-argus', 'x-ladon', 'x-khronos', 'x-ss-req-ticket', 'X-SS-STUB']) {
    assert.equal(typeof first[key], 'string');
    assert.ok(first[key].length > 0, key);
  }
});
