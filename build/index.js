#!/usr/bin/env node
/**
 * 番茄小说 MCP 服务器
 * 基于番茄小说API，提供书籍搜索、详情、目录、章节内容等功能
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { FanQieApi } from "./FanQieApi.js";
const accountProperty = { type: 'string', pattern: '^[a-z0-9][a-z0-9_-]{0,31}$', default: 'default', description: 'Local profile name. Each profile must be authorized by its owner.' };
const accountActions = {
    start_account_login: 'login/start', poll_account_login: 'login/poll', get_account_status: 'status',
    get_my_bookshelf: 'bookshelf', get_my_reading_progress: 'progress', logout_account: 'logout',
    get_my_highlight_books: 'highlight-books', get_my_highlights: 'highlights',
};
const accountTools = [
    { name: 'start_account_login', description: 'Start official QR login for the user\'s own account. Show the QR image and instructions; the user must scan and confirm on their phone.',
        inputSchema: { type: 'object', properties: { account: accountProperty } } },
    { name: 'poll_account_login', description: 'Check a requested QR login, no more often than every 3 seconds. Never ask the user to paste passwords or cookies.',
        inputSchema: { type: 'object', properties: { account: accountProperty, login_id: { type: 'string' } }, required: ['login_id'] } },
    { name: 'get_account_status', description: 'Check whether this local profile has a valid official account session.',
        inputSchema: { type: 'object', properties: { account: accountProperty } } },
    { name: 'get_my_bookshelf', description: 'Read the authorized account\'s current official bookshelf with synced reading positions. This is not the entire lifetime reading history.',
        inputSchema: { type: 'object', properties: { account: accountProperty, offset: { type: 'integer', minimum: 0, default: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } } } },
    { name: 'get_my_reading_progress', description: 'Read available cloud reading positions for the authorized account, optionally filtered by book_id. Progress units are upstream values; do not assume percentages.',
        inputSchema: { type: 'object', properties: { account: accountProperty, book_id: { type: 'string' }, offset: { type: 'integer', minimum: 0, default: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } } } },
    { name: 'logout_account', description: 'Forget this local profile\'s credentials and pending login. Does not delete the official bookshelf or log out other devices.',
        inputSchema: { type: 'object', properties: { account: accountProperty } } },
    { name: 'get_my_highlight_books', description: 'List books with the authorized user\'s saved highlights/bookmarks and counts. This is separate from the current bookshelf. Notes counts do not imply notes text is supported.',
        inputSchema: { type: 'object', properties: { account: accountProperty, offset: { type: 'integer', minimum: 0, default: 0 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 } } } },
    { name: 'get_my_highlights', description: 'Read the authorized user\'s saved underlined text, chapter and positions. Pass returned cursor unchanged until has_more=false; a page may contain zero highlights when upstream rows are bookmarks. Does not read separate personal note text.',
        inputSchema: { type: 'object', properties: { account: accountProperty, book_id: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }, cursor: { type: 'string' } }, required: ['book_id'] } },
];
/**
 * 创建MCP服务器，只提供tools能力
 */
