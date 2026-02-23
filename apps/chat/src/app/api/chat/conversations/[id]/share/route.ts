/**
 * Conversation Sharing API Routes
 * 
 * POST /api/chat/conversations/[id]/share - Share conversation with a user
 * GET /api/chat/conversations/[id]/share - Get all shares for a conversation
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  errorResponse,
  successResponse,
  withErrorHandling,
  ChatErrorCodes,
  validateRequired,
} from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import { shareConversation, getConversationShares } from '@jazzmind/busibox-app/lib/agent/chat-sharing';
import { getAgentApiToken } from '@jazzmind/busibox-app/lib/agent/chat-api-client';
import { getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import type { ShareRole } from '@jazzmind/busibox-app/lib/agent/chat-sharing';

/**
 * POST /api/chat/conversations/[id]/share
 * Share a conversation with another user
 */
export const POST = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user } = authResult;

    const { id: conversationId } = await params;
    const body = await request.json();

    // Validate required fields
    const validation = validateRequired(body, ['targetUserEmail', 'role']);
    if (!validation.valid) {
      return errorResponse(
        `Missing required fields: ${validation.missing?.join(', ')}`,
        400,
        ChatErrorCodes.MISSING_REQUIRED_FIELD,
        { missing: validation.missing }
      );
    }

    const { targetUserEmail, role } = body;

    // Validate role
    if (role !== 'viewer' && role !== 'editor') {
      return errorResponse('Invalid role. Must be "viewer" or "editor"', 400, ChatErrorCodes.INVALID_INPUT);
    }

    try {
      const sessionJwt = getSessionJwt(request);
      if (!sessionJwt) {
        return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
      }
      const token = await getAgentApiToken(user.id, sessionJwt);

      const share = await shareConversation(token, {
        conversationId,
        ownerId: user.id,
        targetUserEmail,
        role: role as ShareRole,
      });

      return successResponse(share, 201);
    } catch (error: any) {
      console.error('Share conversation error:', error);
      
      // Handle specific error cases
      if (error.message === 'Conversation not found') {
        return errorResponse('Conversation not found', 404, ChatErrorCodes.CONVERSATION_NOT_FOUND);
      }
      if (error.message === 'Only the conversation owner can share it') {
        return errorResponse('Only the conversation owner can share it', 403, ChatErrorCodes.FORBIDDEN);
      }
      if (error.message === 'Cannot share private conversations') {
        return errorResponse('Cannot share private conversations', 400, ChatErrorCodes.INVALID_INPUT);
      }
      if (error.message === 'User not found') {
        return errorResponse('User not found', 404, ChatErrorCodes.CONVERSATION_NOT_FOUND);
      }
      if (error.message === 'Cannot share conversation with yourself') {
        return errorResponse('Cannot share conversation with yourself', 400, ChatErrorCodes.INVALID_INPUT);
      }

      return errorResponse(
        error.message || 'Failed to share conversation',
        500,
        ChatErrorCodes.INTERNAL_ERROR
      );
    }
  }
);

/**
 * GET /api/chat/conversations/[id]/share
 * Get all shares for a conversation
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user } = authResult;

    const { id: conversationId } = await params;

    try {
      const sessionJwt = getSessionJwt(request);
      if (!sessionJwt) {
        return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
      }
      const token = await getAgentApiToken(user.id, sessionJwt);

      const shares = await getConversationShares(token, conversationId, user.id);
      return successResponse({ shares });
    } catch (error: any) {
      console.error('Get conversation shares error:', error);
      
      if (error.message === 'Conversation not found' || error.message === 'Access denied') {
        return errorResponse(error.message, 404, ChatErrorCodes.CONVERSATION_NOT_FOUND);
      }

      return errorResponse(
        error.message || 'Failed to get conversation shares',
        500,
        ChatErrorCodes.INTERNAL_ERROR
      );
    }
  }
);

