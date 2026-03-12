/**
 * GET  /api/email-settings  — Read persisted email config (sensitive fields masked)
 * PATCH /api/email-settings — Update email config in config-api
 *
 * Email settings are stored in config-api's config_entries table under the
 * `smtp` category. Bridge reads them on demand via a scope-restricted token,
 * so no restart is needed after updates.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  getEmailConfigToken,
  getEmailConfigFromDeployApi,
  saveEmailConfigToDeployApi,
  maskEmailConfig,
  isMaskedValue,
  type EmailConfig,
} from '@jazzmind/busibox-app/lib/bridge/email-config';
import { getBridgeApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

// -------------------------------------------------------------------------
// GET — read config (masked)
// -------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;

    const token = await getEmailConfigToken(user.id, sessionJwt);
    const config = await getEmailConfigFromDeployApi(token);

    // Check bridge health to determine active provider
    let activeProvider = 'unknown';
    try {
      const bridgeUrl = getBridgeApiUrl();
      const resp = await fetch(`${bridgeUrl}/health`);
      if (resp.ok) {
        const health = await resp.json();
        activeProvider = health.email_provider || 'none';
      }
    } catch {
      activeProvider = 'unreachable';
    }

    return apiSuccess({
      config: maskEmailConfig(config),
      activeProvider,
    });
  } catch (error) {
    console.error('[API] Get email settings error:', error);
    return apiError('Failed to load email settings', 500);
  }
}

// -------------------------------------------------------------------------
// PATCH — update config
// -------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;

    const body = await parseJsonBody(request);
    if (!body || typeof body !== 'object') {
      return apiError('Invalid request body', 400);
    }

    // Build updates, skipping masked values (unchanged passwords)
    const updates: Partial<EmailConfig> = {};

    if (body.smtpHost !== undefined) {
      updates.smtpHost = body.smtpHost || null;
    }
    if (body.smtpPort !== undefined) {
      const port = Number(body.smtpPort);
      updates.smtpPort = Number.isFinite(port) && port > 0 ? port : null;
    }
    if (body.smtpUser !== undefined) {
      updates.smtpUser = body.smtpUser || null;
    }
    if (body.smtpPassword !== undefined && !isMaskedValue(body.smtpPassword)) {
      updates.smtpPassword = body.smtpPassword || null;
    }
    if (body.smtpSecure !== undefined) {
      updates.smtpSecure = body.smtpSecure === true || body.smtpSecure === 'true';
    }
    if (body.emailFrom !== undefined) {
      updates.emailFrom = body.emailFrom || null;
    }
    if (body.resendApiKey !== undefined && !isMaskedValue(body.resendApiKey)) {
      updates.resendApiKey = body.resendApiKey || null;
    }

    if (Object.keys(updates).length === 0) {
      return apiError('No valid fields to update', 400);
    }

    const token = await getEmailConfigToken(user.id, sessionJwt);
    const saved = await saveEmailConfigToDeployApi(token, updates);

    console.log('[API] Email settings updated by', user.email, '— keys:', Object.keys(updates));

    return apiSuccess({
      config: maskEmailConfig(saved),
      message: 'Email settings updated successfully. Bridge will use the new settings on next email send.',
    });
  } catch (error) {
    console.error('[API] Update email settings error:', error);
    return apiError('Failed to update email settings', 500);
  }
}
