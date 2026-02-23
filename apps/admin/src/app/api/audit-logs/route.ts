/**
 * Admin Audit Logs API
 * 
 * GET /api/audit-logs - Get audit logs with filtering and pagination
 * 
 * Audit logs are now stored in the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzOptions, getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { searchParams } = new URL(request.url);
    const authzUrl = getAuthzBaseUrl();
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const userId = searchParams.get('userId') || '';
    const eventType = searchParams.get('eventType') || '';
    const success = searchParams.get('success');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query params for authz
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (userId) params.set('actor_id', userId);
    if (eventType) params.set('event_type', eventType);
    if (startDate) params.set('from_date', startDate);
    if (endDate) params.set('to_date', endDate);

    // Fetch from authz (Zero Trust - audit logs are public with proper scopes)
    const response = await fetch(`${authzUrl}/audit/logs?${params.toString()}`);

    if (!response.ok) {
      const text = await response.text();
      console.error('[API] Authz audit logs error:', text);
      return apiError('Failed to fetch audit logs', response.status);
    }

    const data = await response.json();

    // Transform logs to expected format
    const logs = (data.logs || []).map((log: any) => ({
      id: log.id,
      eventType: log.event_type,
      userId: log.actor_id,
      userEmail: null, // Would need to fetch from users if needed
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

    // Apply success filter client-side (if authz doesn't support it)
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