const server = new Server({
    name: "mcp-server-fanqie",
    version: "0.2.0-dev.6",
}, {
    capabilities: {
        tools: {},
    },
});
/**
 * 列出可用的工具
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            ...accountTools,
            {
                name: "search_books",
                description: "Search for books on FanQie (Tomato) Novel platform by keywords. Supports searching for novels, audiobooks, comics, and short dramas.",
                inputSchema: {
                    type: "object",
                    properties: {
                        key: {
                            type: "string",
                            description: "Search keyword to find books"
                        },
                        tab_type: {
                            type: "integer",
                            description: "Content type: 3=novel, 2=audiobook, 8=comic, 11=short drama",
                            enum: [3, 2, 8, 11],
                            default: 3
                        },
                        offset: {
                            type: "integer",
                            description: "Offset for pagination",
                            default: 0
                        },
                        cursor: {
                            type: "string",
                            description: "For audiobook/comic/drama search, pass the returned cursor unchanged. Novel search uses offset."
                        }
                    },
                    required: ["key"]
                }
            },
            {
                name: "get_book_detail",
                description: "Get detailed information about a specific book including title, author, description, cover, and other metadata",
                inputSchema: {
                    type: "object",
                    properties: {
                        book_id: {
                            type: "string",
                            description: "Book ID"
                        }
                    },
                    required: ["book_id"]
                }
            },
            {
                name: "get_book_directory",
                description: "Get the chapter directory with volumes. Returns 50 chapters by default; use next_offset for subsequent pages.",
                inputSchema: {
                    type: "object",
                    properties: {
                        book_id: {
                            type: "string",
                            description: "Book ID"
                        },
                        offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
                        limit: { type: "integer", minimum: 1, maximum: 200, default: 50 }
                    },
                    required: ["book_id"]
                }
            },
            {
                name: "get_simple_directory",
                description: "Get chapter titles and IDs, 50 per page by default. Use next_offset for subsequent pages.",
                inputSchema: {
                    type: "object",
                    properties: {
                        book_id: {
                            type: "string",
                            description: "Book ID"
                        },
                        offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
                        limit: { type: "integer", minimum: 1, maximum: 200, default: 50 }
                    },
                    required: ["book_id"]
                }
            },
            {
                name: "get_chapter_content",
                description: "Get content of a specific chapter. This is a simplified interface that directly returns chapter text",
                inputSchema: {
                    type: "object",
                    properties: {
                        item_id: {
                            type: "string",
                            description: "Chapter ID"
                        }
                    },
                    required: ["item_id"]
                }
            },
            {
                name: "get_content",
                description: "Retrieve website-visible novel chapters: novel for one chapter, batch for up to 20 chapters from one book. Other legacy modes remain in the schema for compatibility and return unsupported (501).",
                inputSchema: {
                    type: "object",
                    properties: {
                        tab: {
                            type: "string",
                            description: "Supported: novel, batch. Legacy audiobook, short drama, comic and download modes return 501.",
                            enum: ["novel", "audiobook", "short drama", "comic", "batch", "download"]
                        },
                        item_id: {
                            type: "string",
                            description: "Single chapter/video/comic ID (required for novel, audiobook, short drama, comic)"
                        },
                        item_ids: {
                            type: "string",
                            description: "Multiple chapter IDs separated by commas (required for batch)"
                        },
                        book_id: {
                            type: "string",
                            description: "Book ID (required for batch retrieval and download)"
                        },
                        show_html: {
                            type: "string",
                            description: "Whether to return HTML format for comics (0 or 1, default 0)",
                            enum: ["0", "1"]
                        },
                        tone_id: {
                            type: "string",
                            description: "Audiobook voice ID (used for audiobook, default 0)"
                        },
                        async: {
                            type: "string",
                            description: "Comic async mode (0 or 1, default 1). Recommended 1 for faster responses",
                            enum: ["0", "1"]
                        }
                    },
                    required: ["tab"]
                }
            },
            {
                name: "get_comments",
                description: "Get book reviews including the comment text, rating, likes and reply count. Use the returned cursor to fetch the next page. This tool reads book reviews, not chapter or paragraph comments.",
                inputSchema: {
                    type: "object",
                    properties: {
                        book_id: {
                            type: "string",
                            description: "Book ID"
                        },
                        cursor: {
                            type: "string",
                            description: "Opaque cursor returned by get_comments for the next page; pass it unchanged"
                        },
                        count: {
                            type: "integer",
                            description: "Number of items per page (1 to 100)",
                            minimum: 1,
                            maximum: 100,
                            default: 20
                        },
                        offset: {
                            type: "integer",
                            description: "Offset for pagination",
                            default: 0
                        }
                    },
                    required: ["book_id"]
                }
            },
            {
                name: "get_device_pool_status",
                description: "Return compatibility information for local website mode. Does not inspect or manage an App device pool.",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            },
            {
                name: "register_device",
                description: "Legacy compatibility tool; device registration is not implemented and returns unsupported (501).",
                inputSchema: {
                    type: "object",
                    properties: {
                        platform: {
                            type: "string",
                            description: "Platform type: android or ios",
                            enum: ["android", "ios"],
                            default: "android"
                        }
                    }
                }
            },
            {
                name: "get_device_status",
                description: "Return local website-mode status. Does not validate real Android or iOS devices.",
                inputSchema: {
                    type: "object",
                    properties: {
                        platform: {
                            type: "string",
                            description: "Platform type: android or ios",
                            enum: ["android", "ios"],
                            default: "android"
                        }
                    }
                }
            },
            {
                name: "get_raw_content",
                description: "Get original website chapter fields together with decoded website-visible text. Does not guarantee full App content.",
                inputSchema: {
                    type: "object",
                    properties: {
                        item_id: {
                            type: "string",
                            description: "Chapter ID"
                        }
                    },
                    required: ["item_id"]
                }
            },
            {
                name: "get_ios_content",
                description: "Legacy compatibility tool; iOS content protocol is not implemented and returns unsupported (501).",
                inputSchema: {
                    type: "object",
                    properties: {
                        item_id: {
                            type: "string",
                            description: "Chapter ID"
                        }
                    },
                    required: ["item_id"]
                }
            },
            {
                name: "register_ios_device",
                description: "Legacy compatibility tool; iOS registration is not implemented and returns unsupported (501).",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            },
            {
                name: "get_manga_progress",
                description: "Legacy compatibility tool; manga download tasks are not implemented and return unsupported (501).",
                inputSchema: {
                    type: "object",
                    properties: {
                        task_id: {
                            type: "string",
                            description: "Task ID returned from the manga/comic content interface"
                        }
                    },
                    required: ["task_id"]
                }
            }
        ]
    };
});
/**
 * 工具调用处理
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const fanqieApi = new FanQieApi();
        if (Object.hasOwn(accountActions, request.params.name)) {
            const data = await fanqieApi.account(accountActions[request.params.name], request.params.arguments || {});
            const { qrcode, ...metadata } = data;
            return { content: [
                    { type: 'text', text: JSON.stringify(metadata, null, 2) },
                    ...(qrcode ? [{ type: 'image', mimeType: 'image/png', data: qrcode.slice('data:image/png;base64,'.length) }] : []),
                ] };
        }
        switch (request.params.name) {
            // 搜索书籍
            case "search_books": {
                const key = String(request.params.arguments?.key || "");
                const tabType = Number(request.params.arguments?.tab_type ?? 3);
                const offset = Number(request.params.arguments?.offset || 0);
                if (!key) {
                    throw new Error("搜索关键词不能为空");
                }
                const cursor = request.params.arguments?.cursor === undefined ? undefined : String(request.params.arguments.cursor);
                const result = await fanqieApi.searchBooks(key, tabType, offset, cursor);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                keyword: key,
                                tab_type: tabType,
                                offset: offset,
                                results: result
                            }, null, 2)
                        }]
                };
            }
            // 获取书籍详情
            case "get_book_detail": {
                const bookId = String(request.params.arguments?.book_id || "");
                if (!bookId) {
                    throw new Error("书籍ID不能为空");
                }
                const result = await fanqieApi.getBookDetail(bookId);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                book_id: bookId,
                                detail: result
                            }, null, 2)
                        }]
                };
            }
            // 获取书籍目录
            case "get_book_directory": {
                const bookId = String(request.params.arguments?.book_id || "");
                if (!bookId) {
                    throw new Error("书籍ID不能为空");
                }
                const result = await fanqieApi.getBookDirectory(bookId, Number(request.params.arguments?.offset ?? 0), Number(request.params.arguments?.limit ?? 50));
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                book_id: bookId,
                                directory: result
                            }, null, 2)
                        }]
                };
            }
            // 获取简化目录
            case "get_simple_directory": {
                const bookId = String(request.params.arguments?.book_id || "");
                if (!bookId) {
                    throw new Error("书籍ID不能为空");
                }
                const result = await fanqieApi.getSimpleDirectory(bookId, Number(request.params.arguments?.offset ?? 0), Number(request.params.arguments?.limit ?? 50));
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                book_id: bookId,
                                simple_directory: result
                            }, null, 2)
                        }]
                };
            }
            // 获取章节内容（简单接口）
            case "get_chapter_content": {
                const itemId = String(request.params.arguments?.item_id || "");
                if (!itemId) {
                    throw new Error("章节ID不能为空");
                }
                const result = await fanqieApi.getChapter(itemId);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                item_id: itemId,
                                content: result
                            }, null, 2)
                        }]
                };
            }
            // 获取内容（统一接口）
            case "get_content": {
                const tab = String(request.params.arguments?.tab || "");
                const itemId = request.params.arguments?.item_id ? String(request.params.arguments.item_id) : undefined;
                const itemIds = request.params.arguments?.item_ids ? String(request.params.arguments.item_ids) : undefined;
                const bookId = request.params.arguments?.book_id ? String(request.params.arguments.book_id) : undefined;
                const showHtml = request.params.arguments?.show_html ? String(request.params.arguments.show_html) : undefined;
                const toneId = request.params.arguments?.tone_id ? String(request.params.arguments.tone_id) : undefined;
                const asyncMode = request.params.arguments?.async ? String(request.params.arguments.async) : undefined;
                if (!tab) {
                    throw new Error("内容类型不能为空");
                }
                // 验证参数组合
                if (tab === "batch") {
                    if (!itemIds || !bookId) {
                        throw new Error("批量获取需要提供 item_ids 和 book_id 参数");
                    }
                }
                else if (tab === "download") {
                    if (!bookId) {
                        throw new Error("整本下载需要提供 book_id 参数");
                    }
                }
                else {
                    if (!itemId) {
                        throw new Error("需要提供 item_id 参数");
                    }
                }
                const result = await fanqieApi.getContent(tab, itemId, itemIds, bookId, showHtml, toneId, asyncMode);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                tab: tab,
                                item_id: itemId,
                                item_ids: itemIds,
                                book_id: bookId,
                                content: result
                            }, null, 2)
                        }]
                };
            }
            // 获取评论
            case "get_comments": {
                const bookId = String(request.params.arguments?.book_id || "");
                const count = Number(request.params.arguments?.count ?? 20);
                const offset = Number(request.params.arguments?.offset || 0);
                const cursor = request.params.arguments?.cursor ? String(request.params.arguments.cursor) : undefined;
                if (!bookId) {
                    throw new Error("书籍ID不能为空");
                }
                const result = await fanqieApi.getComments(bookId, count, offset, cursor);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                book_id: bookId,
                                count: count,
                                offset: offset,
                                comments: result
                            }, null, 2)
                        }]
                };
            }
            // 获取设备池状态
            case "get_device_pool_status": {
                const result = await fanqieApi.getDevicePoolStatus();
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                device_pool_status: result
                            }, null, 2)
                        }]
                };
            }
            // 注册设备
            case "register_device": {
                const platform = String(request.params.arguments?.platform || "android");
                const result = await fanqieApi.registerDevice(platform);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                platform: platform,
                                registration_result: result
                            }, null, 2)
                        }]
                };
            }
            // 获取设备状态
            case "get_device_status": {
                const platform = String(request.params.arguments?.platform || "android");
                const result = await fanqieApi.getDeviceStatus(platform);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                platform: platform,
                                device_status: result
                            }, null, 2)
                        }]
                };
            }
            // 获取原始内容
            case "get_raw_content": {
                const itemId = String(request.params.arguments?.item_id || "");
                if (!itemId) {
                    throw new Error("章节ID不能为空");
                }
                const result = await fanqieApi.getRawContent(itemId);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                item_id: itemId,
                                raw_content: result
                            }, null, 2)
                        }]
                };
            }
            // 获取 iOS 内容
            case "get_ios_content": {
                const itemId = String(request.params.arguments?.item_id || "");
                if (!itemId) {
                    throw new Error("章节ID不能为空");
                }
                const result = await fanqieApi.getIosContent(itemId);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                item_id: itemId,
                                content: result
                            }, null, 2)
                        }]
                };
            }
            // 注册 iOS 设备
            case "register_ios_device": {
                const result = await fanqieApi.registerIosDevice();
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                registration_result: result
                            }, null, 2)
                        }]
                };
            }
            // 查询漫画下载进度
            case "get_manga_progress": {
                const taskId = String(request.params.arguments?.task_id || "");
                if (!taskId) {
                    throw new Error("任务ID不能为空");
                }
                const result = await fanqieApi.getMangaProgress(taskId);
                return {
                    content: [{
                            type: "text",
                            text: JSON.stringify({
                                task_id: taskId,
                                progress: result
                            }, null, 2)
                        }]
                };
            }
            default:
                throw new Error(`未知的工具: ${request.params.name}`);
        }
    }
    catch (error) {
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify({
                        error: true,
                        message: error.message || "处理请求时发生错误"
                    }, null, 2)
                }],
            isError: true
        };
    }
});
/**
 * 启动服务器
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("番茄小说 MCP 服务器已启动");
}
main().catch((error) => {
    console.error("服务器启动失败:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map