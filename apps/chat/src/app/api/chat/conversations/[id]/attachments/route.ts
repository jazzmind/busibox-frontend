/**
 * Chat Attachments API
 * 
 * POST /api/chat/conversations/[id]/attachments - Upload attachment
 */

import { NextRequest } from 'next/server';
import { requireAuth, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  errorResponse,
  successResponse,
  withErrorHandling,
  ChatErrorCodes,
} from '@jazzmind/busibox-app/lib/agent/chat-middleware';
import { checkConversationAccess } from '@jazzmind/busibox-app/lib/agent/chat-conversations';
import { getAgentApiToken } from '@jazzmind/busibox-app/lib/agent/chat-api-client';
import { processAttachment, validateFile } from '@jazzmind/busibox-app/lib/agent/chat-attachments';
import { setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

/**
 * POST /api/chat/conversations/[id]/attachments
 * 
 * Upload an attachment to a conversation
 * 
 * Form data:
 * - file: File (required)
 */
export const POST = withErrorHandling(
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

    // Set session JWT for Zero Trust token exchange with data service
    setSessionJwtForUser(user.id, sessionJwt);

    const token = await getAgentApiToken(user.id, sessionJwt);

    // Check access
    const access = await checkConversationAccess(token, conversationId, user.id);
    if (!access) {
      return errorResponse(
        'Conversation not found',
        404,
        ChatErrorCodes.CONVERSATION_NOT_FOUND
      );
    }

    if (access === 'viewer') {
      return errorResponse(
        'You do not have permission to add attachments to this conversation',
        403,
        ChatErrorCodes.FORBIDDEN
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse(
        'File is required',
        400,
        ChatErrorCodes.MISSING_REQUIRED_FIELD
      );
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return errorResponse(
        validation.error || 'Invalid file',
        400,
        ChatErrorCodes.INVALID_FILE_TYPE,
        { error: validation.error }
      );
    }

    // Process attachment
    try {
      const processed = await processAttachment(token, file, {
        conversationId,
        userId: user.id,
      });

      return successResponse(processed, 201);
    } catch (error: any) {
      console.error('Failed to process attachment:', error);
      return errorResponse(
        error.message || 'Failed to process attachment',
        500,
        ChatErrorCodes.INTERNAL_ERROR
      );
    }
  }
);

