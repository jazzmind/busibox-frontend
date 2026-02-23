/**
 * Library Triggers API Route
 *
 * GET: List triggers for a library
 * POST: Create a new trigger on a library
 *
 * Proxies to data-api /libraries/{id}/triggers
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { canAccessLibrary, canManageLibrary } from '@jazzmind/busibox-app/lib/data/libraries';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id } = await params;

    const hasAccess = await canAccessLibrary(user.id, id, sessionJwt);
    if (!hasAccess) {
      return apiError('Library not found or access denied', 404);
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:read'],
      purpose: 'library-triggers',
    });

    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('activeOnly') || 'false';

    const response = await fetch(
      `${getDataApiUrl()}/libraries/${id}/triggers?activeOnly=${activeOnly}`,
      {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Data-api triggers list failed:', response.status, errorText);
      return apiError('Failed to list triggers', response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error: unknown) {
    console.error('[API] List triggers error:', error);
    return apiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id } = await params;

    const canManage = await canManageLibrary(user.id, id, sessionJwt);
    if (!canManage) {
      return apiError('Access denied', 403);
    }

    const body = await request.json();
    const payload = {
      name: body.name,
      description: body.description,
      triggerType: body.triggerType,
      agentId: body.agentId,
      prompt: body.prompt,
      schemaDocumentId: body.schemaDocumentId,
      notificationConfig: body.notificationConfig,
      delegationToken: body.delegationToken,
      delegationScopes: body.delegationScopes,
    };

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:write'],
      purpose: 'library-triggers',
    });

    const response = await fetch(`${getDataApiUrl()}/libraries/${id}/triggers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Data-api trigger create failed:', response.status, errorText);
      return apiError('Failed to create trigger', response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error: unknown) {
    console.error('[API] Create trigger error:', error);
    return apiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}
