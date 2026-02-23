/**
 * Insights API Client for busibox-app
 * 
 * Thin wrapper around agent-api HTTP endpoints for chat insights.
 * Insights are agent memories stored in Milvus.
 */

import 'server-only';

export interface ChatInsight {
  id: string;
  userId: string;
  content: string;
  embedding: number[];
  conversationId: string;
  analyzedAt: number; // Unix timestamp
  category?: string; // preference, fact, goal, context, other
}

export interface InsightFrontend {
  id: string;
  content: string;
  category: string;
  importance: number;
  source: string;
  conversationId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface InsightSearchResult {
  id: string;
  content: string;
  insight: InsightFrontend;
  score: number;
  distance: number;
}

export interface InsightListResponse {
  results: InsightSearchResult[];
  total: number;
  offset: number;
  limit: number;
  by_category: Record<string, number>;
}

export interface InsightStatsResponse {
  total: number;
  by_category: Record<string, number>;
  userId: string;
  count: number;
  collectionName: string;
}

export interface TokenManager {
  getAuthzToken(audience: string, scopes: string[]): Promise<string>;
}

// Agent API configuration (insights migrated from search-api to agent-api)
const AGENT_API_URL = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';
// Legacy: Search API fallback
const SEARCH_API_URL = process.env.SEARCH_API_URL || process.env.NEXT_PUBLIC_SEARCH_API_URL || 'http://localhost:8001';

// Use agent-api for insights
const INSIGHTS_API_URL = AGENT_API_URL;

/**
 * Initialize the chat_insights collection in Milvus
 * 
 * Creates the collection with schema if it doesn't exist.
 * This is idempotent - safe to call multiple times.
 */
export async function initializeChatInsightsCollection(
  tokenManager?: TokenManager
): Promise<void> {
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('agent-api', ['insights:write']);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[initializeChatInsightsCollection] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${INSIGHTS_API_URL}/insights/init`, {
    method: 'POST',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to initialize collection: ${error.detail || response.statusText}`);
  }
}

/**
 * Insert insights into Milvus
 * 
 * @param insights - Array of insights to insert
 * @param tokenManager - Token manager for authentication
 */
export async function insertInsights(
  insights: ChatInsight[],
  tokenManager?: TokenManager
): Promise<void> {
  if (insights.length === 0) {
    return;
  }
  
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('agent-api', ['insights:write']);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[insertInsights] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${INSIGHTS_API_URL}/insights`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ insights }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to insert insights: ${error.detail || response.statusText}`);
  }
}

/**
 * Search for relevant insights based on query
 * 
 * @param query - Search query text
 * @param userId - User ID to filter results
 * @param options - Search configuration
 * @param tokenManager - Token manager for authentication
 * @returns Array of relevant insights with scores
 */
export async function searchInsights(
  query: string,
  userId: string,
  options: {
    limit?: number;
    scoreThreshold?: number;
  } = {},
  tokenManager?: TokenManager
): Promise<InsightSearchResult[]> {
  const { limit = 3, scoreThreshold = 0.7 } = options;
  
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('agent-api', ['insights:read']);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[searchInsights] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${INSIGHTS_API_URL}/insights/search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query,
      userId,
      limit,
      scoreThreshold,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to search insights: ${error.detail || response.statusText}`);
  }
  
  const data = await response.json();
  return data.results;
}

/**
 * List all insights for a user with pagination and optional filtering
 * 
 * @param options - List configuration (category, offset, limit)
 * @param tokenManager - Token manager for authentication
 * @returns Paginated list of insights with category counts
 */
export async function listInsights(
  options: {
    category?: string;
    offset?: number;
    limit?: number;
  } = {},
  tokenManager?: TokenManager
): Promise<InsightListResponse> {
  const { category, offset = 0, limit = 50 } = options;
  
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('agent-api', ['insights:read']);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[listInsights] Failed to get auth token:', error);
    }
  }
  
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  params.set('offset', String(offset));
  params.set('limit', String(limit));
  
  const response = await fetch(`${INSIGHTS_API_URL}/insights/list?${params.toString()}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to list insights: ${error.detail || response.statusText}`);
  }
  
  return response.json();
}

/**
 * Delete insights for a conversation
 * 
 * @param conversationId - Conversation ID
 * @param userId - User ID (for authorization)
 * @param tokenManager - Token manager for authentication
 */
export async function deleteConversationInsights(
  conversationId: string,
  userId: string,
  tokenManager?: TokenManager
): Promise<void> {
  let headers: Record<string, string> = {};
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('agent-api', ['insights:write']);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[deleteConversationInsights] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${INSIGHTS_API_URL}/insights/conversation/${conversationId}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to delete conversation insights: ${error.detail || response.statusText}`);
  }
}

/**
 * Get insight count for a user
 * 
 * @param userId - User ID
 * @param tokenManager - Token manager for authentication
 * @returns Number of insights
 */
export async function getUserInsightCount(
  userId: string,
  tokenManager?: TokenManager
): Promise<number> {
  let headers: Record<string, string> = {};
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('agent-api', ['insights:read']);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[getUserInsightCount] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${INSIGHTS_API_URL}/insights/stats/${userId}`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to get user insight count: ${error.detail || response.statusText}`);
  }
  
  const data = await response.json();
  return data.total || data.count;
}

/**
 * Delete all insights for a user (for account deletion/cleanup)
 * 
 * @param userId - User ID
 * @param tokenManager - Token manager for authentication
 */
export async function deleteUserInsights(
  userId: string,
  tokenManager?: TokenManager
): Promise<void> {
  let headers: Record<string, string> = {};
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('agent-api', ['insights:write']);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[deleteUserInsights] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${INSIGHTS_API_URL}/insights/user/${userId}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to delete user insights: ${error.detail || response.statusText}`);
  }
}

/**
 * Flush collection to ensure data persistence
 * 
 * Call this after batch inserts for data durability.
 */
export async function flushInsightsCollection(
  tokenManager?: TokenManager
): Promise<void> {
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('agent-api', ['insights:write']);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[flushInsightsCollection] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${INSIGHTS_API_URL}/insights/flush`, {
    method: 'POST',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to flush collection: ${error.detail || response.statusText}`);
  }
}

/**
 * Get collection statistics including category counts
 * 
 * @param tokenManager - Token manager for authentication (uses /me endpoint)
 */
export async function getCollectionStats(
  tokenManager?: TokenManager
): Promise<InsightStatsResponse> {
  let headers: Record<string, string> = {};
  
  if (tokenManager) {
    try {
      const token = await tokenManager.getAuthzToken('agent-api', ['insights:read']);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('[getCollectionStats] Failed to get auth token:', error);
    }
  }
  
  const response = await fetch(`${INSIGHTS_API_URL}/insights/stats/me`, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to get collection stats: ${error.detail || response.statusText}`);
  }
  
  return response.json();
}

/**
 * Health check for insights service
 * 
 * @returns true if service is healthy
 */
export async function checkInsightsHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${INSIGHTS_API_URL}/health`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.status === 'healthy' || data.status === 'degraded';
  } catch (error) {
    console.error('[checkInsightsHealth] Health check failed:', error);
    return false;
  }
}

