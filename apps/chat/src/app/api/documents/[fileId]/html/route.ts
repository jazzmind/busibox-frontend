import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;

    // Set session JWT for Zero Trust token exchange
    setSessionJwtForUser(user.id, sessionJwt);

    const resolvedParams = await params;
    const { fileId } = resolvedParams;

    // Fetch HTML from data service
    const response = await dataFetch(
      `GET /api/documents/[fileId]/html - get HTML ${fileId}`,
      `/files/${fileId}/html`,
      {
        userId: user.id,  // Required for authz token exchange (RLS passthrough)
      }
    );

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error fetching HTML:', error);
    
    if (error.statusCode === 404) {
      return NextResponse.json(
        { error: 'HTML not available for this file' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch HTML', details: error.message || 'Unknown error' },
      { status: error.statusCode || 500 }
    );
  }
}


