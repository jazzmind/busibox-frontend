import type { SearchAdapter, SearchResult } from '../../interfaces/search';
import type { Filter } from '../../interfaces/data';

interface VercelSearchConfig {
  databaseUrl?: string;
  embeddingApiKey?: string;
  /** Model for embeddings (default: text-embedding-3-small) */
  embeddingModel?: string;
}

type SqlFn = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;

export class VercelSearchAdapter implements SearchAdapter {
  private databaseUrl: string;
  private embeddingModel: string;
  private _sql: SqlFn | null = null;

  constructor(config: VercelSearchConfig = {}) {
    this.databaseUrl = config.databaseUrl ?? process.env.DATABASE_URL ?? '';
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-3-small';
  }

  async search(params: {
    query: string;
    collections?: string[];
    mode?: 'hybrid' | 'semantic' | 'keyword';
    limit?: number;
    filters?: Filter[];
  }): Promise<SearchResult[]> {
    const mode = params.mode ?? 'keyword';
    const limit = params.limit ?? 10;

    if (mode === 'semantic') {
      return this.semanticSearch(params.query, params.collections, limit);
    }

    if (mode === 'keyword') {
      return this.keywordSearch(params.query, params.collections, limit);
    }

    // hybrid: combine both
    const [semantic, keyword] = await Promise.all([
      this.semanticSearch(params.query, params.collections, limit).catch(() => [] as SearchResult[]),
      this.keywordSearch(params.query, params.collections, limit),
    ]);

    return mergeResults(semantic, keyword, limit);
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const { createOpenAI } = await import('@ai-sdk/openai');
      const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const { embed } = await import('ai');

      const model = openai.embedding(this.embeddingModel);
      const results = await Promise.all(
        texts.map((text) => embed({ model, value: text })),
      );
      return results.map((r) => r.embedding);
    } catch {
      throw new Error(
        'Vercel search embed requires "ai" and "@ai-sdk/openai". ' +
        'Run: pnpm add ai @ai-sdk/openai',
      );
    }
  }

  // --- Private helpers ---

  private async getSql(): Promise<SqlFn> {
    if (this._sql) return this._sql;

    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(this.databaseUrl);
      // Neon supports (text, params) call form; cast past the tagged-template TS types
      const sqlFn = sql as unknown as (text: string, params?: unknown[]) => Promise<unknown[]>;
      this._sql = async (statement: string, params: unknown[] = []) => {
        const result = await sqlFn(statement, params);
        return Array.isArray(result) ? result as Record<string, unknown>[] : [];
      };
      return this._sql;
    } catch {
      throw new Error(
        'Vercel search adapter requires "@neondatabase/serverless". ' +
        'Run: pnpm add @neondatabase/serverless',
      );
    }
  }

  private async keywordSearch(
    query: string,
    collections?: string[],
    limit = 10,
  ): Promise<SearchResult[]> {
    const sql = await this.getSql();

    // Full text search using ts_vector across all registered tables.
    // For simplicity, we search each collection table individually.
    const tables = collections ?? [];

    if (tables.length === 0) {
      // No tables to search — return empty
      return [];
    }

    const allResults: SearchResult[] = [];

    for (const table of tables) {
      try {
        const rows = await sql(
          `SELECT *, ts_rank(to_tsvector('english', content::text), plainto_tsquery('english', $1)) AS score
           FROM "${table}"
           WHERE to_tsvector('english', content::text) @@ plainto_tsquery('english', $1)
           ORDER BY score DESC
           LIMIT $2`,
          [query, limit],
        );

        for (const row of rows) {
          allResults.push({
            id: String(row['id']),
            collection: table,
            content: String(row['content'] ?? row['text'] ?? ''),
            score: Number(row['score'] ?? 0),
            metadata: row['metadata'] as Record<string, unknown> | undefined,
          });
        }
      } catch {
        // Table may not have a content column — skip gracefully
      }
    }

    return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async semanticSearch(
    query: string,
    collections?: string[],
    limit = 10,
  ): Promise<SearchResult[]> {
    const [embedding] = await this.embed([query]);
    const sql = await this.getSql();
    const tables = collections ?? [];

    if (tables.length === 0) return [];

    const allResults: SearchResult[] = [];

    for (const table of tables) {
      try {
        const rows = await sql(
          `SELECT *, 1 - (embedding <=> $1::vector) AS score
           FROM "${table}"
           WHERE embedding IS NOT NULL
           ORDER BY embedding <=> $1::vector
           LIMIT $2`,
          [`[${embedding.join(',')}]`, limit],
        );

        for (const row of rows) {
          allResults.push({
            id: String(row['id']),
            collection: table,
            content: String(row['content'] ?? ''),
            score: Number(row['score'] ?? 0),
            metadata: row['metadata'] as Record<string, unknown> | undefined,
          });
        }
      } catch {
        // Table may not have pgvector column — skip gracefully
      }
    }

    return allResults.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

function mergeResults(
  semantic: SearchResult[],
  keyword: SearchResult[],
  limit: number,
): SearchResult[] {
  const seen = new Set<string>();
  const merged: SearchResult[] = [];

  const all = [...semantic, ...keyword].map((r, i) => ({
    ...r,
    // Reciprocal rank fusion score
    rrf: 1 / (60 + i + 1),
  }));

  // Group by id
  const scores = new Map<string, number>();
  for (const r of all) {
    scores.set(r.id, (scores.get(r.id) ?? 0) + r.rrf);
  }

  // Re-rank by combined RRF score
  const deduped = [...new Map(all.map((r) => [r.id, r])).values()]
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    .slice(0, limit);

  return deduped;
}
