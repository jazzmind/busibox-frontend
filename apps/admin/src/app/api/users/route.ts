/**
 * Admin Users API
 * 
 * GET /api/users - List users with pagination and filtering
 * POST /api/users - Create new user
 * 
 * All user management is handled by the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody, validateRequiredFields } from '@jazzmind/busibox-app/lib/next/middleware';
import { sendMagicLinkEmail } from '@jazzmind/busibox-app/lib/bridge/email';
import { isEmailDomainAllowed, getEmailDomainRejectionMessage } from '@jazzmind/busibox-app/lib/authz/email-validation';
import { logUserCreated } from '@jazzmind/busibox-app/lib/authz/audit';
import { listUsers, createUser, getAuthzAccessToken } from '@jazzmind/busibox-app/lib/authz/user-management';

// GET /api/users - List users
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;

    // Exchange session JWT for authz access token
    const accessToken = await getAuthzAccessToken(sessionJwt);

    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status') as 'PENDING' | 'ACTIVE' | 'DEACTIVATED' | null;
    const search = searchParams.get('search') || undefined;

    // Call authz service via busibox-app with access token
    const result = await listUsers({
      page,
      limit,
      status: status || undefined,
      search,
    }, accessToken);

    // Transform to match existing API response format
    // Note: authz /admin/users returns user_id, but /admin/users/{id} returns id
    const transformedUsers = result.users.map(user => {
      const userAny = user as { id?: string; user_id?: string };
      return {
        id: userAny.id || userAny.user_id || user.id,
        email: user.email,
        status: user.status,
        displayName: user.display_name || null,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        avatarUrl: user.avatar_url || null,
        emailVerified: user.email_verified_at ? new Date(user.email_verified_at) : null,
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : null,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
        roles: user.roles.map(r => ({
          id: r.id,
          name: r.name,
        })),
      };
    });

    return apiSuccess({
      users: transformedUsers,
      pagination: {
        page: result.pagination.page,
        limit: result.pagination.limit,
        totalCount: result.pagination.total_count,
        totalPages: result.pagination.total_pages,
        hasMore: result.pagination.page < result.pagination.total_pages,
      },
    });
  } catch (error) {
    console.error('[API] Admin users list error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}

// POST /api/users - Create user
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;
    
    const { user: adminUser, sessionJwt } = authResult;

    // Exchange session JWT for authz access token
    const accessToken = await getAuthzAccessToken(sessionJwt);

    const body = await parseJsonBody(request);

    // Validate request
    const validationError = validateRequiredFields(body, ['email']);
    if (validationError) {
      return apiError(validationError, 400);
    }

    const { email, roleIds } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError('Invalid email address', 400);
    }

    // Check email domain (local validation - authz also validates)
    if (!isEmailDomainAllowed(email)) {
      return apiError(getEmailDomainRejectionMessage(email), 403);
    }

    // Create user in authz with access token
    const newUser = await createUser({
      email: email.toLowerCase(),
      roleIds: roleIds || [],
      status: 'PENDING',
      assignedBy: adminUser.id,
    }, accessToken);

    // Send activation magic link
    try {
      // APP_URL is runtime-only (server-side), NEXT_PUBLIC_APP_URL is baked at build time
      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000/portal';
      const magicLinkUrl = `${appUrl}/login?email=${encodeURIComponent(email)}`;
      await sendMagicLinkEmail(email, magicLinkUrl);
    } catch (emailError) {
      console.error('[API] Failed to send activation email:', emailError);
      // Don't fail the request if email fails
    }

    // Log user creation
    await logUserCreated(newUser.id, email, adminUser.id);

    return apiSuccess({
      user: {
        id: newUser.id,
        email: newUser.email,
        status: newUser.status,
        emailVerified: newUser.email_verified_at ? new Date(newUser.email_verified_at) : null,
        createdAt: new Date(newUser.created_at),
        roles: newUser.roles.map(r => ({
          id: r.id,
          name: r.name,
        })),
      },
    }, 201);
  } catch (error: any) {
    console.error('[API] Admin create user error:', error);
    
    // Handle specific errors from authz
    if (error.message?.includes('409')) {
      return apiError('User with this email already exists', 409);
    }
    if (error.message?.includes('403')) {
      return apiError('Email domain not allowed', 403);
    }
    if (error.message?.includes('400')) {
      return apiError(error.message, 400);
    }
    
    return apiError('An unexpected error occurred', 500);
  }
}
