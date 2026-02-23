/**
 * Search API Client for busibox-app
 * 
 * Unified client for all search-api capabilities:
 * - Web search (Tavily, DuckDuckGo, Perplexity, Bing, etc.)
 * - Document search (BM25 keyword, vector semantic, hybrid, MMR)
 * - Chat insights (Milvus vector store - see insights/client.ts)
 * 
 * Replaces direct provider SDK integrations and Milvus client.
 */

import 'server-only';

// ============================================================================
// Web Search Types
// ============================================================================

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  publishedDate?: string;
  domain?: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  provider: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface WebSearchOptions {
  provider?: string;
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeAnswer?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
}

// ============================================================================
// Document Search Types
// ============================================================================

export interface DocumentSearchResult {
  id: string;
  fileId: string;
  documentId: string;
  chunkId: string;
  text: string;
  markdown?: string;
  score: number;
  highlights?: string[];
  metadata?: {
    filename?: string;
    page?: number;
    section?: string;
    [key: string]: any;
  };
  semanticAlignment?: {
    query: string;
    document: string;
    similarity: number;
    matchedSpans: Array<{
      start: number;
      end: number;
      score: number;
    }>;
  };
}

export interface DocumentSearchResponse {
  query: string;
  results: DocumentSearchResult[];
  mode: 'keyword' | 'semantic' | 'hybrid' | 'mmr';
  totalResults: number;
  executionTimeMs: number;
  metadata?: {
    reranked?: boolean;
    rerankerModel?: string;
    fusionMethod?: string;
    [key: string]: any;
  };
}

export interface DocumentSearchOptions {
  mode?: 'keyword' | 'semantic' | 'hybrid' | 'mmr';
  limit?: number;
  offset?: number;
  useReranker?: boolean;
  rerankerModel?: 'qwen3-gpu' | 'baai-gpu' | 'baai-cpu' | 'none';
  enableHighlighting?: boolean;
  highlightFragmentSize?: number;
  enableSemanticAlignment?: boolean;
  semanticAlignmentTopK?: number;
  // MMR-specific options
  diversityLambda?: number; // 0.0 = max diversity, 1.0 = max relevance
  // Filtering options
  fileIds?: string[];
  documentIds?: string[];
  partitions?: string[];
}

// ============================================================================
// Common Types
// ============================================================================

export interface TokenManager {
  getAuthzToken(audience: string, scopes: string[]): Promise<string>;
}

export interface ProviderStatus {
  provider_name: string;
  is_configured: boolean;
  is_enabled: boolean;
  status: string;
}

// ============================================================================
// Configuration
// ============================================================================

const SEARCH_API_URL = process.env.SEARCH_API_URL || process.env.NEXT_PUBLIC_SEARCH_API_URL || 'http://localhost:8001';

// ============================================================================
// Web Search Functions
// ============================================================================

/**
 * Perform web search using search-api
 * 
 * @param query - Search query
 * @param options - Search options including provider selection
 * @param tokenManager - Optional token manager for authentication
 * @returns Search response with results
 */
export async function searchWeb(
  query: string,
  options?: WebSearchOptions,
  tokenManager?: TokenManager
): Promise<WebSearchResponse> {
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('search-api', []);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[searchWeb] Failed to get auth token, proceeding without auth:', error);
    }
  }
  
  const requestBody = {
    query,
    provider: options?.provider,
    max_results: options?.maxResults || 5,
    search_depth: options?.searchDepth || 'basic',
    include_answer: options?.includeAnswer ?? false,
    include_domains: options?.includeDomains,
    exclude_domains: options?.excludeDomains,
  };
  
  const response = await fetch(`${SEARCH_API_URL}/web-search`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Web search failed: ${error.detail || response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get available web search providers
 * 
 * @param tokenManager - Optional token manager for authentication
 * @returns List of available provider names
 */
export async function getAvailableProviders(
  tokenManager?: TokenManager
): Promise<string[]> {
  let headers: Record<string, string> = {};
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('search-api', []);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[getAvailableProviders] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${SEARCH_API_URL}/web-search/providers`, {
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get providers: ${response.statusText}`);
  }
  
  const providers = await response.json();
  return providers
    .filter((p: any) => p.is_enabled && p.is_configured)
    .map((p: any) => p.provider_name);
}

/**
 * Get provider status
 * 
 * @param provider - Provider name
 * @param tokenManager - Optional token manager for authentication
 * @returns Provider status information
 */
