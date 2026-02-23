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

    // Get format from query params
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'markdown';

    // Validate format
    const validFormats = ['markdown', 'html', 'text', 'docx', 'pdf'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // Export document via data service
    const response = await dataFetch(
      `GET /api/documents/[fileId]/export - export document ${fileId}`,
      `/files/${fileId}/export?format=${format}`,
      {
        userId: user.id,  // Required for authz token exchange (RLS passthrough)
      }
    );

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition');

    // Stream the response
    const blob = await response.blob();
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition || `attachment; filename="document.${format}"`,
      },
    });

  } catch (error: any) {
    console.error('Error exporting document:', error);
    
    if (error.statusCode === 404) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.statusCode || 500 }
    );
  }
}





