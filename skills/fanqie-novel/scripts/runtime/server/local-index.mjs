import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { initialState } from './core.mjs';

// The index contains metadata only; chapter text is never persisted here.
export class LocalIndex {
  constructor(path = resolve(process.env.FANQIE_DATA_DIR || '.cache/fanqie', 'index.json')) {
    this.path = path; this.books = new Map(); this.loaded = false; this.saveQueue = Promise.resolve();
  }
  async load() {
    if (this.loaded) return;
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      for (const book of data.books || []) this.books.set(book.book_id, book);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    this.loaded = true;
  }
  async add(book) {
    await this.load(); this.books.set(book.book_id, book);
    await this.save(); return book;
  }
  async save() {
    const content = JSON.stringify({ version: 1, updated_at: new Date().toISOString(), books: [...this.books.values()] }, null, 2);
    this.saveQueue = this.saveQueue.catch(() => {}).then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(this.path + '.tmp', content, 'utf8');
      await rename(this.path + '.tmp', this.path);
    });
    await this.saveQueue;
  }
  async refresh(client) {
    await this.load();
    const state = initialState(await client.request('/'));
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      const bookId = String(value.book_id || value.bookId || '');
      const name = value.book_name || value.bookName;
      if (/^\d+$/.test(bookId) && typeof name === 'string' && name) {
        this.books.set(bookId, { book_id: bookId, book_name: name, author: value.author || value.authorName || '',
          abstract: value.abstract || '', cover: value.thumb_url || value.thumbUri || '', source: 'official_homepage' });
      }
      for (const child of Object.values(value)) visit(child);
    };
    visit(state); await this.save();
    return { indexed_books: this.books.size, scope: 'homepage_and_imported_books', whole_platform: false };
  }
  async search(key, offset) {
    await this.load(); const query = key.trim().toLocaleLowerCase();
    const all = [...this.books.values()].filter(b => `${b.book_name} ${b.author}`.toLocaleLowerCase().includes(query));
    return { results: all.slice(offset, offset + 10), total: all.length, offset, indexed_books: this.books.size,
      source: 'local_index', whole_platform: false,
      warning: '官网搜索当前不可用；仅搜索本地已收录的书名和作者。可通过 POST /api/index/import 添加书籍。' };
  }
}
