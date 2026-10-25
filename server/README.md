# 本地 API 开发预览版 0.2.0-dev.6

本项目同时提供 MCP 和独立 Skill，安装方法见 [双入口指南](../docs/USAGE.md)。Skill直接调用核心代码，不需要启动本HTTP服务。

Node.js 22+。仅依赖本项目的 npm 依赖，运行不需要 Python、Docker、浏览器或第三方开放 API。

## 运行

```sh
npm install
npm run build
npm run start:api
```

API 仅监听 `127.0.0.1:5000`。访问 `http://127.0.0.1:5000/health` 查看接口能力。

单进程启动 MCP 和随机本地端口 API：`npm start`。MCP 客户端配置：

```json
{
  "mcpServers": {
    "fanqie": {
      "command": "node",
      "args": ["/你的项目绝对路径/server/mcp-local.mjs"]
    }
  }
}
```

本预览版尚未发布 npm，不能用公共 registry 的旧版本验证新功能。安装本地 tgz 后，`mcp-server-fanqie` 启动 MCP，`fanqie-local-api` 单独启动 API。

## 接口兼容表

全部旧路径保留，成功返回 `{ "code": 200, "message": "success", "data": ... }`，失败同时使用真实 HTTP 状态及业务码。数据字段为本地服务规范化结构；未取得旧服务完整响应样本，不能保证旧响应字段逐项一致。

| 路径 | 参数 | 当前状态 |
| --- | --- | --- |
| GET /api/search | key, tab_type=3/2/8/11, offset=0, cursor | 小说使用offset；听书/漫画/短剧使用返回的cursor翻页 |
| GET /api/detail | book_id | 官网书籍详情 |
| GET /api/book | book_id, offset, limit=1~200 | 分卷目录；提供分页参数时按页返回 |
| GET /api/directory | book_id, offset, limit=1~200 | 简化目录；提供分页参数时按页返回 |
| GET /api/chapter | item_id | 网站可见章节正文 |
| GET /api/content | tab=novel/小说, item_id | 单章 |
| GET /api/content | tab=batch/批量, book_id, item_ids | 最多20章，逐章校验归属；任一失败整批报错 |
| GET /api/content | tab=download/下载 | 501，尚未实现整本下载 |
| GET /api/raw_full | item_id | 原始章节字段及解析正文 |
| GET /api/comment | book_id, count=1~100, offset, cursor | 书评正文、评分、点赞、回复数；优先使用返回的cursor翻页 |
| GET /api/device/pool | 无 | 返回网页模式、不需要设备池 |
| GET /api/device/status | platform | 返回网页模式状态，不代表 App 设备状态 |
| GET /api/device/register | platform | 501，网页模式不实现 App 设备注册 |
| GET /api/ios/content | item_id | 501，未实现 iOS 协议 |
| GET /api/ios/register | 无 | 501，未实现 iOS 协议 |
| GET /api/manga/progress/:taskId | 路径参数 | 501，未实现漫画任务 |
| POST /api/index/import | URL参数 book_id | 从官网录入一本书的元数据 |
| POST /api/index/refresh | 无 | 从官网首页刷新可发现的书籍元数据 |

已实现书评正文和四类搜索；未实现听书播放、漫画内容、短剧播放、iOS和整本下载。此版本不等同于完整替代原服务的全部功能。

## 本地检索

已接入官方 `novel.snssdk.com/api/novel/channel/homepage/search/search/v1/`，通过关键词和 offset 搜索官方收录结果，不要求书籍已导入本地。响应含 `source=official_search`、`next_offset`、`has_more`，不虚构官方未返回的总数，也不保证平台全部作品均可搜索到。实测《三体》《十日终焉》与分页通过。之前测试的网页搜索端点仍返回空响应，保留为后备。

小说搜索在上游连接、格式错误或404时尝试备用搜索与本地索引；403权限拒绝、429限流及本地队列繁忙直接返回错误，不掩盖为搜索成功。听书、漫画和短剧失败时返回真实错误，不会拿小说索引冒充分类结果。降级响应含 `source=local_index`、`whole_platform=false`、`indexed_books` 和 `warning`。

