/**
 * 番茄小说 API 封装类
 * 提供搜索、获取书籍详情、目录、章节内容等功能
 */
export declare class FanQieApi {
    private axiosInstance;
    private baseUrl;
    constructor(baseUrl?: string);
    private init;
    /**
     * 搜索书籍
     * @param key 搜索关键词
     * @param tabType 搜索类型：3=小说，2=听书，8=漫画，11=短剧
     * @param offset 偏移量，用于分页
     */
    searchBooks(key: string, tabType?: number, offset?: number): Promise<any>;
    /**
     * 获取书籍详情
     * @param bookId 书籍ID
     */
    getBookDetail(bookId: string): Promise<any>;
    /**
     * 获取书籍目录
     * @param bookId 书籍ID
     */
    getBookDirectory(bookId: string): Promise<any>;
    /**
     * 获取简化目录
     * @param bookId 书籍ID
     */
    getSimpleDirectory(bookId: string): Promise<any>;
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
    getContent(tab: string, itemId?: string, itemIds?: string, bookId?: string, showHtml?: string, toneId?: string, asyncMode?: string): Promise<any>;
    /**
     * 获取章节内容（简单接口）
     * @param itemId 章节ID
     *
     * 注：新服务器的 /api/chapter 端点目前服务端异常（始终返回 500 JSON解析失败），
     * 因此改用稳定可用的统一内容接口 /api/content?tab=小说 获取单章正文。
     */
    getChapter(itemId: string): Promise<any>;
    /**
     * 获取原始内容
     * @param itemId 章节ID
     */
    getRawContent(itemId: string): Promise<any>;
    /**
     * 获取评论
     * @param bookId 书籍ID
     * @param count 每页数量
     * @param offset 偏移量
     */
    getComments(bookId: string, count?: number, offset?: number): Promise<any>;
    /**
     * 获取设备池状态
     */
    getDevicePoolStatus(): Promise<any>;
    /**
     * 注册设备
     * @param platform 平台类型：android或ios
     */
    registerDevice(platform?: string): Promise<any>;
    /**
     * 获取设备状态
     * @param platform 平台类型：android或ios
     */
    getDeviceStatus(platform?: string): Promise<any>;
    /**
     * 获取iOS内容
     * @param itemId 章节ID
     */
    getIosContent(itemId: string): Promise<any>;
    /**
     * 注册iOS设备
     */
    registerIosDevice(): Promise<any>;
    /**
     * 查询漫画下载进度
     * @param taskId 任务ID
     */
    getMangaProgress(taskId: string): Promise<any>;
    /**
     * 处理API响应
     */
    private handleResponse;
}
//# sourceMappingURL=FanQieApi.d.ts.map