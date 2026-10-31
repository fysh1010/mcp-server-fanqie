# 番茄小说三件套 · 发布运行手册（PUBLISHING.md）

> 本文写给**带工具的 AI 执行者**（GPT/Codex 等）：照步骤执行即可完成全部发布工作。
> 所有命令在仓库根目录 `E:\WorkSpace\Projects\Fysh\AI\AI_Agent\fanqie-mcp`（Git 远端
> `https://github.com/fysh1010/mcp-server-fanqie.git`，分支 `main`）执行，除非另注明。
> 发布目标：① 代码与文档推送 GitHub；② DSH 插件发布 npm；③ 插件上架 awesome-dsh-plugin
> 社区市场（dshmarket 与 DSH 插件市场的收录源）。

---

## 0. 现状盘点（先读，避免重做）

### 0.1 已完成（勿重做）

| 事项 | 状态 |
| --- | --- |
| DSH 插件完整实现 | `plugins/deepseek-harness/`（Host 半 index.js + 浏览器半 client.js + vendor 业务核心 + 图标 + 中英文案 + 离线自测） |
| npm 发布改名 | 已把包名从 `@local/fanqie-reader` 改为 **`dsh-fanqie-reader`**（改动了 `package.json`、`cordis.patch.yml`、`client.js`、`README.md` 四处，全仓已无 `@local/` 残留） |
| SM3 兼容修复 | `server/sign.mjs`（纯 JS SM3 兜底，Electron 宿主缺 sm3 时生效）+ `server/sign.test.mjs`（3 条回归测试） |
| 测试全绿 | 仓库 `npm test` **37/37**；插件自测 `node --test plugins/deepseek-harness/test/host.test.mjs` **4/4**（改名后刚跑过） |
| 本机桌面切换 | 用户桌面 profile 已移除旧名包并重装 `dsh-fanqie-reader@0.4.0`（application: applied）——**本机不用再动** |
| 桌面真机验证 | 0.2.1-rc.5 桌面端实测：界面加载、搜索/详情/目录/阅读/书评/书架/划线全链路、扫码登录全流程、7 个 fanqie_* AI 工具实弹验证 |

### 0.2 待执行（本文步骤）

1. 补 README 三分法文档（步骤 1）
2. Git 提交 + 推送 GitHub + 仓库加话题（步骤 2）
3. npm 发布（步骤 3，**需要用户 npm 登录配合**）
4. awesome-dsh-plugin 市场上架 PR（步骤 4）
5. 发布后验证（步骤 5）

### 0.3 插件包文件清单（`plugins/deepseek-harness/`）

```
package.json          # name: dsh-fanqie-reader，dsh.bundle + dsh.client 声明，无构建步骤
cordis.patch.yml      # Loader 行：id= fanqie-reader，name= dsh-fanqie-reader
index.js              # Host 半：/api/fanqie/* 通道 + 7 个 fanqie_* 模型工具
client.js             # 浏览器半：右侧栏「番茄阅读」页面（纯 JS，无构建）
icon.svg              # 原创图标（市场用 PNG 见步骤 4）
locale/zh.json        # 插件管理器显示文案
locale/en.json
README.md             # 插件文档（安装/设计/工具/边界）
scripts/vendor.mjs    # 业务核心同步脚本（vendor/ 生成器 + 一致性校验）
test/host.test.mjs    # Host 半离线自测
vendor/               # 7 个核心文件同步副本（发布必须包含，运行时需要）
```

### 0.4 客观事实（执行时可直接引用）

- 桌面端版本 **0.2.1-rc.5** 实测通过；`engines.dsh` 下限 `>=0.2.0-rc.0`。
- npm 上 `dsh-fanqie-reader` 与 `@fysh925/dsh-fanqie-reader` **均未被占用**（已查 registry，404）。
- 仓库根包 `@fysh925/mcp-server-fanqie`（用户 npm 账号在 `@fysh925` scope 下有发布历史）。
- 插件包**没有** install/prepare/prepack 脚本、没有运行时 npm 依赖——`npm publish` 不会触发构建。
- 业务核心零依赖纯 ESM，`vendor/` 自包含；干净目录安装已验证可独立解析。
- 插件已在真实桌面端验证：`plugin_manager install_bundle` → `application: applied`，工具表可见 7 个 fanqie_* 工具。

