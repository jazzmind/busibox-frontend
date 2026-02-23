/**
 * Admin LLM Speech API Route
 *
 * Proxies text-to-speech requests to agent-api's /llm/audio/speech endpoint.
 * Returns audio binary data.
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
      purpose: 'admin-llm-speech',
    });

    const body = await request.json();

    const response = await fetch(`${agentApiUrl}/llm/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent API audio/speech error:', response.status, errorText);
      return apiError(`TTS failed: ${errorText}`, response.status);
    }

    // Return audio binary data with the same content-type from the upstream response
    const audioBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('Content-Type') || 'audio/mpeg';

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline; filename="speech.mp3"',
      },
    });
  } catch (error) {
    console.error('LLM speech API error:', error);
    return apiError('Internal server error', 500);
  }
}
