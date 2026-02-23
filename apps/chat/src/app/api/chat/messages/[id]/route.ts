import { NextRequest } from 'next/server';
import { requireAuth, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  errorResponse,
  successResponse,
  withErrorHandling,
  ChatErrorCodes,
} from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import { getAgentApiToken, getMessage, deleteMessage } from '@jazzmind/busibox-app/lib/agent/chat-api-client';

/**
 * DELETE /api/chat/messages/[id]
 * Delete a message via agent-api
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

    const sessionJwt = getSessionJwt(request);
    if (!sessionJwt) {
      return errorResponse('Missing session JWT', 401, ChatErrorCodes.UNAUTHORIZED);
    }

    const { id: messageId } = await params;

    const token = await getAgentApiToken(user.id, sessionJwt);

    // Get the message (agent-api verifies conversation access)
    let message;
    try {
      message = await getMessage(token, messageId);
    } catch {
      return errorResponse(
        'Message not found',
        404,
        ChatErrorCodes.CONVERSATION_NOT_FOUND
      );
    }

    // Delete the message via agent-api
    await deleteMessage(token, message.conversation_id, messageId);

    return successResponse({ success: true });
  }
);