---

## 1. 步骤一：README 三分法文档

仓库 `README.md` 现在主要写 MCP/Skill。**保留原文**，在靠前位置（如「功能特性」之后）插入一节，
把三种使用形态分开讲清楚。可直接粘贴的草稿：

```markdown
## 三种使用形态（MCP / Skill / DSH 插件）

同一套核心（`server/`）提供三种独立形态，按你的客户端选一种即可，互不冲突：

### 1. MCP 服务器（AI 客户端通用）
- 适用：Claude Code / Cursor / 任何支持 MCP 的客户端。
- 安装：`npm i -g @fysh925/mcp-server-fanqie`，客户端 MCP 配置指向 `mcp-server-fanqie`（stdio）。
- 能力：22 个工具——搜索（小说/听书/漫画/短剧）、书评、详情、目录、正文、批量正文，
  以及本人扫码登录后的书架、阅读进度、收藏划线。
- 详见 [docs/USAGE.md](docs/USAGE.md) 与 [docs/FUNCTIONS.md](docs/FUNCTIONS.md)。

### 2. 独立 Skill（免 npm 依赖，拷贝即用）
- 适用：任何能读技能目录的 Agent（含 DeepSeek Harness、Claude Code 等）。
- 安装：`node scripts/install-skill.mjs --target "<你的技能父目录>"`。
- 特点：技能包自带运行时副本（`skills/fanqie-novel/scripts/runtime/`），不依赖本仓库和 node_modules；
  需要 Node.js ≥ 22。

### 3. DeepSeek Harness 桌面插件（图形界面 + AI 问答）
- 适用：DeepSeek Harness 桌面/Web 端。
- 安装（二选一）：
  - 命令：`dsh plugin --profile <你的profile> add dsh-fanqie-reader`（npm 发布后可用）；
    桌面端也可在 插件管理页 安装。
  - 源码：插件管理页安装本仓库 `plugins/deepseek-harness/` 目录。
- 功能：右侧栏「番茄阅读」页面（搜索/封面/详情/目录/阅读器[日间/羊皮纸/夜间三主题]/书评/
  书架/划线），以及 7 个 `fanqie_*` 对话工具——在任意会话里直接问
  「我书架上有什么书」「把 XX 的划线读给我」即可。
- 详见 [plugins/deepseek-harness/README.md](plugins/deepseek-harness/README.md)。
```

---

## 2. 步骤二：Git 提交与推送 GitHub

### 2.1 提交范围

**要提交**：
- `plugins/deepseek-harness/`（整个插件包，含 vendor/ 与 test/）
- `server/sign.mjs`（SM3 兜底）、`server/sign.test.mjs`（新增回归测试）
- `README.md`（步骤 1 的三分法文档）
- 如做了市场图标：`docs/assets/icon-180.png`（见步骤 4.3）
- 若用户同意公开：`docs/DEEPSEEK_HARNESS_PLAN.md`、`docs/DEEPSEEK_HARNESS_开发任务书.md`
  （设计与任务文档，默认也提交；若用户反对则跳过）
- 本文档 `docs/PUBLISHING.md`

**不要提交**：`.spec-workflow/`（用户工具状态）、`.cache/`（本地缓存，已被 .gitignore 忽略则无需处理）。

### 2.2 命令

```powershell
git status                      # 核对改动清单
git add plugins/ server/sign.mjs server/sign.test.mjs README.md docs/
git commit -m "feat: add DeepSeek Harness plugin (dsh-fanqie-reader) with reader UI and fanqie_* chat tools

- plugins/deepseek-harness: right-sidebar reader (search/detail/toc/reader/comments),
  account views (QR login, bookshelf, positions, highlights), 7 fanqie_* agent tools
- server/sign.mjs: pure-JS SM3 fallback for Electron hosts without OpenSSL sm3
- docs: three-form usage guide (MCP / Skill / DSH plugin), publishing runbook"
git push origin main
```

> 提示：仓库提交风格多为中英混合短标题，上面的 message 可按需改成中文（例：
> `feat: 新增 DSH 桌面插件（番茄阅读）与 fanqie_* 对话工具`）。

