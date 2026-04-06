/**
 * Insights Configuration API
 *
 * Reads/writes the platform-level insights_enabled flag via config-api.
 *
 * GET  /api/insights-config - Get insights configuration
 * POST /api/insights-config - Update insights configuration
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getConfigApiToken,
  getPublicConfig,
  setConfig,
} from '@jazzmind/busibox-app/lib/config/client';

const CONFIG_KEY = 'insights_enabled';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const publicConfig = await getPublicConfig();
    const insightsEnabled = publicConfig[CONFIG_KEY] !== 'false';

    return apiSuccess({
      config: {
        insightsEnabled,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[Insights Config] Error fetching config:', err);
    return apiError(err?.message || 'Failed to fetch insights config', 500);
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
    const { insightsEnabled } = body;

    if (typeof insightsEnabled !== 'boolean') {
      return apiError('insightsEnabled must be a boolean', 400);
    }

    const token = await getConfigApiToken(user.id, sessionJwt);

    await setConfig(token, CONFIG_KEY, {
      value: String(insightsEnabled),
      scope: 'platform',
      tier: 'public',
      category: 'chat',
      description: 'Enable AI insights and onboarding system',
    });

    return apiSuccess({
      config: {
        insightsEnabled,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[Insights Config] Error updating config:', err);
    return apiError(err?.message || 'Failed to update insights config', 500);
  }
}
