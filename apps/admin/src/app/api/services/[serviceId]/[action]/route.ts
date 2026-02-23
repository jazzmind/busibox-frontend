/**
 * POST /api/services/:serviceId/:action
 * 
 * Control a service (start, stop, restart).
 * Proxies to deploy-api for Docker container control.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, getSessionUser, requireAdmin } from '@jazzmind/busibox-app/lib/next/middleware';

const DEPLOY_API_URL = process.env.DEPLOYMENT_SERVICE_URL || 'http://deploy-api:8011/api/v1/deployment';

// Service to container mapping
const SERVICE_CONTAINERS: Record<string, string> = {
  postgres: 'local-postgres',
  authz: 'local-authz-api',
  nginx: 'local-nginx',
  redis: 'local-redis',
  minio: 'local-minio',
  milvus: 'local-milvus',
  litellm: 'local-litellm',
  embedding: 'local-embedding-api',
  data: 'local-data-api',
  search: 'local-search-api',
  agent: 'local-agent-api',
};

const VALID_ACTIONS = ['start', 'stop', 'restart'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string; action: string }> }
) {
  try {
    const { serviceId, action } = await params;

    // Require admin user
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    // Validate service ID
    const container = SERVICE_CONTAINERS[serviceId];
    if (!container) {
      return apiError(`Unknown service: ${serviceId}`, 400);
    }

    // Validate action
    if (!VALID_ACTIONS.includes(action)) {
      return apiError(`Invalid action: ${action}. Must be one of: ${VALID_ACTIONS.join(', ')}`, 400);
    }

    // Call deploy-api to perform the action
    const response = await fetch(`${DEPLOY_API_URL}/docker/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        container,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return apiError(errorData.message || `Failed to ${action} service`, response.status);
    }

    const result = await response.json();

    return apiSuccess({
      serviceId,
      action,
      result,
    });
  } catch (error) {
    console.error('[API] Service action error:', error);
    return apiError('Failed to perform service action', 500);
  }
}
