/**
 * 番茄小说字体解密模块
 * 基于 https://blog.csdn.net/m0_57265868/article/details/137511029 的研究成果
 *
 * 解密原理：
 * 1. 番茄小说使用自定义字体文件进行加密
 * 2. 字体文件中，Unicode 私有区域字符 (U+E000-U+F8FF) 映射到 gid (glyph ID)
 * 3. gid 再映射到真实字符
 * 4. 解密过程：Unicode 私有区域字符 -> gid -> 真实字符
 */
/**
 * 解密文本中的加密字符
 * @param encryptedText 包含加密字符的文本
 * @returns 解密后的文本
 */
export declare function decryptText(encryptedText: string): string;
/**
 * 解密 HTML 内容中的加密字符
 * @param html 包含加密字符的 HTML
 * @returns 解密后的 HTML
 */
export declare function decryptHtml(html: string): string;
/**
 * 解密章节内容
 * @param content 章节内容（HTML 格式）
 * @returns 解密后的文本
 */
export declare function decryptChapterContent(content: string): string;
//# sourceMappingURL=fontDecrypt.d.ts.map