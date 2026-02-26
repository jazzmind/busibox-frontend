/**
 * Admin Library Trigger Detail API Route
 *
 * GET: Get trigger details
 * PUT: Update a trigger (enable/disable, change settings)
 * DELETE: Delete a trigger
 *
 * Proxies to data-api /libraries/{id}/triggers/{triggerId}
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string; triggerId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id, triggerId } = await params;
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'data-api',
      scopes: ['data:read'],
      purpose: 'admin-library-triggers',
    });

    const response = await fetch(
      `${getDataApiUrl()}/libraries/${id}/triggers/${triggerId}`,
      { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } }
    );

    if (!response.ok) return apiError('Trigger not found', response.status);

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[admin/triggers] GET error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id, triggerId } = await params;
    const body = await request.json();

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'data-api',
      scopes: ['data:write'],
      purpose: 'admin-library-triggers',
    });

    const response = await fetch(
      `${getDataApiUrl()}/libraries/${id}/triggers/${triggerId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
        body: JSON.stringify({
          name: body.name,
          description: body.description,
          isActive: body.isActive,
          triggerType: body.triggerType,
          prompt: body.prompt,
          schemaDocumentId: body.schemaDocumentId,
          agentId: body.agentId,
          notificationConfig: body.notificationConfig,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/triggers] Update failed:', response.status, errorText);
      return apiError('Failed to update trigger', response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[admin/triggers] PUT error:', error);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id, triggerId } = await params;
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'data-api',
      scopes: ['data:write'],
      purpose: 'admin-library-triggers',
    });

    const response = await fetch(
      `${getDataApiUrl()}/libraries/${id}/triggers/${triggerId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
      }
    );

    if (!response.ok) {
      return apiError('Failed to delete trigger', response.status);
    }

    return apiSuccess({ message: 'Trigger deleted successfully' });
  } catch (error) {
    console.error('[admin/triggers] DELETE error:', error);
    return apiError('Internal server error', 500);
  }
}