### 2.3 仓库加话题（市场上架的硬性要求之一）

awesome-dsh-plugin 要求仓库带 `dsh-plugin` 话题。有 `gh` CLI 时：

```powershell
gh repo edit fysh1010/mcp-server-fanqie --add-topic dsh-plugin --add-topic fanqie --add-topic mcp --add-topic novel-reader
```

没有 gh 就用 GitHub API（PAT 需 repo 权限；**先 GET 现有 topics 再整体 PATCH**，避免覆盖掉已有话题）：

```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/fysh1010/mcp-server-fanqie/topics
# 把返回的 names 数组补上 "dsh-plugin" 等，再：
curl -X PATCH -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/fysh1010/mcp-server-fanqie/topics \
  -d '{"names":["...原有...","dsh-plugin","fanqie","mcp","novel-reader"]}'
```

---

## 3. 步骤三：npm 发布

包目录 `plugins/deepseek-harness/`，包名 **`dsh-fanqie-reader`**（已确认未被占用）。

```powershell
# 1) 登录用户 npm 账号（可能要浏览器验证/2FA，需要用户本人配合）
npm login

# 2) 发布（在插件包目录执行；无构建脚本、无依赖，直接发）
cd plugins/deepseek-harness
npm publish --access public

# 3) 验证
npm view dsh-fanqie-reader version description repository
```

发布后安装命令即生效：`dsh plugin --profile <profile> add dsh-fanqie-reader`。

**注意事项**：
- `package.json` 的 `repository.directory: "plugins/deepseek-harness"` 必须保留——
  awesome 审核会核对 npm 包与收录仓库的对应关系。
- `files` 字段已包含 `vendor/`（运行必需）、`locale/`、`icon.svg`、`cordis.patch.yml`、`index.js`、`client.js`。
  发布前可 `npm pack --dry-run` 核对文件清单。
- 若 npm 账号开了 2FA，`npm publish` 时会要 OTP，请用户配合输入。
- 发布失败不要改包名硬闯；先看错误（常见：未登录、OTP、包名冲突）。

---

## 4. 步骤四：awesome-dsh-plugin 市场上架（PR）

收录源仓库：`https://github.com/awesome-dsh-plugin/awesome-dsh-plugin`
（dshmarket 与 DSH「插件 → 发现 → 索引源」的 `dsh-plugin-catalog` 都从它生成）。

### 4.1 规则红线（来自仓库 contributing.md，CI + 人工审核）

- **一个 PR 只加一个文件**：`data/plugins/<文件名>.yaml`，不改 README（README 由维护者生成）。
- 仓库 ≥ 1 天老（本仓库早已满足）、持续维护、包里有真实的 `dsh.bundle` 清单（✓ 已有）。
- 描述必须**准确、无营销腔**，与代码一致；写了数字/命令就要兑现。
- 类目选「它做什么」而不是「想出现在哪」。
- `description` 含英文冒号必须加引号；`en` 必填，`zh` 建议提供。
- 图标只能用 **GitHub 托管的 png/jpg/jpeg/webp**；SVG 与第三方图床会被拒。
- 不要在别人条目附近乱动；PR 只碰自己的文件。

### 4.2 提交的 YAML 文件

- 路径：`data/plugins/fysh1010__mcp-server-fanqie--plugins--deepseek-harness.yaml`
  （monorepo 子包命名：`owner__repo--<路径中 / 换 -->`）。
- 内容（可直接使用）：

```yaml
url: https://github.com/fysh1010/mcp-server-fanqie/tree/main/plugins/deepseek-harness
name: fysh1010/mcp-server-fanqie#deepseek-harness
category: ui
description:
  en: 'Fanqie novel reader for the DeepSeek Harness right sidebar: search novels, audiobooks, manga and short-drama metadata, browse covers and chapter lists, read website-visible chapters with day/paper/night reading themes, and after QR sign-in view your bookshelf, synced reading positions and saved highlights; seven fanqie_* chat tools answer reading questions from any conversation.'
  zh: 'DeepSeek Harness 右侧栏番茄阅读：搜小说/听书/漫画/短剧元数据、看封面与目录、以日间/羊皮纸/夜间主题阅读官网可见章节；本人扫码后可查看书架、同步阅读位置与收藏划线；另有 fanqie_* 对话工具，在任意会话里问答你的阅读内容。'
icon: https://raw.githubusercontent.com/fysh1010/mcp-server-fanqie/main/docs/assets/icon-180.png
```

