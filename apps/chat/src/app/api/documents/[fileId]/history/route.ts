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

    // Fetch processing history from data service
    const response = await dataFetch(
      `GET /api/documents/[fileId]/history - get history ${fileId}`,
      `/files/${fileId}/history`,
      {
        userId: user.id,  // Required for authz token exchange (RLS passthrough)
      }
    );

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error fetching processing history:', error);
    
    if (error.statusCode === 404) {
      return NextResponse.json(
        { error: 'File not found or no history available' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch processing history', details: error.message || 'Unknown error' },
      { status: error.statusCode || 500 }
    );
  }
}


