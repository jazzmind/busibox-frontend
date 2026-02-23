/**
 * Libraries by Folder API Route
 * 
 * GET: Get a library by folder name
 * 
 * This endpoint is used by the agent server to resolve folder names
 * like "personal-research" to actual library IDs.
 * 
 * Supported folder names:
 * - "personal" or "personal-docs" -> Personal DOCS library
 * - "personal-research" or "research" -> Personal RESEARCH library
 * - "personal-tasks" or "tasks" -> Personal TASKS library
 * 
 * As of the library consolidation effort, this endpoint proxies to
 * the data-api service which is now the source of truth for library data.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { getLibraryByFolder } from '@jazzmind/busibox-app/lib/data/libraries';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

const DATA_API_URL = getDataApiUrl();

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    
    // Get folder name from query params
    const folder = request.nextUrl.searchParams.get('folder');
    
    if (!folder || typeof folder !== 'string') {
      return apiError('folder query parameter is required', 400);
    }

    // Try data-api first (source of truth for library data)
    try {
      const dataUrl = `${DATA_API_URL}/libraries/by-folder?folder=${encodeURIComponent(folder)}`;
      console.log(`[API/libraries/by-folder] Proxying to data-api: ${dataUrl}`);
      
      const response = await fetch(dataUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionJwt}`,
          'X-User-Id': user.id,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[API/libraries/by-folder] Data-api returned library: ${data.library?.id}`);
        return apiSuccess({ library: data.library });
      }
      
      // If 404 from data-api, fall through to local DB
      if (response.status === 404) {
        console.log(`[API/libraries/by-folder] Library not found in data-api, falling back to local DB`);
      } else {
        console.warn(`[API/libraries/by-folder] Data-api error: ${response.status}`);
      }
    } catch (dataError: any) {
      console.warn(`[API/libraries/by-folder] Failed to reach data-api: ${dataError.message}`);
      // Fall through to local database
    }

    // Fallback: query local database (for backward compatibility during migration)
    console.log(`[API/libraries/by-folder] Using local database fallback for folder: ${folder}`);
    const library = await getLibraryByFolder(user.id, folder);

    if (!library) {
      return apiError('Library not found for folder: ' + folder, 404);
    }

    return apiSuccess({ library });
  } catch (error: any) {
    console.error('[API] Get library by folder error:', error);
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}
