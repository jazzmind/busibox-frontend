/**
 * DELETE /api/auth/passkey/[id]
 * PATCH /api/auth/passkey/[id]
 * 
 * Delete or rename a passkey.
 * Requires authenticated user.
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { apiSuccess, apiError, parseJsonBody, getSessionUser } from '@jazzmind/busibox-app/lib/next/middleware';
import { deletePasskey, renamePasskey } from '@jazzmind/busibox-app/lib/authz/passkey';
import { logPasskeyRemoved } from '@jazzmind/busibox-app/lib/authz/audit';

type RouteParams = Promise<{ id: string }>;

export async function DELETE(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    // Require authenticated user
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    const { id: passkeyId } = await params;

    const cookieStore = await cookies();
    const sessionJwt = cookieStore.get('busibox-session')?.value;
    if (!sessionJwt) {
      return apiError('Session not found', 401);
    }

    const passkey = await deletePasskey(user.id, passkeyId, sessionJwt);

    // Log the removal
    await logPasskeyRemoved(user.id, passkey.passkey_id, passkey.name);

    return apiSuccess({
      message: 'Passkey removed successfully',
    });
  } catch (error: any) {
    console.error('[API] Delete passkey error:', error);
    return apiError(error.message || 'Failed to delete passkey', 400);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    // Require authenticated user
    const user = await getSessionUser(request);
    if (!user) {
      return apiError('Authentication required', 401);
    }

    const { id: passkeyId } = await params;
    const body = await parseJsonBody(request);

    if (!body?.name) {
      return apiError('Name is required', 400);
    }

    const cookieStore = await cookies();
    const sessionJwt = cookieStore.get('busibox-session')?.value;
    if (!sessionJwt) {
      return apiError('Session not found', 401);
    }

    const passkey = await renamePasskey(user.id, passkeyId, body.name, sessionJwt);

    return apiSuccess({
      message: 'Passkey renamed successfully',
      passkey: {
        id: passkey.passkey_id,
        name: passkey.name,
      },
    });
  } catch (error: any) {
    console.error('[API] Rename passkey error:', error);
    return apiError(error.message || 'Failed to rename passkey', 400);
  }
}










