import { decryptText } from '../build/fontDecrypt.js';
import { signRequest } from './sign.mjs';
import { appQuery, searchResults, commentResults } from './app.mjs';

export class ApiError extends Error {
  constructor(code, message, kind = 'API_ERROR') { super(message); this.code = code; this.kind = kind; }
}
const yes = value => value === true || value === 1 || value === '1';
export function cursorValue(value) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 4096 || /[\r\n]/.test(value))
    throw new ApiError(400, 'cursor 参数不合法', 'INVALID_ARGUMENT');
  return value;
}
function retryAfter(value) {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value) ? Number(value) : (Date.parse(value) - Date.now()) / 1000;
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : undefined;
}
async function readResponse(response) {
  const maxBytes = 8_000_000;
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel();
    throw new ApiError(502, '官网响应过大', 'UPSTREAM_FORMAT');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(502, '官网响应过大', 'UPSTREAM_FORMAT');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, size).toString('utf8');
  } finally { reader.releaseLock(); }
}
export function initialState(html) {
  const marker = 'window.__INITIAL_STATE__=';
  const start = html.indexOf(marker);
  if (start < 0) throw new ApiError(502, '官网未返回页面数据，可能需要验证或页面已改版', 'UPSTREAM_FORMAT');
  const text = html.slice(start + marker.length).trimStart();
  // Only parse JSON; never execute scripts received from the website.
  let depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
    else if (c === '"') quoted = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      if (--depth === 0) {
        try { return JSON.parse(text.slice(0, i + 1)); } catch { break; }
      }
    }
  }
  throw new ApiError(502, '官网页面数据不是有效 JSON', 'UPSTREAM_FORMAT');
}
export function id(value, name = 'ID') {
  if (!/^\d{1,24}$/.test(value || '')) throw new ApiError(400, `${name}必须是数字字符串`, 'INVALID_ARGUMENT');
  return value;
}
export function integer(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new ApiError(400, `数字参数必须在 ${min}~${max} 之间`, 'INVALID_ARGUMENT');
  return n;
}
export function plainText(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(?:p|div)>|<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, s) => { const n = s[0].toLowerCase() === 'x' ? parseInt(s.slice(1), 16) : Number(s); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; })
    .replace(/&(nbsp|lt|gt|quot|apos|amp);/g, (_, s) => ({ nbsp: ' ', lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[s])).trim();
}

