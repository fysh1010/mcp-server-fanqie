import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// API 基础 URL（可通过环境变量 FANQIE_API_BASE 覆盖，便于接口地址变更时无需改动代码）
const FANQIE_API_BASE = process.env.FANQIE_API_BASE || "http://101.35.133.34:5000";

/**
 * 番茄小说 API 封装类
 * 提供搜索、获取书籍详情、目录、章节内容等功能
 */
export class FanQieApi {
  private axiosInstance: any;
  private baseUrl: string;

  constructor(baseUrl: string = FANQIE_API_BASE) {
    this.baseUrl = baseUrl;
    this.init();
  }

  private init(): void {
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
      }
    });
  }

  /**
   * 搜索书籍
   * @param key 搜索关键词
   * @param tabType 搜索类型：3=小说，2=听书，8=漫画，11=短剧
   * @param offset 偏移量，用于分页
   */
  public async searchBooks(key: string, tabType: number = 3, offset: number = 0): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/search', {
        params: { key, tab_type: tabType, offset }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`搜索书籍失败: ${error.message}`);
    }
  }

  /**
   * 获取书籍详情
   * @param bookId 书籍ID
   */
  public async getBookDetail(bookId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/detail', {
        params: { book_id: bookId }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取书籍详情失败: ${error.message}`);
    }
  }

  /**
   * 获取书籍目录
   * @param bookId 书籍ID
   */
  public async getBookDirectory(bookId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/book', {
        params: { book_id: bookId }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取书籍目录失败: ${error.message}`);
    }
  }

  /**
   * 获取简化目录
   * @param bookId 书籍ID
   */
  public async getSimpleDirectory(bookId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/directory', {
        params: { book_id: bookId }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取简化目录失败: ${error.message}`);
    }
  }

  /**
   * 获取章节内容（统一接口）
   * @param tab 内容类型：小说、听书、短剧、漫画、批量、下载
   * @param itemId 单个章节ID（小说、听书、短剧、漫画）
   * @param itemIds 多个章节ID，逗号分隔（批量）
   * @param bookId 书籍ID（批量、下载时需要）
   * @param showHtml 漫画是否返回HTML格式
   * @param toneId 有声书音色ID
   * @param asyncMode 漫画异步模式（0或1，默认1）
   */
  public async getContent(
    tab: string,
    itemId?: string,
    itemIds?: string,
    bookId?: string,
    showHtml?: string,
    toneId?: string,
    asyncMode?: string
  ): Promise<any> {
    try {
      const params: any = { tab };
      if (itemId) params.item_id = itemId;
      if (itemIds) params.item_ids = itemIds;
      if (bookId) params.book_id = bookId;
      if (showHtml) params.show_html = showHtml;
      if (toneId) params.tone_id = toneId;
      if (asyncMode) params.async = asyncMode;

      const response = await this.axiosInstance.get('/api/content', { params });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取内容失败: ${error.message}`);
    }
  }

  /**
   * 获取章节内容（简单接口）
   * @param itemId 章节ID
   *
   * 注：新服务器的 /api/chapter 端点目前服务端异常（始终返回 500 JSON解析失败），
   * 因此改用稳定可用的统一内容接口 /api/content?tab=小说 获取单章正文。
   */
  public async getChapter(itemId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/content', {
        params: { tab: '小说', item_id: itemId }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取章节失败: ${error.message}`);
    }
  }

  /**
   * 获取原始内容
   * @param itemId 章节ID
   */
  public async getRawContent(itemId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/raw_full', {
        params: { item_id: itemId }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取原始内容失败: ${error.message}`);
    }
  }

  /**
   * 获取评论
   * @param bookId 书籍ID
   * @param count 每页数量
   * @param offset 偏移量
   */
  public async getComments(bookId: string, count: number = 20, offset: number = 0): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/comment', {
        params: { book_id: bookId, count, offset }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取评论失败: ${error.message}`);
    }
  }

  /**
   * 获取设备池状态
   */
  public async getDevicePoolStatus(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/device/pool');
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取设备池状态失败: ${error.message}`);
    }
  }

  /**
   * 注册设备
   * @param platform 平台类型：android或ios
   */
  public async registerDevice(platform: string = 'android'): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/device/register', {
        params: { platform }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`注册设备失败: ${error.message}`);
    }
  }

  /**
   * 获取设备状态
   * @param platform 平台类型：android或ios
   */
  public async getDeviceStatus(platform: string = 'android'): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/device/status', {
        params: { platform }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取设备状态失败: ${error.message}`);
    }
  }

  /**
   * 获取iOS内容
   * @param itemId 章节ID
   */
  public async getIosContent(itemId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/api/ios/content`, {
        params: { item_id: itemId }
      });
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`获取iOS内容失败: ${error.message}`);
    }
  }

  /**
   * 注册iOS设备
   */
  public async registerIosDevice(): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/api/ios/register');
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`注册iOS设备失败: ${error.message}`);
    }
  }

  /**
   * 查询漫画下载进度
   * @param taskId 任务ID
   */
  public async getMangaProgress(taskId: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get(`/api/manga/progress/${taskId}`);
      return this.handleResponse(response);
    } catch (error: any) {
      throw new Error(`查询漫画下载进度失败: ${error.message}`);
    }
  }

  /**
   * 处理API响应
   */
  private handleResponse(response: any): any {
    const { data } = response;
    
    // 检查响应格式
    if (data.code === 200) {
      return data.data;
    } else if (data.code === 403) {
      throw new Error('未授权或授权已过期');
    } else if (data.code === 404) {
      throw new Error('资源不存在');
    } else if (data.code === 400) {
      throw new Error(`请求参数错误: ${data.message}`);
    } else if (data.code === 500) {
      throw new Error('服务器内部错误');
    } else {
      throw new Error(`API返回错误: ${data.message || 'Unknown error'} (code: ${data.code})`);
    }
  }
}