/**
 * Chat Search Service
 * 
 * Integrates web search and document search for chat conversations.
 * Provides unified interface for both search types with proper error handling.
 * 
 * MIGRATION NOTE: Now uses search-api for web search instead of direct provider SDKs.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  publishedDate?: string;
  domain?: string;
}

// Search API configuration - use environment variables for deployment flexibility
// Search API is deployed to milvus-lxc, colocated with Milvus for low-latency vector operations
const SEARCH_API_HOST = process.env.SEARCH_API_HOST || process.env.SEARCH_API_IP || 'localhost';
const SEARCH_API_PORT = process.env.SEARCH_API_PORT || '8003';  // Default to 8003 (search-api port on milvus-lxc)
const SEARCH_API_URL = `http://${SEARCH_API_HOST}:${SEARCH_API_PORT}`;

export interface DocumentSearchResult {
  id: string;
  title: string;
  snippet: string;
  source: string; // Library/document name
  url?: string;
  score: number;
  fileId?: string;
  documentId?: string;
  metadata?: Record<string, any>;
}

export interface WebSearchOptions {
  maxResults?: number;
  includeAnswer?: boolean;
}

export interface DocumentSearchOptions {
  limit?: number;
  offset?: number;
  mode?: 'keyword' | 'semantic' | 'hybrid';
  authorization?: string; // JWT Authorization header for service-to-service auth
  useReranker?: boolean; // Whether to use reranking (default: true)
  rerankerModel?: 'qwen3-gpu' | 'baai-gpu' | 'baai-cpu' | 'none'; // Which reranker to use
}

/**
 * Search the web using search-api for chat
 * 
 * @param query - Search query
 * @param userId - User ID (for logging)
 * @param options - Search options
 * @returns Search results with citations
 */
export async function searchWebForChat(
  query: string,
  userId: string,
  options: WebSearchOptions = {}
): Promise<{
  results: SearchResult[];
  answer?: string;
  provider: string;
  error?: string;
}> {
  console.log(`[Chat Search] Starting web search for user ${userId}, query: "${query}"`);
  
  try {
    // Call search-api web search endpoint
    const response = await fetch(`${SEARCH_API_URL}/web-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({
        query,
        max_results: options.maxResults || 5,
        include_answer: options.includeAnswer ?? true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(errorData.detail || 'Web search failed');
    }

    const data = await response.json();

    console.log(`[Chat Search] Search completed. Results: ${data.results.length}, Provider: ${data.provider}`);

    return {
      results: data.results,
      answer: data.metadata?.answer,
      provider: data.provider,
    };
  } catch (error: any) {
    console.error(`[Chat Search] Web search failed for user ${userId}:`, error);
    return {
      results: [],
      provider: 'none',
      error: error.message || 'Web search failed',
    };
  }
}

/**
 * Search user's document libraries
 * 
 * @param query - Search query
 * @param userId - User ID
 * @param options - Search options
 * @returns Document search results
 */
export async function searchDocuments(
  query: string,
  userId: string,
  options: DocumentSearchOptions = {}
): Promise<{
  results: DocumentSearchResult[];
  total?: number;
  error?: string;
}> {
  try {
    // Build headers - prefer JWT authorization, fall back to X-User-Id
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    };
    
    // Add Authorization header if provided (JWT passthrough for RLS)
    if (options.authorization) {
      headers['Authorization'] = options.authorization;
    }
    
    const response = await fetch(`${SEARCH_API_URL}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        mode: options.mode || 'hybrid',
        limit: options.limit || 5,
        offset: options.offset || 0,
        rerank: options.useReranker !== false, // Default to true
        reranker_model: options.rerankerModel || 'qwen3-gpu',
        rerank_k: 100,
        dense_weight: 0.7,
        sparse_weight: 0.3,
        // Return full chunk content for RAG (not just fragments)
        // Larger fragment size ensures LLM gets enough context
        highlight: {
          enabled: true,
          fragment_size: 2000,  // Larger fragments for better RAG context
          num_fragments: 1,     // Single comprehensive fragment per result
        },
        // Request full content if available
        include_content: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.detail || errorData.error || 'Document search failed');
    }

    const data = await response.json();

    // Transform results to DocumentSearchResult format
    const results: DocumentSearchResult[] = (data.results || []).map((r: any) => ({
      id: r.id || r.chunk_id || '',
      title: r.title || r.filename || 'Untitled',
      snippet: r.text || r.content || r.snippet || '', // text is the chunk content from search API
      source: r.source || r.library_name || 'Document Library',
      url: r.url || `/documents/${r.file_id || r.document_id}`,
      score: r.score || r.relevance_score || 0,
      fileId: r.file_id,
      documentId: r.document_id,
      metadata: {
        chunkId: r.chunk_id,
        pageNumber: r.page_number,
        highlighted: r.highlighted,
        denseScore: r.dense_score,
        sparseScore: r.sparse_score,
        rerankScore: r.rerank_score,
      },
    }));

    return {
      results,
      total: data.total,
    };
  } catch (error: any) {
    console.error(`[Chat Search] Document search failed for user ${userId}:`, error);
    return {
      results: [],
      error: error.message || 'Document search failed',
    };
  }
}

/**
 * Format search results for AI context
 * 
 * @param webResults - Web search results
 * @param docResults - Document search results
 * @returns Formatted context string for AI prompt
 */
export function formatSearchResultsForAI(
  webResults?: SearchResult[],
  docResults?: DocumentSearchResult[]
): string {
  const parts: string[] = [];

  if (webResults && webResults.length > 0) {
    parts.push('Web Search Results:');
    webResults.forEach((result, i) => {
      parts.push(`${i + 1}. [${result.title}](${result.url})`);
      parts.push(`   ${result.snippet}`);
      if (result.publishedDate) {
        parts.push(`   Published: ${result.publishedDate}`);
      }
    });
  }

  if (docResults && docResults.length > 0) {
    parts.push('\nDocument Library Results:');
    docResults.forEach((result, i) => {
      parts.push(`${i + 1}. ${result.title} (${result.source})`);
      parts.push(`   ${result.snippet}`);
      if (result.url) {
        parts.push(`   Source: ${result.url}`);
      }
    });
  }

  return parts.join('\n');
}

/**
 * Format search results as citations for display
 * 
 * @param webResults - Web search results
 * @param docResults - Document search results
 * @returns Array of citation objects
 */
export function formatSearchResultsAsCitations(
  webResults?: SearchResult[],
  docResults?: DocumentSearchResult[]
): Array<{
  type: 'web' | 'document';
  title: string;
  url: string;
  snippet: string;
  source?: string;
}> {
  const citations: Array<{
    type: 'web' | 'document';
    title: string;
    url: string;
    snippet: string;
    source?: string;
  }> = [];

  if (webResults) {
    webResults.forEach((result) => {
      citations.push({
        type: 'web',
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        source: result.domain,
      });
    });
  }

  if (docResults) {
    docResults.forEach((result) => {
      citations.push({
        type: 'document',
        title: result.title,
        url: result.url || '#',
        snippet: result.snippet,
        source: result.source,
      });
    });
  }

  return citations;
}