export class WebsiteClient {
  constructor({ fetcher = fetch, searchFallback } = {}) {
    this.fetcher = fetcher; this.searchFallback = searchFallback;
    this.cache = new Map(); this.pending = new Map(); this.queue = Promise.resolve(); this.lastRequest = 0;
    this.cooldowns = new Map();
  }
  async request(path, json = false, origin = 'https://fanqienovel.com', options = {}) {
    if (!['https://fanqienovel.com', 'https://novel.snssdk.com', 'https://reading.snssdk.com'].includes(origin)) throw new ApiError(400, '不允许的上游站点', 'INVALID_ORIGIN');
    const key = JSON.stringify([origin, path, json, options.body, !!options.whole, !!options.signed]);
    const hit = this.cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.value;
    if (this.pending.has(key)) return this.pending.get(key);
    if (this.pending.size >= 32) throw new ApiError(503, '本地请求队列已满，请稍后再试', 'LOCAL_BUSY');
    const queuedAt = Date.now();
    const task = this.queue.then(async () => {
      if (Date.now() - queuedAt > 30000) throw new ApiError(503, '本地请求排队超时，请稍后再试', 'LOCAL_BUSY');
      const remaining = Math.ceil(((this.cooldowns.get(origin) || 0) - Date.now()) / 1000);
      if (remaining > 0) {
        const error = new ApiError(429, '官网正在限流，请按 retry_after 秒数稍后再试', 'UPSTREAM_RATE_LIMIT');
        error.retry_after = remaining; throw error;
      }
      let text;
      for (let attempt = 0; attempt < 2; attempt++) {
        await new Promise(resolve => setTimeout(resolve, Math.max(0, 500 - (Date.now() - this.lastRequest))));
        this.lastRequest = Date.now();
        const url = `${origin}${path}`;
        const body = options.body;
        const headers = { 'User-Agent': origin === 'https://fanqienovel.com' ? 'Mozilla/5.0' : 'com.dragon.read', Referer: 'https://fanqienovel.com/' };
        if (options.signed) {
          try { Object.assign(headers, signRequest(url, body || '')); }
          catch { throw new ApiError(500, '本机不支持请求签名所需的加密算法', 'SIGNING_UNAVAILABLE'); }
        }
        if (body) headers['Content-Type'] = 'application/json; charset=utf-8';
        try {
          const response = await this.fetcher(url, { signal: AbortSignal.timeout(15000), redirect: 'error', headers, ...(body ? { method: 'POST', body } : {}) });
          if (!response.ok) {
            const wait = retryAfter(response.headers.get('retry-after'));
            await response.body?.cancel();
            if (response.status === 429) {
              const error = new ApiError(429, '官网正在限流，请按 retry_after 秒数稍后再试', 'UPSTREAM_RATE_LIMIT');
              error.retry_after = wait ?? 30;
              this.cooldowns.set(origin, Date.now() + error.retry_after * 1000);
              throw error;
            }
            if (attempt === 0 && [502, 503, 504].includes(response.status) && (wait ?? 0) <= 2) {
              await new Promise(resolve => setTimeout(resolve, (wait ?? 0) * 1000));
              continue;
            }
            const status = response.status === 404 ? 404 : response.status === 403 ? 403 : 502;
            const error = new ApiError(status, `官网返回 HTTP ${response.status}`, response.status === 403 ? 'UPSTREAM_ACCESS_DENIED' : 'UPSTREAM_HTTP');
            if (wait !== undefined) error.retry_after = wait;
            throw error;
          }
          text = await readResponse(response);
          break;
        } catch (error) {
          if (error instanceof ApiError) throw error;
          if (attempt === 0) continue;
          throw new ApiError(502, '无法连接番茄官网或响应传输中断、超时', 'UPSTREAM_UNAVAILABLE');
        }
      }
      let value = text;
      if (json) {
        try { value = JSON.parse(text); } catch { throw new ApiError(502, options.signed && !text ? '官方App接口返回空响应，匿名设备可能失效；可配置 FANQIE_DEVICE_ID 与 FANQIE_INSTALL_ID' : '官网返回了验证页面或非 JSON 数据', 'UPSTREAM_VERIFICATION'); }
        if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value, 'code'))
          throw new ApiError(502, '官网 JSON 结构变化', 'UPSTREAM_FORMAT');
        if (value.code !== 0) throw new ApiError(502, `官网接口失败：${value.message || value.code}`, 'UPSTREAM_ERROR');
        value = options.whole ? value : value.data;
      }
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, { value, expires: Date.now() + 300000 });
      return value;
    });
    this.queue = task.catch(() => {});
    this.pending.set(key, task);
    try { return await task; } finally { this.pending.delete(key); }
  }
  async detail(bookId) {
    const page = initialState(await this.request(`/page/${id(bookId, 'book_id')}`)).page;
    if (!page?.bookId) throw new ApiError(404, '书籍不存在或网页不可见', 'NOT_FOUND');
    return { book_id: String(page.bookId), book_name: page.bookName, author: page.authorName || page.author,
      abstract: page.abstract, cover: page.thumbUrl || page.thumbUri, word_count: page.wordNumber,
      creation_status: page.creationStatus, chapter_count: page.chapterTotal,
      latest_chapter_id: page.lastChapterItemId, latest_chapter_title: page.lastChapterTitle,
      source: 'fanqienovel.com' };
  }
  async directory(bookId, simple = false) {
    const data = await this.request(`/api/reader/directory/detail?bookId=${id(bookId, 'book_id')}`, true);
    if (!Array.isArray(data?.chapterListWithVolume)) throw new ApiError(502, '官网目录格式变化', 'UPSTREAM_FORMAT');
    const chapters = data.chapterListWithVolume.flatMap((volume, index) => volume.map(ch => ({
      ...(!simple ? { volume: data.volumeNameList?.[index] || '', order: ch.order, word_count: ch.wordNumber } : {}),
      item_id: String(ch.itemId), title: ch.title,
    })));
    return { book_id: bookId, total: chapters.length, chapters, ...(!simple ? { volume_names: data.volumeNameList } : {}) };
  }
  async chapter(itemId, raw = false) {
    const html = await this.request(`/reader/${id(itemId, 'item_id')}`);
    const state = initialState(html); const chapter = state.reader?.chapterData;
    if (!chapter?.itemId) throw new ApiError(404, '章节不存在或网页不可见', 'NOT_FOUND');
    if (chapter.isChapterLock || chapter.needPay) throw new ApiError(403, '此章节需要官方授权或登录，当前服务无法读取', 'ACCESS_REQUIRED');
    const fontId = /font-family:([^;]+)/.exec(state.common?.css || '')?.[1];
    const encrypted = plainText(chapter.content || '');
    if (!encrypted) throw new ApiError(502, '官网未提供正文', 'EMPTY_CONTENT');
    if (/[\uE000-\uF8FF]/.test(encrypted) && fontId !== 'DNMrHsV173Pd4pgy') throw new ApiError(502, `尚不支持官网字体 ${fontId || 'unknown'}`, 'FONT_CHANGED');
    const content = decryptText(encrypted);
    if (/[\uE000-\uF8FF]/.test(content)) throw new ApiError(502, '正文含未识别的字体字符，拒绝返回乱码', 'FONT_CHANGED');
    return { item_id: String(chapter.itemId), book_id: String(chapter.bookId), title: chapter.title,
      content, word_count: Number(chapter.chapterWordNumber), previous_item_id: chapter.preItemId,
      next_item_id: chapter.nextItemId, source: 'fanqienovel.com',
      completeness: 'website_visible_content', ...(raw ? { raw: chapter, font_id: fontId } : {}) };
  }
  async search(key, tabType, offset, cursor) {
    if (!key?.trim() || key.length > 100) throw new ApiError(400, 'key 不能为空且最多 100 字符', 'INVALID_ARGUMENT');
    if (![2, 3, 8, 11].includes(tabType)) throw new ApiError(400, 'tab_type 支持3小说、2听书、8漫画、11短剧', 'INVALID_ARGUMENT');
    cursor = cursorValue(cursor);
    if (tabType !== 3) return this.appSearch(key.trim(), tabType, offset, cursor);
    if (cursor !== undefined) throw new ApiError(400, '小说搜索使用 offset，分类搜索才使用 cursor', 'INVALID_ARGUMENT');
    // An official lightweight search endpoint; no external signing service or device pool.
    try {
      const params = new URLSearchParams({ aid: '1967', q: key.trim(), offset: String(offset) });
      const data = await this.request(`/api/novel/channel/homepage/search/search/v1/?${params}`, true, 'https://novel.snssdk.com');
      if (!Array.isArray(data?.ret_data)) throw new ApiError(502, '官方搜索结果格式变化', 'UPSTREAM_FORMAT');
      const results = data.ret_data.map(book => ({ ...book, book_name: book.book_name || book.title }));
      return { results, offset, next_offset: data.offset, has_more: yes(data.has_more),
        source: 'official_search', scope: 'official_search_results', local_index: false };
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 502].includes(error.code)) throw error;
      // Keep the website and explicitly marked local index as fallbacks.
    }
    const params = new URLSearchParams({ query_word: key, page_count: '10', page_index: String(Math.floor(offset / 10)), query_type: '0', filter: '' });
    try {
      const data = await this.request(`/api/author/search/search_book/v1?${params}`, true);
      if (!Array.isArray(data?.search_book_data_list)) throw new ApiError(502, '搜索结果格式变化', 'UPSTREAM_FORMAT');
      return { results: data.search_book_data_list, total: data.total_count, offset, source: 'website_api' };
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 502].includes(error.code)) throw error;
      if (!this.searchFallback) throw error;
      return this.searchFallback(key, offset);
    }
  }
  async appSearch(key, tabType, offset, cursor) {
    const params = appQuery({ query: key, passback: cursor ?? String(offset), selected_items: '', tab_type: String(tabType) });
    const response = await this.request(`/reading/bookapi/search/tab/v?${params}`, true, 'https://reading.snssdk.com', { signed: true, whole: true });
    const tab = response.search_tabs?.find(tab => Number(tab.tab_type) === tabType);
    if (!tab || !Array.isArray(tab.data)) throw new ApiError(502, '官方分类搜索结构变化', 'UPSTREAM_FORMAT');
    return searchResults(tab, tabType, offset);
  }
  async comments(bookId, count, offset, cursor) {
    id(bookId, 'book_id');
    cursor = cursorValue(cursor);
    const body = JSON.stringify({ business_param: { book_id: bookId, need_count: true, fold_type: 1 },
      comment_source: 1, comment_type: 2, count, group_id: bookId, group_type: 1, server_channel: 5, sort: 1,
      ...(cursor ? { cursor } : offset ? { cursor: JSON.stringify({ offset }) } : {}) });
    const data = await this.request(`/novel/commentapi/comment/list/${bookId}/v1?${appQuery()}`, true,
      'https://reading.snssdk.com', { signed: true, body });
    if (!data?.common_list_info || !Array.isArray(data.data_list)) throw new ApiError(502, '官方评论结构变化', 'UPSTREAM_FORMAT');
    return commentResults(data, bookId, offset);
  }
}

