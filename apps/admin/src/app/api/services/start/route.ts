/**
 * POST /api/services/start
 * 
 * Start a Docker service via deploy-api.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const DEPLOY_API_BASE = process.env.DEPLOY_API_URL || 'http://deploy-api:8011';
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

export async function POST(request: NextRequest) {
  try {
    // Get user with roles from session JWT
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    
    if (!userWithSession) {
      return apiError('Authentication required', 401);
    }

    const { sessionJwt, ...user } = userWithSession;

    if (!requireAdmin(user)) {
      console.error('[API/services/start] User lacks admin role. User roles:', user.roles);
      return apiError('Admin access required', 403);
    }

    const body = await request.json();
    const { service } = body;

    if (!service) {
      return apiError('Service name is required', 400);
    }

    // Exchange session token for admin-scoped token via authz using busibox-app library
    let adminToken = sessionJwt;
    
    try {
      const exchangeResult = await exchangeTokenZeroTrust(
        {
          sessionJwt,
          audience: 'deploy-api',
          scopes: ['admin', 'deployment:manage', 'services:manage'],
          purpose: 'Service deployment management',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: true,
        }
      );
      
      adminToken = exchangeResult.accessToken;
      console.log('[API/services/start] Token exchange successful');
    } catch (exchangeError) {
      // If the session is invalid (e.g., signing key changed), require logout
      if (isInvalidSessionError(exchangeError)) {
        console.error('[API/services/start] Session is invalid - user should log out:', exchangeError);
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code
        );
      }
      console.warn('[API/services/start] Token exchange error, using session token:', exchangeError);
      // Fall back to session token if exchange fails for other reasons
    }
    
    // Call deploy-api to start the service
    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ service }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return apiError(error.detail || 'Failed to start service', response.status);
    }

    const result = await response.json();
    return apiSuccess(result);
  } catch (error) {
    console.error('[API] Start service error:', error);
    return apiError('Failed to start service', 500);
  }
}
