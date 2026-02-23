/**
 * Conversation Unshare API Route
 * 
 * DELETE /api/chat/conversations/[id]/share/[userId] - Unshare conversation with a user
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  errorResponse,
  successResponse,
  withErrorHandling,
  ChatErrorCodes,
} from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import { unshareConversation } from '@jazzmind/busibox-app/lib/agent/chat-sharing';
import { getAgentApiToken } from '@jazzmind/busibox-app/lib/agent/chat-api-client';
import { getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';

/**
 * DELETE /api/chat/conversations/[id]/share/[userId]
 * Unshare a conversation with a specific user
 */
export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> }
  ) => {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user } = authResult;

    const { id: conversationId, userId } = await params;

    try {
      const sessionJwt = getSessionJwt(request);
      if (!sessionJwt) {
        return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
      }
      const token = await getAgentApiToken(user.id, sessionJwt);

      await unshareConversation(token, conversationId, userId, user.id);
      return successResponse({ success: true });
    } catch (error: any) {
      console.error('Unshare conversation error:', error);
      
      if (error.message === 'Conversation not found') {
        return errorResponse('Conversation not found', 404, ChatErrorCodes.CONVERSATION_NOT_FOUND);
      }
      if (error.message === 'Only the conversation owner can unshare it') {
        return errorResponse('Only the conversation owner can unshare it', 403, ChatErrorCodes.FORBIDDEN);
      }
      if (error.message === 'Share not found') {
        return errorResponse('Share not found', 404, ChatErrorCodes.CONVERSATION_NOT_FOUND);
      }

      return errorResponse(
        error.message || 'Failed to unshare conversation',
        500,
        ChatErrorCodes.INTERNAL_ERROR
      );
    }
  }
);

