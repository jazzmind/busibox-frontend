/**
 * Admin Tags API Route
 * 
 * Lists all tags with their usage counts.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getSearchApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;

    // Fetch tags from search API
    const searchApiUrl = getSearchApiUrl();
    
    try {
      // Exchange session JWT for search-api token
      const userId = getUserIdFromSessionJwt(sessionJwt);
      if (!userId) {
        console.error('Failed to get userId from session JWT');
        return apiSuccess([]);
      }
      const tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId,
        audience: 'search-api',
        purpose: 'admin-tags',
      });

      const response = await fetch(`${searchApiUrl}/search/tags`, {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return apiSuccess(data.tags || data || []);
      }
    } catch (error) {
      // Log but don't fail - service may be unavailable
      console.error('Failed to fetch from search API:', error);
    }

    // Return empty array if search API is not available
    return apiSuccess([]);
  } catch (error) {
    console.error('Tags API error:', error);
    return apiError('Internal server error', 500);
  }
}
