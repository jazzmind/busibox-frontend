/**
 * Admin Database Stats API Route
 * 
 * Returns database statistics including vector counts from Milvus.
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

    // Fetch database stats from search API
    const searchApiUrl = getSearchApiUrl();
    
    try {
      // Exchange session JWT for search-api token
      const userId = getUserIdFromSessionJwt(sessionJwt);
      if (!userId) {
        console.error('Failed to get userId from session JWT');
        return apiSuccess({
          totalRecords: 0,
          tableCount: 0,
          vectorCount: 0,
          indexSize: 0,
        });
      }
      const tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId,
        audience: 'search-api',
        purpose: 'admin-database-stats',
      });

      const response = await fetch(`${searchApiUrl}/search/stats`, {
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return apiSuccess(data);
      }
    } catch (error) {
      // Log but don't fail - service may be unavailable
      console.error('Failed to fetch database stats from search API:', error);
    }

    // Return default stats if search API is not available
    return apiSuccess({
      totalRecords: 0,
      tableCount: 0,
      vectorCount: 0,
      indexSize: 0,
    });
  } catch (error) {
    console.error('Database stats API error:', error);
    return apiError('Internal server error', 500);
  }
}
