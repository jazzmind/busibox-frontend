/**
 * Conversation Title API Route
 * 
 * POST /api/chat/conversations/[id]/title - Generate or update conversation title
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  errorResponse,
  successResponse,
  withErrorHandling,
  ChatErrorCodes,
  validateRequired,
} from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import { updateConversation, checkConversationAccess } from '@jazzmind/busibox-app/lib/agent/chat-conversations';
import { getAgentApiToken } from '@jazzmind/busibox-app/lib/agent/chat-api-client';
import { generateConversationTitle } from '@jazzmind/busibox-app/lib/agent/llm-client';
import { getMessages } from '@jazzmind/busibox-app/lib/agent/chat-messages';

/**
 * POST /api/chat/conversations/[id]/title
 * 
 * Generate or update conversation title
 * 
 * Body:
 * - title?: string (optional) - Manual title, if not provided will auto-generate
 * - autoGenerate?: boolean (optional, default: true) - Auto-generate if title not provided
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse<unknown>> => {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult as NextResponse<unknown>;
    }
    const { user } = authResult;

    const { id: conversationId } = await params;
    const body = await request.json();

    const sessionJwt = getSessionJwt(request);
    if (!sessionJwt) {
      return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
    }
    const token = await getAgentApiToken(user.id, sessionJwt);

    // Check access (must be owner or editor)
    const access = await checkConversationAccess(token, conversationId, user.id);
    if (!access || access === 'viewer') {
      return errorResponse(
        'You do not have permission to update this conversation',
        403,
        ChatErrorCodes.FORBIDDEN
      );
    }

    let title: string;

    if (body.title && typeof body.title === 'string') {
      // Use provided title
      title = body.title.trim().substring(0, 200); // Max 200 chars
      if (title.length === 0) {
        return errorResponse('Title cannot be empty', 400, ChatErrorCodes.INVALID_INPUT);
      }
    } else if (body.autoGenerate !== false) {
      // Auto-generate title from conversation messages
      const messages = await getMessages(token, conversationId, { limit: 10 });
      const userMessages = messages.filter((m) => m.role === 'user');
      
      if (userMessages.length === 0) {
        return errorResponse(
          'Cannot generate title: conversation has no messages',
          400,
          ChatErrorCodes.INVALID_INPUT
        );
      }

      // Use first user message for title generation
      const firstMessage = userMessages[0].content;
      title = await generateConversationTitle(firstMessage);
    } else {
      return errorResponse(
        'Either provide a title or enable auto-generation',
        400,
        ChatErrorCodes.INVALID_INPUT
      );
    }

    // Update conversation
    const updated = await updateConversation(token, conversationId, user.id, { title });

    if (!updated) {
      return errorResponse(
        'Failed to update conversation title',
        500,
        ChatErrorCodes.INTERNAL_ERROR
      );
    }

    return successResponse({ title: updated.title });
  }
);

