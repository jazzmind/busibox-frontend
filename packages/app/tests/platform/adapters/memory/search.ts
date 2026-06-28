import type { SearchAdapter, SearchResult } from '../../../../src/platform/interfaces/search';
import type { Filter } from '../../../../src/platform/interfaces/data';

interface SearchDocument {
  id: string;
  collection: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class MemorySearchAdapter implements SearchAdapter {
  private documents: SearchDocument[] = [];

  seed(docs: SearchDocument[]): void {
    this.documents = [...this.documents, ...docs];
  }

  reset(): void {
    this.documents = [];
  }

  async search(params: {
    query: string;
    collections?: string[];
    mode?: 'hybrid' | 'semantic' | 'keyword';
    limit?: number;
    filters?: Filter[];
  }): Promise<SearchResult[]> {
    const limit = params.limit ?? 10;
    const terms = params.query.toLowerCase().split(/\s+/);

    let docs = this.documents;

    if (params.collections?.length) {
      docs = docs.filter((d) => params.collections!.includes(d.collection));
    }

    const scored = docs
      .map((doc) => {
        const text = doc.content.toLowerCase();
        const score = terms.reduce((acc, term) => {
          const occurrences = (text.match(new RegExp(term, 'g')) || []).length;
          return acc + occurrences * 0.1;
        }, 0);
        return { ...doc, score };
      })
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ id, collection, content, metadata, score }) => ({
      id,
      collection,
      content,
      score,
      metadata,
    }));
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Return deterministic fake embeddings (1536-dim, normalized)
    return texts.map((text) => {
      const seed = text.length;
      return Array.from({ length: 16 }, (_, i) => Math.sin(seed + i) * 0.1);
    });
  }
}
