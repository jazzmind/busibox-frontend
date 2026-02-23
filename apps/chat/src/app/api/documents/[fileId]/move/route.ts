/**
 * Document Move API Route
 *
 * POST: Move a document to a target library
 *
 * Uses data-api:
 * - GET /files/{fileId} to verify document exists and user has access
 * - POST /files/{fileId}/move to update visibility and roles based on target library
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { canAccessLibrary, canUploadToLibrary } from '@jazzmind/busibox-app/lib/data/libraries';
import { exchangeWithSubjectToken, getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';
import { getResourceRoles, getUserRoles } from '@jazzmind/busibox-app';
import { logAuditEvent } from '@jazzmind/busibox-app/lib/authz/audit';

interface RouteParams {
  params: Promise<{ fileId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { fileId: documentId } = await params;
    const body = await request.json();
    const { targetLibraryId, action = 'move' } = body || {};

    if (!targetLibraryId || typeof targetLibraryId !== 'string') {
      return apiError('targetLibraryId is required', 400);
    }

    if (action !== 'move') {
      return apiError('Copy is not supported in this version. Please move the file.', 400);
    }

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'data-api',
      scopes: ['data:read', 'data:write'],
      purpose: 'document-move',
    });

    const dataApiUrl = getDataApiUrl();

    // Verify document exists and user has access (GET /files/{fileId})
    const fileResponse = await fetch(`${dataApiUrl}/files/${documentId}`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!fileResponse.ok) {
      if (fileResponse.status === 404) {
        return apiError('Document not found', 404);
      }
      if (fileResponse.status === 403) {
        return apiError('Access denied to document', 403);
      }
      const errorText = await fileResponse.text();
      console.error('[API] Move document - fetch failed:', fileResponse.status, errorText);
      return apiError('Failed to fetch document', 500);
    }

    const fileData = await fileResponse.json();
    const libraryId = fileData.libraryId || fileData.library_id;

    if (libraryId) {
      const canAccessSource = await canAccessLibrary(user.id, libraryId, sessionJwt);
      if (!canAccessSource) {
        return apiError('Access denied to source library', 403);
      }
    }

    const canUpload = await canUploadToLibrary(user.id, targetLibraryId, sessionJwt);
    if (!canUpload) {
      return apiError('No permission to move to target library', 403);
    }

    // Fetch target library to determine visibility and roleIds
    const libResponse = await fetch(`${dataApiUrl}/libraries/${targetLibraryId}`, {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    });

    if (!libResponse.ok) {
      return apiError('Target library not found', 404);
    }

    const libData = await libResponse.json();
    const targetLib = libData.data || libData;
    const isPersonal = targetLib.isPersonal ?? targetLib.is_personal ?? false;

    let visibility: 'personal' | 'shared';
    let roleIds: string[] = [];

    if (isPersonal) {
      visibility = 'personal';
    } else {
      visibility = 'shared';
      const authzOptions = await getAuthzOptionsWithToken(sessionJwt);
      // Try to get role bindings from the target library
      try {
        const roleBindings = await getResourceRoles('library', targetLibraryId, authzOptions);
        roleIds = roleBindings.map((r: { id: string }) => r.id);
      } catch (e) {
        console.error('[API] Move document - failed to get library roles:', e);
      }
      // Fall back to the user's own roles if the library has no explicit role bindings
      if (roleIds.length === 0) {
        try {
          const userRoles = await getUserRoles(user.id, authzOptions);
          roleIds = userRoles.map((r: { id: string }) => r.id);
        } catch (e) {
          console.error('[API] Move document - failed to get user roles:', e);
        }
      }
      if (roleIds.length === 0) {
        return apiError('Unable to determine role bindings for the target library or the current user.', 400);
      }
    }

    const moveResponse = await fetch(`${dataApiUrl}/files/${documentId}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
      body: JSON.stringify({ visibility, roleIds, libraryId: targetLibraryId }),
    });

    if (!moveResponse.ok) {
      const errorText = await moveResponse.text();
      console.error('[API] Move document - move failed:', moveResponse.status, errorText);
      return apiError('Failed to move document', 500);
    }

    logAuditEvent({
      actorId: user.id,
      action: 'document.moved',
      resourceType: 'document',
      resourceId: documentId,
      details: {
        sourceLibraryId: libraryId,
        targetLibraryId,
        visibility,
      },
    }).catch(() => {});

    return apiSuccess({ documentId, targetLibraryId });
  } catch (error: unknown) {
    console.error('[API] Move document error:', error);
    return apiError(error instanceof Error ? error.message : 'An unexpected error occurred', 500);
  }
}