首次降级自动索引官网首页的书籍；也可明确导入：

```powershell
Invoke-RestMethod -Method Post "http://127.0.0.1:5000/api/index/import?book_id=7143038691944959011"
Invoke-RestMethod "http://127.0.0.1:5000/api/search?key=十日终焉"
```

索引只存元数据，不落盘保存章节正文。搜索不到不能推断全站不存在。官网抓取请求串行、最小间隔500毫秒，最多缓存100项、有效期5分钟。

## 分页

- 小说搜索：当 `has_more=true` 时，将返回的 `next_offset` 作为下一次请求的 `offset`。
- 听书、漫画、短剧搜索：将返回的 `cursor` 原样作为下一次请求的 `cursor`，保留关键词和 `tab_type`；不要将游标转成数字。旧 `next_offset` 字段保留，但可能是非数字字符串。
- 目录：HTTP接口不传 `offset/limit` 时仍返回完整目录，兼容旧调用；传任一参数即启用分页，默认 `offset=0, limit=50`。响应新增 `returned`、`has_more`、`next_offset`，末页的 `next_offset=null`。页大小上限200，超出末页返回空数组。
- MCP的 `get_book_directory`、`get_simple_directory` 和Skill的 `directory` 默认每页50章。两种入口均支持 `offset/limit`，以免长篇目录占满模型上下文。分页只缩小返回结果，官网目录仍一次获取并缓存。

```powershell
Invoke-RestMethod "http://127.0.0.1:5000/api/book?book_id=7143038691944959011&offset=50&limit=20"
$first = Invoke-RestMethod "http://127.0.0.1:5000/api/search?key=重生&tab_type=11"
if ($first.data.has_more -and $first.data.cursor) {
  $cursor = [uri]::EscapeDataString($first.data.cursor)
  Invoke-RestMethod "http://127.0.0.1:5000/api/search?key=重生&tab_type=11&cursor=$cursor"
}
```

## 超时与错误处理

单次上游请求限时15秒，覆盖读取响应正文；连接中断或HTTP 502/503/504最多自动重试一次，重试也遵守请求间隔。若上游要求等待超过2秒，直接返回等待提示。403、404、验证页、格式错误不自动重试。限制响应体为8,000,000字节，读取时检查，超过即停止。

429限流返回 `error=UPSTREAM_RATE_LIMIT` 和 `retry_after` 秒数，HTTP同时包含 `Retry-After` 响应头。同一客户端实例在这段时间内暂停请求对应上游站点；未提供有效等待时间时默认30秒。不要立即循环重试。MCP错误文字会说明等待秒数；CLI/Skill的JSON保留 `retry_after`。

最多32个不同上游请求排队，相同请求合并；请求出队时若已等待超过30秒则拒绝执行。队列繁忙返回503及 `error=LOCAL_BUSY`。这些限制按进程内客户端实例生效，多个独立Skill进程之间不共享缓存或限流状态。

## 配置

### 本人账号只读接口

所有账号路径都沿用本机Host、Origin限制和可选Token。查询通过GET；发起/检查扫码登录与本机退出使用POST，参数仍放在URL查询中。只支持本人登录后的数据，不接受任意远程用户ID。

| 路径 | 参数 | 返回 |
| --- | --- | --- |
| POST /api/account/login/start | account=default | login_id、qrcode、qrcode_path、有效期、官方扫码提示 |
| POST /api/account/login/poll | account, login_id | waiting_scan/scanned/connected/expired等状态；间隔至少3秒 |
| GET /api/account/status | account | connected/disconnected/expired，不返回Cookie |
| POST /api/account/logout | account | 清空本机凭据；不会更改官方书架和收藏 |
| GET /api/account/bookshelf | account, offset=0, limit=1~100 | 当前书架、已同步位置和当前章节标题 |
| GET /api/account/progress | account, book_id可选, offset=0, limit=1~100 | 已同步阅读记录及书名、当前章节 |
| GET /api/account/highlight-books | account, offset=0, limit=1~100 | 有收藏的书、划线/书签/笔记统计 |
| GET /api/account/highlights | account, book_id, limit=1~100, cursor可选 | highlights[].text原文、章节、位置、下一页cursor |

