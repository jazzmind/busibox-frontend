/**
 * Admin Audit Logs API
 * 
 * GET /api/audit-logs - Get audit logs with filtering and pagination
 * 
 * Audit logs are stored in the authz service. Requires Zero Trust token
 * exchange with authz.audit.read scope.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || getAuthzBaseUrl();

export async function GET(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) {
      return apiError('Authentication required', 401);
    }

    const { sessionJwt, ...user } = userWithSession;
    if (!requireAdmin(user)) {
      return apiError('Admin access required', 403);
    }

    // Exchange the session token for an authz-api access token carrying
    // authz.audit.read. The audience must be 'authz-api' (what authz's
    // AUTHZ_ALLOWED_AUDIENCES permits and what getAuthzOptionsWithToken uses);
    // 'authz' was refused, and the old fallback to the raw session JWT then
    // produced a 401 that surfaced only as "Failed to fetch audit logs".
    // There is no fallback: a session JWT is not an access token and authz
    // will always reject it, so report the exchange failure instead.
    let token: string;
    try {
      const result = await exchangeTokenZeroTrust(
        { sessionJwt, audience: 'authz-api', scopes: ['authz.audit.read'], purpose: 'Read audit logs' },
        { authzBaseUrl: AUTHZ_BASE_URL, verbose: false },
      );
      token = result.accessToken;
    } catch (exchangeError) {
      if (isInvalidSessionError(exchangeError)) {
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code,
        );
      }
      const reason = exchangeError instanceof Error ? exchangeError.message : String(exchangeError);
      console.error('[API/audit-logs] Token exchange failed:', reason);
      return apiError(`Could not obtain audit access from authz: ${reason}`, 502);
    }

    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const userId = searchParams.get('userId') || '';
    const eventType = searchParams.get('eventType') || '';
    const success = searchParams.get('success');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (userId) params.set('actor_id', userId);
    if (eventType) params.set('event_type', eventType);
    if (startDate) params.set('from_date', startDate);
    if (endDate) params.set('to_date', endDate);

    const response = await fetch(`${AUTHZ_BASE_URL}/audit/logs?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[API] Authz audit logs error:', response.status, text);
      // Say what authz said (its detail is short and safe to show an admin),
      // rather than a bare "Failed to fetch audit logs".
      let detail = '';
      try {
        const parsed = JSON.parse(text) as { detail?: unknown; error?: unknown };
        const d = parsed.detail ?? parsed.error;
        detail = typeof d === 'string' ? d : d ? JSON.stringify(d) : '';
      } catch {
        detail = text.slice(0, 200);
      }
      return apiError(
        `authz returned ${response.status} for audit logs${detail ? `: ${detail}` : ''}`,
        response.status >= 500 ? 502 : response.status,
      );
    }

    const data = await response.json();

    const logs = (data.logs || []).map((log: any) => ({
      id: log.id,
      eventType: log.event_type,
      userId: log.actor_id,
      userEmail: null,
      targetUserId: log.target_user_id,
      targetRoleId: log.target_role_id,
      targetAppId: log.target_app_id,
      action: log.action,
      details: log.details,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      success: log.success,
      errorMessage: log.error_message,
      createdAt: log.created_at,
    }));

    const filteredLogs = success !== null && success !== undefined && success !== ''
      ? logs.filter((log: any) => log.success === (success === 'true'))
      : logs;

    return apiSuccess({
      logs: filteredLogs,
      pagination: {
        page: data.pagination?.page || page,
        limit: data.pagination?.limit || limit,
        totalCount: data.pagination?.total_count || 0,
        totalPages: data.pagination?.total_pages || 0,
        hasMore: page * limit < (data.pagination?.total_count || 0),
      },
    });
  } catch (error) {
    console.error('[API] Admin audit logs error:', error);
    return apiError('An unexpected error occurred', 500);
  }
}
