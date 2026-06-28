import type { Filter } from './data';

export interface SearchResult {
  id: string;
  collection?: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface SearchAdapter {
  search(params: {
    query: string;
    collections?: string[];
    mode?: 'hybrid' | 'semantic' | 'keyword';
    limit?: number;
    filters?: Filter[];
  }): Promise<SearchResult[]>;

  embed?(texts: string[]): Promise<number[][]>;
}
