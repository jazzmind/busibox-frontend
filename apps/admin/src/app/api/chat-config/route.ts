/**
 * Chat Configuration API
 * 
 * Uses chat-config-store (data-api backed) instead of Prisma.
 * 
 * GET /api/chat-config - Get chat configuration
 * POST /api/chat-config - Update chat configuration
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getChatConfigToken,
  getChatConfig,
  upsertChatConfig,
} from '@jazzmind/busibox-app/lib/agent/chat-config';
import { getSharedRoleIdsForConfig } from '@jazzmind/busibox-app/lib/data/portal-config';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;

    const token = await getChatConfigToken(user.id, sessionJwt);
    const chatConfig = await getChatConfig(token);

    return apiSuccess({
      config: {
        streamingEnabled: chatConfig.streaming_enabled,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[Chat Config] Error fetching config:', err);
    return apiError(err?.message || 'Failed to fetch chat config', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;

    const body = await request.json();
    const { streamingEnabled } = body;

    if (typeof streamingEnabled !== 'boolean') {
      return apiError('streamingEnabled must be a boolean', 400);
    }

    const token = await getChatConfigToken(user.id, sessionJwt);
    const roleIds = getSharedRoleIdsForConfig(token, sessionJwt);

    await upsertChatConfig(token, { streaming_enabled: streamingEnabled }, roleIds);

    return apiSuccess({
      config: {
        streamingEnabled,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[Chat Config] Error updating config:', err);
    return apiError(err?.message || 'Failed to update chat config', 500);
  }
}

