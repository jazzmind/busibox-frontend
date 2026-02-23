/**
 * Admin LLM Transcribe API Route
 *
 * Proxies audio transcription requests to agent-api's /llm/audio/transcribe endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const agentApiUrl = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';

    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) {
      return apiError('Failed to get userId from session', 401);
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'agent-api',
      purpose: 'admin-llm-transcribe',
    });

    // Forward the multipart form data as-is
    const formData = await request.formData();

    const response = await fetch(`${agentApiUrl}/llm/audio/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent API audio/transcribe error:', response.status, errorText);
      return apiError(`Transcription failed: ${errorText}`, response.status);
    }

    const data = await response.json();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('LLM transcribe API error:', error);
    return apiError('Internal server error', 500);
  }
}
