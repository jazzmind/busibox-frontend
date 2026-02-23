/**
 * Chat Conversations API
 * 
 * GET /api/chat/conversations - List user's conversations
 * POST /api/chat/conversations - Create new conversation
 */

import { NextRequest } from 'next/server';
import { requireAuth, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAgentApiToken } from '@jazzmind/busibox-app/lib/agent/chat-api-client';
import {
  errorResponse,
  successResponse,
  validateRequired,
  parsePagination,
  paginatedResponse,
  withErrorHandling,
  ChatErrorCodes,
} from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import {
  getUserConversations,
  createConversation,
} from '@jazzmind/busibox-app/lib/agent/chat-conversations';

/**
 * GET /api/chat/conversations
 * 
 * List user's conversations (owned + shared)
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - includeShared: Include shared conversations (default: true)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }
  const { user } = authResult;

  const sessionJwt = getSessionJwt(request);
  if (!sessionJwt) {
    return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
  }
  const token = await getAgentApiToken(user.id, sessionJwt);

  // Parse pagination
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const includeShared = searchParams.get('includeShared') !== 'false';

  // Get conversations
  const result = await getUserConversations(token, {
    userId: user.id,
    page,
    limit,
    includeShared,
  });

  // Return paginated response
  return successResponse(
    paginatedResponse(result.conversations, result.total, page, limit)
  );
});

/**
 * POST /api/chat/conversations
 * 
 * Create a new conversation
 * 
 * Body:
 * - title?: string (optional, defaults to "New Conversation")
 * - isPrivate?: boolean (optional, defaults to false)
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }
  const { user } = authResult;

  // Parse body
  const body = await request.json();

  // Validate (no required fields, but validate types if provided)
  if (body.title && typeof body.title !== 'string') {
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

  const sessionJwt = getSessionJwt(request);
  if (!sessionJwt) {
    return errorResponse('Missing session', 401, ChatErrorCodes.UNAUTHORIZED);
  }
  const token = await getAgentApiToken(user.id, sessionJwt);

  // Create conversation
  const conversation = await createConversation(
    token,
    user.id,
    body.title,
    body.isPrivate ?? false
  );

  return successResponse(conversation, 201);
});

