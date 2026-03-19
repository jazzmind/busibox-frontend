import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    const { user, sessionJwt } = authResult;
    setSessionJwtForUser(user.id, sessionJwt);

    const { fileId } = await params;

    const response = await dataFetch(
      `GET /api/documents/[fileId]/provenance - get provenance for ${fileId}`,
      `/files/${fileId}/provenance`,
      {
        userId: user.id,
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching provenance:', error);

    if (error.statusCode === 404) {
      return NextResponse.json(
        { error: 'Provenance not found for this file' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.statusCode || 500 }
    );
  }
}
