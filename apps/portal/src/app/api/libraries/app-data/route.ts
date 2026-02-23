/**
 * App Data Libraries API Route
 * 
 * GET: List app data "libraries" - data documents with sourceApp metadata
 * 
 * App data libraries are structured data created by apps like busibox-projects.
 * They are exposed as "libraries" for browsing in the document manager.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    
    // Get optional sourceApp filter from query params
    const { searchParams } = new URL(request.url);
    const sourceApp = searchParams.get('sourceApp');

    // Build the URL for data-api
    const dataApiUrl = getDataApiUrl();
    const url = new URL('/libraries/app-data', dataApiUrl);
    if (sourceApp) {
      url.searchParams.set('sourceApp', sourceApp);
    }

    // Exchange session JWT for a data-api scoped token via Zero Trust
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:read'],
      purpose: 'app-data-libraries',
    });

    // Call the data-api to get app data libraries
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If data-api returns an error, return empty result (app data is optional)
      if (response.status === 404 || response.status === 501) {
        return apiSuccess({ data: [], grouped: [], total: 0 });
      }
      
      const errorText = await response.text();
      console.error('[API/libraries/app-data] Data API error:', response.status, errorText);
      return apiError('Failed to fetch app data libraries', response.status);
    }

    const data = await response.json();
    
    // Return the grouped and data arrays directly (apiSuccess wraps in { success: true, data: {...} })
    return apiSuccess({
      groups: data.grouped || [],
      data: data.data || [],
      total: data.total || 0,
    });
  } catch (error: any) {
    console.error('[API/libraries/app-data] Error:', error);
    // Return empty result on error - app data is optional
    return apiSuccess({ data: [], grouped: [], total: 0 });
  }
}
