# 番茄小说 MCP 服务器

<p align="center">
  <img src="https://p3-reading-sign.fqnovelpic.com/tos-cn-i-1yzifmftcy/20c327fd5455431ea1d9f1e8989f20aa~tplv-s85hriknmn-jpeg-v1:300:0.jpeg?lk3s=6668da9f&x-expires=1771087684&x-signature=QWHr%2BEOeew%2FMPaY1z2Ul8U0MIsM%3D" alt="番茄小说" width="300" />
</p>

<p align="center">
  <a href="https://github.com/freestylefly/mcp-server-weread/blob/main/LICENSE"><img src="https://img.shields.io/github/license/freestylefly/mcp-server-weread?color=rgb(25%2C%20121%2C%20255)" alt="The MIT License"></a>
  <a href="https://github.com/freestylefly/mcp-server-weread"><img src="https://img.shields.io/github/forks/freestylefly/mcp-server-weread?color=green" alt="Forks"></a>
  <a href="https://github.com/freestylefly/mcp-server-weread"><img src="https://img.shields.io/github/stars/freestylefly/mcp-server-weread?style=flat-square&color=rgb(25%2C%20121%2C%20255)" alt="Stars"></a>
</p>

一个为番茄小说（FanQie Novel）提供 MCP（Model Context Protocol）服务的工具，支持将番茄小说的书籍、目录、章节内容等数据提供给支持 MCP 协议的大语言模型客户端，如 Claude Desktop、Cursor。

## ✨ 功能特点

- 🔍 **搜索功能** - 支持搜索小说、听书、漫画、短剧
- 📖 **书籍信息** - 获取书籍详情、完整目录、简化目录
- 📄 **内容获取** - 获取章节内容，支持多种内容类型
- 💬 **评论功能** - 获取书籍评论，支持分页
- 📱 **设备管理** - 支持 Android 和 iOS 设备池管理
- 🎯 **多平台支持** - 支持获取 iOS 平台特定内容

## 🛠️ 主要工具

### 1. search_books - 搜索书籍
搜索番茄小说平台上的书籍、听书、漫画或短剧。

**参数：**
- `key` (必需): 搜索关键词
- `tab_type` (可选): 内容类型
  - `3` - 小说（默认）
  - `2` - 听书
  - `8` - 漫画
  - `11` - 短剧
- `offset` (可选): 分页偏移量，默认为 0

**示例：**
```
搜索"修仙"关键词的小说
搜索"历史"关键词的漫画
```

### 2. get_book_detail - 获取书籍详情
获取指定书籍的详细信息，包括书名、作者、简介、封面等元数据。

**参数：**
- `book_id` (必需): 书籍 ID

**返回信息：**
- 书名、作者、译者
- 简介、封面
- 分类、标签
- 字数、评分等

### 3. get_book_directory - 获取书籍完整目录
获取书籍的完整章节目录列表，包括所有卷和章节信息。

**参数：**
- `book_id` (必需): 书籍 ID

**返回信息：**
- 所有卷的标题和 ID
- 每卷下的章节列表
- 章节标题和 ID

### 4. get_simple_directory - 获取简化目录
获取书籍的简化目录信息，仅包含章节标题和 ID。

**参数：**
- `book_id` (必需): 书籍 ID

**用途：**
- 快速获取章节列表
- 用于批量获取章节内容

### 5. get_chapter_content - 获取章节内容（简单接口）
获取指定章节的文本内容。

**参数：**
- `item_id` (必需): 章节 ID

**返回：**
- 章节文本内容

### 6. get_content - 获取内容（统一接口）
统一的内容获取接口，支持多种内容类型。

**参数：**
- `tab` (必需): 内容类型
  - `novel` - 小说章节
  - `audiobook` - 有声书音频
  - `short drama` - 短剧视频
  - `comic` - 漫画图片
  - `batch` - 批量获取多个章节
- `item_id` (可选): 单个章节/视频/漫画 ID（非批量时必需）
- `item_ids` (可选): 多个章节 ID，逗号分隔（批量时必需）
- `book_id` (可选): 书籍 ID（批量获取时必需）
- `show_html` (可选): 漫画是否返回 HTML 格式（0 或 1，默认 0）
- `tone_id` (可选): 有声书音色 ID（听书时使用，默认 0）

**使用场景：**
- 获取单个小说章节：`tab=novel, item_id=章节ID`
- 获取有声书音频：`tab=audiobook, item_id=章节ID`
- 获取漫画图片：`tab=comic, item_id=章节ID`
- 批量获取章节：`tab=batch, item_ids=章节ID1,章节ID2, book_id=书籍ID`

### 7. get_comments - 获取评论
获取书籍、章节或其他内容的评论列表，支持分页。

**参数：**
- `book_id` (必需): 书籍 ID
- `count` (可选): 每页数量，默认 20
- `offset` (可选): 偏移量，默认 0

### 8. get_device_pool_status - 获取设备池状态
查看设备池的整体状态，包括所有注册设备。

**用途：**
- 检查可用设备
- 监控设备健康状态

### 9. register_device - 注册设备
注册新的设备到设备池。

**参数：**
- `platform` (可选): 平台类型
  - `android`（默认）
  - `ios`

### 10. get_device_status - 获取设备状态
查看指定平台的设备状态。

**参数：**
- `platform` (可选): 平台类型
  - `android`（默认）
  - `ios`

## 📦 安装与使用

### 先决条件

