// Native Node.js port of the MIT-licensed protocol algorithms in
// https://github.com/tr4cex/TikTok-Encryption (argus.py, ladon.py, lib/Simon.py).
// Copyright (c) 2024 TikTok Encryption Project. See licenses/TikTok-Encryption-MIT.txt.
import { createHash, createCipheriv, randomBytes, randomInt } from 'node:crypto';

const mask = (1n << 64n) - 1n;
const left = (x, bits) => ((x << BigInt(bits)) | (x >> BigInt(64 - bits))) & mask;
const right = (x, bits) => left(x, 64 - bits);
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest();

// SM3（GB/T 32905）兜底：Electron 等运行时的 OpenSSL 构建可能不含 sm3，
// createHash('sm3') 会抛错。优先原生实现，缺失时用纯 JS 结果一致的实现。
const T = Array.from({ length: 64 }, (_, j) => (j < 16 ? 0x79cc4519 : 0x7a879d8a) >>> 0);
const rol32 = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
function sm3Js(input) {
  const P0 = (x) => (x ^ rol32(x, 9) ^ rol32(x, 17)) >>> 0;
  const P1 = (x) => (x ^ rol32(x, 15) ^ rol32(x, 23)) >>> 0;
  const bytes = Buffer.from(input);
  const bitLen = bytes.length * 8;
  const withPad = Buffer.concat([bytes, Buffer.from([0x80])]);
  const zeros = (56 - (withPad.length % 64) + 64) % 64;
  const msg = Buffer.concat([withPad, Buffer.alloc(zeros), Buffer.alloc(8)]);
  msg.writeBigUInt64BE(BigInt(bitLen), msg.length - 8);
  let v = [0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600, 0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e].map((x) => x >>> 0);
  const w = new Array(68).fill(0);
  const w1 = new Array(64).fill(0);
  for (let offset = 0; offset < msg.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = msg.readUInt32BE(offset + i * 4) >>> 0;
    for (let i = 16; i < 68; i++) w[i] = (P1(w[i - 16] ^ w[i - 9] ^ rol32(w[i - 3], 15)) ^ rol32(w[i - 13], 7) ^ w[i - 6]) >>> 0;
    for (let i = 0; i < 64; i++) w1[i] = (w[i] ^ w[i + 4]) >>> 0;
    let [a, b, c, d, e, f, g, hh] = v;
    for (let j = 0; j < 64; j++) {
      const ss1 = rol32((rol32(a, 12) + e + rol32(T[j], j)) >>> 0, 7);
      const ss2 = (ss1 ^ rol32(a, 12)) >>> 0;
      const ff = j < 16 ? (a ^ b ^ c) >>> 0 : ((a & b) | (a & c) | (b & c)) >>> 0;
      const gg = j < 16 ? (e ^ f ^ g) >>> 0 : ((e & f) | (~e & g)) >>> 0;
      const tt1 = (ff + d + ss2 + w1[j]) >>> 0;
      const tt2 = (gg + hh + ss1 + w[j]) >>> 0;
      d = c; c = rol32(b, 9); b = a; a = tt1;
      hh = g; g = rol32(f, 19); f = e; e = P0(tt2);
    }
    v = [a, b, c, d, e, f, g, hh].map((x, i) => (x ^ v[i]) >>> 0);
  }
  const out = Buffer.alloc(32);
  v.forEach((x, i) => out.writeUInt32BE(x, i * 4));
  return out;
}
let sm3Native = null;
function sm3Digest(bytes) {
  if (sm3Native === null) {
    try { createHash('sm3').update(Buffer.alloc(0)).digest(); sm3Native = true; }
    catch { sm3Native = false; }
  }
  return sm3Native ? digest('sm3', bytes) : sm3Js(bytes);
}
// 测试钩子：直接校验纯 JS SM3 与国标向量/原生实现一致。
export { sm3Js as _sm3Js };
const padded = bytes => { const n = 16 - bytes.length % 16; return Buffer.concat([bytes, Buffer.alloc(n, n)]); };
const words = bytes => Array.from({ length: bytes.length / 8 }, (_, i) => bytes.readBigUInt64LE(i * 8));
function packWords(values) { const bytes = Buffer.alloc(values.length * 8); values.forEach((x, i) => bytes.writeBigUInt64LE(x & mask, i * 8)); return bytes; }
function varint(value) {
  let n = Number(value) >>> 0; const out = [];
  do { const byte = n & 127; n >>>= 7; out.push(byte | (n ? 128 : 0)); } while (n);
  return Buffer.from(out);
}
function protobuf(fields) {
  return Buffer.concat(Object.entries(fields).map(([tag, value]) => {
    if (typeof value === 'number') return Buffer.concat([varint(Number(tag) * 8), varint(value)]);
    const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.isBuffer(value) ? value : protobuf(value);
    return Buffer.concat([varint(Number(tag) * 8 + 2), varint(bytes.length), bytes]);
  }));
}
function simon(bytes, key) {
  const roundKeys = [...words(key)];
  while (roundKeys.length < 72) {
    const i = roundKeys.length;
    const t = right(roundKeys[i - 1], 3) ^ roundKeys[i - 3];
    roundKeys.push((~roundKeys[i - 4] ^ t ^ right(t, 1) ^ (0x3dc94c3a046d678bn >> BigInt((i - 4) % 62) & 1n) ^ 3n) & mask);
  }
  const out = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    let [a, b] = words(bytes.subarray(offset, offset + 16));
    for (const k of roundKeys) [a, b] = [b, (a ^ (left(b, 1) & left(b, 8)) ^ left(b, 2) ^ k) & mask];
    out.push(packWords([a, b]));
  }
  return Buffer.concat(out);
}
function ladon(seconds, nonce) {
  const [first, ...tail] = words(Buffer.from(digest('md5', Buffer.concat([nonce, Buffer.from('1967')])).toString('hex')));
  const rounds = [first];
  for (let i = 0; i < 33; i++) {
    const next = ((right(tail[i], 8) + rounds[i]) & mask) ^ BigInt(i);
    tail.push(next); rounds.push(next ^ left(rounds[i], 3));
  }
  const input = padded(Buffer.from(`${seconds}-1611921764-1967`)); const blocks = [];
  for (let i = 0; i < input.length; i += 16) {
    let [a, b] = words(input.subarray(i, i + 16));
    for (const k of rounds) { b = ((right(b, 8) + a) & mask) ^ k; a = left(a, 3) ^ b; }
    blocks.push(packWords([a, b]));
  }
  return Buffer.concat([nonce, ...blocks]).toString('base64');
}
function argus(query, body, seconds, randomValue) {
  const params = new URLSearchParams(query);
  const pb = protobuf({
    1: 0x20200929 * 2, 2: 2, 3: randomValue, 4: '1967', 5: params.get('device_id') || '',
    6: '1611921764', 7: params.get('version_name') || '', 8: 'v04.04.05-ov-android', 9: 134744640,
    10: Buffer.alloc(8), 11: 0, 12: seconds * 2,
    13: sm3Digest(body.length ? digest('md5', body) : Buffer.alloc(16)).subarray(0, 6),
    14: sm3Digest(query ? Buffer.from(query) : Buffer.alloc(16)).subarray(0, 6),
    15: { 1: 1, 2: 1, 3: 1, 7: 3348294860 }, 16: '', 20: 'none', 21: 738,
    23: { 1: 'NX551J', 2: 8196, 4: 2162219008 }, 25: 2,
  });
  const signKey = Buffer.from('ac1adaae95a7af94a5114ab3b3a97dd80050aa0a39314c40528caec95256c28c', 'hex');
  const key = sm3Digest(Buffer.concat([signKey, Buffer.from('f281616f', 'hex'), signKey]));
  const scrambled = Buffer.concat([Buffer.from('f2f7fcfff2f7fcff', 'hex'), simon(padded(pb), key)]);
  for (let i = 8; i < scrambled.length; i++) scrambled[i] ^= scrambled[i % 8];
  scrambled.reverse();
  const input = Buffer.concat([Buffer.from('a66ead9f7701d00c18', 'hex'), scrambled, Buffer.from('ao')]);
  const cipher = createCipheriv('aes-128-cbc', digest('md5', signKey.subarray(0, 16)), digest('md5', signKey.subarray(16)));
  return Buffer.concat([Buffer.from('f281', 'hex'), cipher.update(input), cipher.final()]).toString('base64');
}
export function signRequest(url, body = '', { now = Date.now(), nonce = randomBytes(4), randomValue = randomInt(0x7fffffff) } = {}) {
  const bytes = Buffer.from(body); const seconds = Math.floor(now / 1000);
  return { 'x-argus': argus(new URL(url).search.slice(1), bytes, seconds, randomValue),
    'x-ladon': ladon(seconds, nonce), 'x-khronos': String(seconds), 'x-ss-req-ticket': String(now),
    ...(bytes.length ? { 'X-SS-STUB': digest('md5', bytes).toString('hex') } : {}) };
}