export async function getProviderStatus(
  provider: string,
  tokenManager?: TokenManager
): Promise<ProviderStatus> {
  let headers: Record<string, string> = {};
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('search-api', []);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[getProviderStatus] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${SEARCH_API_URL}/web-search/providers/${provider}`, {
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get provider status: ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// Document Search Functions
// ============================================================================

/**
 * Search documents using search-api
 * 
 * Supports multiple search modes:
 * - keyword: BM25 full-text search (fast, exact matching)
 * - semantic: Vector similarity search (understands meaning)
 * - hybrid: Combined keyword + semantic with RRF fusion (recommended)
 * - mmr: Maximal Marginal Relevance for diverse results
 * 
 * @param query - Search query
 * @param options - Search options
 * @param tokenManager - Optional token manager for authentication
 * @returns Search response with results
 */
export async function searchDocuments(
  query: string,
  options?: DocumentSearchOptions,
  tokenManager?: TokenManager
): Promise<DocumentSearchResponse> {
  const mode = options?.mode || 'hybrid';
  
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('search-api', []);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[searchDocuments] Failed to get auth token, proceeding without auth:', error);
    }
  }
  
  const requestBody = {
    query,
    mode,
    limit: options?.limit || 10,
    offset: options?.offset || 0,
    use_reranker: options?.useReranker ?? true,
    reranker_model: options?.rerankerModel || 'baai-gpu',
    enable_highlighting: options?.enableHighlighting ?? true,
    highlight_fragment_size: options?.highlightFragmentSize || 150,
    enable_semantic_alignment: options?.enableSemanticAlignment ?? false,
    semantic_alignment_top_k: options?.semanticAlignmentTopK || 3,
    diversity_lambda: options?.diversityLambda,
    file_ids: options?.fileIds,
    document_ids: options?.documentIds,
    partitions: options?.partitions,
  };
  
  // Use mode-specific endpoint if specified, otherwise use main /search endpoint
  const endpoint = mode === 'mmr' ? '/search/mmr' : `/search/${mode}`;
  
  const response = await fetch(`${SEARCH_API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Document search failed: ${error.detail || response.statusText}`);
  }
  
  return response.json();
}

/**
 * Keyword search (BM25 only)
 * 
 * Fast full-text search with exact term matching.
 * Best for technical terms, codes, IDs, and known phrases.
 * 
 * @param query - Search query
 * @param options - Search options
 * @param tokenManager - Optional token manager for authentication
 * @returns Search response with results
 */
export async function searchKeyword(
  query: string,
  options?: Omit<DocumentSearchOptions, 'mode'>,
  tokenManager?: TokenManager
): Promise<DocumentSearchResponse> {
  return searchDocuments(query, { ...options, mode: 'keyword' }, tokenManager);
}

/**
 * Semantic search (vector only)
 * 
 * Dense vector similarity search using embeddings.
 * Understands meaning and context beyond exact keywords.
 * Best for conceptual queries and natural language questions.
 * 
 * @param query - Search query
 * @param options - Search options
 * @param tokenManager - Optional token manager for authentication
 * @returns Search response with results
 */
export async function searchSemantic(
  query: string,
  options?: Omit<DocumentSearchOptions, 'mode'>,
  tokenManager?: TokenManager
): Promise<DocumentSearchResponse> {
  return searchDocuments(query, { ...options, mode: 'semantic' }, tokenManager);
}

/**
 * Hybrid search (keyword + semantic with RRF fusion)
 * 
 * Combines BM25 keyword search and vector semantic search.
 * Provides best of both worlds - exact matching and semantic understanding.
 * Recommended for most use cases.
 * 
 * @param query - Search query
 * @param options - Search options
 * @param tokenManager - Optional token manager for authentication
 * @returns Search response with results
 */
export async function searchHybrid(
  query: string,
  options?: Omit<DocumentSearchOptions, 'mode'>,
  tokenManager?: TokenManager
): Promise<DocumentSearchResponse> {
  return searchDocuments(query, { ...options, mode: 'hybrid' }, tokenManager);
}

/**
 * MMR search (Maximal Marginal Relevance)
 * 
 * Returns diverse results by balancing relevance and diversity.
 * Useful for exploratory search and avoiding redundant results.
 * 
 * @param query - Search query
 * @param options - Search options (diversityLambda: 0.0 = max diversity, 1.0 = max relevance)
 * @param tokenManager - Optional token manager for authentication
 * @returns Search response with results
 */
export async function searchMMR(
  query: string,
  options?: Omit<DocumentSearchOptions, 'mode'>,
  tokenManager?: TokenManager
): Promise<DocumentSearchResponse> {
  return searchDocuments(query, { ...options, mode: 'mmr' }, tokenManager);
}

/**
 * Get semantic alignment for a query and document
 * 
 * Visualizes query-document similarity with matched spans.
 * Useful for understanding why a document matched a query.
 * 
 * @param query - Search query
 * @param documentId - Document ID
 * @param tokenManager - Optional token manager for authentication
 * @returns Semantic alignment data
 */
export async function getSemanticAlignment(
  query: string,
  documentId: string,
  tokenManager?: TokenManager
): Promise<{
  query: string;
  document: string;
  similarity: number;
  matchedSpans: Array<{
    start: number;
    end: number;
    score: number;
  }>;
}> {
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('search-api', []);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[getSemanticAlignment] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${SEARCH_API_URL}/search/explain`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, document_id: documentId }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to get semantic alignment: ${error.detail || response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check search-api health
 * 
 * @returns true if service is healthy
 */
export async function checkSearchHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SEARCH_API_URL}/health`);
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.status === 'healthy' || data.status === 'degraded';
  } catch (error) {
    console.error('[checkSearchHealth] Health check failed:', error);
    return false;
  }
}
