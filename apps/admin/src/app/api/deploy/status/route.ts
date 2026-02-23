/**
 * GET /api/deploy/status
 * 
 * Get deployment status, install state, and history.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

// Deploy API - accessed directly within Docker network for server-to-server calls
const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const DEPLOY_API_V1 = `${DEPLOY_API_BASE}/api/v1/deployment`;
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function GET(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) {
      return apiError('Authentication required', 401);
    }

    const { sessionJwt, ...user } = userWithSession;

    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    // Default to development for local installs, use BUSIBOX_ENVIRONMENT if set
    const defaultEnv = process.env.BUSIBOX_ENVIRONMENT || 
        (process.env.NODE_ENV === 'production' ? 'production' : 'development');
    const environment = searchParams.get('environment') || defaultEnv;

    // Exchange session token for deploy-api scoped token
    let adminToken = sessionJwt;
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'system:read'],
          purpose: 'Get deployment status',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: false,
        }
      );
      adminToken = exchangeResult.accessToken;
    } catch (exchangeError) {
      // If the session is invalid (e.g., signing key changed), require logout
      if (isInvalidSessionError(exchangeError)) {
        console.error('[API/deploy/status] Session is invalid - user should log out:', exchangeError);
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code
        );
      }
      console.warn('[API/deploy/status] Token exchange error, using session token:', exchangeError);
      // Fall back to session token if exchange fails for other reasons
    }

    // Try to get install state from deploy-api
    let installState = null;
    try {
      const stateResponse = await fetch(`${DEPLOY_API_BASE}/system/state`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      });

      if (stateResponse.ok) {
        const rawState = await stateResponse.json();
        // Extract only safe fields - raw contains secrets!
        installState = {
          phase: rawState.phase,
          status: rawState.status,
          environment: rawState.environment,
          platform: rawState.platform,
          llmBackend: rawState.llmBackend,
          llmTier: rawState.llmTier,
          adminEmail: rawState.adminEmail,
          baseDomain: rawState.baseDomain,
          adminUserId: rawState.adminUserId,
          // ONLY check SETUP_COMPLETE flag - set by setup wizard after user completes setup
          // INSTALL_PHASE tracks Ansible deployment, not user setup completion
          setupComplete: rawState.SETUP_COMPLETE === 'true',
        };
      } else {
        console.warn(`[API/deploy/status] Deploy API state fetch returned ${stateResponse.status}`);
      }
    } catch (fetchError) {
      console.error('[API/deploy/status] Deploy API state fetch failed:', fetchError);
    }

    // Try to get deployment status from deploy-api
    try {
      const response = await fetch(`${DEPLOY_API_V1}/ansible/status?environment=${environment}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return apiSuccess({
          ...data,
          installState,
        });
      }
    } catch (fetchError) {
      console.error('[API] Deploy API status call failed:', fetchError);
    }

    // Return default data if deploy-api is not available
    const targets = [
      {
        id: 'all',
        name: 'Full Stack',
        environment,
        description: `Deploy all services to ${environment} environment`,
        status: 'ready',
      },
      {
        id: 'apps',
        name: 'Applications Only',
        environment,
        description: 'Deploy Busibox Portal and Agent Manager',
        status: 'ready',
      },
      {
        id: 'infra',
        name: 'Infrastructure',
        environment,
        description: 'Deploy PostgreSQL, Redis, Milvus, MinIO',
        status: 'ready',
      },
      {
        id: 'ai',
        name: 'AI Services',
        environment,
        description: 'Deploy LiteLLM, Embedding API',
        status: 'ready',
      },
    ];

    return apiSuccess({
      targets,
      logs: [],
      installState,
    });
  } catch (error) {
    console.error('[API] Get deploy status error:', error);
    return apiError('Failed to get deployment status', 500);
  }
}
