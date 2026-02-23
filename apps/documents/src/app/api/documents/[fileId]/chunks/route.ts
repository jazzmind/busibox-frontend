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

    // Get query parameters for pagination
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    // Fetch chunks from data service
    const response = await dataFetch(
      `GET /api/documents/[fileId]/chunks - get chunks ${fileId}`,
      `/files/${fileId}/chunks?page=${page}&page_size=${pageSize}`,
      {
        userId: user.id,  // Required for authz token exchange (RLS passthrough)
      }
    );

    const data = await response.json();
    
    // Transform camelCase to snake_case for frontend compatibility
    const transformedData = {
      ...data,
      chunks: data.chunks?.map((chunk: any) => ({
        chunk_id: chunk.chunkId || `${fileId}-${chunk.chunkIndex}`,
        chunk_index: chunk.chunkIndex,
        text: chunk.text,
        page_number: chunk.pageNumber,
        section_heading: chunk.sectionHeading,
        token_count: chunk.tokenCount,
        processing_strategy: chunk.processingStrategy,
      })) || []
    };
    
    return NextResponse.json(transformedData);

  } catch (error: any) {
    console.error('Error fetching chunks:', error);
    
    if (error.statusCode === 404) {
      return NextResponse.json(
        { error: 'Chunks not found for this file' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.statusCode || 500 }
    );
  }
}


