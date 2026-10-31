/**
 * 番茄阅读 DeepSeek Harness 插件 —— Host 半。
 *
 * 业务能力全部复用仓库核心（vendor/ 为源码同步副本，见 scripts/vendor.mjs）：
 *   - vendor/server/client.mjs    createLocalClient()
 *   - vendor/server/core.mjs      dispatch() / ApiError
 *   - vendor/server/accounts.mjs  dispatchAccount()
 *
 * 通道：Harness 连接层的共享 /api FetchHandler（ctx.connection.fetch.register），
 * 页面侧用文档相对地址 `api/fanqie/*` 访问。它随插件生命周期注册与释放，
 * 不新增监听端口、不放宽项目原有 server/http.mjs 的 Origin/Host 保护。
 */
import { createLocalClient } from './vendor/server/client.mjs';
import { dispatch, ApiError, endpointCapabilities } from './vendor/server/core.mjs';
import { dispatchAccount } from './vendor/server/accounts.mjs';

/** 连接服务与工具注册表是硬依赖：没有它们插件保持未激活，而不是启动后报错。 */
export const inject = ['connection', 'tools'];

const PLUGIN_VERSION = '0.4.0';

/** 参数名白名单之外的键一律忽略；值只接受标量并统一转成字符串。 */
const MAX_PARAMS = 32;

