#!/usr/bin/env node

/**
 * 番茄小说 MCP 服务器
 * 基于番茄小说API，提供书籍搜索、详情、目录、章节内容等功能
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { FanQieApi } from "./FanQieApi.js";

/**
 * 创建MCP服务器，只提供tools能力
 */
const server = new Server(
  {
    name: "mcp-server-fanqie",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * 列出可用的工具
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
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
              default: 3
            },
            offset: {
              type: "integer",
              description: "Offset for pagination",
              default: 0
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
        description: "Get the complete chapter directory of a book including all volumes and chapters",
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
        name: "get_simple_directory",
        description: "Get simplified directory information with only chapter titles and IDs",
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
        description: "Unified content retrieval interface supporting novels, audiobooks, short dramas, comics, and batch retrieval",
        inputSchema: {
          type: "object",
          properties: {
            tab: {
              type: "string",
              description: "Content type: novel, audiobook, short drama, comic, batch",
              enum: ["novel", "audiobook", "short drama", "comic", "batch"]
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
              description: "Book ID (required for batch retrieval)"
            },
            show_html: {
              type: "string",
              description: "Whether to return HTML format for comics (0 or 1, default 0)",
              enum: ["0", "1"]
            },
            tone_id: {
              type: "string",
              description: "Audiobook voice ID (used for audiobook, default 0)"
            }
          },
          required: ["tab"]
        }
      },
      {
        name: "get_comments",
        description: "Get comments for a book, chapter, or other content with pagination support",
        inputSchema: {
          type: "object",
          properties: {
            book_id: {
              type: "string",
              description: "Book ID"
            },
            count: {
              type: "integer",
              description: "Number of items per page",
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
        description: "View the overall status of the device pool including all registered devices",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "register_device",
        description: "Register a new device to the device pool",
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
        description: "View the status of devices for a specific platform",
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

    switch (request.params.name) {
      // 搜索书籍
      case "search_books": {
        const key = String(request.params.arguments?.key || "");
        const tabType = Number(request.params.arguments?.tab_type || 3);
        const offset = Number(request.params.arguments?.offset || 0);

        if (!key) {
          throw new Error("搜索关键词不能为空");
        }

        const result = await fanqieApi.searchBooks(key, tabType, offset);
        
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

        const result = await fanqieApi.getBookDirectory(bookId);
        
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

        const result = await fanqieApi.getSimpleDirectory(bookId);
        
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

        if (!tab) {
          throw new Error("内容类型不能为空");
        }

        // 验证参数组合
        if (tab === "batch") {
          if (!itemIds || !bookId) {
            throw new Error("批量获取需要提供 item_ids 和 book_id 参数");
          }
        } else {
          if (!itemId) {
            throw new Error("需要提供 item_id 参数");
          }
        }

        const result = await fanqieApi.getContent(tab, itemId, itemIds, bookId, showHtml, toneId);
        
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
        const count = Number(request.params.arguments?.count || 20);
        const offset = Number(request.params.arguments?.offset || 0);

        if (!bookId) {
          throw new Error("书籍ID不能为空");
        }

        const result = await fanqieApi.getComments(bookId, count, offset);
        
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

      default:
        throw new Error(`未知的工具: ${request.params.name}`);
    }
  } catch (error: any) {
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