- Node.js 16.x 或更高版本
- TypeScript 5.x 或更高版本

### 安装

#### 方式一：全局安装（推荐）

```bash
npm install -g mcp-server-fanqie
```

#### 方式二：本地安装

```bash
cd fanqie-mcp
npm install
npm run build
```

### 与 Claude Desktop 集成

#### 方式一：通过 npx 使用（最简单）

1. 打开 Claude Desktop
2. 进入设置 → MCP 配置
3. 添加工具，使用以下 JSON 配置：

```json
{
  "mcpServers": {
    "mcp-server-fanqie": {
      "command": "npx",
      "args": ["-y", "mcp-server-fanqie"]
    }
  }
}
```

#### 方式二：全局安装后使用

1. 全局安装包：
```bash
npm install -g mcp-server-fanqie
```

2. 在 Claude 配置中使用：
```json
{
  "mcpServers": {
    "mcp-server-fanqie": {
      "command": "mcp-server-fanqie"
    }
  }
}
```

#### 方式三：本地构建后使用

1. 进入项目目录并构建：
```bash
cd fanqie-mcp
npm install
npm run build
```

2. 在 Claude 配置中使用：
```json
{
  "mcpServers": {
    "m友-server-fanqie": {
      "command": "node",
      "args": ["E:\\AI\\AI_Agent\\mcp-server-weread\\fanqie-mcp\\build\\index.js"]
    }
  }
}
```

**注意：** 路径需要根据你的实际安装位置调整。

## 🎯 使用示例

### 示例 1：搜索小说

**用户：**
```
帮我搜索关于修仙的小说
```

**LLM 调用：**
```
search_books(key="修仙", tab_type=3, offset=0)
```

**返回结果：**
```json
{
  "keyword": "修仙",
  "tab_type": 3,
  "offset": 0,
  "results": [
    {
      "book_id": "7233628636023098407",
      "book_name": "修罗武神",
      "author": "善良的蜜蜂",
      "cover": "...",
      "abstract": "...",
      "total_words": 1000000
    }
    // ... 更多搜索结果
  ]
}
```

### 示例 2：获取书籍详情

**用户：**
```
帮我查看《修罗武神》的详细信息
```

**LLM 调用：**
```
get_book_detail(book_id="7233628636023098407")
```

**返回结果：**
```json
{
  "book_id": "7233628636023098407",
  "detail": {
    "book_name": "修罗武神",
    "author": "善良的蜜蜂",
    "abstract": "一个关于修仙的故事...",
    "cover": "...",
    "total_words": 1000000,
    "rating": 8.5,
    "category": "玄幻"
  }
}
```

### 示例 3：获取书籍目录

**用户：**
```
帮我获取《修罗武神》的目录
```

**LLM 调用：**
```
get_book_directory(book_id="7233628636023098407")
```

**返回结果：**
```json
{
  "book_id": "7233628636023098407",
  "directory": {
    "volume_1": {
      "volume_id": "xxx",
      "volume_title": "第一卷",
      "chapters": [
        {"chapter_id": "xxx", "chapter_title": "第一章"},
        {"chapter_id": "xxx", "chapter_title": "第二章"}
      ]
    }
  }
}
```

### 示例 4：阅读章节内容

**用户：**
```
我想读《修罗武神》的第一章
```

**LLM 调用：**
```
get_chapter_content(item_id="7233628684760910863")
```

**返回结果：**
```json
{
  "item_id": "7233628684760910863",
  "content": "第一章的内容..."
}
```

### 示例 5：批量获取章节

**用户：**
```
帮我获取《修罗武神》前 5 章的内容
```

**LLM 调用：**
```
get_content(tab="batch", item_ids="章节ID1,章节ID2,章节ID3,章节ID4,章节ID5", book_id="7233628636023098407")
```

### 示例 6：获取评论

**用户：**
```
《修罗武神》有什么热门评论？
```

**LLM 调用：**
```
get_comments(book_id="7233628636023098407", count=10, offset=0)
```

## 🔧 开发

### 构建项目

```bash
cd fanqie-mcp
npm install
npm run build
```

### 运行服务器

```bash
npm run start
```

### 运行测试

```bash
npm test
```

### 使用 MCP Inspector 测试

```bash
npm run inspector
```

## 📁 项目结构

```
fanqie-mcp/
├── src/
│   ├── FanQieApi.ts      # 番茄小说 API 封装类
│   └── index.ts            # MCP 服务器主入口
├── build/                  # 编译输出目录
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript 配置
├── .gitignore              # Git 忽略文件
└── README.md               # 说明文档
```

## 🔗 相关链接

- [番茄小说官网](https://fanqienovel.com/)
- [番茄小说 API 文档](http://103.236.91.147:9999/docs)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [微信读书 MCP 服务器](https://github.com/freestylefly/mcp-server-weread)

## 📝 更新日志

### v0.1.0 (2025-01-16)
- 🎉 首次发布
- ✅ 实现搜索功能
- ✅ 实现书籍信息获取
- ✅ 实现目录和章节内容获取
- ✅ 实现评论功能
- ✅ 实现设备管理功能
- ✅ 支持 iOS 平台特定内容获取

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

本项目基于 [番茄小说 API](http://103.236.91.147:9999) 开发
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [微信读书 MCP 服务器](https://github.com/freestylefly/mcp-server-weread) - 提供了开发参考

---

**注意：** 本项目仅供学习和研究使用，请遵守番茄小说的使用条款和 API 使用规范。