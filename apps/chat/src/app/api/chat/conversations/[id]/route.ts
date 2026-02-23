/**
 * Chat Conversation Detail API
 * 
 * GET /api/chat/conversations/[id] - Get conversation with messages
 * PATCH /api/chat/conversations/[id] - Update conversation
 * DELETE /api/chat/conversations/[id] - Delete conversation
 */

import { NextRequest } from 'next/server';
import { requireAuth, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  errorResponse,
  successResponse,
  withErrorHandling,
  ChatErrorCodes,
} from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from '@jazzmind/busibox-app/lib/agent/chat-conversations';
import { getAgentApiToken } from '@jazzmind/busibox-app/lib/agent/chat-api-client';

/**
 * GET /api/chat/conversations/[id]
 * 
 * Get conversation details with messages
 * 
 * Query params:
 * - includeMessages: Include messages (default: true)
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user } = authResult;

    const { id: conversationId } = await params;

    const sessionJwt = getSessionJwt(request);
    if (!sessionJwt) {
      return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
    }
    const token = await getAgentApiToken(user.id, sessionJwt);

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const includeMessages = searchParams.get('includeMessages') !== 'false';

    // Get conversation
    const conversation = await getConversation(
      token,
      conversationId,
      user.id,
      includeMessages
    );

    if (!conversation) {
      return errorResponse(
        'Conversation not found',
        404,
        ChatErrorCodes.CONVERSATION_NOT_FOUND
      );
    }

    return successResponse(conversation);
  }
);

/**
 * PATCH /api/chat/conversations/[id]
 * 
 * Update conversation (owner only)
 * 
 * Body:
 * - title?: string
 * - isPrivate?: boolean
 */
export const PATCH = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user } = authResult;

    const { id: conversationId } = await params;

    const sessionJwt = getSessionJwt(request);
    if (!sessionJwt) {
      return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
    }
    const token = await getAgentApiToken(user.id, sessionJwt);

    // Parse body
    const body = await request.json();

    // Validate
    if (body.title !== undefined && typeof body.title !== 'string') {
      return errorResponse(
        'Title must be a string',
        400,
        ChatErrorCodes.INVALID_INPUT
      );
    }

    if (body.isPrivate !== undefined && typeof body.isPrivate !== 'boolean') {
      return errorResponse(
        'isPrivate must be a boolean',
        400,
        ChatErrorCodes.INVALID_INPUT
      );
    }

    // Update conversation
    const conversation = await updateConversation(token, conversationId, user.id, {
      title: body.title,
      isPrivate: body.isPrivate,
    });

    if (!conversation) {
      return errorResponse(
        'Conversation not found or you do not have permission to update it',
        403,
        ChatErrorCodes.FORBIDDEN
      );
    }

    return successResponse(conversation);
  }
);

/**
 * DELETE /api/chat/conversations/[id]
 * 
 * Delete conversation (owner only)
 * Cascades to messages, attachments, and shares
 */
export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user } = authResult;

    const { id: conversationId } = await params;

    const sessionJwt = getSessionJwt(request);
    if (!sessionJwt) {
      return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
    }
    const token = await getAgentApiToken(user.id, sessionJwt);

    // Delete conversation
    const deleted = await deleteConversation(token, conversationId, user.id);

    if (!deleted) {
      return errorResponse(
        'Conversation not found or you do not have permission to delete it',
        403,
        ChatErrorCodes.FORBIDDEN
      );
    }

    return successResponse({ success: true, deleted: conversationId });
  }
);

