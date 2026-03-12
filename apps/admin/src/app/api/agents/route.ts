import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const agentApiUrl = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Failed to get userId from session', 401);

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt, userId, audience: 'agent-api', purpose: 'admin-agents-list',
    });

    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '200';

    const response = await fetch(`${agentApiUrl}/agents?limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${tokenResult.accessToken}` },
    });

    if (response.ok) {
      const data = await response.json();
      return apiSuccess(data);
    }

    const errorText = await response.text();
    console.error('[admin/api/agents] agent-api error:', response.status, errorText);
    return apiError(`Agent API error: ${response.status}`, response.status);
  } catch (error) {
    console.error('[admin/api/agents] error:', error);
    return apiError('Failed to fetch agents', 500);
  }
}
