/**
 * POST /api/services/health
 * 
 * Check health of a Docker service via deploy-api.
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
      return apiError('Admin access required', 403);
    }

    const body = await request.json();
    const { service, endpoint } = body;

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
          scopes: ['admin', 'services:read'],
          purpose: 'Service health check',
        },
        {
          authzBaseUrl: AUTHZ_BASE_URL,
          verbose: true,
        }
      );
      
      adminToken = exchangeResult.accessToken;
    } catch (exchangeError) {
      // If the session is invalid (e.g., signing key changed), require logout
      if (isInvalidSessionError(exchangeError)) {
        console.error('[API/services/health] Session is invalid - user should log out:', exchangeError);
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code
        );
      }
      console.warn('[API/services/health] Token exchange error, using session token:', exchangeError);
      // Fall back to session token if exchange fails for other reasons
    }
    
    // Call deploy-api to check service health
    const response = await fetch(`${DEPLOY_API_BASE}/api/v1/services/health`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ service, endpoint: endpoint || '/health' }),
    });

    if (!response.ok) {
      return apiSuccess({ healthy: false });
    }

    const result = await response.json();
    return apiSuccess({ healthy: result.healthy || false });
  } catch (error) {
    console.error('[API] Check service health error:', error);
    return apiSuccess({ healthy: false });
  }
}
