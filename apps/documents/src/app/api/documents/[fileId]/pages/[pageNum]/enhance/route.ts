import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string; pageNum: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    setSessionJwtForUser(user.id, sessionJwt);
    const { fileId, pageNum } = await params;

    const body = await request.json();

    const response = await dataFetch(
      `POST /api/documents/[fileId]/pages/[pageNum]/enhance - enhance page ${pageNum} of ${fileId}`,
      `/files/${fileId}/pages/${pageNum}/enhance`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        userId: user.id,
        timeout: 120000,
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to enhance page' },
      { status: error.statusCode || 500 }
    );
  }
}