> 若 CI 对 monorepo 条目的 `name` 提出异议（它期望 `owner/repo#子路径` 形式），
> 改成 `fysh1010/mcp-server-fanqie#plugins--deepseek-harness` 再推同一分支即可，无需新 PR。

### 4.3 图标（必须是 GitHub 托管的光栅图）

**已就绪**：`docs/assets/icon-180.png`（256×256 PNG，由 `scripts/make_icon.py` 生成，
与 `icon.svg` 同一设计，已验证可正常渲染）。随步骤 2 一起提交推送即可；
`icon:` 链接必须指向 raw.githubusercontent.com，且文件**已推送**到 GitHub 后才能提 PR。
如需换图：让用户给一张 256×256 PNG 覆盖 `docs/assets/icon-180.png` 即可。

### 4.4 截图（可选但推荐，App Store 式展示）

没有截图就跳过（店面会回退到 README 提图）。要做的话：
1. 截 1–4 张插件界面图（搜索网格 / 阅读器 / 我的页），存 `docs/assets/screenshot-*.png`；
2. 在插件包 `plugins/deepseek-harness/` 下新建 `screenshots.json`：
   ```json
   ["https://raw.githubusercontent.com/fysh1010/mcp-server-fanqie/main/docs/assets/screenshot-1.png",
    "https://raw.githubusercontent.com/fysh1010/mcp-server-fanqie/main/docs/assets/screenshot-2.png"]
   ```
3. 一并提交推送。

### 4.5 提 PR

1. Fork `awesome-dsh-plugin/awesome-dsh-plugin` 到用户账号；
2. 建分支（如 `add-dsh-fanqie-reader`），只放上面那一个 YAML 文件；
3. 开 PR，标题：`Add fysh1010/mcp-server-fanqie#deepseek-harness (dsh-fanqie-reader)`；
   正文简述：DSH 右侧栏番茄阅读插件，npm 包 `dsh-fanqie-reader`，含 7 个 fanqie_* 对话工具；
4. 等 CI 绿 + 维护者审核（人工审描述准确性与类目；被要求改就改完推同一分支）。

> 没有该仓库的凭据时：把 4.2 的 YAML 与 4.3 的图标链接整理好发给用户，让他手动
> 在 GitHub 网页上 Fork → 新建文件 → 提 PR（网页操作 2 分钟）。

---

## 5. 步骤五：发布后验证清单

- [ ] `npm view dsh-fanqie-reader` 有版本（0.4.0）与正确 repository 链接；
- [ ] 干净 profile 安装：`dsh plugin --profile <test-profile> add dsh-fanqie-reader` 成功且无构建脚本告警；
- [ ] 安装后重启/刷新，右侧栏开始页出现「番茄阅读」胶囊，搜索能出封面（用户已实测过同代码路径）；
- [ ] dshmarket 或 DSH「插件 → 发现」搜「番茄」/「fanqie」可见条目（收录 PR 合并后 1 天内同步）；
- [ ] 对话里出现 fanqie_* 工具（问一句「我书架上有什么书」实测）；
- [ ] `git log` 里提交完整、`.spec-workflow/` 未被提交；
- [ ] 回报：npm 版本号、PR 链接、验证结果截图/描述。

## 6. 风险与红线（执行全程遵守）

- **不要**动用户数据、`D:\Tools\.dsh` 配置、`.env`、`.credentials.yaml`、会话与账号数据；
- **不要**改 `server/` 业务行为（sign.mjs 的 SM3 兜底已验证，勿动）；
- **不要**提交 `.spec-workflow/`、`.cache/`；
- **不要**把插件包 `private: true` 加回去（会拒发）；不要删 `repository.directory`；
- npm 登录、2FA、GitHub PAT 均需用户本人配合；不要试图读取或输出任何凭据明文；
- awesome 审核是人工的，反馈要求改描述/类目属正常，按意见改后推同一分支即可；
- 发布版本号策略：当前 0.4.0；后续改动先改 `package.json` version 再 `npm publish`。
