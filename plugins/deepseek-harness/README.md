# 番茄阅读 · DeepSeek Harness 插件

在 DeepSeek Harness 桌面端右侧栏提供「番茄阅读」页面：搜索番茄小说（含听书/漫画/短剧元数据）、
浏览封面与书籍详情、分页查看目录、阅读官网可见章节、浏览书评；本人扫码登录后可查看书架、
已同步阅读位置与收藏划线。

插件复用本仓库 `server/` 核心（搜索、详情、目录、正文解密、账号协议），不重复实现业务；
原有 MCP、独立 Skill、本地 HTTP API 全部保持不变。

## 目录结构

```
plugins/deepseek-harness/
├── package.json         # bundle 声明（dsh.bundle.patch + dsh.client）
├── cordis.patch.yml     # Loader 插件行：id= fanqie-reader
├── index.js             # Host 半：注册 /api/fanqie/* 通道，调用 vendor/ 业务核心
├── client.js            # 浏览器半：右侧栏 tab 类型 + 页面 UI（纯 JS，无构建）
├── icon.svg             # 原创图标（番茄+书页）
├── locale/zh.json       # 插件管理器显示文案
├── locale/en.json
├── scripts/vendor.mjs   # 把仓库核心同步到 vendor/（打包策略）
└── vendor/              # 核心源码同步副本（零依赖 ESM），使插件包可独立安装
```

## 安装

前置：DeepSeek Harness 桌面端 `0.2.1-rc.5`（已在该版本实测；`engines.dsh` 下限为 0.2.0-rc.0）。

1. 同步业务核心（仅当 `server/` 有改动时需要）：

   ```powershell
   node plugins/deepseek-harness/scripts/vendor.mjs
   ```

2. 安装 bundle（任选其一）：
   - npm 发布后，在插件管理页按包名 `dsh-fanqie-reader` 安装；
   - 插件管理页（设置 → 插件）选择本目录安装；
   - 会话中让智能体执行 `plugin_manager install_bundle`，目标为本目录绝对路径。
   - 安装器（pnpm）把本目录以本地链接方式装入当前 profile 的 `node_modules`。

3. 重开或刷新 Harness 页面后：会话标题栏右侧展开**右侧栏** → 「+」进入**开始**页 →
   点「番茄阅读」胶囊即可（首次展开后也可直接从标签页进入）。

卸载：插件管理页卸载 `dsh-fanqie-reader`，或在会话中执行 `plugin_manager remove_bundle`。
卸载会撤销 Host 路由与右侧栏注册，不影响原有 MCP / Skill / HTTP API。

## 技术通道

- **页面 ↔ Host**：Harness 连接层的共享 `/api` FetchHandler（`ctx.connection.fetch.register`），
  浏览器用文档相对地址 `api/fanqie/{ping,capabilities,dispatch,account}` 访问。通道随插件
  生命周期注册/释放，不新开监听端口；外部进程与跨源请求被连接层信任机制拒绝（实测 401）。
- **右侧栏**：`ctx.sidebarRightTabs.register()` 注册 `fanqie-reader` 页类型（含开始页入口胶囊），
  正文注册在 `sidebar.right.pane.tab` 席位（key = 包名），标题注册在 `sidebar.right.pane.tab.title`。
- **业务**：Host 半通过 `vendor/server/client.mjs` 的 `createLocalClient()` 复用
  `dispatch()` / `dispatchAccount()`，与 MCP、Skill、HTTP API 同源；上游队列、冷却、
  超时、重试与错误语义原样生效。

## 明确的能力边界

- 正文是**番茄小说官网可见内容**（`completeness: website_visible_content`）。付费/锁定章节返回
  403 `ACCESS_REQUIRED`，空正文、未知字体返回 502，界面如实显示，不编造正文。
- 听书、漫画、短剧只展示官方搜索元数据，不支持播放或阅读。
- 搜索分页按接口区分：小说用 `offset/next_offset`，听书/漫画/短剧用官方不透明 `cursor`，
  划线用绑定账号与书的 `cursor`；`book_id`/`item_id` 全程按字符串传递。
- `read_progress` 为官方原始值（`progress_unit: upstream_unspecified`），未换算百分比。
- 最近打开/阅读位置是**本机记录**（localStorage），与官方账号进度无关；项目未实现向官方写进度。
- 独立笔记正文官方接口未提供，划线页只展示 `bookmark_form_type=2` 的收藏划线。
- 封面图仅渲染 `https:` 且域名在可信来源清单内的 URL，其余显示占位图。

