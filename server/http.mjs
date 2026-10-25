import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { ApiError, dispatch } from './core.mjs';
import { dispatchAccount } from './accounts.mjs';

export function createApiServer(client, { token = process.env.FANQIE_LOCAL_TOKEN, index, accounts } = {}) {
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, value) => { res.writeHead(status); res.end(JSON.stringify(value)); };
    try {
      // Local API is not a browser cross-origin service. Prevent drive-by localhost requests.
      if (req.headers.origin) throw new ApiError(403, '不接受浏览器跨来源请求', 'ORIGIN_DENIED');
      const host = req.headers.host || '';
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) throw new ApiError(403, '仅支持本机 Host', 'HOST_DENIED');
      if (token) {
        const actual = Buffer.from(req.headers.authorization || ''); const expected = Buffer.from(`Bearer ${token}`);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ApiError(401, '本地 API Token 不正确', 'UNAUTHORIZED');
      }
      const url = new URL(req.url, 'http://127.0.0.1');
      let data;
      if (url.pathname.startsWith('/api/account/')) {
        const action = url.pathname.slice('/api/account/'.length);
        const method = ['login/start', 'login/poll', 'logout'].includes(action) ? 'POST' : 'GET';
        if (req.method !== method) throw new ApiError(405, `此接口要求 ${method}`, 'METHOD_NOT_ALLOWED');
        if (!accounts) throw new ApiError(501, '账号功能未启用', 'UNSUPPORTED_CAPABILITY');
        data = await dispatchAccount(accounts, action, url.searchParams);
      } else if (url.pathname === '/api/index/refresh' || url.pathname === '/api/index/import') {
        if (req.method !== 'POST') throw new ApiError(405, '此接口要求 POST', 'METHOD_NOT_ALLOWED');
        if (!index) throw new ApiError(501, '本地索引未启用');
        if (url.pathname.endsWith('/refresh')) data = await index.refresh(client);
        else data = await index.add(await client.detail(url.searchParams.get('book_id')));
      } else {
        if (req.method !== 'GET') throw new ApiError(405, '此接口要求 GET', 'METHOD_NOT_ALLOWED');
        data = await dispatch(client, url.pathname, url.searchParams);
      }
      send(200, { code: 200, message: 'success', data });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 500;
      if (error.retry_after !== undefined) res.setHeader('Retry-After', String(error.retry_after));
      send(code, { code, message: error instanceof ApiError ? error.message : '本地服务内部错误',
        error: error.kind || 'INTERNAL_ERROR', ...(error.retry_after !== undefined ? { retry_after: error.retry_after } : {}), data: null });
      if (!(error instanceof ApiError)) console.error('[fanqie-api]', error);
    }
  });
}
