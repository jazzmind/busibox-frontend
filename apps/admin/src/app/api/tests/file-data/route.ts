import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import { buildServiceAuthorization } from '../helpers';

/**
 * Proxy endpoint for viewing file data (chunks, vectors, markdown, source)
 * Adds authentication headers before forwarding to data-api
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    
    // Set session JWT for Zero Trust token exchange
    setSessionJwtForUser(user.id, sessionJwt);
    
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const type = searchParams.get('type'); // chunks, vectors, markdown, or source

    if (!fileId || !type) {
      return NextResponse.json(
        { error: 'Missing fileId or type parameter' },
        { status: 400 }
      );
    }

    // Build authorization header (legacy - dataFetch now handles this internally)
    const authorization = await buildServiceAuthorization(sessionJwt, user);

    // Map type to data-api endpoint
    const endpoint = type === 'source' 
      ? `/files/${fileId}`
      : `/files/${fileId}/${type}`;

    // Forward request to data-api with auth
    const response = await dataFetch(
      `Get file ${type}`,
      endpoint,
      {
        headers: {
          Authorization: authorization,
          'X-User-Id': user.id,
        },
      }
    );

    // Check if response is JSON or binary
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // For source files (binary), stream the response
      const blob = await response.blob();
      return new NextResponse(blob, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': response.headers.get('content-disposition') || '',
        },
      });
    }
  } catch (error: any) {
    console.error('[admin/tests/file-data] Failed to fetch file data', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch file data' },
      { status: 500 }
    );
  }
}










