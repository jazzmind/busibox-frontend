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
      `GET /api/documents/[fileId]/image-urls - batch image URLs ${fileId}`,
      `/files/${fileId}/image-urls`,
      { userId: user.id }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=3000',
      },
    });
  } catch (error: any) {
    console.error('Error fetching image URLs:', error);

    if (error.statusCode === 404) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.statusCode || 500 }
    );
  }
}
