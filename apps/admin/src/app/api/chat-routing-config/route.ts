/** Administrator-controlled model routing policy for the Chat app. */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { getConfigApiToken, getPublicConfig, setConfig } from '@jazzmind/busibox-app/lib/config/client';

const CONFIG_KEY = 'chat_model_routing_mode';
const VALID_MODES = new Set(['local', 'auto', 'frontier']);

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const publicConfig = await getPublicConfig();
    const configuredMode = publicConfig[CONFIG_KEY] || 'local';
    const mode = VALID_MODES.has(configuredMode) ? configuredMode : 'local';
    return apiSuccess({ config: { mode } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch chat routing config';
    return apiError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;

    const body = await request.json();
    const mode = typeof body.mode === 'string' ? body.mode.toLowerCase() : '';
    if (!VALID_MODES.has(mode)) {
      return apiError('mode must be local, auto, or frontier', 400);
    }

    const token = await getConfigApiToken(user.id, sessionJwt);
    await setConfig(token, CONFIG_KEY, {
      value: mode,
      scope: 'platform',
      tier: 'public',
      category: 'chat',
      description: 'Chat model routing policy: local, auto, or frontier',
    });

    return apiSuccess({ config: { mode } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update chat routing config';
    return apiError(message, 500);
  }
}
