/**
 * 番茄阅读 DeepSeek Harness 插件 —— 浏览器半（右侧栏「番茄阅读」页面）。
 *
 * 纯 JavaScript、无构建步骤：React 来自浏览器模块表；业务数据一律经
 * `api/fanqie/*` 连接通道由 Host 半调用仓库核心，不在页面直连上游。
 *
 * 视觉语言「番茄暖光」：番茄红渐变品牌色 + 暖纸阅读面 + 衬线正文排版，
 * 参考 Readest / Koodo Reader / Legado 等开源阅读器的主题化阅读体验。
 * 外壳 chrome 只用 --dsw-alias-* 主题 token；阅读画布自持三档阅读主题。
 * 外部文字一律按文本渲染。
 */
window.__ModuleLoader__.load({
  id: 'dsh-fanqie-reader',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // ---------------------------------------------------------------- 语言
    const ZH = {
      'tab.title': '番茄阅读',
      'guide.title': '番茄阅读',
      'guide.desc': '搜书、看目录、读官网可见章节，本人扫码后看划线',
      'nav.back': '返回',
      'nav.account': '我的',
      'home.tagline': '把喜欢的故事，读得更好看',
      'home.search': '搜索书名或作者',
      'home.searchBtn': '搜索',
      'home.categories': '分类浏览',
      'home.recent': '最近在读',
      'home.recentNote': '仅本机记录，与官方进度无关',
      'home.empty': '还没有阅读记录，先去搜一本吧',
      'cat.3': '小说',
      'cat.2': '听书',
      'cat.8': '漫画',
      'cat.11': '短剧',
      'cat.notice': '听书、漫画、短剧只展示官方搜索元数据，本插件不支持播放或阅读。',
      'result.more': '加载更多',
      'result.end': '到底啦',
      'result.empty': '没有找到结果，换个关键词试试',
      'result.local': '官网搜索不可用，已降级为本地索引结果，不是全站搜索。',
      'result.recommend': '官方结果可能混入推荐项，请核对标题与作者。',
      'result.author': '作者',
      'result.words': '字数',
      'result.chapterCount': '章节',
      'result.status': '状态',
      'result.noCover': '暂无封面',
      'detail.toc': '目录',
      'detail.comments': '书评',
      'detail.read': '开始阅读',
      'detail.latest': '最新章节',
      'detail.abstract': '简介',
      'detail.expand': '展开',
      'detail.fold': '收起',
      'detail.source': '来源：番茄小说官网可见数据',
      'toc.title': '目录',
      'toc.page': '第 {a} / {b} 页',
      'toc.prev': '上一页',
      'toc.next': '下一页',
      'toc.count': '共 {n} 章',
      'reader.prev': '上一章',
      'reader.next': '下一章',
      'reader.theme': '主题',
      'reader.themeDay': '日间',
      'reader.themePaper': '羊皮纸',
      'reader.themeNight': '夜间',
      'reader.fontSmaller': 'A-',
      'reader.fontBigger': 'A+',
      'reader.lineHeight': '行距',
      'reader.chapterList': '目录',
      'reader.localPosition': '已记录本机阅读位置 · 与官方账号进度无关',
      'reader.notice': '正文为番茄小说官网可见内容',
      'reader.noPrev': '没有上一章',
      'reader.noNext': '没有下一章',
      'comments.title': '书评',
      'comments.like': '赞',
      'comments.reply': '回复',
      'account.title': '我的番茄',
      'account.status': '账号状态',
      'account.connected': '已登录',
      'account.expired': '登录已失效',
      'account.disconnected': '未登录',
      'account.connect': '扫码登录',
      'account.logout': '退出登录',
      'account.logoutNote': '仅清除本机凭据',
      'account.loggingIn': '请使用本人账号扫码，并在手机上确认登录',
      'account.waiting': '等待扫码',
      'account.scanned': '已扫码，请在手机上确认',
      'account.expiredQr': '二维码已过期，请重新生成',
      'account.rescan': '重新生成二维码',
      'account.stop': '取消登录',
      'account.bookshelf': '书架',
      'account.progress': '阅读位置',
      'account.highlightBooks': '划线笔记',
      'account.highlights': '划线原文',
      'account.highlightsNote': '仅展示官方返回的收藏划线；独立笔记正文官方接口尚未提供。',
      'account.progressNote': 'read_progress 为官方原始值，单位官方未标明，不做百分比换算。',
      'account.loadMore': '加载更多',
      'account.privacy': '账号数据仅在你打开本页时读取，不发送给模型、不写入对话日志。',
      'state.loading': '加载中…',
      'state.error': '出错了',
      'state.empty': '暂无数据',
      'state.retry': '重试',
      'state.offline': '请求失败，请检查网络或稍后重试',
      'state.busy': '本地请求繁忙，请稍后重试',
      'state.rateLimited': '官网限流，请约 {n} 秒后重试',
    };
    const EN = {
      'tab.title': 'Fanqie Reader',
      'guide.title': 'Fanqie Reader',
      'guide.desc': 'Search, browse chapters, read website-visible text; shelf and highlights after QR sign-in',
      'nav.back': 'Back', 'nav.account': 'Mine',
      'home.tagline': 'Read your stories, beautifully',
      'home.search': 'Search by title or author', 'home.searchBtn': 'Search',
      'home.categories': 'Categories', 'home.recent': 'Continue reading', 'home.recentNote': 'Local records only, not official progress', 'home.empty': 'Nothing yet — search for a book first',
      'cat.3': 'Novel', 'cat.2': 'Audiobook', 'cat.8': 'Manga', 'cat.11': 'Short drama',
      'cat.notice': 'Audiobook, manga and short drama show search metadata only; playback and reading are not supported.',
      'result.more': 'Load more', 'result.end': 'That is all', 'result.empty': 'No results — try another keyword', 'result.local': 'Official search unavailable; showing local index results, not a site-wide search.',
      'result.recommend': 'Official results may include recommendations; check title and author.',
      'result.author': 'Author', 'result.words': 'Words', 'result.chapterCount': 'Chapters', 'result.status': 'Status', 'result.noCover': 'No cover',
      'detail.toc': 'Chapters', 'detail.comments': 'Reviews', 'detail.read': 'Start reading', 'detail.latest': 'Latest chapter', 'detail.abstract': 'Summary', 'detail.expand': 'More', 'detail.fold': 'Less', 'detail.source': 'Source: website-visible data on fanqienovel.com',
      'toc.title': 'Chapters', 'toc.page': 'Page {a} / {b}', 'toc.prev': 'Previous', 'toc.next': 'Next', 'toc.count': '{n} chapters',
      'reader.prev': 'Prev', 'reader.next': 'Next', 'reader.theme': 'Theme', 'reader.themeDay': 'Day', 'reader.themePaper': 'Paper', 'reader.themeNight': 'Night',
      'reader.fontSmaller': 'A-', 'reader.fontBigger': 'A+', 'reader.lineHeight': 'Leading', 'reader.chapterList': 'Chapters',
      'reader.localPosition': 'Reading position saved locally · not synced to the official account',
      'reader.notice': 'Text is website-visible content from fanqienovel.com', 'reader.noPrev': 'No previous chapter', 'reader.noNext': 'No next chapter',
      'comments.title': 'Reviews', 'comments.like': 'Likes', 'comments.reply': 'Replies',
      'account.title': 'My Fanqie', 'account.status': 'Account', 'account.connected': 'Connected', 'account.expired': 'Session expired', 'account.disconnected': 'Not connected',
      'account.connect': 'Sign in with QR code', 'account.logout': 'Sign out', 'account.logoutNote': 'clears local credentials only', 'account.loggingIn': 'Scan with your own account and confirm on your phone',
      'account.waiting': 'Waiting for scan', 'account.scanned': 'Scanned; confirm on your phone', 'account.expiredQr': 'QR code expired, generate a new one',
      'account.rescan': 'Generate new QR code', 'account.stop': 'Cancel', 'account.bookshelf': 'Bookshelf', 'account.progress': 'Positions', 'account.highlightBooks': 'Highlights', 'account.highlights': 'Highlighted text',
      'account.highlightsNote': 'Only official saved underlines are shown; standalone notes are not supported by the API yet.',
      'account.progressNote': 'read_progress is the raw upstream value; its unit is unspecified, so no percentage is computed.',
      'account.loadMore': 'Load more', 'account.privacy': 'Account data is read only when you open this page; never sent to the model or written to logs.',
      'state.loading': 'Loading…', 'state.error': 'Something went wrong', 'state.empty': 'No data', 'state.retry': 'Retry', 'state.offline': 'Request failed; check the network and retry',
      'state.busy': 'Local queue busy, retry later', 'state.rateLimited': 'Upstream rate limited; retry in about {n}s',
    };
    const DICTS = { zh: ZH, en: EN };
    let localeId = 'zh';
    const t = (key, vars) => {
      const dict = DICTS[localeId] || ZH;
      let text = dict[key] ?? ZH[key] ?? key;
      if (vars) for (const [name, value] of Object.entries(vars)) text = text.replace(`{${name}}`, String(value));
      return text;
    };

    // ---------------------------------------------------------------- 通道
    async function callChannel(path, body, signal) {
      let response;
      try {
        response = await fetch(`api/fanqie/${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
      } catch (error) {
        if (error && error.name === 'AbortError') throw error;
        const offline = new Error(t('state.offline'));
        offline.kind = 'NETWORK';
        throw offline;
      }
      let payload = null;
      try { payload = await response.json(); } catch { /* 落到统一错误 */ }
      if (!payload || typeof payload !== 'object') {
        const bad = new Error(`${t('state.error')} (HTTP ${response.status})`);
        bad.kind = 'BAD_RESPONSE';
        throw bad;
      }
      if (payload.ok !== true) {
        const info = payload.error || {};
        const error = new Error(info.message || t('state.error'));
        error.kind = info.kind || 'API_ERROR';
        error.code = info.code;
        error.retry_after = info.retry_after;
        throw error;
      }
      return payload.value;
    }
    const apiDispatch = (pathname, params, signal) => callChannel('dispatch', { pathname, params: params || {} }, signal);
    const apiAccount = (action, params, signal) => callChannel('account', { action, params: params || {} }, signal);

    // ---------------------------------------------------------------- 工具
    const COVER_HOSTS = ['fanqienovel.com', 'pstatp.com', 'snssdk.com', 'byteimg.com', 'bytecdn.cn', 'bytedance.com', 'bytedance.net', 'toutiao.com', 'zjcdn.com', 'douyinpic.com'];
    function safeCoverUrl(value) {
      if (typeof value !== 'string' || !value.startsWith('https://')) return null;
      try {
        const host = new URL(value).hostname.toLowerCase();
        return COVER_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) ? value : null;
      } catch { return null; }
    }
    function pick(record, names) {
      if (!record || typeof record !== 'object') return undefined;
      for (const name of names) if (record[name] !== undefined && record[name] !== null && record[name] !== '') return record[name];
      return undefined;
    }
    function asText(value) { return value === undefined || value === null ? '' : String(value); }
    function bookIdOf(record) {
      return asText(pick(record, ['book_id', 'bookId', 'series_id', 'item_id']) || '').trim();
    }
    function bookNameOf(record) {
      return asText(pick(record, ['book_name', 'bookName', 'title', 'name']) || '').trim() || t('state.empty');
    }
    function authorOf(record) {
      return asText(pick(record, ['author', 'author_name', 'authorName', 'writer']) || '').trim();
    }
    function abstractOf(record) {
      return asText(pick(record, ['abstract', 'abstracts', 'desc', 'description', 'summary']) || '').trim();
    }
    function coverOf(record) {
      const raw = pick(record, ['thumb', 'thumb_url', 'thumbUrl', 'thumbUri', 'thumb_uri', 'cover', 'cover_url', 'cover_url_list']);
      if (Array.isArray(raw)) return safeCoverUrl(asText(raw[0] || ''));
      return safeCoverUrl(asText(raw || ''));
    }
    function shortNumber(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return asText(value);
      if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)} 万`;
      return String(n);
    }
    function fmtDate(value) {
      if (!value) return '';
      const date = new Date(Number(value) || value);
      if (Number.isNaN(date.getTime())) return '';
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    // —— 封面补全：上游只有详情接口统一带 cover（thumbUrl/thumbUri），
    //    书架/划线/本地记录没有封面字段，按需查详情补图（限并发、带缓存）。
    const coverCache = new Map();      // book_id -> url | null（null 表示查过没有/失败）
    const coverPending = new Map();    // book_id -> Promise
    let coverInFlight = 0;
    function rememberCover(book) {
      const id = bookIdOf(book);
      const url = coverOf(book);
      if (id && url && !coverCache.has(id)) coverCache.set(id, url);
      return url;
    }
    function enqueueCoverFetch(bookId, signal) {
      if (!bookId || coverCache.has(bookId)) return Promise.resolve(coverCache.get(bookId) || null);
      const pending = coverPending.get(bookId);
      if (pending) return pending;
      const task = (async () => {
        while (coverInFlight >= 2) await new Promise((resolve) => setTimeout(resolve, 120));
        coverInFlight += 1;
        try {
          const data = await apiDispatch('/api/detail', { book_id: bookId }, signal);
          const url = safeCoverUrl(data && data.cover);
          coverCache.set(bookId, url || null);
          return url;
        } catch {
          coverCache.set(bookId, null);
          return null;
        } finally {
          coverInFlight -= 1;
          coverPending.delete(bookId);
        }
      })();
      coverPending.set(bookId, task);
      return task;
    }
    const RECENT_KEY = 'fanqie-reader.recent.v1';
    const FONT_KEY = 'fanqie-reader.font.v1';
    const LEAD_KEY = 'fanqie-reader.lead.v1';
    const THEME_KEY = 'fanqie-reader.theme.v1';
    function readRecent() {
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.slice(0, 12) : [];
      } catch { return []; }
    }
    function pushRecent(entry) {
      try {
        const list = readRecent().filter((row) => row.book_id !== entry.book_id);
        list.unshift({ ...entry, at: Date.now() });
        localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12)));
      } catch { /* 本地记录失败不影响阅读 */ }
    }
    function readNumber(key, fallback, min, max) {
      try {
        const value = Number(localStorage.getItem(key));
        return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
      } catch { return fallback; }
    }
    function saveSetting(key, value) {
      try { localStorage.setItem(key, String(value)); } catch { /* 忽略 */ }
    }
    function readTheme() {
      try {
        const value = localStorage.getItem(THEME_KEY);
        return ['day', 'paper', 'night'].includes(value) ? value : 'day';
      } catch { return 'day'; }
    }

    // ---------------------------------------------------------------- 设计系统
    const CSS = `
/* —— 外壳与品牌 —— */
.fq-root { --fq-brand: #ff512f; --fq-brand-2: #ff8a3d; --fq-ink: var(--dsw-alias-label-primary); --fq-ink-2: var(--dsw-alias-label-secondary); --fq-ink-3: var(--dsw-alias-label-tertiary);
  --fq-bg: var(--dsw-alias-bg-base); --fq-panel: var(--dsw-alias-bg-layer-1); --fq-panel-2: var(--dsw-alias-bg-layer-2);
  --fq-line: var(--dsw-alias-border-l1); --fq-line-2: var(--dsw-alias-border-l2);
  --fq-radius: 14px; --fq-radius-s: 10px;
  --fq-shadow-1: 0 1px 2px rgba(17,12,8,.06), 0 4px 14px rgba(17,12,8,.06);
  --fq-shadow-2: 0 2px 6px rgba(17,12,8,.08), 0 12px 32px rgba(17,12,8,.14);
  --fq-serif: "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun", Georgia, serif;
  display:flex; flex-direction:column; height:100%; min-height:0;
  color: var(--fq-ink); background: var(--fq-bg); font-size: 13px; }
.fq-scroll { flex:1 1 auto; min-height:0; overflow:auto; padding: 12px 12px 20px; }
.fq-anim { animation: fq-in .28s cubic-bezier(.22,.8,.32,1) both; }
@keyframes fq-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform:none; } }
@keyframes fq-shimmer { from { background-position: -220px 0; } to { background-position: 280px 0; } }
.fq-btn { border:1px solid var(--fq-line-2); background: var(--fq-panel); color: var(--fq-ink);
  border-radius: 999px; padding: 6px 14px; font-size: 12px; cursor:pointer;
  transition: transform .16s ease, box-shadow .16s ease, background .16s ease; }
.fq-btn:hover { background: var(--dsw-alias-interactive-bg-hover); transform: translateY(-1px); }
.fq-btn:active { transform: translateY(0) scale(.98); }
.fq-btn:focus-visible { outline:2px solid var(--dsw-focus-ring-color); outline-offset:2px; }
.fq-btn[disabled] { opacity:.45; cursor:default; transform:none; }
.fq-btn-brand { background: linear-gradient(135deg, var(--fq-brand), var(--fq-brand-2)); border-color: transparent; color:#fff;
  box-shadow: 0 4px 14px rgba(255,81,47,.32); font-weight: 600; }
.fq-btn-brand:hover { background: linear-gradient(135deg, var(--fq-brand), var(--fq-brand-2)); filter: brightness(1.06); box-shadow: 0 6px 20px rgba(255,81,47,.4); }
.fq-btn-ghost { border-color: transparent; background: transparent; color: var(--fq-ink-2); }
.fq-btn-ghost:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--fq-ink); }
.fq-icon-btn { width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center; padding:0;
  border-radius: 999px; border:1px solid var(--fq-line-2); background: var(--fq-panel); color: var(--fq-ink-2); cursor:pointer; font-size:13px;
  transition: transform .16s ease, color .16s ease, background .16s ease; }
.fq-icon-btn:hover { color: var(--fq-brand); transform: translateY(-1px); background: var(--dsw-alias-interactive-bg-hover); }
.fq-icon-btn:focus-visible { outline:2px solid var(--dsw-focus-ring-color); outline-offset:2px; }
.fq-pill { border:1px solid transparent; background: transparent; color: var(--fq-ink-2); border-radius: 999px;
  padding: 5px 13px; font-size: 12px; cursor:pointer; transition: all .18s ease; }
.fq-pill:hover { color: var(--fq-ink); background: var(--dsw-alias-interactive-bg-hover); }
.fq-pill-on { background: linear-gradient(135deg, var(--fq-brand), var(--fq-brand-2)); color:#fff; font-weight:600;
  box-shadow: 0 3px 12px rgba(255,81,47,.3); }
.fq-pill-on:hover { color:#fff; background: linear-gradient(135deg, var(--fq-brand), var(--fq-brand-2)); }
.fq-input { flex:1 1 160px; min-width:0; border:1px solid var(--fq-line-2); background: var(--fq-panel);
  color: var(--fq-ink); border-radius: 999px; padding: 9px 16px; font-size: 13px; transition: border-color .18s, box-shadow .18s; }
.fq-input:focus { outline:none; border-color: var(--fq-brand); box-shadow: 0 0 0 3px rgba(255,81,47,.16); }
.fq-row { display:flex; gap:8px; align-items:center; margin: 10px 0; flex-wrap:wrap; }
.fq-spacer { flex:1 1 auto; }
.fq-title { font-weight: 700; font-size: 13px; letter-spacing: .02em; }
.fq-sub { color: var(--fq-ink-2); font-size: 12px; margin-top: 2px; }
.fq-muted { color: var(--fq-ink-3); font-size: 11px; }
.fq-note { color: var(--dsw-alias-state-warn-primary); font-size: 11px; margin: 6px 2px; line-height: 1.6; }
.fq-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; margin: 8px 2px; line-height: 1.6; }
.fq-section { display:flex; align-items:center; gap: 8px; margin: 18px 2px 10px; }
.fq-section-label { font-size: 12px; font-weight: 700; letter-spacing: .04em; color: var(--fq-ink-2); }
.fq-section-bar { flex:1 1 auto; height:1px; background: linear-gradient(90deg, var(--fq-line), transparent); }

/* —— 首页 hero —— */
.fq-hero { position:relative; overflow:hidden; border-radius: var(--fq-radius); padding: 18px 16px 16px;
  background: linear-gradient(135deg, rgba(255,81,47,.14), rgba(255,138,61,.08) 55%, transparent);
  border:1px solid var(--fq-line); }
.fq-hero::after { content:""; position:absolute; right:-32px; top:-32px; width:120px; height:120px; border-radius:50%;
  background: radial-gradient(circle, rgba(255,138,61,.28), transparent 70%); pointer-events:none; }
.fq-hero-title { font-size: 19px; font-weight: 800; letter-spacing: .01em;
  background: linear-gradient(120deg, var(--fq-brand), var(--fq-brand-2)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.fq-hero-sub { color: var(--fq-ink-2); font-size: 12px; margin-top: 3px; }
.fq-hero .fq-row { margin: 12px 0 2px; }

/* —— 书卡与网格 —— */
.fq-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 12px 10px; margin: 10px 0; }
.fq-book { border:0; background:transparent; padding:0; cursor:pointer; text-align:left; min-width:0;
  transition: transform .18s ease; }
.fq-book:hover { transform: translateY(-3px); }
.fq-book:focus-visible { outline:2px solid var(--dsw-focus-ring-color); outline-offset:3px; border-radius: 8px; }
.fq-book-cover { position:relative; width:100%; aspect-ratio: 2/3; border-radius: 10px; overflow:hidden;
  background: linear-gradient(160deg, var(--fq-panel-2), var(--fq-panel)); box-shadow: var(--fq-shadow-1);
  transition: box-shadow .18s ease, transform .18s ease; }
.fq-book:hover .fq-book-cover { box-shadow: var(--fq-shadow-2); }
.fq-book-cover img { width:100%; height:100%; object-fit:cover; display:block; }
.fq-book-fallback { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  color: var(--fq-ink-3); font-size: 11px; padding: 8px; text-align:center; }
.fq-book-name { margin-top: 7px; font-size: 12px; font-weight: 600; line-height: 1.4;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break: break-all; }
.fq-book-author { color: var(--fq-ink-3); font-size: 11px; margin-top: 1px;
  overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
.fq-list-card { display:flex; gap:11px; align-items:stretch; width:100%; text-align:left;
  border:1px solid var(--fq-line); border-radius: var(--fq-radius-s); padding: 10px; margin-bottom: 10px;
  background: var(--fq-panel); cursor:pointer;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.fq-list-card:hover { transform: translateY(-2px); box-shadow: var(--fq-shadow-2); border-color: var(--fq-line-2); }
.fq-list-card:focus-visible { outline:2px solid var(--dsw-focus-ring-color); outline-offset:2px; }
.fq-list-cover { width:46px; height:62px; border-radius: 8px; overflow:hidden; flex:0 0 auto;
  background: var(--fq-panel-2); position:relative; box-shadow: var(--fq-shadow-1); }
.fq-list-cover img { width:100%; height:100%; object-fit:cover; display:block; }
.fq-list-main { flex:1 1 auto; min-width:0; }
.fq-list-name { font-weight:600; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fq-list-line { color:var(--fq-ink-2); font-size:11px; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fq-list-abs { color:var(--fq-ink-3); font-size:11px; margin-top:5px; line-height:1.6;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.fq-badge { display:inline-flex; align-items:center; gap:4px; border-radius:999px; padding:2px 9px;
  font-size:10.5px; font-weight:600; background: rgba(255,81,47,.12); color: var(--fq-brand); }
.fq-chips { display:flex; gap:6px; flex-wrap:wrap; margin: 8px 0; }
.fq-chip-static { border-radius:999px; padding:3px 10px; font-size:11px;
  background: var(--fq-panel-2); color: var(--fq-ink-2); border:1px solid var(--fq-line); }

/* —— 详情 —— */
.fq-detail-hero { position:relative; margin: -12px -12px 0; padding: 22px 16px 18px; overflow:hidden; }
.fq-detail-hero-bg { position:absolute; inset:0; background-size: cover; background-position: center 30%; filter: blur(28px) saturate(1.3); transform: scale(1.25); opacity:.38; }
.fq-detail-hero-mask { position:absolute; inset:0; background: linear-gradient(180deg, rgba(0,0,0,.06), var(--fq-bg) 92%); }
.fq-detail-hero-inner { position:relative; display:flex; gap:14px; }
.fq-detail-cover { width:104px; height:150px; border-radius: 12px; overflow:hidden; flex:0 0 auto;
  box-shadow: var(--fq-shadow-2); background: var(--fq-panel-2); position:relative; }
.fq-detail-cover img { width:100%; height:100%; object-fit:cover; display:block; }
.fq-detail-name { font-size:17px; font-weight:800; line-height:1.35; }
.fq-detail-author { color: var(--fq-ink-2); font-size:12px; margin-top:6px; }
.fq-detail-stats { display:flex; gap:14px; margin-top:10px; flex-wrap:wrap; }
.fq-stat { text-align:center; }
.fq-stat-num { font-size:14px; font-weight:800; color: var(--fq-brand); }
.fq-stat-label { font-size:10px; color: var(--fq-ink-3); margin-top:1px; letter-spacing:.05em; }
.fq-abstract { margin: 14px 2px 4px; color: var(--fq-ink-2); font-size: 12px; line-height: 1.85;
  white-space: pre-wrap; }
.fq-abstract-fold { display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }

/* —— 目录 —— */
.fq-chapter { display:flex; align-items:baseline; gap:9px; width:100%; text-align:left; border:0;
  background:transparent; color: var(--fq-ink); padding: 8px 10px; border-radius: 9px; cursor:pointer; font-size: 12.5px;
  transition: background .15s ease, transform .15s ease; }
.fq-chapter:hover { background: var(--dsw-alias-interactive-bg-hover); transform: translateX(2px); }
.fq-chapter:focus-visible { outline:2px solid var(--dsw-focus-ring-color); outline-offset:-2px; }
.fq-chapter-order { color: var(--fq-ink-3); font-size: 11px; min-width: 30px; font-variant-numeric: tabular-nums; }
.fq-chapter-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* —— 阅读器 —— */
.fq-reader-wrap { display:flex; flex-direction:column; height:100%; min-height:0; }
.fq-reader-top { height:3px; background: var(--fq-line); border-radius: 999px; margin: 0 12px; overflow:hidden; }
.fq-reader-top-fill { height:100%; border-radius: 999px; background: linear-gradient(90deg, var(--fq-brand), var(--fq-brand-2)); transition: width .25s ease; }
.fq-paper { --fq-paper-bg: #fdfbf6; --fq-paper-ink: #2b2118; --fq-paper-ink-2: #8a7a68;
  background: var(--fq-paper-bg); color: var(--fq-paper-ink); }
.fq-paper-day { --fq-paper-bg: #fdfbf6; --fq-paper-ink: #2b2118; --fq-paper-ink-2: #978772; }
.fq-paper-paper { --fq-paper-bg: #f3e9d4; --fq-paper-ink: #4a3b28; --fq-paper-ink-2: #a08a68; }
.fq-paper-night { --fq-paper-bg: #1b1713; --fq-paper-ink: #d8cbb8; --fq-paper-ink-2: #8d7f6d; }
.fq-reader-canvas { flex:1 1 auto; min-height:0; overflow:auto; padding: 20px 18px 84px; }
.fq-reader-meta { text-align:center; color: var(--fq-paper-ink-2); font-size: 11px; letter-spacing: .12em; margin-bottom: 4px; }
.fq-reader-title { font-family: var(--fq-serif); text-align:center; font-size: 20px; font-weight: 700;
  margin: 8px 0 22px; letter-spacing: .04em; }
.fq-reader-body { font-family: var(--fq-serif); }
.fq-reader-body p { margin: 0 0 1.05em; text-align: justify; text-indent: 2em;
  word-break: break-word; line-height: inherit; }
.fq-reader-end { text-align:center; color: var(--fq-paper-ink-2); font-size: 11px; letter-spacing:.2em; margin: 26px 0 6px; }
.fq-reader-bar { position: sticky; bottom: 0; display:flex; gap:6px; align-items:center; justify-content:center;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); margin: 0 -12px -20px;
  background: linear-gradient(180deg, transparent, var(--fq-paper-bg) 34%); }
.fq-reader-bar .fq-icon-btn { background: var(--fq-panel); }
.fq-paper-night .fq-icon-btn { background: #262019; border-color:#383026; color:#c8b9a3; }

/* —— 书评 / 划线 —— */
.fq-quote-card { position:relative; border:1px solid var(--fq-line); border-left: 3px solid var(--fq-brand);
  border-radius: var(--fq-radius-s); padding: 11px 13px; margin-bottom: 10px; background: var(--fq-panel);
  box-shadow: var(--fq-shadow-1); }
.fq-quote-mark { position:absolute; top:6px; right:11px; font-size: 24px; line-height:1; color: rgba(255,81,47,.18); font-family: Georgia, serif; }
.fq-quote-text { font-size: 12.5px; line-height: 1.85; color: var(--fq-ink); }
.fq-quote-meta { display:flex; align-items:center; gap:8px; margin-top:8px; color: var(--fq-ink-3); font-size: 11px; }
.fq-avatar { width:22px; height:22px; border-radius:50%; flex:0 0 auto;
  background: linear-gradient(135deg, var(--fq-brand), var(--fq-brand-2)); color:#fff;
  display:flex; align-items:center; justify-content:center; font-size: 11px; font-weight:700; }

/* —— 账号 —— */
.fq-account-hero { border-radius: var(--fq-radius); padding: 16px; color:#fff; position:relative; overflow:hidden;
  background: linear-gradient(135deg, var(--fq-brand), var(--fq-brand-2)); box-shadow: 0 8px 24px rgba(255,81,47,.28); }
.fq-account-hero::after { content:""; position:absolute; right:-24px; bottom:-40px; width:130px; height:130px; border-radius:50%;
  background: rgba(255,255,255,.14); }
.fq-account-name { font-size: 15px; font-weight: 800; letter-spacing:.02em; }
.fq-account-status { display:inline-flex; align-items:center; gap:6px; margin-top:8px; font-size:12px;
  background: rgba(255,255,255,.18); border-radius:999px; padding: 4px 12px; }
.fq-dot { width:7px; height:7px; border-radius:50%; background:#fff; box-shadow:0 0 0 3px rgba(255,255,255,.25); }
.fq-qr-frame { background:#fff; border-radius: 16px; padding: 12px; width: 208px; margin: 14px auto 8px;
  box-shadow: var(--fq-shadow-2); }
.fq-qr-frame img { width:100%; display:block; border-radius: 8px; }
.fq-tabs { display:flex; gap:6px; margin: 14px 0 10px; flex-wrap:wrap; }

/* —— 骨架屏 / 空状态 —— */
.fq-skeleton { border-radius: 9px; background: linear-gradient(90deg, var(--fq-panel-2) 0%, var(--fq-panel) 40%, var(--fq-panel-2) 80%);
  background-size: 480px 100%; animation: fq-shimmer 1.3s linear infinite; }
.fq-skeleton-line { height: 11px; margin: 7px 0; }
.fq-empty { text-align:center; padding: 34px 18px 26px; color: var(--fq-ink-3); }
.fq-empty svg { margin-bottom: 12px; }
.fq-empty-title { font-size: 13px; color: var(--fq-ink-2); font-weight: 600; }
.fq-empty-sub { font-size: 11px; margin-top: 5px; line-height: 1.7; }

/* —— 顶部工具条 —— */
.fq-toolbar { display:flex; align-items:center; gap:8px; padding: 10px 12px 8px;
  border-bottom:1px solid var(--fq-line); background: var(--fq-bg); }
.fq-toolbar .fq-title { font-size: 13.5px; }
`;
    function Styles() { return h('style', { dangerouslySetInnerHTML: { __html: CSS } }); }

    // ---------------------------------------------------------------- 基础组件
    function Skeleton(props) {
      return h('div', null,
        Array.from({ length: props.lines || 3 }).map((_, index) => h('div', {
          key: index,
          className: 'fq-skeleton fq-skeleton-line',
          style: { width: `${92 - index * 13}%`, height: index === 0 ? 16 : 11 },
        })));
    }
    function SkeletonGrid(props) {
      return h('div', { className: 'fq-grid' },
        Array.from({ length: props.count || 6 }).map((_, index) => h('div', { key: index },
          h('div', { className: 'fq-skeleton', style: { aspectRatio: '2/3', borderRadius: 10 } }),
          h('div', { className: 'fq-skeleton fq-skeleton-line', style: { width: '82%' } }),
          h('div', { className: 'fq-skeleton fq-skeleton-line', style: { width: '55%', height: 9 } }))));
    }
    function EmptyArt(props) {
      return h('svg', { width: 92, height: 68, viewBox: '0 0 92 68', 'aria-hidden': true },
        h('rect', { x: 8, y: 14, width: 34, height: 44, rx: 5, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, opacity: 0.5 }),
        h('rect', { x: 50, y: 14, width: 34, height: 44, rx: 5, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, opacity: 0.5 }),
        h('path', { d: 'M42 18 q4 -6 8 0', fill: 'none', stroke: '#ff8a3d', strokeWidth: 2.4, opacity: 0.85 }),
        h('path', { d: 'M18 28 h14 M18 36 h14 M60 28 h14 M60 36 h14', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', opacity: 0.32 }),
        h('circle', { cx: 46, cy: 52, r: 3.2, fill: '#ff512f', opacity: 0.8 }));
    }
    function EmptyState(props) {
      return h('div', { className: 'fq-empty' },
        h(EmptyArt, null),
        h('div', { className: 'fq-empty-title' }, props.title || t('state.empty')),
        props.sub ? h('div', { className: 'fq-empty-sub' }, props.sub) : null);
    }
    function StateBlock(props) {
      if (props.error) {
        return h('div', { className: 'fq-empty' },
          h('div', { className: 'fq-error' }, props.error.message || t('state.error')),
          props.onRetry ? h('button', { type: 'button', className: 'fq-btn', onClick: props.onRetry }, t('state.retry')) : null);
      }
      return props.grid ? h(SkeletonGrid, { count: props.count }) : h('div', { style: { padding: '14px 4px' } }, h(Skeleton, { lines: props.lines || 4 }));
    }
    function Cover(props) {
      const [failed, setFailed] = React.useState(false);
      const url = props.url;
      if (!url || failed) return h('div', { className: 'fq-book-fallback' }, t('result.noCover'));
      return h('img', { src: url, alt: '', loading: 'lazy', onError: () => setFailed(true) });
    }
    /** 封面智能组件：字段直取 → 本会话缓存 → 按需查详情补图（限并发）。 */
    function BookCover(props) {
      const book = props.book || {};
      const direct = rememberCover(book);
      const bookId = bookIdOf(book);
      const [url, setUrl] = React.useState(() => direct || (bookId ? coverCache.get(bookId) : undefined) || null);
      React.useEffect(() => {
        if (url || !bookId) return undefined;
        let alive = true;
        enqueueCoverFetch(bookId).then((found) => { if (alive && found) setUrl(found); });
        return () => { alive = false; };
      });
      return h(Cover, { url });
    }
    function SectionLabel(props) {
      return h('div', { className: 'fq-section' },
        h('span', { className: 'fq-section-label' }, props.children),
        h('span', { className: 'fq-section-bar' }),
        props.action || null);
    }
    function BookTile(props) {
      const book = props.book || {};
      return h('button', { type: 'button', className: 'fq-book', onClick: () => props.onOpen(book) },
        h('div', { className: 'fq-book-cover' }, h(BookCover, { book })),
        h('div', { className: 'fq-book-name' }, bookNameOf(book)),
        h('div', { className: 'fq-book-author' }, authorOf(book) || ' '));
    }

    // ---------------------------------------------------------------- 页面
    function HomePage(props) {
      const [keyword, setKeyword] = React.useState('');
      const [tabType, setTabType] = React.useState('3');
      const [recent, setRecent] = React.useState(readRecent);
      const submit = () => {
        const key = keyword.trim();
        if (key) props.onSearch(key, tabType);
      };
      return h('div', { className: 'fq-anim' },
        h('div', { className: 'fq-hero' },
          h('div', { className: 'fq-hero-title' }, t('tab.title')),
          h('div', { className: 'fq-hero-sub' }, t('home.tagline')),
          h('div', { className: 'fq-row' },
            h('input', {
              className: 'fq-input', value: keyword, placeholder: t('home.search'), 'aria-label': t('home.search'),
              onChange: (event) => setKeyword(event.target.value),
              onKeyDown: (event) => { if (event.key === 'Enter') submit(); },
            }),
            h('button', { type: 'button', className: 'fq-btn fq-btn-brand', onClick: submit }, t('home.searchBtn')))),
        h(SectionLabel, null, t('home.categories')),
        h('div', { className: 'fq-tabs' },
          ['3', '2', '8', '11'].map((code) => h('button', {
            key: code,
            type: 'button',
            className: `fq-pill${tabType === code ? ' fq-pill-on' : ''}`,
            onClick: () => setTabType(code),
          }, t(`cat.${code}`)))),
        tabType !== '3' ? h('div', { className: 'fq-note' }, t('cat.notice')) : null,
        h(SectionLabel, null, t('home.recent')),
        h('div', { className: 'fq-muted', style: { margin: '0 2px 8px' } }, t('home.recentNote')),
        recent.length === 0
          ? h(EmptyState, { title: t('home.empty') })
          : recent.map((row) => h('button', {
            type: 'button', className: 'fq-list-card', key: `${row.book_id}-${row.item_id || ''}`,
            onClick: () => props.onRecent(row),
          },
            h('div', { className: 'fq-list-cover' }, h(BookCover, { book: row })),
            h('div', { className: 'fq-list-main' },
              h('div', { className: 'fq-list-name' }, row.book_name || row.book_id),
              row.title ? h('div', { className: 'fq-list-line' }, row.title) : null,
              h('div', { style: { marginTop: 6 } }, h('span', { className: 'fq-badge' }, fmtDate(row.at)))))));
    }

    function SearchPage(props) {
      const state = props.state;
      return h('div', { className: 'fq-anim' },
        state.warning ? h('div', { className: 'fq-note' }, state.warning) : null,
        state.loading && state.results.length === 0 ? h(StateBlock, { grid: true }) : null,
        !state.loading && !state.error && state.results.length === 0 ? h(EmptyState, { title: t('result.empty') }) : null,
        state.results.length > 0 ? h('div', { className: 'fq-grid' },
          state.results.map((book, index) => h(BookTile, {
            key: `${bookIdOf(book) || index}-${index}`, book, onOpen: props.onOpen,
          }))) : null,
        state.error ? h(StateBlock, { error: state.error, onRetry: props.onRetry }) : null,
        state.hasMore && !state.loading && !state.error
          ? h('div', { style: { textAlign: 'center', marginTop: 12 } },
            h('button', { type: 'button', className: 'fq-btn', onClick: props.onMore }, t('result.more')))
          : (state.results.length > 0 && !state.loading ? h('div', { className: 'fq-muted', style: { textAlign: 'center', margin: '14px 0 4px' } }, t('result.end')) : null));
    }

    function DetailPage(props) {
      const state = props.state;
      const book = state.data || {};
      const [expanded, setExpanded] = React.useState(false);
      return h('div', null,
        state.loading ? h(StateBlock, { lines: 5 }) : null,
        state.error ? h(StateBlock, { error: state.error, onRetry: props.onRetry }) : null,
        state.data ? h('div', { className: 'fq-anim' },
          h('div', { className: 'fq-detail-hero' },
            h('div', {
              className: 'fq-detail-hero-bg',
              style: safeCoverUrl(book.cover) ? { backgroundImage: `url(${book.cover})` } : { background: 'linear-gradient(135deg, rgba(255,81,47,.35), rgba(255,138,61,.2))' },
            }),
            h('div', { className: 'fq-detail-hero-mask' }),
            h('div', { className: 'fq-detail-hero-inner' },
              h('div', { className: 'fq-detail-cover' }, h(Cover, { url: safeCoverUrl(book.cover) })),
              h('div', { style: { minWidth: 0, flex: '1 1 auto' } },
                h('div', { className: 'fq-detail-name' }, asText(book.book_name)),
                h('div', { className: 'fq-detail-author' }, asText(book.author) || ' '),
                h('div', { className: 'fq-detail-stats' },
                  h('div', { className: 'fq-stat' },
                    h('div', { className: 'fq-stat-num' }, shortNumber(book.word_count) || '—'),
                    h('div', { className: 'fq-stat-label' }, t('result.words'))),
                  h('div', { className: 'fq-stat' },
                    h('div', { className: 'fq-stat-num' }, asText(book.chapter_count) || '—'),
                    h('div', { className: 'fq-stat-label' }, t('result.chapterCount'))),
                  h('div', { className: 'fq-stat' },
                    h('div', { className: 'fq-stat-num' }, asText(book.creation_status) || '—'),
                    h('div', { className: 'fq-stat-label' }, t('result.status'))))))),
          h('div', { className: 'fq-row', style: { marginTop: 14 } },
            h('button', { type: 'button', className: 'fq-btn fq-btn-brand', onClick: props.onRead }, t('detail.read')),
            h('button', { type: 'button', className: 'fq-btn', onClick: props.onToc }, t('detail.toc')),
            h('button', { type: 'button', className: 'fq-btn', onClick: props.onComments }, t('detail.comments'))),
          book.latest_chapter_title ? h('div', { className: 'fq-chips' },
            h('span', { className: 'fq-chip-static' }, `${t('detail.latest')} · ${asText(book.latest_chapter_title)}`)) : null,
          book.abstract ? h('div', { className: 'fq-abstract' },
            h('div', { className: 'fq-section-label', style: { marginBottom: 6 } }, t('detail.abstract')),
            h('div', { className: expanded ? '' : 'fq-abstract-fold' }, asText(book.abstract)),
            h('button', {
              type: 'button', className: 'fq-btn fq-btn-ghost', style: { marginTop: 4, paddingLeft: 0 },
              onClick: () => setExpanded(!expanded),
            }, expanded ? t('detail.fold') : t('detail.expand'))) : null,
          h('div', { className: 'fq-muted', style: { margin: '10px 2px' } }, t('detail.source'))) : null);
    }

    function TocPage(props) {
      const state = props.state;
      const pages = state.pageSize > 0 ? Math.max(1, Math.ceil(state.total / state.pageSize)) : 1;
      const page = state.pageSize > 0 ? Math.floor(state.offset / state.pageSize) + 1 : 1;
      return h('div', { className: 'fq-anim' },
        state.loading && !state.data ? h(StateBlock, { lines: 6 }) : null,
        state.error ? h(StateBlock, { error: state.error, onRetry: props.onRetry }) : null,
        state.data ? h('div', null,
          h('div', { className: 'fq-chips', style: { justifyContent: 'space-between' } },
            h('span', { className: 'fq-chip-static' }, t('toc.count', { n: state.total })),
            h('span', { className: 'fq-chip-static' }, t('toc.page', { a: page, b: pages }))),
          state.data.map((chapter, index) => h('button', {
            type: 'button', className: 'fq-chapter', key: `${chapter.item_id}-${index}`,
            onClick: () => props.onOpen(chapter),
          },
            h('span', { className: 'fq-chapter-order' }, asText(chapter.order ?? state.offset + index + 1)),
            h('span', { className: 'fq-chapter-title' }, asText(chapter.title)))),
          h('div', { className: 'fq-row', style: { justifyContent: 'center' } },
            h('button', { type: 'button', className: 'fq-btn', disabled: state.offset <= 0, onClick: props.onPrev }, t('toc.prev')),
            h('button', { type: 'button', className: 'fq-btn', disabled: state.offset + state.pageSize >= state.total, onClick: props.onNext }, t('toc.next')))) : null);
    }

    function ReaderPage(props) {
      const state = props.state;
      const chapter = state.data;
      const paragraphs = chapter ? String(chapter.content || '').split(/\n+/).filter((line) => line.trim() !== '') : [];
      return h('div', { className: 'fq-reader-wrap fq-paper fq-paper-' + state.theme },
        h('div', { className: 'fq-reader-top' },
          h('div', { className: 'fq-reader-top-fill', style: { width: `${Math.round((state.progress || 0) * 100)}%` } })),
        h('div', { className: 'fq-reader-canvas', onScroll: props.onScroll },
          state.loading ? h(StateBlock, { lines: 6 }) : null,
          state.error ? h('div', { className: 'fq-empty' },
            h('div', { className: 'fq-error' }, state.error.message || t('state.error')),
            h('div', { className: 'fq-muted' }, t('reader.notice')),
            h('div', { className: 'fq-row', style: { justifyContent: 'center' } },
              h('button', { type: 'button', className: 'fq-btn', onClick: props.onRetry }, t('state.retry')),
              chapter || props.canPrev ? h('button', { type: 'button', className: 'fq-btn', onClick: props.onPrev }, t('reader.prev')) : null,
              props.canNext ? h('button', { type: 'button', className: 'fq-btn', onClick: props.onNext }, t('reader.next')) : null)) : null,
          chapter ? h('div', { className: 'fq-anim' },
            h('div', { className: 'fq-reader-meta' }, t('reader.notice')),
            h('h3', { className: 'fq-reader-title' }, asText(chapter.title)),
            h('div', { className: 'fq-reader-body', style: { fontSize: `${state.fontSize}px`, lineHeight: state.lineHeight } },
              paragraphs.map((line, index) => h('p', { key: index }, line))),
            h('div', { className: 'fq-reader-end' }, '— 本章完 —'),
            h('div', { className: 'fq-reader-meta', style: { marginTop: 10 } }, t('reader.localPosition'))) : null),
        h('div', { className: 'fq-reader-bar' },
          h('button', { type: 'button', className: 'fq-icon-btn', title: t('reader.prev'), onClick: props.onPrev, disabled: !chapter || !chapter.previous_item_id }, '‹'),
          h('button', {
            type: 'button', className: 'fq-icon-btn', title: t('reader.theme'),
            onClick: props.onCycleTheme,
          }, state.theme === 'day' ? '☀' : state.theme === 'paper' ? '📜' : '☾'),
          h('button', { type: 'button', className: 'fq-icon-btn', title: t('reader.fontSmaller'), onClick: props.onSmaller }, 'A−'),
          h('button', { type: 'button', className: 'fq-icon-btn', title: t('reader.fontBigger'), onClick: props.onBigger }, 'A+'),
          h('button', { type: 'button', className: 'fq-icon-btn', title: t('reader.lineHeight'), onClick: props.onCycleLead }, '↕'),
          h('button', { type: 'button', className: 'fq-icon-btn', title: t('reader.chapterList'), onClick: props.onToc }, '☰'),
          h('button', { type: 'button', className: 'fq-icon-btn', title: t('reader.next'), onClick: props.onNext, disabled: !chapter || !chapter.next_item_id }, '›')));
    }

    function CommentsPage(props) {
      const state = props.state;
      return h('div', { className: 'fq-anim' },
        state.loading && (state.comments || []).length === 0 ? h(StateBlock, { lines: 5 }) : null,
        state.error ? h(StateBlock, { error: state.error, onRetry: props.onRetry }) : null,
        !state.loading && !state.error && (state.comments || []).length === 0 ? h(EmptyState, { title: t('state.empty') }) : null,
        (state.comments || []).map((row) => h('div', { className: 'fq-quote-card', key: asText(row.comment_id) },
          h('div', { className: 'fq-quote-mark' }, '”'),
          h('div', { className: 'fq-quote-text' }, asText(row.text) || '…'),
          h('div', { className: 'fq-quote-meta' },
            h('span', { className: 'fq-avatar' }, (asText(row.user_name) || '匿')[0]),
            h('span', null, asText(row.user_name) || '匿名'),
            h('span', { className: 'fq-spacer' }),
            h('span', null, `♥ ${asText(row.like_count)}`),
            h('span', null, `💬 ${asText(row.reply_count)}`)))),
        state.hasMore && !state.loading ? h('div', { style: { textAlign: 'center', marginTop: 10 } },
          h('button', { type: 'button', className: 'fq-btn', onClick: props.onMore }, t('result.more'))) : null);
    }

    function HighlightsPage(props) {
      const state = props.state;
      return h('div', { className: 'fq-anim' },
        state.loading && (state.highlights || []).length === 0 ? h(StateBlock, { lines: 4 }) : null,
        state.error ? h(StateBlock, { error: state.error, onRetry: props.onRetry }) : null,
        !state.loading && !state.error && (state.highlights || []).length === 0
          ? h(EmptyState, { title: t('state.empty'), sub: t('account.highlightsNote') }) : null,
        (state.highlights || []).map((row) => h('div', { className: 'fq-quote-card', key: asText(row.highlight_id) },
          h('div', { className: 'fq-quote-mark' }, '”'),
          h('div', { className: 'fq-quote-text' }, asText(row.text)),
          h('div', { className: 'fq-quote-meta' },
            h('span', null, asText(row.chapter_title) || asText(row.book_name))))),
        state.hasMore && !state.loading ? h('div', { style: { textAlign: 'center', marginTop: 10 } },
          h('button', { type: 'button', className: 'fq-btn', onClick: props.onMore }, t('account.loadMore'))) : null,
        h('div', { className: 'fq-muted', style: { margin: '10px 2px' } }, t('account.highlightsNote')));
    }

    function AccountPage(props) {
      const state = props.state;
      const connected = state.status === 'connected';
      return h('div', { className: 'fq-anim' },
        h('div', { className: 'fq-account-hero' },
          h('div', { className: 'fq-account-name' }, t('account.title')),
          h('div', { className: 'fq-account-status' },
            h('span', { className: 'fq-dot', style: connected ? {} : { background: '#ffd2c4', boxShadow: 'none' } }),
            connected ? t('account.connected') : state.status === 'expired' ? t('account.expired') : t('account.disconnected')),
          h('div', { style: { marginTop: 8, fontSize: 11, opacity: 0.9, lineHeight: 1.6 } }, t('account.privacy'))),
        state.accountError ? h('div', { className: 'fq-error' }, state.accountError.message) : null,
        connected ? h('div', null,
          h('div', { className: 'fq-tabs' },
            [['bookshelf', t('account.bookshelf')], ['progress', t('account.progress')], ['highlights', t('account.highlightBooks')]].map(([id, label]) => h('button', {
              key: id, type: 'button',
              className: `fq-pill${state.section === id ? ' fq-pill-on' : ''}`,
              onClick: () => props.onSection(id),
            }, label))),
          state.sectionLoading && (state.shelf || state.progress || state.highlightBooks || []).length === 0 ? h(StateBlock, { lines: 4 }) : null,
          state.sectionError ? h(StateBlock, { error: state.sectionError, onRetry: () => props.onSection(state.section) }) : null,
          state.section === 'bookshelf' ? renderShelf(props, state) : null,
          state.section === 'progress' ? renderProgress(props, state) : null,
          state.section === 'highlights' ? renderHighlightBooks(props, state) : null,
          h('div', { style: { textAlign: 'center', marginTop: 16 } },
            h('button', {
              type: 'button', className: 'fq-btn fq-btn-ghost', onClick: props.onLogout,
            }, `${t('account.logout')} · ${t('account.logoutNote')}`)))
          : h('div', null,
            state.qr ? h('div', { className: 'fq-anim' },
              h('div', { className: 'fq-qr-frame' }, h('img', { src: state.qr.qrcode, alt: t('account.loggingIn') })),
              h('div', { style: { textAlign: 'center' } },
                h('div', { className: 'fq-note' }, asText(state.qr.instruction) || t('account.loggingIn')),
                h('div', { className: 'fq-chips', style: { justifyContent: 'center' } },
                  h('span', { className: 'fq-chip-static' }, qrStatusLabel(state.qrStatus)))),
              h('div', { className: 'fq-row', style: { justifyContent: 'center' } },
                h('button', { type: 'button', className: 'fq-btn', onClick: props.onQrStop }, t('account.stop')),
                h('button', { type: 'button', className: 'fq-btn fq-btn-brand', onClick: props.onQrStart }, t('account.rescan'))))
              : h('div', { style: { textAlign: 'center', marginTop: 18 } },
                h('button', { type: 'button', className: 'fq-btn fq-btn-brand', onClick: props.onQrStart }, t('account.connect')))));
    }
    function qrStatusLabel(status) {
      if (status === 'scanned' || status === 'confirming' || status === 'confirm') return t('account.scanned');
      if (status === 'expired' || status === 'cancelled' || status === 'canceled') return t('account.expiredQr');
      return t('account.waiting');
    }
    function renderShelf(props, state) {
      return h('div', null,
        (state.shelf || []).map((row) => h('button', {
          type: 'button', className: 'fq-list-card', key: asText(row.book_id), onClick: () => props.onOpenBook(row),
        },
          h('div', { className: 'fq-list-cover' }, h(BookCover, { book: row })),
          h('div', { className: 'fq-list-main' },
            h('div', { className: 'fq-list-name' }, asText(row.book_name) || asText(row.book_id)),
            row.author ? h('div', { className: 'fq-list-line' }, asText(row.author)) : null,
            row.current_chapter_title ? h('div', { className: 'fq-list-line' }, asText(row.current_chapter_title)) : null,
            row.read_progress !== null && row.read_progress !== undefined
              ? h('div', { style: { marginTop: 6 } }, h('span', { className: 'fq-badge' }, `read_progress ${asText(row.read_progress)}`))
              : null))),
        (state.shelf || []).length === 0 && !state.sectionLoading ? h(EmptyState, { title: t('state.empty') }) : null,
        state.shelfHasMore && !state.sectionLoading ? h('div', { style: { textAlign: 'center', marginTop: 8 } },
          h('button', { type: 'button', className: 'fq-btn', onClick: props.onShelfMore }, t('account.loadMore'))) : null,
        h('div', { className: 'fq-muted', style: { margin: '10px 2px' } }, t('account.progressNote')));
    }
    function renderProgress(props, state) {
      return h('div', null,
        (state.progress || []).map((row) => h('div', { className: 'fq-quote-card', key: `${asText(row.book_id)}-${asText(row.item_id)}` },
          h('div', { className: 'fq-quote-mark' }, '»'),
          h('div', { className: 'fq-quote-text' }, asText(row.book_name) || asText(row.book_id)),
          h('div', { className: 'fq-quote-meta' },
            h('span', null, asText(row.current_chapter_title)),
            h('span', { className: 'fq-spacer' }),
            h('span', { className: 'fq-badge' }, `read_progress ${asText(row.read_progress)}`)))),
        (state.progress || []).length === 0 && !state.sectionLoading ? h(EmptyState, { title: t('state.empty') }) : null,
        state.progressHasMore && !state.sectionLoading ? h('div', { style: { textAlign: 'center', marginTop: 8 } },
          h('button', { type: 'button', className: 'fq-btn', onClick: props.onProgressMore }, t('account.loadMore'))) : null,
        h('div', { className: 'fq-muted', style: { margin: '10px 2px' } }, t('account.progressNote')));
    }
    function renderHighlightBooks(props, state) {
      return h('div', null,
        (state.highlightBooks || []).map((row) => h('button', {
          type: 'button', className: 'fq-list-card', key: asText(row.book_id), onClick: () => props.onOpenHighlights(row),
        },
          h('div', { className: 'fq-list-cover' }, h(BookCover, { book: row })),
          h('div', { className: 'fq-list-main' },
            h('div', { className: 'fq-list-name' }, asText(row.book_name) || asText(row.book_id)),
            row.author ? h('div', { className: 'fq-list-line' }, asText(row.author)) : null,
            h('div', { style: { marginTop: 6, display: 'flex', gap: 6 } },
              h('span', { className: 'fq-badge' }, `划线 ${asText(row.highlight_count)}`),
              h('span', { className: 'fq-chip-static' }, `书签 ${asText(row.bookmark_count)}`),
              h('span', { className: 'fq-chip-static' }, fmtDate(row.updated_at)))))),
        (state.highlightBooks || []).length === 0 && !state.sectionLoading ? h(EmptyState, { title: t('state.empty') }) : null,
        state.highlightBooksHasMore && !state.sectionLoading ? h('div', { style: { textAlign: 'center', marginTop: 8 } },
          h('button', { type: 'button', className: 'fq-btn', onClick: props.onHighlightBooksMore }, t('account.loadMore'))) : null,
        h('div', { className: 'fq-muted', style: { margin: '10px 2px' } }, t('account.highlightsNote')));
    }

    // ---------------------------------------------------------------- 根组件
    function FanqieTab(props) {
      const useTabInfo = props.useTabInfo;
      const info = useTabInfo();
      const tab = info.tab;
      const signal = tab.signal;
      const [view, setView] = React.useState({ name: 'home' });
      const [search, setSearch] = React.useState({ results: [], hasMore: false, loading: false, error: null, warning: '' });
      const [detail, setDetail] = React.useState({ data: null, loading: false, error: null });
      const [toc, setToc] = React.useState({ data: null, total: 0, offset: 0, pageSize: 50, loading: false, error: null });
      const [reader, setReader] = React.useState({
        data: null, loading: false, error: null,
        fontSize: readNumber(FONT_KEY, 16, 12, 28),
        lineHeight: readNumber(LEAD_KEY, 1.9, 1.4, 2.6),
        theme: readTheme(),
        progress: 0,
        book: null,
      });
      const [comments, setComments] = React.useState({ comments: [], hasMore: false, loading: false, error: null, offset: 0 });
      const [account, setAccount] = React.useState({
        status: 'disconnected', qr: null, qrStatus: '', accountError: null,
        section: 'bookshelf', sectionLoading: false, sectionError: null,
        shelf: [], shelfHasMore: false, shelfOffset: 0,
        progress: [], progressHasMore: false, progressOffset: 0,
        highlightBooks: [], highlightBooksHasMore: false, highlightBooksOffset: 0,
      });
      const [highlights, setHighlights] = React.useState({ highlights: [], hasMore: false, cursor: null, loading: false, error: null, book: null });

      // 打开时带参数（guide / openTab params）：{ book_id, item_id }
      const bootstrapped = React.useRef(false);
      React.useEffect(() => {
        if (bootstrapped.current) return;
        const params = tab.navigation && typeof tab.navigation.getSnapshot === 'function'
          ? (tab.navigation.getSnapshot() || {}).params
          : tab.navigation && tab.navigation.params;
        if (params && params.book_id) {
          bootstrapped.current = true;
          openDetail(String(params.book_id));
          if (params.item_id) openReader({ item_id: String(params.item_id), book_id: String(params.book_id) });
        }
      });

      const abortError = (error) => error && error.name === 'AbortError';
      function errorText(error) {
        if (!error) return null;
        if (error.kind === 'UPSTREAM_RATE_LIMIT') {
          const wrapped = new Error(t('state.rateLimited', { n: error.retry_after ?? 30 }));
          wrapped.kind = error.kind;
          return wrapped;
        }
        return error;
      }

      function openDetail(bookId, name) {
        setView({ name: 'detail', bookId, bookName: name || '' });
        setDetail({ data: null, loading: true, error: null });
        apiDispatch('/api/detail', { book_id: bookId }, signal).then((data) => {
          rememberCover(data);
          setDetail({ data, loading: false, error: null });
        }).catch((error) => {
          if (abortError(error)) return;
          setDetail({ data: null, loading: false, error: errorText(error) });
        });
      }
      function openBookFromRecord(book) {
        const bookId = bookIdOf(book);
        if (!bookId) return;
        openDetail(bookId, bookNameOf(book));
      }
      function loadToc(bookId, offset) {
        setView({ name: 'toc', bookId, bookName: view.bookName });
        setToc((prev) => ({ ...prev, loading: true, error: null, offset }));
        apiDispatch('/api/directory', { book_id: bookId, offset, limit: 50 }, signal).then((data) => {
          setToc({ data: data.chapters || [], total: data.total || 0, offset, pageSize: 50, loading: false, error: null });
        }).catch((error) => {
          if (abortError(error)) return;
          setToc((prev) => ({ ...prev, loading: false, error: errorText(error) }));
        });
      }
      function openReader(chapterRef) {
        const itemId = asText(chapterRef.item_id);
        const bookId = asText(chapterRef.book_id) || asText(view.bookId) || asText(reader.data && reader.data.book_id);
        setView({ name: 'reader', bookId, bookName: view.bookName });
        setReader((prev) => ({ ...prev, data: null, loading: true, error: null, progress: 0, book: { book_id: bookId } }));
        apiDispatch('/api/chapter', { item_id: itemId }, signal).then((data) => {
          setReader((prev) => ({ ...prev, data, loading: false, error: null, book: { book_id: data.book_id || bookId } }));
          const rid = asText(data.book_id || bookId);
          pushRecent({ book_id: rid, book_name: view.bookName || '', item_id: asText(data.item_id), title: asText(data.title), cover: coverCache.get(rid) || '' });
        }).catch((error) => {
          if (abortError(error)) return;
          setReader((prev) => ({ ...prev, loading: false, error: errorText(error) }));
        });
      }
      function moveChapter(direction) {
        const chapter = reader.data;
        if (!chapter) return;
        const target = direction > 0 ? chapter.next_item_id : chapter.previous_item_id;
        if (!target) return;
        openReader({ item_id: asText(target), book_id: asText(chapter.book_id) });
      }
      function loadComments(offset, append) {
        setView({ name: 'comments', bookId: view.bookId, bookName: view.bookName });
        setComments((prev) => ({ ...prev, loading: true, error: null }));
        apiDispatch('/api/comment', { book_id: view.bookId, count: 20, offset }, signal).then((data) => {
          setComments((prev) => ({
            comments: append ? prev.comments.concat(data.comments || []) : (data.comments || []),
            hasMore: !!data.has_more, loading: false, error: null, offset,
          }));
        }).catch((error) => {
          if (abortError(error)) return;
          setComments((prev) => ({ ...prev, loading: false, error: errorText(error) }));
        });
      }
      function runSearch(key, tabType, offset, append, cursor) {
        setView({ name: 'search', key, tabType });
        setSearch((prev) => ({
          results: append ? prev.results : [], hasMore: false, loading: true, error: null,
          warning: tabType !== '3' ? t('cat.notice') : '',
        }));
        // 三套分页互不兼容：小说(3)用 offset；听书/漫画/短剧(2/8/11)用官方不透明 cursor。
        const params = { key, tab_type: tabType, offset };
        if (tabType !== '3' && cursor) params.cursor = cursor;
        apiDispatch('/api/search', params, signal).then((data) => {
          const rows = data.results || [];
          rows.forEach(rememberCover);
          const warnings = [];
          if (data.source === 'local_index') warnings.push(t('result.local'));
          if (data.source === 'local_index' && data.warning) warnings.push(asText(data.warning));
          if (data.warning || data.source === 'official_app_search') warnings.push(t('result.recommend'));
          setSearch((prev) => ({
            results: append ? prev.results.concat(rows) : rows,
            hasMore: !!data.has_more,
            nextOffset: tabType === '3'
              ? (data.next_offset === null || data.next_offset === undefined ? offset + rows.length : Number(data.next_offset))
              : (data.offset ?? offset),
            cursor: data.cursor ? String(data.cursor) : (data.next_offset !== null && data.next_offset !== undefined && tabType !== '3' ? String(data.next_offset) : null),
            loading: false, error: null,
            warning: [prev.warning && tabType !== '3' ? t('cat.notice') : '', ...warnings].filter(Boolean).join(' '),
          }));
        }).catch((error) => {
          if (abortError(error)) return;
          setSearch((prev) => ({ ...prev, loading: false, error: errorText(error) }));
        });
      }

      // 账号页：状态 + 二维码轮询（≥3 秒；关闭页面/插件卸载/成功/过期即停止）
      const pollRef = React.useRef({ timer: null, loginId: null });
      function stopPolling() {
        const poll = pollRef.current;
        if (poll.timer !== null) { clearTimeout(poll.timer); poll.timer = null; }
        poll.loginId = null;
      }
      React.useEffect(() => () => stopPolling(), []);
      function schedulePoll(delayMs) {
        const poll = pollRef.current;
        if (poll.timer !== null) clearTimeout(poll.timer);
        poll.timer = setTimeout(doPoll, Math.max(3000, delayMs));
      }
      function doPoll() {
        const poll = pollRef.current;
        if (!poll.loginId) return;
        apiAccount('login/poll', { login_id: poll.loginId }, signal).then((result) => {
          setAccount((prev) => ({ ...prev, qrStatus: result.status, accountError: null }));
          if (result.status === 'connected') {
            stopPolling();
            setAccount((prev) => ({ ...prev, qr: null, status: 'connected' }));
            refreshAccountSection('bookshelf');
            return;
          }
          if (result.status === 'expired' || result.status === 'cancelled' || result.status === 'canceled') {
            stopPolling();
            setAccount((prev) => ({ ...prev, qrStatus: result.status }));
            return;
          }
          schedulePoll((result.poll_interval_seconds || 3) * 1000);
        }).catch((error) => {
          if (abortError(error)) return;
          stopPolling();
          setAccount((prev) => ({ ...prev, accountError: errorText(error) }));
        });
      }
      function startQrLogin() {
        stopPolling();
        setAccount((prev) => ({ ...prev, accountError: null, qrStatus: '' }));
        apiAccount('login/start', {}, signal).then((result) => {
          setAccount((prev) => ({ ...prev, qr: result, qrStatus: 'waiting_scan' }));
          pollRef.current.loginId = asText(result.login_id);
          schedulePoll((result.poll_interval_seconds || 3) * 1000);
        }).catch((error) => {
          if (abortError(error)) return;
          setAccount((prev) => ({ ...prev, accountError: errorText(error) }));
        });
      }
      function checkStatus() {
        apiAccount('status', {}, signal).then((result) => {
          setAccount((prev) => ({ ...prev, status: result.status, accountError: null }));
          if (result.status === 'connected') refreshAccountSection(account.section);
        }).catch((error) => {
          if (abortError(error)) return;
          setAccount((prev) => ({ ...prev, accountError: errorText(error) }));
        });
      }
      function refreshAccountSection(section, offset = 0, append = false) {
        setAccount((prev) => ({ ...prev, section, sectionLoading: true, sectionError: null }));
        const failed = (error) => {
          if (abortError(error)) return;
          setAccount((prev) => ({ ...prev, sectionLoading: false, sectionError: errorText(error) }));
        };
        if (section === 'bookshelf') {
          apiAccount('bookshelf', { offset, limit: 20 }, signal).then((result) => {
            setAccount((prev) => ({
              ...prev, sectionLoading: false, sectionError: null,
              shelf: append ? prev.shelf.concat(result.books || []) : (result.books || []),
              shelfHasMore: !!result.has_more, shelfOffset: offset,
            }));
          }).catch(failed);
        } else if (section === 'progress') {
          apiAccount('progress', { offset, limit: 20 }, signal).then((result) => {
            setAccount((prev) => ({
              ...prev, sectionLoading: false, sectionError: null,
              progress: append ? prev.progress.concat(result.records || []) : (result.records || []),
              progressHasMore: !!result.has_more, progressOffset: offset,
            }));
          }).catch(failed);
        } else {
          apiAccount('highlight-books', { offset, limit: 20 }, signal).then((result) => {
            setAccount((prev) => ({
              ...prev, sectionLoading: false, sectionError: null,
              highlightBooks: append ? prev.highlightBooks.concat(result.books || []) : (result.books || []),
              highlightBooksHasMore: !!result.has_more, highlightBooksOffset: offset,
            }));
          }).catch(failed);
        }
      }
      function openHighlights(book) {
        setView({ name: 'highlights', bookId: asText(book.book_id), bookName: asText(book.book_name) });
        setHighlights({ highlights: [], hasMore: false, cursor: null, loading: true, error: null, book });
        apiAccount('highlights', { book_id: asText(book.book_id), limit: 20 }, signal).then((result) => {
          setHighlights({
            highlights: result.highlights || [], hasMore: !!result.has_more,
            cursor: result.cursor || null, loading: false, error: null, book,
          });
        }).catch((error) => {
          if (abortError(error)) return;
          setHighlights((prev) => ({ ...prev, loading: false, error: errorText(error) }));
        });
      }
      function moreHighlights() {
        setHighlights((prev) => ({ ...prev, loading: true, error: null }));
        apiAccount('highlights', { book_id: asText(highlights.book && highlights.book.book_id), limit: 20, cursor: highlights.cursor || undefined }, signal).then((result) => {
          setHighlights((prev) => ({
            ...prev,
            highlights: prev.highlights.concat(result.highlights || []),
            hasMore: !!result.has_more, cursor: result.cursor || null, loading: false, error: null,
          }));
        }).catch((error) => {
          if (abortError(error)) return;
          setHighlights((prev) => ({ ...prev, loading: false, error: errorText(error) }));
        });
      }

      function openAccount() {
        setView({ name: 'account' });
        checkStatus();
      }

      // 阅读器控制
      function cycleTheme() {
        setReader((prev) => {
          const order = ['day', 'paper', 'night'];
          const theme = order[(order.indexOf(prev.theme) + 1) % order.length];
          saveSetting(THEME_KEY, theme);
          return { ...prev, theme };
        });
      }
      function cycleLead() {
        setReader((prev) => {
          const order = [1.6, 1.9, 2.3];
          const next = order[(order.indexOf(prev.lineHeight) + 1) % order.length] ?? 1.9;
          saveSetting(LEAD_KEY, next);
          return { ...prev, lineHeight: next };
        });
      }

      // 刷新命令（侧栏“刷新当前页面”）
      React.useEffect(() => {
        if (!tab.actions || typeof tab.actions.bindCommands !== 'function') return undefined;
        return tab.actions.bindCommands({
          refresh: () => {
            const current = view.name;
            if (current === 'detail' && view.bookId) openDetail(view.bookId, view.bookName);
            else if (current === 'toc' && view.bookId) loadToc(view.bookId, toc.offset);
            else if (current === 'reader' && reader.data) openReader(reader.data);
            else if (current === 'comments' && view.bookId) loadComments(comments.offset, false);
            else if (current === 'search') runSearch(view.key, view.tabType, 0, false);
            else if (current === 'account') checkStatus();
          },
        });
      });

      const titles = {
        home: t('tab.title'),
        search: asText(view.key),
        detail: asText(view.bookName) || t('nav.detail'),
        toc: t('toc.title'),
        reader: asText(reader.data && reader.data.title) || t('nav.reader'),
        comments: t('comments.title'),
        account: t('account.title'),
        highlights: t('account.highlights'),
      };

      return h('div', { className: 'fq-root' },
        h(Styles, null),
        view.name !== 'reader' ? h('div', { className: 'fq-toolbar' },
          view.name !== 'home' ? h('button', {
            type: 'button', className: 'fq-icon-btn', title: t('nav.back'), onClick: () => {
              if (view.name === 'highlights') setView({ name: 'account' });
              else if (view.name === 'account') setView({ name: 'home' });
              else if (['toc', 'comments'].includes(view.name)) openDetail(view.bookId, view.bookName);
              else if (view.name === 'reader') loadToc(view.bookId, 0);
              else setView({ name: 'home' });
            },
          }, '‹') : null,
          h('div', { className: 'fq-title' }, titles[view.name] || t('tab.title')),
          h('span', { className: 'fq-spacer' }),
          view.name !== 'account' ? h('button', { type: 'button', className: 'fq-btn fq-btn-ghost', onClick: openAccount }, t('nav.account')) : null) : null,
        h('div', { className: 'fq-scroll', style: view.name === 'reader' ? { padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0 } : undefined },
          view.name === 'home' ? h(HomePage, {
            onSearch: (key, tabType) => runSearch(key, tabType, 0, false),
            onRecent: (row) => {
              if (row.item_id) openReader(row);
              else openDetail(row.book_id, row.book_name);
            },
          }) : null,
          view.name === 'search' ? h(SearchPage, {
            state: search,
            onOpen: openBookFromRecord,
            onMore: () => runSearch(view.key, view.tabType, search.nextOffset ?? 0, true, search.cursor || undefined),
            onRetry: () => runSearch(view.key, view.tabType, 0, false),
          }) : null,
          view.name === 'detail' ? h(DetailPage, {
            state: detail,
            onRetry: () => openDetail(view.bookId, view.bookName),
            onToc: () => loadToc(view.bookId, 0),
            onComments: () => loadComments(0, false),
            onRead: () => loadToc(view.bookId, 0),
          }) : null,
          view.name === 'toc' ? h(TocPage, {
            state: toc,
            onOpen: openReader,
            onPrev: () => loadToc(view.bookId, Math.max(0, toc.offset - toc.pageSize)),
            onNext: () => loadToc(view.bookId, toc.offset + toc.pageSize),
            onRetry: () => loadToc(view.bookId, toc.offset),
          }) : null,
          view.name === 'reader' ? h(ReaderPage, {
            state: reader,
            canPrev: !!(reader.data && reader.data.previous_item_id),
            canNext: !!(reader.data && reader.data.next_item_id),
            onPrev: () => moveChapter(-1),
            onNext: () => moveChapter(1),
            onRetry: () => { if (reader.data) openReader(reader.data); },
            onToc: () => loadToc(view.bookId, 0),
            onCycleTheme: cycleTheme,
            onCycleLead: cycleLead,
            onScroll: (event) => {
              const el = event.currentTarget;
              const max = el.scrollHeight - el.clientHeight;
              const progress = max > 4 ? Math.min(1, el.scrollTop / max) : 0;
              setReader((prev) => (Math.abs((prev.progress || 0) - progress) > 0.01 ? { ...prev, progress } : prev));
            },
            onSmaller: () => setReader((prev) => {
              const size = Math.max(12, prev.fontSize - 1);
              saveSetting(FONT_KEY, size);
              return { ...prev, fontSize: size };
            }),
            onBigger: () => setReader((prev) => {
              const size = Math.min(28, prev.fontSize + 1);
              saveSetting(FONT_KEY, size);
              return { ...prev, fontSize: size };
            }),
          }) : null,
          view.name === 'comments' ? h(CommentsPage, {
            state: comments,
            onMore: () => loadComments(comments.offset + 20, true),
            onRetry: () => loadComments(comments.offset, false),
          }) : null,
          view.name === 'account' ? h(AccountPage, {
            state: account,
            onQrStart: startQrLogin,
            onQrStop: () => { stopPolling(); setAccount((prev) => ({ ...prev, qr: null, qrStatus: '' })); },
            onLogout: () => {
              stopPolling();
              apiAccount('logout', {}, signal).then(() => {
                setAccount((prev) => ({ ...prev, status: 'disconnected', qr: null, qrStatus: '' }));
              }).catch((error) => {
                if (abortError(error)) return;
                setAccount((prev) => ({ ...prev, accountError: errorText(error) }));
              });
            },
            onSection: (section) => refreshAccountSection(section),
            onShelfMore: () => refreshAccountSection('bookshelf', account.shelfOffset + 20, true),
            onProgressMore: () => refreshAccountSection('progress', account.progressOffset + 20, true),
            onHighlightBooksMore: () => refreshAccountSection('highlights', account.highlightBooksOffset + 20, true),
            onOpenBook: openBookFromRecord,
            onOpenHighlights: openHighlights,
          }) : null,
          view.name === 'highlights' ? h(HighlightsPage, {
            state: highlights,
            onMore: moreHighlights,
            onRetry: () => openHighlights(highlights.book || { book_id: view.bookId, book_name: view.bookName }),
          }) : null));
    }

    function FanqieTitle(props) {
      const useTabInfo = props.useTabInfo;
      useTabInfo();
      return h('span', null, t('tab.title'));
    }

    // ---------------------------------------------------------------- 装配
    const TAB_ID = 'dsh-fanqie-reader';
    const TAB_KIND = 'fanqie-reader';

    function serviceOf(ctx, name) {
      const direct = ctx.get ? ctx.get(name) : undefined;
      return direct !== undefined && direct !== null ? direct : (ctx[name] !== undefined ? ctx[name] : undefined);
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        // 语言：注册字典；t 在每次渲染读取当前语言。
        ctx.effect(() => {
          const dispose = ctx.locale.register('fanqie', DICTS);
          const sync = () => {
            try {
              const snapshot = ctx.locale.getLocale ? ctx.locale.getLocale() : null;
              localeId = (snapshot && (snapshot.id || snapshot.locale)) || 'zh';
            } catch { localeId = 'zh'; }
          };
          sync();
          return () => dispose();
        }, 'fanqie-reader: locale');

        const registry = serviceOf(ctx, 'sidebarRightTabs');
        if (!registry || typeof registry.register !== 'function') {
          console.error('fanqie-reader: sidebarRightTabs 服务不可用，未注册右侧栏页面');
          return;
        }

        // 1) tab 类型（引导页出现一枚入口胶囊）
        ctx.effect(() => registry.register({
          id: TAB_ID,
          kind: TAB_KIND,
          priority: 'extension',
          title: () => t('tab.title'),
          guide: [{
            id: 'reader',
            order: 10,
            title: () => t('guide.title'),
            description: () => t('guide.desc'),
          }],
        }), 'fanqie-reader: tab type');

        // 2) 正文与标题席位
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TAB_ID,
        }, FanqieTab)), 'fanqie-reader: tab body');

        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab.title',
          key: TAB_ID,
        }, FanqieTitle)), 'fanqie-reader: tab title');
      },
    };
  },
});
