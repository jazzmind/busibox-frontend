/**
 * Chat Insights Query API
 * 
 * POST /api/chat/insights/query - Query relevant insights for a user
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
import { queryInsights } from '@jazzmind/busibox-app/lib/agent/chat-insights';
import { getAgentApiToken } from '@jazzmind/busibox-app/lib/agent/chat-api-client';
import { getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';

/**
 * POST /api/chat/insights/query
 * 
 * Query relevant insights for the current user based on a search query
 * 
 * Body:
 * - query: string (required) - Search query
 * - limit?: number - Max results (default: 3)
 * - scoreThreshold?: number - Minimum similarity score (default: 0.7)
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

    const { query, limit, scoreThreshold } = body;

    const sessionJwt = getSessionJwt(request);
    if (!sessionJwt) {
      return errorResponse('Missing session JWT', 401, ChatErrorCodes.UNAUTHORIZED);
    }
    const token = await getAgentApiToken(user.id, sessionJwt);

    try {
      const insights = await queryInsights(token, query, user.id, {
        limit: limit || 3,
        scoreThreshold: scoreThreshold || 0.7,
      });

      return successResponse({
        query,
        insights,
        count: insights.length,
      });
    } catch (error: any) {
      console.error('Failed to query insights:', error);
      return errorResponse(
        error.message || 'Failed to query insights',
        500,
        ChatErrorCodes.INTERNAL_ERROR
      );
    }
  }
);

