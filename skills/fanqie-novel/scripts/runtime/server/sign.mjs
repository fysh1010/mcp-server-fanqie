// Native Node.js port of the MIT-licensed protocol algorithms in
// https://github.com/tr4cex/TikTok-Encryption (argus.py, ladon.py, lib/Simon.py).
// Copyright (c) 2024 TikTok Encryption Project. See licenses/TikTok-Encryption-MIT.txt.
import { createHash, createCipheriv, randomBytes, randomInt } from 'node:crypto';

const mask = (1n << 64n) - 1n;
const left = (x, bits) => ((x << BigInt(bits)) | (x >> BigInt(64 - bits))) & mask;
const right = (x, bits) => left(x, 64 - bits);
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest();
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
    13: digest('sm3', body.length ? digest('md5', body) : Buffer.alloc(16)).subarray(0, 6),
    14: digest('sm3', query ? Buffer.from(query) : Buffer.alloc(16)).subarray(0, 6),
    15: { 1: 1, 2: 1, 3: 1, 7: 3348294860 }, 16: '', 20: 'none', 21: 738,
    23: { 1: 'NX551J', 2: 8196, 4: 2162219008 }, 25: 2,
  });
  const signKey = Buffer.from('ac1adaae95a7af94a5114ab3b3a97dd80050aa0a39314c40528caec95256c28c', 'hex');
  const key = digest('sm3', Buffer.concat([signKey, Buffer.from('f281616f', 'hex'), signKey]));
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
