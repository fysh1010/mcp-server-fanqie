import { mkdir, readFile, writeFile, rename, realpath, open, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError, integer, id } from './core.mjs';

const origin = 'https://fanqienovel.com';
const loginPage = origin + '/main/writer/login';
const passport = { passport_jssdk_version: '3.0.16', passport_jssdk_type: 'normal', aid: '2503', language: 'zh', account_sdk_source: 'web' };
const profileName = name => {
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(name)) throw new ApiError(400, 'account 使用1~32位小写字母、数字、下划线或连字符', 'INVALID_ARGUMENT');
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(name)) throw new ApiError(400, 'account 不能使用系统保留名称', 'INVALID_ARGUMENT');
  return name;
};
const loginRequired = () => new ApiError(401, '此账号未登录或登录已失效，请重新扫码登录', 'ACCOUNT_LOGIN_REQUIRED');
const yes = value => value === true || value === 1 || value === '1';
const bookmarkQuery = extra => new URLSearchParams({ aid: '1967', iid: '0', version_code: '74132', ...extra });

// Keep large upstream IDs as strings before JSON.parse can round them.
export function accountJSON(text) {
  return JSON.parse(text.replace(/"(?:\\.|[^"\\])*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, (token, number) =>
    number && /^-?\d+$/.test(number) && !Number.isSafeInteger(Number(number)) ? JSON.stringify(number) : token));
}
export class AccountStore {
  constructor(root = process.env.FANQIE_ACCOUNT_DIR || join(process.platform === 'win32'
    ? process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    : process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'fanqie-mcp', 'accounts')) {
    this.root = resolve(root);
  }
  path(account) { return join(this.root, profileName(account) + '.json'); }
  async read(account) {
    const path = this.path(account);
    try { return JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw new ApiError(500, '无法读取本机账号文件', 'ACCOUNT_STORAGE_ERROR'); }
  }
  async write(account, value) {
    profileName(account);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    // Windows packaged apps may redirect AppData to a different volume.
    this.root = await realpath(this.root);
    const target = this.path(account);
    const temp = target + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
      await rename(temp, target);
    } finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  async lock(account) {
    profileName(account);
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    this.root = await realpath(this.root);
    const path = this.path(account) + '.lock';
    let handle;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { handle = await open(path, 'wx', 0o600); break; }
      catch (error) {
        if (error.code !== 'EEXIST') throw new ApiError(500, '无法锁定本机账号文件', 'ACCOUNT_STORAGE_ERROR');
        let owner; try { owner = Number(await readFile(path, 'utf8')); } catch {}
        let dead = false;
        if (Number.isInteger(owner) && owner > 0) {
          try { process.kill(owner, 0); } catch (e) { dead = e.code === 'ESRCH'; }
        }
        if (attempt === 0 && dead) { await unlink(path); continue; }
        throw new ApiError(409, '另一个进程正在处理此账号，请稍后重试', 'ACCOUNT_BUSY');
      }
    }
    await handle.writeFile(String(process.pid));
    return async () => { await handle.close(); await unlink(path); };
  }
}

