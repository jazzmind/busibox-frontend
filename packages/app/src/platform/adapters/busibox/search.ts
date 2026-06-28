import type { SearchAdapter, SearchResult } from '../../interfaces/search';
import type { Filter } from '../../interfaces/data';

interface BusiboxSearchConfig {
  searchApiUrl?: string;
  getToken: () => Promise<string>;
}

interface SearchApiResult {
  id: string;
  document_id?: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export class BusiboxSearchAdapter implements SearchAdapter {
  private baseUrl: string;
  private getToken: () => Promise<string>;

  constructor(config: BusiboxSearchConfig) {
    this.baseUrl =
      config.searchApiUrl ??
      process.env.SEARCH_API_URL ??
      (() => {
        const host = process.env.SEARCH_API_HOST ?? 'localhost';
        const port = process.env.SEARCH_API_PORT ?? '8003';
        return `http://${host}:${port}`;
      })();
    this.getToken = config.getToken;
  }

  async search(params: {
    query: string;
    collections?: string[];
    mode?: 'hybrid' | 'semantic' | 'keyword';
    limit?: number;
    filters?: Filter[];
  }): Promise<SearchResult[]> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: params.query,
        document_ids: params.collections,
        mode: params.mode ?? 'hybrid',
        limit: params.limit ?? 10,
        filters: params.filters?.map((f) => ({
          field: f.field,
          op: f.op,
          value: f.value,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { results: SearchApiResult[] };
    return (data.results ?? []).map((r) => ({
      id: r.id,
      collection: r.document_id,
      content: r.content,
      score: r.score,
      metadata: r.metadata,
    }));
  }

  async embed(texts: string[]): Promise<number[][]> {
    const token = await this.getToken();

    const response = await fetch(`${this.baseUrl}/embed`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      throw new Error(`Embed API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { embeddings: number[][] };
    return data.embeddings;
  }
}
