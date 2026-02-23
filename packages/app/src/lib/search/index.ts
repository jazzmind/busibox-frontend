/**
 * Search exports for busibox-app
 * 
 * Unified search client for:
 * - Web search (Tavily, DuckDuckGo, Perplexity, Bing, etc.)
 * - Document search (BM25 keyword, vector semantic, hybrid, MMR)
 * 
 * For chat insights, use '@jazzmind/busibox-app/lib/agent/insights' instead.
 */

// ============================================================================
// Web Search
// ============================================================================

export {
  searchWeb,
  getAvailableProviders,
  getProviderStatus,
  type WebSearchResult,
  type WebSearchResponse,
  type WebSearchOptions,
  type ProviderStatus,
} from './client';

// ============================================================================
// Document Search
// ============================================================================

export {
  searchDocuments,
  searchKeyword,
  searchSemantic,
  searchHybrid,
  searchMMR,
  getSemanticAlignment,
  type DocumentSearchResult,
  type DocumentSearchResponse,
  type DocumentSearchOptions,
} from './client';

// ============================================================================
// Common
// ============================================================================

export {
  checkSearchHealth,
  type TokenManager,
} from './client';