账号凭据与登录中的状态存入独立的系统用户目录，由 `FANQIE_ACCOUNT_DIR` 覆盖。个人响应不进入公开请求缓存；不同配置分别存储，同一配置跨进程使用文件锁。账号网络请求最小间隔500毫秒，不对登录请求自动重试。未登录或登录失效返回401及 `ACCOUNT_LOGIN_REQUIRED`；账号正在被另一操作使用返回409及 `ACCOUNT_BUSY`。

划线首次请求必须使用官方新协议的 `next_id=0`，核心已封装；省略时官方会静默只返回少量记录。后续把本服务返回的 `cursor` 原样传回，它携带账号、书籍及两项上游分页标记。末页cursor为null；返回数量可能小于limit，不可据此判断已结束。只返回收藏划线，普通书签和独立笔记正文不混入结果。书籍统计中的notes_count不等于已支持笔记正文。登录与字段解释详见 [使用指南](../docs/USAGE.md#本人账号书架阅读进度与收藏划线)。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| FANQIE_LOCAL_PORT | 5000 | 独立 API 端口 |
| FANQIE_DATA_DIR | 当前工作目录/.cache/fanqie | 本地索引目录，可指定绝对路径 |
| FANQIE_LOCAL_TOKEN | 空 | 本地 API Bearer Token，自动 MCP 启动器会传递它 |
| FANQIE_API_BASE | 空 | MCP 显式连接自有 API，设置后不自动启动本地服务 |
| FANQIE_API_TOKEN | 空 | MCP 连接显式 API 的 Bearer Token |
| FANQIE_DEVICE_ID | 内置公共示例设备 | 官方App只读接口的匿名设备ID，可能随时失效，可指定自己的有效设备 |
| FANQIE_INSTALL_ID | 内置公共示例安装ID | 与设备ID配套；仅影响评论和分类搜索 |
| FANQIE_ACCOUNT_DIR | 系统用户数据目录/fanqie-mcp/accounts | 本人扫码登录凭据；独立于公开元数据索引，勿放进仓库 |

不要将 Token 提交到 GitHub。API 拒绝跨来源浏览器请求和非本机 Host，不适合直接公开部署。

评论返回 `data.comments[].text` 和同值的 `content`，不在客户端截断。下一页将 `data.cursor` 原样作为 URL 参数 cursor 传回；优先使用cursor保留官方分页会话。未提供cursor时，offset以官方偏移参数请求，不保证排序一致。这里只读取书评列表，不提供发评论、回复、章评或段评。

漫画、短剧与听书搜索走官方App只读接口，签名在本地生成；不依赖公共签名站点。匿名设备过期时会明确报错，可通过上面两个变量配置有效设备。不会自动注册设备或激活会员。Node需要支持原生SM3（标准Node.js 22+构建通常具备）；算法不可用时会报SIGNING_UNAVAILABLE。

## 数据边界与验证

仅提取官网正常提供的网页数据。锁定、需要付费的章节返回403；未知字体、未识别字符、空正文返回明确错误。`completeness=website_visible_content` 表示仅取得网站返回的内容，不保证与 App 完整正文一致。

字体实现沿用本项目已有映射并修正10个字符事实；通过当前已知字体 family 检查决定能否应用。字体同名更新仍可能需要维护。参考核对资料：官网章节页面，以及 https://github.com/naiyQAQ/fanqie-assistant/blob/main/src/fontDecrypt.ts 中的字符映射数据；未引入该项目实现代码。

`npm test` 执行离线契约测试；`node server/smoke.mjs` 执行少量官网在线验证。正文只验证结构与可读性，不在报告中保存全文。
