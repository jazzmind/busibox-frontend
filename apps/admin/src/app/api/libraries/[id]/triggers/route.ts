/**
 * Admin Library Triggers API Route
 *
 * GET: List triggers for a library
 * POST: Create a new trigger on a library
 *
 * Proxies to data-api /libraries/{id}/triggers
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id } = await params;
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'data-api',
      scopes: ['data:read'],
      purpose: 'admin-library-triggers',
    });

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('activeOnly') || 'false';

    const response = await fetch(
      `${getDataApiUrl()}/libraries/${id}/triggers?activeOnly=${activeOnly}`,
      { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } }
    );

    if (!response.ok) {
      return apiError('Failed to list triggers', response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[admin/triggers] GET error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id } = await params;
    const body = await request.json();

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'data-api',
      scopes: ['data:write'],
      purpose: 'admin-library-triggers',
    });

    const response = await fetch(`${getDataApiUrl()}/libraries/${id}/triggers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
      body: JSON.stringify({
        name: body.name,
        description: body.description,
        triggerType: body.triggerType,
        agentId: body.agentId,
        prompt: body.prompt,
        schemaDocumentId: body.schemaDocumentId,
        notificationConfig: body.notificationConfig,
        delegationToken: body.delegationToken,
        delegationScopes: body.delegationScopes,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/triggers] Create failed:', response.status, errorText);
      return apiError('Failed to create trigger', response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[admin/triggers] POST error:', error);
    return apiError('Internal server error', 500);
  }
}