// Separate from public WebsiteClient: personal responses never enter the shared cache.
export class AccountClient {
  constructor({ store = new AccountStore(), fetcher = fetch } = {}) {
    this.store = store; this.fetcher = fetcher; this.busy = new Set();
    this.queue = Promise.resolve(); this.lastRequest = 0;
  }
  async run(account, fn) {
    profileName(account);
    if (this.busy.has(account)) throw new ApiError(409, '该账号有请求正在处理，请稍后重试', 'ACCOUNT_BUSY');
    this.busy.add(account);
    let release;
    try { release = await this.store.lock(account); return await fn(); }
    finally { try { if (release) await release(); } finally { this.busy.delete(account); } }
  }
  async request(path, cookies, body) {
    const task = this.queue.then(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 500 - (Date.now() - this.lastRequest))));
      this.lastRequest = Date.now();
      return this.requestOnce(path, cookies, body);
    });
    this.queue = task.catch(() => {});
    return task;
  }
  async requestOnce(path, cookies, body) {
    const url = new URL(path, origin);
    if (url.origin !== origin || url.username || url.password) throw new ApiError(502, '登录跳转超出官方站点，已停止', 'ACCOUNT_REDIRECT_DENIED');
    const headers = { 'User-Agent': 'Mozilla/5.0', Referer: loginPage, Accept: 'application/json,text/html',
      Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') };
    if (cookies.passport_csrf_token) headers['x-tt-passport-csrf-token'] = cookies.passport_csrf_token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await this.fetcher(url.href, { method: body === undefined ? 'GET' : 'POST',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    } catch { throw new ApiError(502, '账号接口连接失败或超时', 'ACCOUNT_UPSTREAM_UNAVAILABLE'); }
    for (const line of response.headers.getSetCookie()) {
      const parts = line.split(';').map(s => s.trim());
      const domain = parts.find(s => /^domain=/i.test(s))?.slice(7).replace(/^\./, '').toLowerCase();
      if (domain && domain !== 'fanqienovel.com') continue;
      const split = parts[0].indexOf('=');
      const name = parts[0].slice(0, split), value = parts[0].slice(split + 1);
      if (split < 1 || !/^[a-zA-Z0-9_-]+$/.test(name) || /[;\r\n]/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(name)) continue;
      if (parts.some(s => /^max-age=0$/i.test(s)) || !value) delete cookies[name];
      else cookies[name] = value;
    }
    if (response.status === 401 || response.status === 403) { await response.body?.cancel(); throw loginRequired(); }
    if (response.status === 429) { await response.body?.cancel(); throw new ApiError(429, '官方账号接口限流，请稍后重试', 'UPSTREAM_RATE_LIMIT'); }
    if (response.status >= 400) { await response.body?.cancel(); throw new ApiError(502, `官方账号接口返回 HTTP ${response.status}`, 'ACCOUNT_UPSTREAM_ERROR'); }
    let text;
    try {
      const chunks = []; let bytes = 0;
      if (response.body) for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 4_000_000) throw new ApiError(502, '账号接口响应过大', 'UPSTREAM_FORMAT');
        chunks.push(chunk);
      }
      text = Buffer.concat(chunks).toString('utf8');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, '账号接口响应传输失败', 'ACCOUNT_UPSTREAM_UNAVAILABLE');
    }
    let json; try { json = accountJSON(text); } catch { /* HTML is expected for login preflight. */ }
    return { json, location: response.headers.get('location'), status: response.status };
  }
  async data(path, cookies, body) {
    const { json } = await this.request(path, cookies, body);
    if (!json || typeof json !== 'object') throw new ApiError(502, '账号接口未返回JSON，可能需要官方验证', 'ACCOUNT_UPSTREAM_FORMAT');
    if (json.code !== 0) {
      if ([-1, 101108].includes(json.code) || /登录|login|session/i.test(String(json.message))) throw loginRequired();
      throw new ApiError(502, `账号接口未成功（code=${json.code ?? 'unknown'}）`, 'ACCOUNT_UPSTREAM_ERROR');
    }
    return json.data;
  }
  async loginStart(account) {
    return this.run(account, async () => {
      const cookies = {};
      await this.request(loginPage, cookies);
      const params = new URLSearchParams({ ...passport, need_logo: 'true', next: loginPage });
      const { json } = await this.request('/passport/web/get_qrcode/?' + params, cookies);
      const data = json?.data;
      if (json?.message !== 'success' || !data?.token || !data.qrcode || !/^[a-zA-Z0-9+/=]+$/.test(data.qrcode))
        throw new ApiError(502, '官方未提供可用登录二维码，请稍后重试', 'ACCOUNT_LOGIN_UNAVAILABLE');
      const login_id = randomUUID();
      const expires_at = Math.min(Number(data.expire_time) * 1000 || Date.now() + 300000, Date.now() + 300000);
      const previous = await this.store.read(account);
      const pending = { login_id, token: data.token, cookies, expires_at, last_poll: 0 };
      await this.store.write(account, { ...previous, pending });
      const qrPath = join(this.store.root, `${account}-${login_id}.png`);
      await writeFile(qrPath, Buffer.from(data.qrcode, 'base64'), { mode: 0o600, flag: 'wx' });
      let copywriting = ''; try { copywriting = JSON.parse(data.copywriting || '{}').desc || ''; } catch {}
      return { account, login_id, status: 'waiting_scan', expires_at: new Date(expires_at).toISOString(),
        qrcode_path: qrPath, qrcode: 'data:image/png;base64,' + data.qrcode,
        instruction: copywriting.replace(/\[\/?(?:color[^\]]*|)\]/g, '') || '请使用本人账号按官方提示扫码，并在手机上确认登录。', poll_interval_seconds: 3 };
    });
  }
  async loginPoll(account, loginId) {
    return this.run(account, async () => {
      const state = await this.store.read(account); const pending = state.pending;
      if (!pending || pending.login_id !== loginId) throw new ApiError(404, '登录请求不存在、已完成或已被替换', 'ACCOUNT_LOGIN_NOT_FOUND');
      if (Date.now() >= pending.expires_at) {
        delete state.pending; await this.store.write(account, state);
        return { account, status: 'expired' };
      }
      if (Date.now() - pending.last_poll < 3000) return { account, status: 'waiting', poll_interval_seconds: 3 };
      pending.last_poll = Date.now();
      const params = new URLSearchParams({ ...passport, token: pending.token, next: '/' });
      let response = await this.request('/passport/web/check_qrconnect/?' + params, pending.cookies);
      const status = response.json?.data?.status;
      let redirect = response.location || response.json?.data?.redirect_url;
      for (let hop = 0; !pending.cookies.sessionid && redirect && hop < 5; hop++) {
        response = await this.request(redirect, pending.cookies);
        redirect = response.location;
      }
      // Recheck before persisting: a newer login/logout must not be replaced by this poll.
      if ((await this.store.read(account)).pending?.login_id !== loginId) throw new ApiError(409, '登录请求已被替换', 'ACCOUNT_LOGIN_REPLACED');
      if (pending.cookies.sessionid) {
        const progress = await this.data('/api/reader/book/progress', pending.cookies);
        if (!Array.isArray(progress)) throw new ApiError(502, '阅读进度格式变化，未保存登录凭据', 'ACCOUNT_UPSTREAM_FORMAT');
        await this.store.write(account, { cookies: pending.cookies, connected_at: new Date().toISOString() });
        return { account, status: 'connected', progress_records: progress.length };
      }
      if (['expired', 'cancelled', 'canceled'].includes(status)) delete state.pending;
      await this.store.write(account, state);
      return { account, status: ['expired', 'cancelled', 'canceled', 'scanned', 'confirming', 'confirm'].includes(status) ? status : 'waiting_scan', poll_interval_seconds: 3 };
    });
  }
  async authenticated(account, fn) {
    return this.run(account, async () => {
      const state = await this.store.read(account);
      if (!state.cookies?.sessionid) throw loginRequired();
      return fn(state.cookies);
    });
  }
  async status(account) {
    const state = await this.store.read(account);
    if (!state.cookies?.sessionid) return { account, status: 'disconnected', highlights_supported: true };
    try {
      await this.authenticated(account, async cookies => {
        const data = await this.data('/api/reader/book/progress', cookies);
        if (!Array.isArray(data)) throw new ApiError(502, '官方阅读进度格式变化', 'ACCOUNT_UPSTREAM_FORMAT');
      });
      return { account, status: 'connected', connected_at: state.connected_at, highlights_supported: true };
    } catch (error) {
      if (error.kind === 'ACCOUNT_LOGIN_REQUIRED') return { account, status: 'expired', highlights_supported: true };
      throw error;
    }
  }
  async logout(account) {
    return this.run(account, async () => {
      await this.store.write(account, {});
      return { account, status: 'disconnected', scope: 'local_credentials_only' };
    });
  }
  async details(cookies, books) {
    const details = new Map();
    for (let i = 0; i < books.length; i += 20) {
      const data = await this.data('/api/bookshelf/multidetail', cookies, { books: books.slice(i, i + 20) });
      if (!Array.isArray(data?.detail_list)) throw new ApiError(502, '书架详情格式变化', 'ACCOUNT_UPSTREAM_FORMAT');
      data.detail_list.forEach(row => details.set(String(row.book_id), row));
    }
    return details;
  }
  async progress(account, bookId, offset = 0, limit = 20) {
    if (bookId) id(bookId, 'book_id');
    offset = integer(offset, 0, 0, 100000); limit = integer(limit, 20, 1, 100);
    return this.authenticated(account, async cookies => {
      const data = await this.data('/api/reader/book/progress', cookies);
      if (!Array.isArray(data)) throw new ApiError(502, '官方阅读进度格式变化', 'ACCOUNT_UPSTREAM_FORMAT');
      const filtered = data.filter(row => !bookId || String(row.book_id) === bookId);
      const selected = filtered.slice(offset, offset + limit);
      const details = await this.details(cookies, selected.map(row => ({ book_id: String(row.book_id), item_id: String(row.item_id || '0') })));
      const records = selected.map(row => ({
        book_id: String(row.book_id), item_id: row.item_id == null ? null : String(row.item_id),
        book_name: details.get(String(row.book_id))?.book_name ?? null,
        current_chapter_title: details.get(String(row.book_id))?.title ?? null,
        chapter_order: details.get(String(row.book_id))?.real_chapter_order ?? details.get(String(row.book_id))?.order ?? null,
        chapter_index: row.index ?? null, read_progress: row.read_progress ?? null, read_timestamp: row.read_timestamp ?? null,
      }));
      const has_more = offset + records.length < filtered.length;
      return { account, records, total: filtered.length, offset, limit, has_more, next_offset: has_more ? offset + records.length : null,
        returned: records.length, source: 'official_account_progress',
        scope: 'upstream_available_records', progress_unit: 'upstream_unspecified' };
    });
  }
  async bookshelf(account, offset = 0, limit = 20) {
    offset = integer(offset, 0, 0, 100000); limit = integer(limit, 20, 1, 100);
    return this.authenticated(account, async cookies => {
      const progress = await this.data('/api/reader/book/progress', cookies);
      if (!Array.isArray(progress)) throw new ApiError(502, '官方阅读进度格式变化', 'ACCOUNT_UPSTREAM_FORMAT');
      const shelf = await this.data('/reading/bookapi/bookshelf/info/v:version/?aid=1967&iid=0&version_code=57700&update_version_code=57700', cookies);
      const rows = shelf?.book_shelf_info ?? shelf?.bookShelfInfo ?? shelf;
      if (!Array.isArray(rows)) throw new ApiError(502, '官方书架格式变化', 'ACCOUNT_UPSTREAM_FORMAT');
      const positions = new Map(progress.map(row => [String(row.book_id), row]));
      const selected = rows.slice(offset, offset + limit);
      const details = await this.details(cookies, selected.map(row => ({ book_id: String(row.book_id), item_id: String(positions.get(String(row.book_id))?.item_id || '0') })));
      const books = selected.map(row => {
        const bookId = String(row.book_id), detail = details.get(bookId), position = positions.get(bookId);
        return { book_id: bookId, book_name: detail?.book_name ?? null, author: detail?.author ?? null,
          chapter_count: detail?.serial_count ?? detail?.chapter_number ?? detail?.chapter_count ?? null,
          current_chapter_title: position ? detail?.title ?? null : null,
          chapter_order: position ? detail?.real_chapter_order ?? detail?.order ?? null : null,
          item_id: position?.item_id == null ? null : String(position.item_id), chapter_index: position?.index ?? null,
          read_progress: position?.read_progress ?? null, read_timestamp: position?.read_timestamp ?? null,
          add_shelf_time: row.add_shelf_time ?? null, detail_available: !!detail };
      });
      const has_more = offset + books.length < rows.length;
      return { account, books, total: rows.length, offset, limit, returned: books.length, has_more,
        next_offset: has_more ? offset + books.length : null, source: 'official_account_bookshelf', scope: 'current_bookshelf' };
    });
  }
  async highlightBooks(account, offset = 0, limit = 20) {
    offset = integer(offset, 0, 0, 100000); limit = integer(limit, 20, 1, 100);
    return this.authenticated(account, async cookies => {
      const data = await this.data('/reading/reader/bookmark/personal_list/?' + bookmarkQuery({ offset: String(offset), limit: String(limit) }), cookies);
      if (!Array.isArray(data?.personal_bookmark_data)) throw new ApiError(502, '个人收藏书籍列表格式变化', 'ACCOUNT_UPSTREAM_FORMAT');
      const books = data.personal_bookmark_data.map(row => ({ book_id: String(row.data?.book_id || ''),
        book_name: row.data?.book_name ?? null, original_book_name: row.data?.original_book_name ?? null,
        author: row.data?.author ?? null, highlight_count: row.underline_num ?? null,
        bookmark_count: row.bookmark_num ?? null, notes_count: row.notes_num ?? null, updated_at: row.update_time ?? null }));
      const has_more = yes(data.has_more);
      return { account, books, total: data.book_num ?? null, returned: books.length, offset, limit,
        has_more, next_offset: has_more ? data.next_offset : null, source: 'official_account_highlight_books',
        scope: 'books_with_saved_annotations', notes_content_supported: false };
    });
  }
  async highlights(account, bookId, limit = 20, cursor) {
    id(bookId, 'book_id'); limit = integer(limit, 20, 1, 100);
    let offset = 0, nextId = '0';
    if (cursor) {
      try {
        if (typeof cursor !== 'string' || cursor.length > 4096 || !/^[a-zA-Z0-9_-]+$/.test(cursor)) throw new Error();
        const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (decoded.account !== account || decoded.book_id !== bookId || typeof decoded.next_id !== 'string') throw new Error();
        offset = integer(decoded.offset, undefined, 0, 1000000); nextId = id(decoded.next_id, 'next_id');
        if (offset === undefined) throw new Error();
      } catch { throw new ApiError(400, '划线游标无效或不属于当前账号/书籍，请从首页重新读取', 'INVALID_ARGUMENT'); }
    }
    return this.authenticated(account, async cookies => {
      // next_id=0 selects the current protocol. Omitting it silently returns only a subset.
      const data = await this.data('/reading/reader/bookmark/list/?' + bookmarkQuery({ book_id: bookId, limit: String(limit), offset: String(offset), next_id: nextId }), cookies);
      if (!Array.isArray(data?.bookmark_data)) throw new ApiError(502, '个人划线列表格式变化', 'ACCOUNT_UPSTREAM_FORMAT');
      const rows = data.bookmark_data;
      if (rows.some(row => String(row.book_id) !== bookId)) throw new ApiError(502, '划线返回了其他书籍的数据，已停止', 'ACCOUNT_UPSTREAM_FORMAT');
      const highlights = rows.filter(row => Number(row.bookmark_form_type) === 2).map(row => ({
        highlight_id: String(row.bookmark_id), book_id: bookId, item_id: String(row.item_id),
        book_name: row.item_info?.book_name ?? null, chapter_title: row.item_info?.title ?? row.item_info?.origin_chapter_title ?? null,
        text: typeof row.para_content === 'string' ? row.para_content : '',
        line_position: row.line_pos ?? null, position: row.position_info_v2 ?? null, modified_at: row.modify_time ?? null,
        is_public: row.is_public ?? null,
      }));
      const has_more = yes(data.has_more);
      let nextCursor = null;
      if (has_more) {
        const nextOffset = integer(data.next_offset, undefined, 0, 1000000);
        if (data.next_id == null || nextOffset === undefined || (nextOffset <= offset && String(data.next_id) === nextId))
          throw new ApiError(502, '官方划线翻页标记缺失或未前进，已停止', 'ACCOUNT_UPSTREAM_FORMAT');
        const next = id(String(data.next_id), 'next_id');
        nextCursor = Buffer.from(JSON.stringify({ account, book_id: bookId, offset: nextOffset, next_id: next })).toString('base64url');
      }
      return { account, book_id: bookId, highlights, returned: highlights.length, upstream_returned: rows.length,
        offset, limit, has_more, cursor: nextCursor, source: 'official_account_highlights', scope: 'saved_underlines',
        client_truncated: false, notes_content_supported: false };
    });
  }
}

export async function dispatchAccount(client, action, p) {
  const account = profileName(p.get('account') || 'default');
  switch (action) {
    case 'login/start': return client.loginStart(account);
    case 'login/poll': return client.loginPoll(account, p.get('login_id'));
    case 'status': return client.status(account);
    case 'logout': return client.logout(account);
    case 'bookshelf': return client.bookshelf(account, integer(p.get('offset'), 0, 0, 100000), integer(p.get('limit'), 20, 1, 100));
    case 'progress': return client.progress(account, p.get('book_id') || undefined, integer(p.get('offset'), 0, 0, 100000), integer(p.get('limit'), 20, 1, 100));
    case 'highlight-books': return client.highlightBooks(account, integer(p.get('offset'), 0, 0, 100000), integer(p.get('limit'), 20, 1, 100));
    case 'highlights': return client.highlights(account, id(p.get('book_id'), 'book_id'), integer(p.get('limit'), 20, 1, 100), p.get('cursor') || undefined);
    default: throw new ApiError(404, '账号接口不存在', 'NOT_FOUND');
  }
}
