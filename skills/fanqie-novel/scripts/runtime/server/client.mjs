import { WebsiteClient } from './core.mjs';
import { LocalIndex } from './local-index.mjs';

// HTTP, MCP and CLI share the same upstream implementation and fallback rules.
export async function createLocalClient() {
  const index = new LocalIndex();
  await index.load();
  const client = new WebsiteClient({ searchFallback: async (key, offset) => {
    if (!index.books.size) await index.refresh(client);
    return index.search(key, offset);
  } });
  return { client, index };
}
