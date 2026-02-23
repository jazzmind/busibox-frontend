/**
 * POST /api/deploy - Trigger Ansible deployment
 * PUT /api/deploy - Update install state
 * GET /api/deploy - Get install state
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getSessionUser, requireAdmin, getSessionJwt } from '@jazzmind/busibox-app/lib/next/middleware';

// Deploy API - accessed directly within Docker network for server-to-server calls
// Using direct container URL avoids SSL certificate issues
const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const DEPLOY_API_V1 = `${DEPLOY_API_BASE}/api/v1/deployment`;

// Map target IDs to Ansible make targets
const TARGET_MAP: Record<string, string> = {
  all: 'all',
  apps: 'deploy-apps',
  infra: 'files,pg,milvus,redis',
  ai: 'litellm,embedding',
  portal: 'deploy-busibox-portal',
  agents: 'deploy-busibox-agents',
};

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    const body = await request.json();
    const { target, environment } = body;

    // Validate target
    if (!target || !TARGET_MAP[target]) {
      return apiError(`Invalid target: ${target}`, 400);
    }

    // Validate environment
    if (!['staging', 'production'].includes(environment)) {
      return apiError('Invalid environment. Must be "staging" or "production"', 400);
    }

    const makeTarget = TARGET_MAP[target];

    // Call deploy-api to trigger Ansible deployment
    try {
      const response = await fetch(`${DEPLOY_API_V1}/ansible/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: makeTarget,
          environment,
          user: user.email,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return apiError(error.message || 'Failed to start deployment', response.status);
      }

      const result = await response.json();

      return apiSuccess({
        message: 'Deployment started',
        deploymentId: result.deploymentId,
        target: makeTarget,
        environment,
      });
    } catch (fetchError) {
      console.error('[API] Deploy API call failed:', fetchError);
      return apiError('Failed to connect to deployment service', 503);
    }
  } catch (error) {
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to start deployment');
  }
}

/**
 * PUT /api/deploy
 * 
 * Update installation state via deploy-api.
 */
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
    const { updates } = body;

    if (!updates || typeof updates !== 'object') {
      return apiError('Updates object is required', 400);
    }

    // Get session token for auth
    const sessionToken = getSessionJwt(request);

    // Call deploy-api to update state
    try {
      const response = await fetch(`${DEPLOY_API_BASE}/system/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` }),
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return apiError(error.detail || 'Failed to update state', response.status);
      }

      const result = await response.json();
      return apiSuccess(result);
    } catch (fetchError) {
      console.error('[API] Deploy API state update failed:', fetchError);
      return apiError('Failed to connect to deployment service', 503);
    }
  } catch (error) {
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to update installation state');
  }
}

/**
 * GET /api/deploy
 * 
 * Get installation state from deploy-api.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    // Get session token for auth
    const sessionToken = getSessionJwt(request);

    // Call deploy-api to get state
    try {
      const response = await fetch(`${DEPLOY_API_BASE}/system/state`, {
        method: 'GET',
        headers: {
          ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` }),
        },
      });

      if (!response.ok) {
        // Return default state if deploy-api is not available
        return apiSuccess({
          phase: 'bootstrap',
          status: 'unknown',
        });
      }

      const data = await response.json();
      return apiSuccess(data);
    } catch (fetchError) {
      console.error('[API] Deploy API state fetch failed:', fetchError);
      // Return default state if deploy-api is not available
      return apiSuccess({
        phase: 'bootstrap',
        status: 'unknown',
      });
    }
  } catch (error) {
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to get installation state');
  }
}