## 隐私

- 账号数据在用户打开「我的」页面或调用本人账号对话工具时读取；扫码二维码经受控通道直达界面展示，
  不由插件主动发送到 AI 模型上下文与对话日志。
- 登录凭据沿用核心的本机存储（`%LOCALAPPDATA%/fanqie-mcp/accounts`，0700/0600），
  「退出登录」只清除本机凭据，不注销官方侧会话。
- 插件注册下文列出的7个对话工具；调用账号工具时，相应结果会进入当前 AI 对话上下文。插件代码未包含遥测采集逻辑。

## 视觉设计「番茄暖光」

参考 Readest / Koodo Reader / Legado 等开源阅读器的社区需求（沉浸阅读、主题化、
划线批注、封面化书架、微动效），以番茄红渐变 + 暖纸阅读面 + 衬线正文排版重构：

- 首页：渐变 hero + 胶囊搜索框 + 分类胶囊 + 「最近在读」时间线（本机记录）。
- 搜索：封面网格卡片（2:3 圆角 + 投影 + 悬停抬升），骨架屏加载，空态内联插画。
  封面字段缺失的视图（书架/划线/本机记录）按需查详情补图：限并发 2、会话内缓存，
  官方字段有图时直接渲染，始终保留占位兜底。
- 详情：封面虚化背景 hero、数据小节（字数/章节/状态）、渐变主按钮、简介折叠。
- 阅读器：全幅「纸面」画布，衬线排版、首行缩进、两端对齐；日间/羊皮纸/夜间三档
  阅读主题；字号 12–28 与三档行距可调；顶部细进度条 + 底部悬浮工具舱。
- 书评/划线：引用卡（品牌左边条 + 引号符 + 头像）。
- 账号：渐变身份卡 + 状态徽标 + 胶囊分段，划线书目与书架列表卡片化。
- 全局：视图切换淡入上移动画、shimmer 骨架、hover 抬升、focus-visible 焦点环、
  深浅主题跟随外壳 token（阅读画布自持三档主题）。

## AI 问答工具（MCP/Skill 能力在 Harness 内的等价物）

插件 Host 半向 Agent 注册 7 个只读工具（与界面走同一业务通道，随插件卸载释放）：

| 工具 | 用途 |
| --- | --- |
| `fanqie_search_books` | 四分类搜索，返回 ID/书名/作者/简介摘要 |
| `fanqie_book_detail` | 书详情（简介、字数、状态、最新章节） |
| `fanqie_book_directory` | 分页目录（章节 item_id 定位） |
| `fanqie_read_chapter` | 官网可见正文片段（`preview_chars` 有界返回，截断明确标注） |
| `fanqie_my_bookshelf` | 本人书架与官方已同步阅读位置（`read_progress` 原值） |
| `fanqie_my_highlights` | 本人收藏划线原文与所属章节（cursor 翻页） |
| `fanqie_book_comments` | 书评分页 |

因此在对话里直接问「我书架上有什么书」「把某本书的划线读给我」即可，无需先打开界面；
账号数据只在工具被调用时读取。工具输出有界（列表每页≤条目上限、正文可限字数），
续读方式写在结果里。



## 已验证（0.2.1-rc.5 桌面端）

- `plugin_manager install_bundle` 安装 → `application: applied`，Host 半 `fiberPhase: active`；
- 7 个 `fanqie_*` 工具经 `cordis_inspect` 工具表实测可见（AI 问答可用）；
- Host 通道注册于连接层，非信任请求统一 401（与官方插件同通道）；
- 干净目录复制后 `node --check` + 动态导入 `index.js` 成功（vendor/ 自包含）；
- 本仓库离线回归：`npm test` 37项通过，插件 Host 测试4项通过；
- 开发交付记录称已在桌面端验证右侧栏、上游查询及本人扫码；不同环境和后续上游变更仍需重新验证。

## 本地开发

```powershell
node --check plugins/deepseek-harness/index.js     # 语法
node --check plugins/deepseek-harness/client.js
node plugins/deepseek-harness/scripts/vendor.mjs --check   # vendor 与源码一致性
node --test plugins/deepseek-harness/test/host.test.mjs    # Host 半离线自测（通道/校验/错误信封）
```

修改 `client.js` / `index.js` 后由 Harness 的插件 HMR 机制热替换；若未生效，重载页面或重启桌面端。