function scalarParams(raw, label) {
  if (raw === undefined || raw === null) return new Map();
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new ApiError(400, `${label}必须是对象`, 'INVALID_ARGUMENT');
  const entries = Object.entries(raw);
  if (entries.length > MAX_PARAMS) throw new ApiError(400, `${label}参数过多`, 'INVALID_ARGUMENT');
  const map = new Map();
  for (const [key, value] of entries) {
    if (typeof value === 'string') map.set(key, value);
    else if (typeof value === 'number' && Number.isFinite(value)) map.set(key, String(value));
    else if (typeof value === 'boolean') map.set(key, value ? '1' : '0');
    else if (value === null || value === undefined) continue;
    else throw new ApiError(400, `${label}.${key}只接受字符串或数字`, 'INVALID_ARGUMENT');
  }
  return map;
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function ok(value) {
  return jsonResponse({ ok: true, value });
}

function fail(error) {
  if (error instanceof ApiError) {
    const body = { code: error.code, kind: error.kind, message: error.message };
    if (typeof error.retry_after === 'number') body.retry_after = error.retry_after;
    return jsonResponse({ ok: false, error: body });
  }
  return jsonResponse({ ok: false, error: { code: 500, kind: 'PLUGIN_ERROR', message: error instanceof Error ? error.message : String(error) } });
}

async function readJsonBody(request) {
  let raw;
  try {
    raw = await request.text();
  } catch {
    throw new ApiError(400, '请求体读取失败', 'INVALID_ARGUMENT');
  }
  if (raw.length > 262_144) throw new ApiError(413, '请求体过大', 'INVALID_ARGUMENT');
  if (raw === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, '请求体不是合法 JSON', 'INVALID_ARGUMENT');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new ApiError(400, '请求体必须是 JSON 对象', 'INVALID_ARGUMENT');
  return parsed;
}

/** 惰性建立本地客户端：账号与索引文件只在真正发起业务调用时读取。 */
let localClientPromise = null;
function localClient() {
  if (localClientPromise === null) localClientPromise = createLocalClient();
  return localClientPromise;
}

/** 模型工具经由与界面完全相同的 dispatch/dispatchAccount 调用核心。
 *  核心的分发入口要求 Map 形态的参数（与 URLSearchParams 一致），统一在这里转换并校验。 */
async function callDispatch(pathname, params) {
  const { client } = await localClient();
  return dispatch(client, pathname, scalarParams(params, 'params'));
}

async function callAccount(action, params) {
  const { accounts } = await localClient();
  return dispatchAccount(accounts, action, scalarParams(params, 'params'));
}

// ---------------------------------------------------------------- 模型工具
// 设计原则：描述行为、参数规则放在参数上、输出有界（截断明确标注、附续读方式）。

const textBlock = (text) => [{ type: 'text', text }];
const brief = (value, max) => {
  const text = asText(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
};
function asText(value) { return value === undefined || value === null ? '' : String(value); }

/** 统一输出 schema：对象 + 明细字段，允许上游新增字段透传。 */
const looseObject = (properties) => ({ type: 'object', additionalProperties: true, properties });

const searchParams = {
  keyword: { type: 'string', required: true, description: '书名或作者关键词，1–100 字。' },
  tab_type: { type: 'integer', description: '分类：3 小说（默认，offset 翻页）｜2 听书｜8 漫画｜11 短剧（后三类用 cursor 翻页，只返回元数据）。' },
  offset: { type: 'integer', description: '小说分类的翻页偏移；首次查询或从头翻页时省略。' },
  cursor: { type: 'string', description: '听书/漫画/短剧分类的不透明翻页游标，原样回传上一次结果的 cursor 字段；与 offset 互斥。' },
};

function toolSearch() {
  return {
    name: 'fanqie_search_books',
    description: '按书名或作者搜索番茄小说（小说/听书/漫画/短剧四类）。返回书目卡片（ID、书名、作者、简介摘要、封面），按分类各自的分页字段翻页。听书/漫画/短剧仅有元数据，不能播放或阅读。',
    parameters: searchParams,
    output: {
      schema: looseObject({
        results: { type: 'array', items: looseObject({ book_id: { type: 'string' }, book_name: { type: 'string' } }) },
        has_more: { type: 'boolean' },
        source: { type: 'string' },
      }),
      render: (_args, value) => {
        const rows = (value.results || []).slice(0, 10);
        const lines = rows.map((row, index) => {
          const author = brief(row.author || row.author_name || '', 20);
          const extra = value.local_index === true || value.source === 'local_index' ? '（本地索引，非全站）' : '';
          return `${index + 1}. ${brief(row.book_name || row.title, 30)}${author ? ` · ${author}` : ''} · book_id=${asText(row.book_id)}${extra}`;
        });
        const more = value.has_more
          ? `还有更多，翻页字段：${value.cursor ? `cursor=${brief(value.cursor, 60)}` : `offset=${asText(value.next_offset)}`}。`
          : '已到末页。';
        return textBlock(`找到 ${rows.length} 条${rows.length < (value.results || []).length ? `（已截断，共 ${(value.results || []).length} 条）` : ''}：\n${lines.join('\n')}\n${more}`);
      },
    },
    isConcurrencySafe: () => true,
    execute: (args) => callDispatch('/api/search', {
      key: args.keyword,
      tab_type: args.tab_type ?? 3,
      ...(args.offset === undefined ? {} : { offset: args.offset }),
      ...(args.cursor === undefined ? {} : { cursor: args.cursor }),
    }),
  };
}

function toolDetail() {
  return {
    name: 'fanqie_book_detail',
    description: '获取一本书的详情：书名、作者、简介、字数、连载状态、章节数与最新章节。book_id 用数字字符串，来自搜索、书架或划线结果。',
    parameters: {
      book_id: { type: 'string', required: true, description: '书籍 ID，数字字符串（勿转数字）。' },
    },
    output: {
      schema: looseObject({ book_id: { type: 'string' }, book_name: { type: 'string' } }),
      render: (_args, value) => textBlock(
        `《${asText(value.book_name)}》 ${asText(value.author)}\n`
        + `字数 ${asText(value.word_count)} · ${asText(value.chapter_count)} 章 · ${asText(value.creation_status)}\n`
        + `最新：${asText(value.latest_chapter_title)}\n简介：${brief(value.abstract, 220)}`),
    },
    isConcurrencySafe: () => true,
    execute: (args) => callDispatch('/api/detail', { book_id: args.book_id }),
  };
}

function toolDirectory() {
  return {
    name: 'fanqie_book_directory',
    description: '分页获取一本书的章节目录（章节 item_id 与标题），用于定位要读的章节。',
    parameters: {
      book_id: { type: 'string', required: true, description: '书籍 ID，数字字符串。' },
      offset: { type: 'integer', description: '章节偏移，默认 0。' },
      limit: { type: 'integer', description: '每页章数，默认 30，最大 100。' },
    },
    output: {
      schema: looseObject({ total: { type: 'integer' }, chapters: { type: 'array' }, has_more: { type: 'boolean' } }),
      render: (_args, value) => {
        const rows = (value.chapters || []).slice(0, 100);
        const lines = rows.map((row, index) => `${asText(row.order ?? (value.offset ?? 0) + index + 1)}. ${brief(row.title, 40)} · item_id=${asText(row.item_id)}`);
        return textBlock(`共 ${asText(value.total)} 章，本页 ${rows.length} 章（offset=${asText(value.offset)}）：\n${lines.join('\n')}\n${value.has_more ? `还有更多，next_offset=${asText(value.next_offset)}。` : '已到末页。'}`);
      },
    },
    isConcurrencySafe: () => true,
    execute: (args) => callDispatch('/api/directory', {
      book_id: args.book_id,
      offset: args.offset ?? 0,
      limit: args.limit ?? 30,
    }),
  };
}

function toolRead() {
  return {
    name: 'fanqie_read_chapter',
    description: '阅读一章的官网可见正文片段（纯文本、段落结构）。付费/锁定/空正文/未知字体会返回明确错误而不是乱码。想读更长可加大 preview_chars。',
    parameters: {
      item_id: { type: 'string', required: true, description: '章节 ID，数字字符串，来自目录或书架。' },
      preview_chars: { type: 'integer', description: '返回正文的最大字符数，默认 2000，范围 200–20000。正文被截断时结果会标注 truncated=true。' },
    },
    output: {
      schema: looseObject({ item_id: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' }, truncated: { type: 'boolean' } }),
      render: (_args, value) => {
        const content = asText(value.content);
        return textBlock(`《${asText(value.title)}》（item_id=${asText(value.item_id)}，本章 ${asText(value.word_count)} 字，completeness=${asText(value.completeness)}）\n\n${content}${value.truncated ? `\n\n[正文已截断，共 ${asText(value.total_chars)} 字；用更大的 preview_chars 续读]` : ''}\n\n上一章 item_id=${asText(value.previous_item_id) || '无'} ｜ 下一章 item_id=${asText(value.next_item_id) || '无'}`);
      },
    },
    isConcurrencySafe: () => true,
    execute: async (args) => {
      const limit = Math.min(20000, Math.max(200, Number(args.preview_chars) || 2000));
      const chapter = await callDispatch('/api/chapter', { item_id: args.item_id });
      const content = asText(chapter.content);
      const total = content.length;
      if (total <= limit) return { ...chapter, truncated: false, total_chars: total };
      // 在边界附近收尾，避免截在半个词上。
      const cut = content.lastIndexOf('\n', limit);
      return { ...chapter, content: content.slice(0, cut > limit * 0.6 ? cut : limit), truncated: true, total_chars: total };
    },
  };
}

function toolBookshelf() {
  return {
    name: 'fanqie_my_bookshelf',
    description: '读取用户本人账号的书架（含官方已同步的阅读位置）。仅在调用时读取用户自己的账号数据；read_progress 是官方原始值（单位未标明，勿当百分比）。',
    parameters: {
      offset: { type: 'integer', description: '翻页偏移，默认 0。' },
      limit: { type: 'integer', description: '每页条数，默认 10，最大 30。' },
    },
    output: {
      schema: looseObject({ books: { type: 'array' }, total: { type: 'integer' }, has_more: { type: 'boolean' } }),
      render: (_args, value) => {
        const rows = (value.books || []).slice(0, 30);
        const lines = rows.map((row, index) => `${index + 1}. ${brief(row.book_name || row.book_id, 26)}${row.author ? ` · ${brief(row.author, 16)}` : ''}`
          + ` · book_id=${asText(row.book_id)}`
          + (row.current_chapter_title ? ` · 读到《${brief(row.current_chapter_title, 24)}》(item_id=${asText(row.item_id)})` : '')
          + (row.read_progress !== null && row.read_progress !== undefined ? ` · read_progress=${asText(row.read_progress)}` : ''));
        return textBlock(`书架共 ${asText(value.total)} 本，本页 ${rows.length} 本：\n${lines.join('\n')}\n${value.has_more ? `还有更多，next_offset=${asText(value.next_offset)}。` : '已到末页。'}\n（read_progress 为官方原值，单位未标明）`);
      },
    },
    execute: (args) => callAccount('bookshelf', { offset: args.offset ?? 0, limit: Math.min(30, args.limit ?? 10) }),
  };
}

function toolHighlights() {
  return {
    name: 'fanqie_my_highlights',
    description: '读取用户本人账号的收藏划线。省略 book_id 列出有划线的书；给 book_id 返回该书划线原文（完整句子、所属章节），用 cursor 翻页。独立笔记正文官方接口未提供。',
    parameters: {
      book_id: { type: 'string', description: '书籍 ID，数字字符串；省略则列出有划线/书签的书。' },
      cursor: { type: 'string', description: '上一次结果的翻页游标，原样回传；仅在继续翻同一本书时使用。' },
      limit: { type: 'integer', description: '每页条数，默认 20，最大 50。' },
    },
    output: {
      schema: looseObject({ has_more: { type: 'boolean' } }),
      render: (_args, value) => {
        if (value.books) {
          const rows = (value.books || []).slice(0, 50);
          const lines = rows.map((row, index) => `${index + 1}. ${brief(row.book_name || row.book_id, 26)} · book_id=${asText(row.book_id)} · 划线 ${asText(row.highlight_count)} · 书签 ${asText(row.bookmark_count)}`);
          return textBlock(`有收藏的书 ${rows.length} 本：\n${lines.join('\n')}\n${value.has_more ? '还有更多，用 offset 翻页（本工具传 book_id 后才返回划线原文）。' : '已到末页。'}`);
        }
        const rows = (value.highlights || []).slice(0, 50);
        const lines = rows.map((row, index) => `${index + 1}. 「${brief(row.text, 160)}」 —— ${brief(row.chapter_title || row.book_name, 24)}（item_id=${asText(row.item_id)}）`);
        return textBlock(`划线 ${rows.length} 条${value.upstream_returned !== undefined ? `（上游返回 ${asText(value.upstream_returned)} 条含非划线项）` : ''}：\n${lines.join('\n')}\n${value.has_more ? `还有更多，cursor=${brief(value.cursor, 80)}。` : '已到末页。'}\n（仅收藏划线，笔记正文官方未提供）`);
      },
    },
    execute: (args) => callAccount(args.book_id ? 'highlights' : 'highlight-books', {
      ...(args.book_id ? { book_id: args.book_id } : {}),
      ...(args.cursor === undefined ? {} : { cursor: args.cursor }),
      limit: Math.min(50, args.limit ?? 20),
    }),
  };
}

function toolComments() {
  return {
    name: 'fanqie_book_comments',
    description: '分页获取一本书的书评（评分、点赞、回复数）。',
    parameters: {
      book_id: { type: 'string', required: true, description: '书籍 ID，数字字符串。' },
      offset: { type: 'integer', description: '翻页偏移，默认 0。' },
      limit: { type: 'integer', description: '每页条数，默认 10，最大 30。' },
    },
    output: {
      schema: looseObject({ comments: { type: 'array' }, has_more: { type: 'boolean' } }),
      render: (_args, value) => {
        const rows = (value.comments || []).slice(0, 30);
        const lines = rows.map((row, index) => `${index + 1}. ${brief(row.user_name || '匿名', 12)}：${brief(row.text, 120)}（♥${asText(row.like_count)} 💬${asText(row.reply_count)}）`);
        return textBlock(`书评 ${rows.length} 条：\n${lines.join('\n')}\n${value.has_more ? `还有更多，offset=${asText((value.offset ?? 0) + rows.length)}。` : '已到末页。'}`);
      },
    },
    isConcurrencySafe: () => true,
    execute: (args) => callDispatch('/api/comment', {
      book_id: args.book_id,
      offset: args.offset ?? 0,
      count: Math.min(30, args.limit ?? 10),
    }),
  };
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) throw new ApiError(400, `${label}必须是非空字符串`, 'INVALID_ARGUMENT');
  return value;
}

/**
 * Host 插件入口：注册 /api/fanqie/* 通道，全部在插件卸载时随 effect 释放。
 * @param {object} ctx - Host Cordis 上下文。
 */
export function apply(ctx) {
  const register = (path, handler) => ctx.effect(() => ctx.connection.fetch.register({
    path,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: handler,
  }), `fanqie-reader: ${path}`);

  register('/api/fanqie/ping', async (request) => {
    await request.text();
    return ok({ name: 'fanqie-reader', version: PLUGIN_VERSION, time: new Date().toISOString() });
  });

  register('/api/fanqie/capabilities', async (request) => {
    await request.text();
    return ok({ version: PLUGIN_VERSION, endpoints: endpointCapabilities });
  });

  register('/api/fanqie/dispatch', async (request) => {
    try {
      const body = await readJsonBody(request);
      const pathname = requireString(body.pathname, 'pathname');
      const params = scalarParams(body.params, 'params');
      const { client } = await localClient();
      return ok(await dispatch(client, pathname, params));
    } catch (error) {
      return fail(error);
    }
  });

  register('/api/fanqie/account', async (request) => {
    try {
      const body = await readJsonBody(request);
      const action = requireString(body.action, 'action');
      const params = scalarParams(body.params, 'params');
      const { accounts } = await localClient();
      return ok(await dispatchAccount(accounts, action, params));
    } catch (error) {
      return fail(error);
    }
  });

  // AI 问答工具：注册/释放随插件生命周期，与界面走同一业务通道。
  for (const definition of [
    toolSearch(), toolDetail(), toolDirectory(), toolRead(),
    toolBookshelf(), toolHighlights(), toolComments(),
  ]) {
    ctx.effect(() => ctx.tools.register(definition), `fanqie-reader: tool ${definition.name}`);
  }
}
