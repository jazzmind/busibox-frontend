import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthorizationHeaderWithSession } from '@jazzmind/busibox-app/lib/authz/next-client';

function getAgentApiUrl() {
  return (
    process.env.AGENT_API_URL ||
    (process.env.AGENT_HOST
      ? `http://${process.env.AGENT_HOST}:${process.env.AGENT_API_PORT || 8000}`
      : 'http://localhost:8000')
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;
    const { user, sessionJwt } = authResult;
    const { fileId } = await params;
    const body = await request.json();

    if (!body?.schemaDocumentId) {
      return apiError('schemaDocumentId is required', 400);
    }

    const authHeader = await getAuthorizationHeaderWithSession({
      sessionJwt,
      userId: user.id,
      audience: 'agent-api',
      scopes: ['agent.execute', 'data.read', 'data.write'],
      purpose: 'document-extract',
    });

    const response = await fetch(`${getAgentApiUrl()}/extract`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        schema_document_id: body.schemaDocumentId,
        agent_id: body.agentId || null,
        prompt_override: body.promptOverride || null,
        store_results: body.storeResults !== false,
      }),
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error: any) {
    return apiError(error.message || 'Failed to extract document', 500);
  }
}
