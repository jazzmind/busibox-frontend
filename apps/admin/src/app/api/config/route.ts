/**
 * GET/PUT /api/config
 * 
 * Get and update system configuration.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getSessionUser, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';

// Configuration keys that can be managed through this endpoint
const ALLOWED_CONFIG_KEYS = [
  'EMAIL_FROM',
  'RESEND_API_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'APP_URL',  // Runtime URL for server-side code (passkeys, emails, etc.)
  'ALLOWED_EMAIL_DOMAINS',
  'REQUIRE_PASSKEY_ADMIN',
  'SESSION_EXPIRY_HOURS',
];

// Keys that should be masked in responses
const SENSITIVE_KEYS = [
  'RESEND_API_KEY',
  'SMTP_PASSWORD',
];

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    // Get config from environment variables
    // In production, these would come from the database or deploy-api
    const config: Record<string, string> = {};
    
    for (const key of ALLOWED_CONFIG_KEYS) {
      const value = process.env[key] || '';
      // Mask sensitive values
      if (SENSITIVE_KEYS.includes(key) && value) {
        config[key] = value.substring(0, 4) + '****' + value.substring(value.length - 4);
      } else {
        config[key] = value;
      }
    }

    return apiSuccess({ config });
  } catch (error) {
    console.error('[API] Get config error:', error);
    return apiError('Failed to get configuration', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    const body = await request.json();
    const { config } = body;

    if (!config || typeof config !== 'object') {
      return apiError('Invalid config object', 400);
    }

    // Filter to only allowed keys
    const updates: Record<string, string> = {};
    for (const key of ALLOWED_CONFIG_KEYS) {
      if (key in config && config[key] !== undefined) {
        // Skip masked values (they haven't been changed)
        if (SENSITIVE_KEYS.includes(key) && config[key].includes('****')) {
          continue;
        }
        updates[key] = config[key];
      }
    }

    // In a real implementation, this would:
    // 1. Store config in database
    // 2. Call deploy-api to update environment variables
    // 3. Optionally restart affected services
    
    // For now, we just log the updates
    console.log('[API] Config updates:', Object.keys(updates));

    // TODO: Implement actual config storage via deploy-api
    // const response = await fetch(`${DEPLOY_API_URL}/config`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ updates }),
    // });

    return apiSuccess({ 
      message: 'Configuration updated',
      updatedKeys: Object.keys(updates),
    });
  } catch (error) {
    console.error('[API] Update config error:', error);
    return apiError('Failed to update configuration', 500);
  }
}
