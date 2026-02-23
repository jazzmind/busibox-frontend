/**
 * Library Trigger Detail API Route
 *
 * GET: Get trigger details
 * PUT: Update a trigger (enable/disable, change settings)
 * DELETE: Delete a trigger
 *
 * Proxies to data-api /libraries/{id}/triggers/{triggerId}
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { canAccessLibrary, canManageLibrary } from '@jazzmind/busibox-app/lib/data/libraries';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string; triggerId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id, triggerId } = await params;

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

    const response = await fetch(
      `${getDataApiUrl()}/libraries/${id}/triggers/${triggerId}`,
      {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return apiError('Trigger not found', response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error: unknown) {
    console.error('[API] Get trigger error:', error);
    return apiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id, triggerId } = await params;

    const canManage = await canManageLibrary(user.id, id, sessionJwt);
    if (!canManage) {
      return apiError('Access denied', 403);
    }

    const body = await request.json();
    const payload = {
      name: body.name,
      description: body.description,
      isActive: body.isActive,
      triggerType: body.triggerType,
      prompt: body.prompt,
      schemaDocumentId: body.schemaDocumentId,
      agentId: body.agentId,
      notificationConfig: body.notificationConfig,
    };

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:write'],
      purpose: 'library-triggers',
    });

    const response = await fetch(
      `${getDataApiUrl()}/libraries/${id}/triggers/${triggerId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Data-api trigger update failed:', response.status, errorText);
      return apiError('Failed to update trigger', response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error: unknown) {
    console.error('[API] Update trigger error:', error);
    return apiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id, triggerId } = await params;

    const canManage = await canManageLibrary(user.id, id, sessionJwt);
    if (!canManage) {
      return apiError('Access denied', 403);
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:write'],
      purpose: 'library-triggers',
    });

    const response = await fetch(
      `${getDataApiUrl()}/libraries/${id}/triggers/${triggerId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Data-api trigger delete failed:', response.status, errorText);
      return apiError('Failed to delete trigger', response.status);
    }

    return apiSuccess({ message: 'Trigger deleted successfully' });
  } catch (error: unknown) {
    console.error('[API] Delete trigger error:', error);
    return apiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}
