/**
 * Chat Document Search API
 * 
 * POST /api/chat/search/documents - Search document libraries for chat context
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  errorResponse,
  successResponse,
  validateRequired,
  withErrorHandling,
  ChatErrorCodes,
} from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import { searchDocuments } from '@jazzmind/busibox-app/lib/agent/chat-search';

/**
 * POST /api/chat/search/documents
 * 
 * Search user's document libraries for chat context
 * 
 * Body:
 * - query: string (required) - Search query
 * - limit?: number - Max results (default: 5)
 * - offset?: number - Pagination offset (default: 0)
 * - mode?: 'keyword' | 'semantic' | 'hybrid' - Search mode (default: 'hybrid')
 */
export const POST = withErrorHandling(
  async (request: NextRequest) => {
    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user } = authResult;

    // Parse body
    const body = await request.json();

    // Validate required fields
    const validation = validateRequired(body, ['query']);
    if (!validation.valid) {
      return errorResponse(
        `Missing required fields: ${validation.missing?.join(', ')}`,
        400,
        ChatErrorCodes.MISSING_REQUIRED_FIELD,
        { missing: validation.missing }
      );
    }

    const { query, limit, offset, mode } = body;

    // Perform search
    const result = await searchDocuments(query, user.id, {
      limit: limit || 5,
      offset: offset || 0,
      mode: mode || 'hybrid',
    });

    // Return error if search failed
    if (result.error) {
      return errorResponse(
        result.error,
        503,
        ChatErrorCodes.SEARCH_UNAVAILABLE
      );
    }

    return successResponse(result);
  }
);

