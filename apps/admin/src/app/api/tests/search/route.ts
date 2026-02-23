import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { buildServiceAuthorization } from '../helpers';
import { searchDocuments } from '@jazzmind/busibox-app/lib/agent/chat-search';

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user, sessionJwt } = authResult;
  const body = await request.json().catch(() => ({}));
  const query = body?.query || '';
  const mode = body?.mode || 'hybrid';
  const useReranker = body?.useReranker !== false; // Default to true
  const rerankerModel = body?.rerankerModel || 'qwen3-gpu';

  if (!query || typeof query !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Query is required' },
      { status: 400 }
    );
  }

  const authorization = await buildServiceAuthorization(sessionJwt, user);

  try {
    const result = await searchDocuments(query, user.id, {
      mode,
      authorization,
      limit: 5,
      useReranker,
      rerankerModel,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[admin/tests/search] RAG search failed', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Search failed' },
      { status: 500 }
    );
  }
}










