import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id: documentId } = await params;

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
    });

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const response = await fetch(`${dataApiUrl}/data/${documentId}/roles`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return apiError(`Failed to fetch document roles: ${errorText}`, response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[admin/data/[id]/roles] GET error:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id: documentId } = await params;
    const body = await request.json();

    const roleIds = Array.isArray(body?.roleIds)
      ? body.roleIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : [];

    const visibility =
      body?.visibility === 'personal' || body?.visibility === 'shared'
        ? body.visibility
        : undefined;

    const roleNames: Record<string, string> | undefined =
      body?.roleNames && typeof body.roleNames === 'object'
        ? body.roleNames
        : undefined;

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
    });

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const response = await fetch(`${dataApiUrl}/data/${documentId}/roles`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roleIds, visibility, ...(roleNames ? { roleNames } : {}) }),
    });

    if (!response.ok) {
      let detail = `Failed to update roles (${response.status})`;
      try {
        const payload = await response.json();
        detail = payload?.detail || payload?.error || detail;
      } catch {
        const text = await response.text();
        if (text) detail = text;
      }
      return apiError(detail, response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[admin/data/[id]/roles] PUT error:', error);
    return apiError(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
