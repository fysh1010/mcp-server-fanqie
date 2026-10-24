#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { ApiError, dispatch, integer } from './core.mjs';
import { createLocalClient } from './client.mjs';

const help = `番茄小说 CLI（Node.js 22+，无需启动 HTTP/MCP 服务）
用法：fanqie <命令> [参数]
  search <关键词> [--type novel|audiobook|manga|drama] [--offset 0]
  comments <book_id> [--count 20] [--cursor 游标] [--offset 0]  书评正文
  detail <book_id>                   书籍详情
  directory <book_id> [--offset 0] [--limit 50]  分页显示目录
  chapter <item_id>                  网站可见正文
  raw <item_id>                      原始章节数据与正文
  batch <book_id> <item_id,...>       最多20章
  index-import <book_id>             录入本地元数据索引
  index-refresh                     刷新首页元数据索引
  capabilities                      当前服务能力与限制
  help                              显示说明
所有查询输出单个 JSON 对象。失败时 code 非200且进程退出码为1。`;

export async function executeCLI(args, { createClient = createLocalClient } = {}) {
  const [command = 'help', ...rest] = args;
  if (['help', '--help', '-h'].includes(command)) return { code: 200, message: 'success', data: { help } };
  const positions = []; const options = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      if (!['--offset', '--limit', '--type', '--count', '--cursor'].includes(arg) || options[arg] !== undefined || rest[i + 1] === undefined || rest[i + 1].startsWith('--'))
        throw new ApiError(400, `不支持或缺少值的参数：${arg}`, 'INVALID_ARGUMENT');
      options[arg] = rest[++i];
    } else positions.push(arg);
  }
  const routes = { search: ['/api/search', 'key'], detail: ['/api/detail', 'book_id'],
    directory: ['/api/book', 'book_id'], chapter: ['/api/chapter', 'item_id'], raw: ['/api/raw_full', 'item_id'],
    batch: ['/api/content', 'book_id'], comments: ['/api/comment', 'book_id'], capabilities: ['/health'] };
  if (!routes[command] && !['index-import', 'index-refresh'].includes(command))
    throw new ApiError(400, `未知命令：${command}，使用 help 查看帮助`, 'INVALID_ARGUMENT');
  const required = command === 'batch' ? 2 : ['capabilities', 'index-refresh'].includes(command) ? 0 : 1;
  if (positions.length !== required) throw new ApiError(400, `${command} 需要 ${required} 个位置参数`, 'INVALID_ARGUMENT');
  if (options['--offset'] !== undefined && !['search', 'directory', 'comments'].includes(command) || options['--limit'] !== undefined && command !== 'directory'
    || options['--type'] !== undefined && command !== 'search' || (options['--count'] !== undefined || options['--cursor'] !== undefined) && command !== 'comments')
    throw new ApiError(400, '此命令不接受该分页参数', 'INVALID_ARGUMENT');
  const { client, index } = await createClient();
  let data;
  if (command === 'index-import') data = await index.add(await client.detail(positions[0]));
  else if (command === 'index-refresh') data = await index.refresh(client);
  else {
    const [route, field] = routes[command]; const params = new URLSearchParams();
    if (field) params.set(field, positions[0]);
    if (command === 'search') {
      params.set('offset', String(integer(options['--offset'], 0, 0, 10000)));
      const type = { novel: 3, audiobook: 2, manga: 8, drama: 11 }[options['--type'] || 'novel'];
      if (!type) throw new ApiError(400, '--type 支持 novel、audiobook、manga、drama', 'INVALID_ARGUMENT');
      params.set('tab_type', String(type));
    }
    if (command === 'comments') {
      params.set('count', String(integer(options['--count'], 20, 1, 100)));
      params.set('offset', String(integer(options['--offset'], 0, 0, 100000)));
      if (options['--cursor']) params.set('cursor', options['--cursor']);
    }
    if (command === 'batch') { params.set('tab', 'batch'); params.set('item_ids', positions[1]); }
    data = await dispatch(client, route, params);
    if (command === 'directory') {
      const offset = integer(options['--offset'], 0, 0, 100000);
      const limit = integer(options['--limit'], 50, 1, 200);
      const chapters = data.chapters.slice(offset, offset + limit);
      data = { ...data, chapters, offset, limit, has_more: offset + chapters.length < data.total };
    }
  }
  return { code: 200, message: 'success', data };
}

export async function main(args = process.argv.slice(2)) {
  try { console.log(JSON.stringify(await executeCLI(args))); }
  catch (error) {
    console.log(JSON.stringify({ code: error instanceof ApiError ? error.code : 500,
      message: error instanceof ApiError ? error.message : '本地查询失败', error: error.kind || 'INTERNAL_ERROR', data: null }));
    if (!(error instanceof ApiError)) console.error(error.message);
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
