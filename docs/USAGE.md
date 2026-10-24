# MCP 与 Skill 双入口

本仓库保留一个数据核心，提供 MCP、Skill/CLI 和可选 HTTP API。当前 `0.2.0-dev.5` 为GitHub开发预览版。[下载Release](https://github.com/fysh1010/mcp-server-fanqie/releases/tag/v0.2.0-dev.5)。本次不发布npm，公共registry中的旧版不包含这些新功能。

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

无需先执行 `start:api`。已设置 `FANQIE_API_BASE` 时，会连接指定 API 而不自动启动；未设置时完全本地启动。普通用户无需番茄账号或预设密码。

## Skill 安装

### 直接安装独立ZIP

1. 下载Release中的 `fanqie-novel-skill-0.2.0-dev.5.zip`。
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

CLI/Skill 不读 `.env`，可从调用进程继承 `FANQIE_DATA_DIR` 指定索引目录；默认只在需要保存索引时写入当前工作目录的 `.cache/fanqie`。不要把本地索引或配置中的Token提交到GitHub。

## 更新、配置与排错

- Skill更新：先备份或重命名原技能文件夹，再解压新ZIP或运行安装脚本；脚本不覆盖已有目录。
- 源码MCP更新：在无本地未提交修改的克隆中执行 `git pull --ff-only`、`npm ci`、`npm run build`，再重启MCP连接。有自己的修改时先自行保存，不要强制重置。
- 找不到node：确认 `node --version` 为22或更高，或在MCP配置的command中填写Node可执行文件绝对路径。
- API端口被占用：MCP自动使用随机端口；独立HTTP API可用 `FANQIE_LOCAL_PORT` 更换端口。
- 搜索降级：`source=local_index`只表示搜索已收录元数据，不代表全站搜索。
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