export const endpointCapabilities = {
  '/api/account/login/start': 'POST：生成本人账号登录二维码', '/api/account/login/poll': 'POST：检查本人扫码结果',
  '/api/account/status': '本地账号登录状态', '/api/account/logout': 'POST：清除本机登录凭据',
  '/api/account/bookshelf': '本人书架及已同步阅读位置', '/api/account/progress': '本人已同步阅读进度与章节标题',
  '/api/account/highlight-books': '有收藏的书籍及划线、书签数量', '/api/account/highlights': '本人收藏的划线原文、章节、位置及游标翻页',
  '/api/search': '官方小说、听书、漫画、短剧关键词搜索；小说失败时明确降级本地索引', '/api/detail': '书籍详情', '/api/book': '完整目录',
  '/api/directory': '简化目录', '/api/chapter': '单章正文', '/api/content': '小说单章、批量（最多20章）',
  '/api/raw_full': '原始章节数据及解析后的正文', '/api/comment': '书籍评论正文、评分、点赞、回复数及cursor翻页',
  '/api/device/pool': '本地网页模式不需要设备池', '/api/device/register': '不支持 App 设备注册',
  '/api/device/status': '本地网页模式状态', '/api/ios/content': '未实现 iOS 协议',
  '/api/ios/register': '未实现 iOS 协议', '/api/manga/progress/:taskId': '未实现漫画任务',
};
export async function dispatch(client, pathname, p) {
  const bookId = () => id(p.get('book_id'), 'book_id');
  const itemId = () => id(p.get('item_id'), 'item_id');
  switch (pathname) {
    case '/health': return { status: 'ok', mode: 'direct_website', capabilities: endpointCapabilities };
    case '/api/search': return client.search(p.get('key') || '', integer(p.get('tab_type'), 3, 0, 20), integer(p.get('offset'), 0, 0, 10000), cursorValue(p.get('cursor')));
    case '/api/detail': return client.detail(bookId());
    case '/api/book':
    case '/api/directory': {
      const paged = p.has('offset') || p.has('limit');
      const offset = integer(p.get('offset'), 0, 0, 100000);
      const limit = integer(p.get('limit'), 50, 1, 200);
      const data = await client.directory(bookId(), pathname === '/api/directory');
      if (!paged) return data;
      const chapters = data.chapters.slice(offset, offset + limit);
      const has_more = offset + chapters.length < data.total;
      return { ...data, chapters, offset, limit, returned: chapters.length, has_more,
        next_offset: has_more ? offset + chapters.length : null };
    }
    case '/api/chapter': return client.chapter(itemId());
    case '/api/raw_full': return client.chapter(itemId(), true);
    case '/api/comment': return client.comments(bookId(), integer(p.get('count'), 20, 1, 100), integer(p.get('offset'), 0, 0, 100000), p.get('cursor') || undefined);
    case '/api/content': {
      const tab = p.get('tab');
      if (['novel', '小说'].includes(tab)) return client.chapter(itemId());
      if (['batch', '批量'].includes(tab)) {
        const expectedBook = bookId();
        const ids = (p.get('item_ids') || '').split(',');
        if (ids.length > 20) throw new ApiError(400, '每批最多20章', 'INVALID_ARGUMENT');
        ids.forEach(x => id(x, 'item_ids'));
        const results = [];
        for (const item of ids) {
          const chapter = await client.chapter(item);
          if (chapter.book_id !== expectedBook) throw new ApiError(400, '章节不属于指定书籍', 'INVALID_ARGUMENT');
          results.push(chapter);
        }
        return { book_id: expectedBook, chapters: results };
      }
      if (['download', '下载'].includes(tab)) throw new ApiError(501, '整本下载尚未实现；请使用目录与分页批量接口', 'UNSUPPORTED_CAPABILITY');
      throw new ApiError(501, '当前仅支持小说正文及批量小说正文', 'UNSUPPORTED_CAPABILITY');
    }
    case '/api/device/pool': return { mode: 'website', required: false, devices: [] };
    case '/api/device/status': return { mode: 'website', required: false, platform: p.get('platform') || 'android' };
    default:
      if (pathname in endpointCapabilities || /^\/api\/manga\/progress\/[^/]+$/.test(pathname))
        throw new ApiError(501, endpointCapabilities[pathname] || '未实现漫画任务', 'UNSUPPORTED_CAPABILITY');
      throw new ApiError(404, '接口不存在', 'NOT_FOUND');
  }
}
