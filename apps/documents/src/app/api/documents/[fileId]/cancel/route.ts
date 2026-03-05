import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export async function POST(
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
      `POST /api/documents/[fileId]/cancel - cancel processing ${fileId}`,
      `/files/${fileId}/cancel`,
      {
        method: 'POST',
        userId: user.id,
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to cancel processing' },
      { status: error.statusCode || 500 }
    );
  }
}
