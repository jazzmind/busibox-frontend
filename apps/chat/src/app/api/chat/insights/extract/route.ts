/**
 * Chat Insights Extraction API
 * 
 * POST /api/chat/insights/extract - Manually trigger insight extraction
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  errorResponse,
  successResponse,
  withErrorHandling,
  ChatErrorCodes,
} from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import { extractInsights } from '@jazzmind/busibox-app/lib/agent/chat-insights';
import { getAgentApiToken } from '@jazzmind/busibox-app/lib/agent/chat-api-client';
import { getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';

/**
 * POST /api/chat/insights/extract
 * 
 * Manually trigger insight extraction for the current user
 * 
 * Body (optional):
 * - userId?: string - Extract for specific user (admin only)
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
    const body = await request.json().catch(() => ({}));
    const targetUserId = body.userId || user.id;

    // Only allow users to extract their own insights unless admin
    // TODO: Add admin check if needed
    if (targetUserId !== user.id) {
      return errorResponse(
        'You can only extract insights for your own account',
        403,
        ChatErrorCodes.FORBIDDEN
      );
    }

    try {
      const sessionJwt = getSessionJwt(request);
      if (!sessionJwt) {
        return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
      }
      const token = await getAgentApiToken(targetUserId, sessionJwt);

      const result = await extractInsights(token, targetUserId);

      return successResponse(
        {
          status: 'accepted',
          message: 'Insight extraction started',
          result,
        },
        202
      );
    } catch (error: any) {
      console.error('Failed to trigger insight extraction:', error);
      return errorResponse(
        error.message || 'Failed to trigger insight extraction',
        500,
        ChatErrorCodes.INTERNAL_ERROR
      );
    }
  }
);

