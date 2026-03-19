/**
 * Document Search API Route
 *
 * Performs hybrid search across documents via the Search API.
 * Supports keyword, semantic, and hybrid modes with highlighting.
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

    const {
      query,
      limit = 30,
      offset = 0,
      mode = 'hybrid',
      rerank = false,
      reranker_model,
      rerank_k = 100,
      highlight,
      filters,
    } = body;

    const searchBody: Record<string, any> = {
      query,
      limit,
      offset,
      mode,
      rerank,
      highlight: highlight || {
        enabled: true,
        fragment_size: 200,
        num_fragments: 3,
      },
    };

    if (reranker_model) searchBody.reranker_model = reranker_model;
    if (rerank_k) searchBody.rerank_k = rerank_k;
    if (filters) searchBody.filters = filters;

    const response = await callService({
      sessionJwt,
      userId: user.id,
      service: 'search-api',
      scopes: [],
      purpose: 'busibox-documents.document-search',
      path: '/search',
      method: 'POST',
      body: searchBody,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[API] Search error:', errorData);
      throw new Error(errorData.error || 'Search failed');
    }

    const data = await response.json();

    const transformedResults = (data.results || []).map((result: any) => ({
      fileId: result.fileId || result.file_id,
      filename: result.filename,
      chunkIndex: result.chunkIndex ?? result.chunk_index ?? 0,
      pageNumber: result.pageNumber ?? result.page_number ?? -1,
      text: result.text,
      score: result.score,
      scores: result.scores,
      highlights: result.highlights,
      metadata: result.metadata,
    }));

    return apiSuccess({
      query,
      results: transformedResults,
      total: data.total || transformedResults.length,
      limit,
      offset,
      execution_time_ms: data.execution_time_ms,
    });
  } catch (error: any) {
    console.error('[API] Document search error:', error);

    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      return apiError('Search API is not available', 503);
    }

    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}
