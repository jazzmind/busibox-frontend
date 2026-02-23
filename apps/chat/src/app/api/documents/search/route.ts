/**
 * Document Search API Route
 * 
 * Performs sophisticated search on uploaded documents via the dedicated Search API.
 * 
 * The Search API (search-api service) provides:
 * 1. Hybrid search combining dense semantic vectors + BM25 keyword search
 * 2. Cross-encoder reranking for improved accuracy
 * 3. Search term highlighting with fuzzy matching
 * 4. Semantic alignment visualization
 * 5. User permission filtering (RLS)
 * 
 * Features:
 * - Multiple search modes: keyword, semantic, hybrid (recommended)
 * - Result highlighting with HTML markup
 * - Detailed scoring breakdown (dense, sparse, rerank)
 * - Semantic alignment matrix for top results
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import { callService } from '@jazzmind/busibox-app/lib/next/service-client';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    
    const body = await parseJsonBody(request);
    const validationError = validateRequiredFields(body, ['query']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { query, limit = 10, offset = 0 } = body;

    console.log(`[API] Document search requested by ${user.email}: "${query}"`);

    // Call Search API for semantic search across all user documents
    // Uses authz-issued access token for proper RBAC enforcement
    const response = await callService({
      sessionJwt,
      userId: user.id,
      service: 'search-api',
      scopes: [],
      purpose: 'busibox-portal.document-search',
      path: '/search',
      method: 'POST',
      body: {
        query,
        limit,
        offset,
        mode: 'hybrid',  // Use hybrid mode for best results
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[API] Search error:', errorData);
      throw new Error(errorData.error || 'Search failed');
    }

    const data = await response.json();

    // Transform results to match frontend expectations
    const transformedResults = (data.results || []).map((result: any) => ({
      fileId: result.fileId || result.file_id,
      filename: result.filename,
      chunkIndex: result.chunkIndex || result.chunk_index,
      pageNumber: result.pageNumber || result.page_number,
      text: result.text,
      score: result.score,
      metadata: result.metadata,
    }));

    console.log(
      `[API] Search completed: ${transformedResults.length} results for "${query}"`
    );

    return apiSuccess({
      query: query,
      results: transformedResults,
      total: transformedResults.length,
      limit: limit,
      offset: offset,
    });
  } catch (error: any) {
    console.error('[API] Document search error:', error);
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      return apiError('Search API is not available', 503);
    }

    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}
