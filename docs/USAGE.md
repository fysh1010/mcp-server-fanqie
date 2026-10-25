# MCP 与 Skill 双入口

本仓库保留一个数据核心，提供 MCP、Skill/CLI 和可选 HTTP API。当前 `0.2.0-dev.6` 为GitHub开发预览版。[下载Release](https://github.com/fysh1010/mcp-server-fanqie/releases/tag/v0.2.0-dev.6)。本次不发布npm，公共registry中的旧版不包含这些新功能。

## 选择入口

| 方式 | 适用情况 | 启动行为 |
| --- | --- | --- |
| MCP | 支持 MCP 的 AI 客户端 | 客户端启动 MCP，MCP 自动启动随机本地端口 API |
| Skill | 支持 Skills、可运行本地命令的 AI 助手 | 按需运行脚本，直接查询官方数据，用完退出，不启动监听端口 |
| CLI | 终端或自己的脚本 | 与 Skill 相同 |
| HTTP API | 其他程序需要访问本机接口 | 单独启动，默认 127.0.0.1:5000 |

都需要 Node.js 22+ 和访问番茄官方站点的网络。支持 Skills 不自动代表允许执行脚本；所用客户端必须具备本地脚本执行权限。

## 从 GitHub 获取

```sh
git clone https://github.com/fysh1010/mcp-server-fanqie.git
cd mcp-server-fanqie
```

也可从Release下载源码ZIP。解压后，以下命令都在解压得到的仓库根目录执行。

## MCP 安装

在克隆目录执行：

```sh
npm ci
npm run build
```

将下面路径换成你自己的绝对路径，加入 MCP 客户端配置：

以下为支持mcpServers格式的客户端示例；其他客户端在其配置界面填写同样的command与args。

```json
{
  "mcpServers": {
    "fanqie": {
      "command": "node",
      "args": ["D:/你的路径/mcp-server-fanqie/server/mcp-local.mjs"]
    }
  }
}
```

无需先执行 `start:api`。已设置 `FANQIE_API_BASE` 时，会连接指定 API 而不自动启动；未设置时完全本地启动。公开查询无需番茄账号或预设密码；个人书架、进度和划线需本人扫码登录，账号功能仅通过本机API使用。

### 使用Release里的tgz安装

下载本版 `fysh925-mcp-server-fanqie-0.2.0-dev.6.tgz`，在自己准备的空目录执行：

```sh
npm init -y
npm install "/下载文件的绝对路径/fysh925-mcp-server-fanqie-0.2.0-dev.6.tgz"
```

MCP配置的args改为安装目录下 `node_modules/@fysh925/mcp-server-fanqie/server/mcp-local.mjs` 的绝对路径，command仍是node。tgz包含已编译代码、完整Skill和运行文件，不要求自己编译TypeScript；下载依赖仍需要网络。此方式不会从registry安装旧版项目本身，也不会全局安装。

## Skill 安装

### 直接安装独立ZIP

1. 下载Release中的 `fanqie-novel-skill-0.2.0-dev.6.zip`。
2. 将ZIP内完整的 `fanqie-novel` 目录解压到客户端支持的技能父目录。Codex示例：Windows为 `$HOME/.agents/skills/`，macOS/Linux为 `~/.agents/skills/`。
3. 检查 `fanqie-novel/SKILL.md` 和 `fanqie-novel/scripts/runtime/` 都存在，不能形成多余的一层同名目录。
4. 让客户端重新发现技能，必要时重启客户端。

### 从克隆仓库安装

Skill 运行只使用 Node.js 标准库，不需要 MCP SDK、npm 依赖、Python或浏览器。仓库自带编译后的字体文件，因此仅使用 Skill 时无需 `npm ci`。

在克隆目录运行安装脚本，明确指定当前客户端的**技能父目录**。脚本将创建其中的 `fanqie-novel/`，复制技能与必需运行文件；目标已存在时拒绝覆盖。

Codex 用户目录示例：

```powershell
node "scripts/install-skill.mjs" --target "$HOME/.agents/skills"
```

```sh
node "scripts/install-skill.mjs" --target "$HOME/.agents/skills"
```

其他客户端使用各自支持的 Skills 目录，不能假设所有 MCP 客户端都支持 Skill。无需更改系统环境变量或全局安装 npm 包。

安装后让客户端重新发现技能，使用：

```text
$fanqie-novel 搜索《三体》，核对作者，然后查看前20章目录。
```

也可以直接运行技能脚本验证：

```powershell
node "$HOME/.agents/skills/fanqie-novel/scripts/fanqie.mjs" search "三体"
```

也可让支持 GitHub 仓库路径的技能安装器安装 `fysh1010/mcp-server-fanqie` 的 `skills/fanqie-novel` 目录。该目录已包含生成的完整运行文件，可以独立复制和移动。完整 Skill ZIP 解压到技能父目录也可使用，文件夹名保持 `fanqie-novel`。不要只复制 `SKILL.md`。

## 命令行

```sh
node "server/cli.mjs" search "三体" --offset 0
node "server/cli.mjs" search "绝世武神" --type manga
node "server/cli.mjs" search "重生" --type drama
node "server/cli.mjs" comments "7143038691944959011" --count 20
node "server/cli.mjs" detail "7143038691944959011"
node "server/cli.mjs" directory "7143038691944959011" --offset 0 --limit 20
node "server/cli.mjs" chapter "7173216089122439711"
node "server/cli.mjs" capabilities
```

输出单个 JSON 对象。`code=200` 表示成功；失败时进程退出码为1。书籍/章节ID为字符串。安装 npm 包后也可使用其中的 `fanqie` 命令。

评论正文在 `data.comments[].text`（`content`为同值别名），客户端不会截断文本。下一页将 `data.cursor` 原样作为 `--cursor` 的独立参数传入；MCP的 `get_comments` 同样支持cursor。这里提供整本书的书评，不含章评、段评、楼中楼。

漫画和短剧只提供搜索、基本元数据，不读取漫画内容或播放短剧。官方搜索可能混入推荐，需核对标题、作者和返回的 `upstream_use_recommend` 标记。

搜索翻页：小说将 `next_offset` 传给 `--offset`；听书、漫画、短剧将 `cursor` 原样传给 `--cursor`（MCP `search_books` 同名参数），不能将游标转为数字。仅在 `has_more=true` 时继续翻页，保持关键词和分类不变。

MCP的 `get_book_directory`、`get_simple_directory` 和Skill目录命令默认每页50章，可指定 `offset` 和 `limit`（1~200）。下一页使用 `next_offset`；末页返回 `has_more=false, next_offset=null`。独立HTTP接口不传分页参数时仍返回全目录，兼容旧调用。

CLI/Skill 不读 `.env`，可从调用进程继承 `FANQIE_DATA_DIR` 指定索引目录；默认只在需要保存索引时写入当前工作目录的 `.cache/fanqie`。不要把本地索引或配置中的Token提交到GitHub。

## 本人账号：书架、阅读进度与收藏划线

0.2.0-dev.6的源码、MCP安装包和独立Skill ZIP均包含账号功能。公开搜索、书评和章节查询仍无需登录。

**MCP：** 让AI调用 `start_account_login` 并展示二维码，按官方提示用本人已登录的手机App扫码确认，再调用 `poll_account_login`，间隔至少3秒。官方当前可能提示使用抖音App；确认后请核对书架是否对应自己的番茄账号。二维码约5分钟有效，过期重新生成。

登录后可直接说：“查看我的番茄书架和每本书读到哪章”“列出我有划线的书”“获取这本书收藏的划线原文”。对应工具为 `get_my_bookshelf`、`get_my_reading_progress`、`get_my_highlight_books`、`get_my_highlights`；`get_account_status` 检查登录，`logout_account` 清除本机凭据。

**Skill/CLI：** 同一台机器默认共用同一个本地账号目录。Skill把下面脚本路径换成其目录内的 `scripts/fanqie.mjs`，无需启动HTTP服务。

```sh
node "server/cli.mjs" login-start --account default
node "server/cli.mjs" login-poll "上一步返回的login_id" --account default
node "server/cli.mjs" account-status
node "server/cli.mjs" bookshelf --offset 0 --limit 20
node "server/cli.mjs" reading-progress --limit 20
node "server/cli.mjs" highlight-books --offset 0 --limit 20
node "server/cli.mjs" highlights "书籍ID" --limit 20
node "server/cli.mjs" highlights "书籍ID" --limit 20 --cursor "上页返回的cursor"
node "server/cli.mjs" logout
```

`login-start` 输出的 `qrcode_path` 是可直接打开的本地PNG，也返回二维码数据供客户端展示。`login-poll` 在 `status=connected` 后才算登录完成，不要持续轮询已经完成的登录。

Windows PowerShell可用下面的完整流程生成二维码、打开图片并等待手机确认；请在仓库根目录运行：

```powershell
$login = node "server/cli.mjs" login-start --account default | ConvertFrom-Json
if ($login.code -ne 200) { throw $login.message }
Write-Host $login.data.instruction
Invoke-Item -LiteralPath $login.data.qrcode_path
do {
  Start-Sleep -Seconds 3
  $check = node "server/cli.mjs" login-poll $login.data.login_id --account default | ConvertFrom-Json
  if ($check.code -ne 200) { throw $check.message }
  Write-Host $check.data.status
} while ($check.data.status -in @("waiting", "waiting_scan", "scanned", "confirming", "confirm"))
if ($check.data.status -ne "connected") { throw "未完成登录，请重新生成二维码" }
node "server/cli.mjs" bookshelf --limit 20
node "server/cli.mjs" highlight-books --limit 20
```

macOS/Linux也先执行login-start，用系统图片查看器打开返回的qrcode_path，然后每隔至少3秒执行一次login-poll。独立Skill使用其目录内脚本绝对路径替换server/cli.mjs，参数不变。

读取某本书的全部划线时，先从highlight-books取得book_id，再按下面的逻辑翻页。示例中每页输出JSON，不会自动导出文件：

```powershell
$bookId = "从highlight-books取得的书籍ID"
$cursor = $null
do {
  $queryArgs = @("server/cli.mjs", "highlights", $bookId, "--limit", "100")
  if ($cursor) { $queryArgs += @("--cursor", $cursor) }
  $page = node @queryArgs | ConvertFrom-Json
  if ($page.code -ne 200) { throw $page.message }
  $page.data.highlights | ConvertTo-Json -Depth 10
  $cursor = $page.data.cursor
  if ($page.data.has_more -and -not $cursor) { throw "下一页游标缺失" }
} while ($page.data.has_more)
```

- `bookshelf` 是当前官方书架；`reading-progress` 是接口返回的云端阅读位置，不等同于所有历史阅读记录。没有进度的书返回 `null`，不能据此认定从未读过。
- 章节标题是 `current_chapter_title`。`read_progress` 和 `chapter_index` 保留上游值，其单位不作推断，尤其不要直接把它显示成百分比。书名可能因官方改名与App显示不同，以书籍ID核对。
- `highlight-books` 返回有收藏记录的书、划线数、书签数和笔记数。统计有笔记不代表已支持笔记正文导出。
- `highlights` 只返回 `highlights[].text` 收藏划线原文，并带章节、原始位置及修改时间。原文不截断。首次自动带必要的官方参数；后续必须原样使用 `cursor`，保持 `account/book_id` 不变，直到 `has_more=false`。不要自行累加offset：上游分页同时计算书签、划线、笔记及部分不可见记录，某页可没有划线但仍有下一页。
- `--account alice` 可为另一位已授权用户使用独立本地配置，需要该用户单独扫码。名称不是番茄用户ID，不能凭别人的ID读取数据。配置隔离不替代系统用户权限，HTTP API不面向多租户或公开部署。

账号文件默认放在系统用户数据目录：Windows为 `%LOCALAPPDATA%/fanqie-mcp/accounts`，Linux/macOS为 `$XDG_STATE_HOME/fanqie-mcp/accounts`（未设置时使用 `~/.local/state/fanqie-mcp/accounts`）。可在启动进程中设置 `FANQIE_ACCOUNT_DIR` 指定共同目录；打包应用下系统可能将AppData重定向到应用专属目录。

凭据只写入本机，不出现在API响应、日志或发布包中；文件不保证在所有系统上加密，勿放进公开仓库或共享目录。不要将密码、Cookie发送给AI。退出登录清空本机该配置的凭据和待登录请求，不删除官方数据，也不会注销手机上的登录。账号请求不使用公开查询缓存；同一账号的并发操作通过本机文件锁互斥。

## 更新、配置与排错

- Skill更新：先备份或重命名原技能文件夹，再解压新ZIP或运行安装脚本；脚本不覆盖已有目录。
- 源码MCP更新：在无本地未提交修改的克隆中执行 `git pull --ff-only`、`npm ci`、`npm run build`，再重启MCP连接。有自己的修改时先自行保存，不要强制重置。
- 找不到node：确认 `node --version` 为22或更高，或在MCP配置的command中填写Node可执行文件绝对路径。
- API端口被占用：MCP自动使用随机端口；独立HTTP API可用 `FANQIE_LOCAL_PORT` 更换端口。
- 搜索降级：`source=local_index`只表示搜索已收录元数据，不代表全站搜索。
- 429限流：按返回的 `retry_after` 秒数等待后重试；MCP会在错误文字中提示等待时间。每次请求遇到短暂连接故障或502/503/504最多自动重试一次，不会对限流和权限错误反复请求。
- 503且 `error=LOCAL_BUSY`：本地请求队列繁忙，请减少并发后重试。
- 403：网站章节需要权限，当前版本无法读取；不会把试读片段当作完整正文。
- 匿名设备失效：评论、听书/漫画/短剧搜索使用App设备参数。可在启动进程环境中设置配套的 `FANQIE_DEVICE_ID` 与 `FANQIE_INSTALL_ID`。Skill与CLI不会读`.env`，也不会自动注册设备或激活会员。

MCP可将上述设备变量放进该服务器配置的 `env` 对象；只填写你自己的有效值。API Token与设备配置不要提交到公开仓库。完整配置项见 [API文档](../server/README.md)。

## 当前功能边界

本版实现包括小说、听书、漫画和短剧搜索，书评正文及游标翻页，小说详情、目录、网站可见正文、原始章节数据和最多20章批量读取。搜索失败可降级为本地已收录书籍检索，会明确标记 `source=local_index`。

书评正文与四类搜索已经接入本版MCP、Skill和API。安卓注册、App正文、音视频播放、iOS、整本下载和漫画任务不在本版提供范围内。MCP/Skill 不改变这些边界。见 [实验记录](../server/EXPERIMENTS.md) 和 [HTTP接口文档](../server/README.md)。

## 维护与验证

```sh
npm ci
npm run build
npm test
node "server/smoke.mjs"
```

Skill 的 `scripts/runtime/` 是核心代码的生成副本，没有第二套独立维护的爬虫源码；`npm run build` 自动同步这些文件。核心变更后运行构建、提交生成副本，并验证独立目录安装后的查询。发布时排除 `.env`、`.cache`、`node_modules`、原有个人工作流目录及签名实验临时文件。
