/**
 * Admin User Detail API
 * 
 * GET /api/users/[userId] - Get user details
 * PATCH /api/users/[userId] - Update user
 * DELETE /api/users/[userId] - Delete user
 * 
 * All user management is handled by the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { logUserDeactivated, logUserActivated, logUserDeleted } from '@jazzmind/busibox-app/lib/authz/audit';
import { getUser, updateUser, deleteUser, activateUser, deactivateUser, getAuthzAccessToken, type AuthzUser } from '@jazzmind/busibox-app/lib/authz/user-management';

type RouteParams = {
  params: Promise<{ userId: string }>;
};

// GET /api/users/[userId] - Get user details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const { userId } = await params;

    // Exchange session JWT for authz access token
    const accessToken = await getAuthzAccessToken(sessionJwt);

    // Get user from authz with access token
    const user = await getUser(userId, accessToken);

    if (!user) {
      return apiError('User not found', 404);
    }

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        displayName: user.display_name || null,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        avatarUrl: user.avatar_url || null,
        emailVerified: user.email_verified_at ? new Date(user.email_verified_at) : null,
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : null,
        pendingExpiresAt: user.pending_expires_at ? new Date(user.pending_expires_at) : null,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
        roles: user.roles.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          isSystem: r.is_system,
        })),
      },
      recentActivity: [],
    });
  } catch (error) {
    console.error('[API] Admin get user error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// PATCH /api/users/[userId] - Update user
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { userId } = await params;
    const body = await parseJsonBody(request);

    // Exchange session JWT for authz access token
    const accessToken = await getAuthzAccessToken(sessionJwt);

    // Get existing user with access token
    const existingUser = await getUser(userId, accessToken);

    if (!existingUser) {
      return apiError('User not found', 404);
    }

    let updatedUser: AuthzUser;

    // Collect profile field updates separately from status changes
    const profileFields: Record<string, string> = {};
    for (const key of ['display_name', 'first_name', 'last_name', 'avatar_url'] as const) {
      if (body[key] !== undefined) {
        profileFields[key] = body[key];
      }
    }

    // Handle status changes
    if (body.status) {
      if (body.status === 'ACTIVE' && existingUser.status !== 'ACTIVE') {
        updatedUser = await activateUser(userId, accessToken);
        await logUserActivated(userId, existingUser.email, adminUser.id);
      } else if (body.status === 'DEACTIVATED' && existingUser.status !== 'DEACTIVATED') {
        updatedUser = await deactivateUser(userId, accessToken);
        await logUserDeactivated(userId, existingUser.email, adminUser.id);
      } else {
        updatedUser = await updateUser(userId, { status: body.status, ...profileFields }, accessToken);
      }
      // If status was changed via activate/deactivate AND profile fields exist, apply them
      if (Object.keys(profileFields).length > 0 && (body.status === 'ACTIVE' || body.status === 'DEACTIVATED')) {
        updatedUser = await updateUser(userId, profileFields, accessToken);
      }
    } else if (Object.keys(profileFields).length > 0) {
      updatedUser = await updateUser(userId, profileFields, accessToken);
    } else {
      updatedUser = await updateUser(userId, body, accessToken);
    }

    return apiSuccess({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        status: updatedUser.status,
        displayName: updatedUser.display_name || null,
        firstName: updatedUser.first_name || null,
        lastName: updatedUser.last_name || null,
        avatarUrl: updatedUser.avatar_url || null,
        emailVerified: updatedUser.email_verified_at ? new Date(updatedUser.email_verified_at) : null,
        lastLoginAt: updatedUser.last_login_at ? new Date(updatedUser.last_login_at) : null,
        updatedAt: new Date(updatedUser.updated_at),
        roles: updatedUser.roles.map(r => ({
          id: r.id,
          name: r.name,
        })),
      },
    });
  } catch (error) {
    console.error('[API] Admin update user error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// DELETE /api/users/[userId] - Delete user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { userId } = await params;

    // Exchange session JWT for authz access token
    const accessToken = await getAuthzAccessToken(sessionJwt);

    // Get existing user with access token
    const existingUser = await getUser(userId, accessToken);

    if (!existingUser) {
      return apiError('User not found', 404);
    }

    // Prevent deleting yourself
    if (userId === adminUser.id) {
      return apiError('Cannot delete your own account', 400);
    }

    // Delete user from authz (this cascades to sessions, etc.)
    await deleteUser(userId, accessToken);

    await logUserDeleted(existingUser.id, existingUser.email, adminUser.id);

    return apiSuccess({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('[API] Admin delete user error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
