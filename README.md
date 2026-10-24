# 番茄小说：Skill、MCP 与本地 API

## Skill 与 MCP 双入口（0.2.0-dev.5）

同一套官方数据查询代码，既可作为 **Skill 本地脚本**，也可作为 **MCP 工具** 使用。无需依赖旧的第三方番茄 API 站点。

本版为 **GitHub 开发预览版**，普通 npm registry 中的旧版不代表本仓库的新功能。[下载 v0.2.0-dev.5](https://github.com/fysh1010/mcp-server-fanqie/releases/tag/v0.2.0-dev.5) · [详细安装指南](docs/USAGE.md) · [HTTP API 文档](server/README.md)

| 功能 | 状态 |
| --- | --- |
| 小说、听书、漫画、短剧搜索 | 支持；官方可能混入推荐 |
| 小说详情、目录、网站可见章节正文 | 支持，不保证与 App 全文完全一致 |
| 书评正文、评分、点赞数、回复数 | 支持，cursor翻页，不在客户端截断正文 |
| 原始章节数据、批量正文 | 支持，每批最多20章 |
| 本地元数据索引 | 支持；小说上游失败时明确标记降级 |
| 漫画内容、短剧/听书播放、iOS、整本下载 | 不提供 |

评论指整本书的书评，不是章评、段评或楼中楼。本版没有完整复刻旧服务的全部功能。

## 选择入口

| 使用方式 | 前置要求 | 是否需要手动启动API |
| --- | --- | --- |
| MCP | Node.js 22+，安装项目依赖，支持MCP的客户端 | 不需要，MCP自动启动 |
| Skill | Node.js 22+，支持Skills且能执行本地脚本的客户端 | 不需要，不启动HTTP服务 |

## 安装 Skill（推荐本地脚本用户）

1. 下载 [完整Skill ZIP](https://github.com/fysh1010/mcp-server-fanqie/releases/download/v0.2.0-dev.5/fanqie-novel-skill-0.2.0-dev.5.zip)。
2. 解压后，将整个 `fanqie-novel` 文件夹放进客户端的技能目录；Codex示例为 `$HOME/.agents/skills/`。不要只复制 `SKILL.md`。
3. 确认本机有 Node.js 22+，让客户端重新发现技能。
4. 输入 `$fanqie-novel 搜索《三体》，获取书评正文`。

Skill已包含全部运行代码，不需要npm依赖、Python、浏览器、MCP或本地API服务；仍需联网访问番茄官方站点。

也可通过支持GitHub仓库路径的技能安装器安装 `fysh1010/mcp-server-fanqie` 的 `skills/fanqie-novel` 目录。

## 安装 MCP

```sh
git clone https://github.com/fysh1010/mcp-server-fanqie.git
cd mcp-server-fanqie
npm ci
npm run build
```

在MCP客户端配置中加入以下内容，把路径替换为你自己的绝对路径；路径含空格也保持为单个args元素：

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

客户端自动启动本地服务，无需先执行 `start:api`。可以直接让AI搜索小说、查看目录或获取书评正文。若提示找不到node，请在command中填写本机Node可执行文件绝对路径。

## 从源码安装 Skill 或直接使用命令行

**Skill：** 在仓库执行安装脚本（以Codex技能父目录为例）：

```powershell
node "scripts/install-skill.mjs" --target "$HOME/.agents/skills"
```

脚本将创建包含全部运行文件的 `fanqie-novel` 技能，目标已存在时不会覆盖。仅安装Skill不需要npm依赖。安装后可使用 `$fanqie-novel 搜索《三体》，查看目录`。其他客户端请指定其各自的Skills目录。

**直接试用CLI：** `node "server/cli.mjs" search "三体"`。

```sh
node "server/cli.mjs" comments "7143038691944959011" --count 20
node "server/cli.mjs" search "绝世武神" --type manga
node "server/cli.mjs" search "重生" --type drama
```

当前可用：小说、听书、漫画和短剧搜索，书评正文与游标翻页，小说详情、目录、网站可见正文与批量正文。漫画内容和短剧播放不在本版范围内；不是旧服务全部功能的完整复刻。请安装完整技能目录，不要只复制SKILL.md。


## 更新与常见问题

安装脚本拒绝覆盖已有技能。更新前备份或重命名已有 `fanqie-novel` 文件夹，再安装新版；客户端需要重新加载技能。

评论正文在 `data.comments[].text`，`content`为同值别名。翻页时将返回的cursor原样传回；MCP与Skill都支持。

评论/分类搜索若提示匿名设备失效，可配置配套的 `FANQIE_DEVICE_ID`、`FANQIE_INSTALL_ID`。不会自动注册设备或激活会员。详细配置见安装指南。

本次发布到GitHub；不要使用公共npm registry中的旧包来验证新功能。源码依赖仍有已知审计项，本版按开发预览版发布，详见Release说明。

安装完整说明见 [双入口使用指南](docs/USAGE.md)，HTTP接口见 [API文档](server/README.md)，实验结果见 [功能复测记录](server/EXPERIMENTS.md)。

## 开发与验证

```sh
npm ci
npm run build
npm test
node "server/smoke.mjs"
```

`server/`维护数据核心，`src/`维护MCP封装；`skills/fanqie-novel/scripts/runtime/`由构建自动同步，无需维护两套爬虫。当前版本为开发预览版，公共npm registry中的旧版本不代表此源码的能力。

## 许可证

[MIT](LICENSE)。本项目为非官方工具，内容版权归原平台及权利人所有。本地签名实现的来源与许可证见 [第三方说明](THIRD_PARTY_NOTICES.md)。
