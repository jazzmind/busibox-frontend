import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string; index: string }> }
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
    const { fileId, index } = resolvedParams;

    // Fetch image from data service
    const response = await dataFetch(
      `GET /api/documents/[fileId]/images/[index] - get image ${fileId}/${index}`,
      `/files/${fileId}/images/${index}`,
      {
        userId: user.id,  // Required for authz token exchange (RLS passthrough)
      }
    );

    // Get image data
    const imageData = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    // Return image with appropriate headers
    return new NextResponse(imageData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });

  } catch (error: any) {
    console.error('Error fetching image:', error);
    
    if (error.statusCode === 404) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.statusCode || 500 }
    );
  }
}


