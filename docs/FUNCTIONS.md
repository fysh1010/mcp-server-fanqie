# 功能与方法清单：MCP、Skill 与 Harness 插件

MCP、独立 Skill、Harness 插件、CLI 和 HTTP API 复用同一数据核心。下表详细列出 MCP、Skill/CLI 与 HTTP 方法；Harness 提供图形界面及7个单独注册的对话工具，见本页后文。安装与登录流程见 [使用指南](USAGE.md)，HTTP 参数见 [接口文档](../server/README.md)。

## DeepSeek Harness 插件

插件右侧栏提供四类搜索、封面、书籍详情、目录、网站可见正文、书评，以及本人扫码后的书架、已同步阅读位置和收藏划线。以下是其对话工具；它们不是22个 MCP 工具的完整映射。

| Harness 工具 | 功能 |
| --- | --- |
| `fanqie_search_books` | 小说、听书、漫画和短剧元数据搜索 |
| `fanqie_book_detail` | 查看书籍详情 |
| `fanqie_book_directory` | 分页查看目录 |
| `fanqie_read_chapter` | 读取网站可见章节正文片段 |
| `fanqie_book_comments` | 获取书评 |
| `fanqie_my_bookshelf` | 查看本人书架及已同步位置 |
| `fanqie_my_highlights` | 查看本人收藏划线 |

Harness 账号登录和退出在插件界面操作；漫画、听书和短剧只支持搜索元数据。安装方式见 [插件文档](../plugins/deepseek-harness/README.md)。

## 公开查询：无需账号登录

| 能做什么 | MCP工具 | Skill/CLI命令 | HTTP路径（GET） |
| --- | --- | --- | --- |
| 按书名、作者或关键词搜索小说 | `search_books`，tab_type=3 | `search "关键词"` | `/api/search` |
| 搜索听书 | `search_books`，tab_type=2 | `search "关键词" --type audiobook` | `/api/search` |
| 搜索漫画 | `search_books`，tab_type=8 | `search "关键词" --type manga` | `/api/search` |
| 搜索短剧 | `search_books`，tab_type=11 | `search "关键词" --type drama` | `/api/search` |
| 查看小说详情、简介、作者、字数等 | `get_book_detail` | `detail <book_id>` | `/api/detail` |
| 按页查看含分卷信息的小说目录 | `get_book_directory` | `directory <book_id>` | `/api/book` |
| 获取只有标题和ID的简化目录 | `get_simple_directory` | 无独立命令，使用directory | `/api/directory` |
| 读取网站可见的单章正文 | `get_chapter_content` | `chapter <item_id>` | `/api/chapter` |
| 通过统一入口读取单章或批量正文 | `get_content` | `chapter`或`batch` | `/api/content` |
| 获取原始章节数据及解析正文 | `get_raw_content` | `raw <item_id>` | `/api/raw_full` |
| 获取书评正文、评分、点赞、回复数并翻页 | `get_comments` | `comments <book_id>` | `/api/comment` |

目录在MCP/Skill中默认50章一页，上限200；HTTP不传分页参数时仍返回全目录。批量正文上限20章，要求章节属于指定书籍。网站可见正文不保证与App完整正文一致；锁定或需要授权的章节明确报错。评论是整本书的书评，不含章评、段评和楼中楼正文。

## 本人账号：扫码授权后使用

| 能做什么 | MCP工具 | Skill/CLI命令 | HTTP方法与路径 |
| --- | --- | --- | --- |
| 生成官方登录二维码 | `start_account_login` | `login-start` | POST `/api/account/login/start` |
| 检查扫码和确认结果 | `poll_account_login` | `login-poll <login_id>` | POST `/api/account/login/poll` |
| 检查登录状态是否有效 | `get_account_status` | `account-status` | GET `/api/account/status` |
| 查看当前书架及已同步的阅读位置 | `get_my_bookshelf` | `bookshelf` | GET `/api/account/bookshelf` |
| 查看云端阅读记录、书名和当前章节 | `get_my_reading_progress` | `reading-progress [book_id]` | GET `/api/account/progress` |
| 列出有收藏的书及划线、书签、笔记数量 | `get_my_highlight_books` | `highlight-books` | GET `/api/account/highlight-books` |
| 读取收藏划线原文、所在章节、位置和修改时间 | `get_my_highlights` | `highlights <book_id>` | GET `/api/account/highlights` |
| 清除本机保存的凭据和待登录请求 | `logout_account` | `logout` | POST `/api/account/logout` |

默认本地配置名为default。每种入口均支持account，另一账号须单独扫码。配置名不是番茄用户ID，只读取当前已授权账号的数据。书架、进度、有收藏的书籍列表为不同数据集合；进度只代表上游可用记录，不能当作完整历史阅读记录。

划线原文位于 `highlights[].text`。后续页必须使用返回的cursor；上游同时计算其他记录，因此一页没有划线也可能仍有下一页。划线正文不截断。笔记数量可读取，独立撰写的笔记/想法正文尚未接入。

## 辅助命令与兼容入口

| 功能 | MCP工具 | Skill/CLI命令 | HTTP方法与路径 |
| --- | --- | --- | --- |
| 查询能力清单 | 无 | `capabilities` | GET `/health` |
| 将指定书籍元数据录入本地索引 | 无 | `index-import <book_id>` | POST `/api/index/import` |
| 刷新官网首页可发现的书籍元数据索引 | 无 | `index-refresh` | POST `/api/index/refresh` |
| 显示命令帮助 | 无 | `help` | 无 |
| 查询设备池兼容信息 | `get_device_pool_status` | 无 | GET `/api/device/pool` |
| 查询网页模式状态 | `get_device_status` | 无 | GET `/api/device/status` |

最后两个接口只说明当前网页模式，不创建、验证或管理真实App设备池。本地索引只在小说官方搜索故障时作为有限后备，不代表全站收录。

## 保留名称但未实现的方法

| MCP工具 | HTTP路径 | 实际行为 |
| --- | --- | --- |
| `register_device` | `/api/device/register` | 返回501 |
| `get_ios_content` | `/api/ios/content` | 返回501 |
| `register_ios_device` | `/api/ios/register` | 返回501 |
| `get_manga_progress` | `/api/manga/progress/:taskId` | 返回501 |

`get_content`的听书、漫画、短剧内容模式以及整本下载模式同样未实现，返回501。Skill不为这些未实现功能提供命令。

当前MCP注册22个工具：16个公开查询/本人账号工具、2个状态兼容工具、4个未实现工具。Skill/CLI有19个命令，包含help和capabilities。账号能力为只读，不修改官方书架、阅读进度或收藏；无内置JSON/Markdown/EPUB导出命令。

## 可以直接对AI说的话

- “搜索《三体》，核对作者，列出前20章。”
- “读取这本书第三章，概括主要内容。”
- “取这本书20条书评，整理读者评价。”
- “搜索带‘重生’的短剧，给我下一页结果。”
- “连接我的番茄账号，让我扫码。”
- “查看我的书架，告诉我每本书读到哪一章。”
- “列出我有划线的书，读取其中一本的全部收藏划线并按章节整理。”
- “断开我的番茄账号，只清除本机登录。”
