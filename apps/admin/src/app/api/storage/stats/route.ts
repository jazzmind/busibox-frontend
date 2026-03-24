/**
 * Admin Storage Stats API Route
 * 
 * Returns file storage statistics from MinIO.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;

    // Fetch storage stats from data API
    const dataApiHost = process.env.DATA_API_HOST || 'localhost';
    const dataApiPort = process.env.DATA_API_PORT || '8002';
    const dataApiUrl = `http://${dataApiHost}:${dataApiPort}`;
    
    try {
      // Exchange session JWT for data-api token
      const userId = getUserIdFromSessionJwt(sessionJwt);
      if (!userId) {
        console.error('Failed to get userId from session JWT');
        return apiSuccess({
          totalSize: 0,
          usedSize: 0,
          fileCount: 0,
          bucketCount: 0,
        });
      }
      const tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId,
        audience: 'data-api',
        purpose: 'admin-storage-stats',
      });

      const response = await fetch(`${dataApiUrl}/files/storage/stats`, {
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
      console.error('Failed to fetch storage stats from data API:', error);
    }

    // Return default stats if data API is not available
    return apiSuccess({
      totalSize: 0,
      usedSize: 0,
      fileCount: 0,
      bucketCount: 0,
    });
  } catch (error) {
    console.error('Storage stats API error:', error);
    return apiError('Internal server error', 500);
  }
}
