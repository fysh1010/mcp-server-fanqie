import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { resolve } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { installSkill } from '../scripts/install-skill.mjs';
import { startLocalServer } from './index.mjs';

const { server } = await startLocalServer({ port: 0, quiet: true });
const base = `http://127.0.0.1:${server.address().port}`;
const book = '7143038691944959011';
const headers = process.env.FANQIE_LOCAL_TOKEN ? { Authorization: `Bearer ${process.env.FANQIE_LOCAL_TOKEN}` } : {};
const report = [];
async function check(path, method = 'GET', allowed = [200]) {
  const response = await fetch(base + path, { method, headers }); const data = await response.json();
  report.push({ path, http: response.status, code: data.code, ...(data.code !== 200 ? { message: data.message } : {}) });
  if (response.status !== data.code || !allowed.includes(data.code)) throw new Error(`接口失败 ${path}: ${data.message}`);
  return data;
}
try {
  const detail = await check(`/api/detail?book_id=${book}`);
  if (detail.data?.book_name !== '十日终焉') throw new Error('详情不符合预期');
  const directory = await check(`/api/book?book_id=${book}`);
  const chapters = directory.data?.chapters;
  if (!chapters?.length || !/^\d+$/.test(chapters[0].item_id)) throw new Error('目录格式不符合预期');
  const pagedDirectory = await check(`/api/book?book_id=${book}&offset=10&limit=5`);
  if (pagedDirectory.data.returned !== 5 || pagedDirectory.data.next_offset !== 15 || pagedDirectory.data.chapters[0].item_id !== chapters[10].item_id)
    throw new Error('目录分页失败');
  report.at(-1).returned = pagedDirectory.data.returned;
  for (const item of [chapters[0], chapters[1]]) {
    const chapter = await check(`/api/chapter?item_id=${item.item_id}`);
    if (chapter.code !== 200 || !chapter.data.content || /[\uE000-\uF8FF]/.test(chapter.data.content)) throw new Error('正文字体解析失败');
    report.at(-1).characters = chapter.data.content.length;
  }
  const locked = await check(`/api/chapter?item_id=${chapters.at(-1).item_id}`, 'GET', [200, 403]);
  if (![200, 403].includes(locked.code)) throw new Error('末章既不可读也没有明确权限状态');
  await check(`/api/directory?book_id=${book}`);
  await check(`/api/raw_full?item_id=${chapters[0].item_id}`);
  await check(`/api/content?tab=novel&item_id=${chapters[0].item_id}`);
  await check(`/api/content?tab=batch&book_id=${book}&item_ids=${chapters[0].item_id},${chapters[1].item_id}`);
  await check(`/api/index/import?book_id=${book}`, 'POST');
  const search = await check('/api/search?key=' + encodeURIComponent('十日终焉'));
  if (!search.data?.results?.some(b => b.book_id === book)) throw new Error('已导入书籍搜索失败');
  report.at(-1).source = search.data.source;
  const globalSearch = await check('/api/search?key=' + encodeURIComponent('三体') + '&offset=10');
  if (globalSearch.data?.source !== 'official_search' || !globalSearch.data.results.length) throw new Error('官方搜索分页未打通');
  report.at(-1).source = globalSearch.data.source;
  report.at(-1).results = globalSearch.data.results.length;
  for (const [key, type] of [['三体', 2], ['绝世武神', 8], ['重生', 11]]) {
    const category = await check('/api/search?' + new URLSearchParams({ key, tab_type: String(type) }));
    if (category.data?.source !== 'official_app_search' || !category.data.results.length) throw new Error('分类搜索未打通');
    report.at(-1).results = category.data.results.length;
    report.at(-1).first_title = category.data.results[0].book_name;
    if (category.data.has_more && category.data.cursor) {
      const next = await check('/api/search?' + new URLSearchParams({ key, tab_type: String(type), cursor: category.data.cursor }));
      const newResults = next.data.results.filter(book => !category.data.results.some(old => old.book_id === book.book_id)).length;
      report.at(-1).results = next.data.results.length;
      report.at(-1).new_results = newResults;
      if (!newResults) throw new Error(`分类 ${type} 游标翻页没有新结果`);
    }
  }
  const reviews = await check(`/api/comment?book_id=${book}&count=3`);
  if (!reviews.data?.comments?.some(c => c.text?.length)) throw new Error('评论没有正文');
  report.at(-1).returned = reviews.data.returned;
  report.at(-1).body_lengths = reviews.data.comments.map(c => c.text.length);
  const nextReviews = await check('/api/comment?' + new URLSearchParams({ book_id: book, count: '3', offset: '3', cursor: reviews.data.cursor }));
  if (!nextReviews.data?.comments?.some(c => !reviews.data.comments.some(old => old.comment_id === c.comment_id))) throw new Error('评论翻页未取得新评论');
  report.at(-1).returned = nextReviews.data.returned;
  report.at(-1).new_comments = true;
  await check('/api/device/pool'); await check('/api/device/status');
  for (const path of ['/api/device/register', '/api/ios/content', '/api/ios/register', '/api/manga/progress/1']) {
    if ((await check(path, 'GET', [501])).code !== 501) throw new Error('未支持能力没有明确返回501');
  }
  const mcp = new Client({ name: 'local-smoke', version: '1.0' }, { capabilities: {} });
  try {
    await mcp.connect(new StdioClientTransport({ command: process.execPath, args: [resolve('server/mcp-local.mjs')], stderr: 'pipe' }));
    const result = await mcp.request({ method: 'tools/call', params: { name: 'get_book_detail', arguments: { book_id: book } } }, CallToolResultSchema);
    if (result.isError || !JSON.stringify(result.content).includes(book)) throw new Error('MCP端到端失败');
    report.push({ mcp: 'auto-start-local-api', passed: true });
    const pageResult = await mcp.request({ method: 'tools/call', params: { name: 'get_book_directory', arguments: { book_id: book, offset: 10, limit: 5 } } }, CallToolResultSchema);
    const page = JSON.parse(pageResult.content[0].text).directory;
    if (pageResult.isError || page.returned !== 5 || page.chapters[0].item_id !== chapters[10].item_id) throw new Error('MCP目录分页失败');
    report.push({ mcp: 'get_book_directory', returned: page.returned, next_offset: page.next_offset, passed: true });
    const reviewResult = await mcp.request({ method: 'tools/call', params: { name: 'get_comments', arguments: { book_id: book, count: 3 } } }, CallToolResultSchema);
    const parsedReviews = JSON.parse(reviewResult.content[0].text).comments;
    if (reviewResult.isError || !parsedReviews.comments.some(c => c.text?.length)) throw new Error('MCP评论正文失败');
    report.push({ mcp: 'get_comments', returned: parsedReviews.returned, body_lengths: parsedReviews.comments.map(c => c.text.length), passed: true });
    for (const tab_type of [8, 11]) {
      const categoryResult = await mcp.request({ method: 'tools/call', params: { name: 'search_books', arguments: { key: tab_type === 8 ? '绝世武神' : '重生', tab_type } } }, CallToolResultSchema);
      const category = JSON.parse(categoryResult.content[0].text).results;
      if (categoryResult.isError || !category.results?.length) throw new Error('MCP分类搜索失败');
      report.push({ mcp: 'search_books', tab_type, results: category.results.length, passed: true });
    }
  } finally { await mcp.close(); }
  const parent = await mkdtemp(join(tmpdir(), 'fanqie-live-skill-'));
  const installed = await installSkill(parent);
  const { stdout } = await promisify(execFile)(process.execPath, [join(installed, 'scripts/fanqie.mjs'), 'comments', book, '--count', '2'], { cwd: parent, timeout: 45000 });
  const skillReviews = JSON.parse(stdout);
  if (skillReviews.code !== 200 || !skillReviews.data.comments.some(c => c.text?.length)) throw new Error('独立Skill书评正文失败');
  report.push({ skill: 'standalone-installed-comments', returned: skillReviews.data.returned, body_lengths: skillReviews.data.comments.map(c => c.text.length), passed: true });
  console.log(JSON.stringify({ checked_at: new Date().toISOString(), book, chapters: chapters.length, report }, null, 2));
} finally { await new Promise(resolve => server.close(resolve)); }
