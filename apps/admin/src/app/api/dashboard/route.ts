/**
 * Admin Dashboard API
 * 
 * GET /api/dashboard - Get dashboard stats and recent activity
 * 
 * User/role/audit stats are fetched from the authz service.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  listUsers,
  listRoles,
  type RbacClientOptions,
} from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken, getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';
import { countAppsInStore, getAppConfigStoreContextForUser } from '@jazzmind/busibox-app/lib/deploy/app-config';

async function fetchAuthzStats(options: RbacClientOptions) {
  try {
    // Fetch users with different status filters
    const [allUsersResp, activeUsersResp, pendingUsersResp, rolesResp] = await Promise.all([
      listUsers({}, options),
      listUsers({ status: 'ACTIVE' }, options),
      listUsers({ status: 'PENDING' }, options),
      listRoles(options),
    ]);

    return {
      totalUsers: allUsersResp.pagination.total_count,
      activeUsers: activeUsersResp.pagination.total_count,
      pendingUsers: pendingUsersResp.pagination.total_count,
      totalRoles: rolesResp.length,
    };
  } catch (error) {
    console.error('[API] Failed to fetch authz stats:', error);
    return {
      totalUsers: 0,
      activeUsers: 0,
      pendingUsers: 0,
      totalRoles: 0,
    };
  }
}

async function fetchAuditStats(authzUrl: string, accessToken: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Sessions are considered "active" if login was within last 30 minutes
  const sessionWindow = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
  };
  
  try {
    // Fetch recent login count (requires admin auth)
    const loginResp = await fetch(`${authzUrl}/audit/logs?event_type=USER_LOGIN&from_date=${since}&limit=1`, { headers });
    const loginData = loginResp.ok ? await loginResp.json() : { pagination: { total_count: 0 } };
    
    // Fetch failed login count
    const failedResp = await fetch(`${authzUrl}/audit/logs?event_type=USER_LOGIN_FAILED&from_date=${since}&limit=1`, { headers });
    const failedData = failedResp.ok ? await failedResp.json() : { pagination: { total_count: 0 } };
    
    // Fetch recent activity
    const activityResp = await fetch(`${authzUrl}/audit/logs?limit=10`, { headers });
    const activityData = activityResp.ok ? await activityResp.json() : { logs: [] };

    // Estimate active sessions from recent logins (within 30 min window)
    const recentSessionsResp = await fetch(`${authzUrl}/audit/logs?event_type=USER_LOGIN&from_date=${sessionWindow}&limit=100`, { headers });
    const recentSessionsData = recentSessionsResp.ok ? await recentSessionsResp.json() : { logs: [] };
    // Count unique users who logged in recently
    const recentUsers = new Set(
      (recentSessionsData.logs || []).map((log: { user_id?: string }) => log.user_id).filter(Boolean)
    );
    const activeSessions = Math.max(1, recentUsers.size); // At least 1 if we're making this request

    return {
      recentLogins: loginData.pagination?.total_count || 0,
      failedLogins: failedData.pagination?.total_count || 0,
      recentActivity: activityData.logs || [],
      activeSessions,
    };
  } catch (error) {
    console.error('[API] Failed to fetch audit stats:', error);
    return {
      recentLogins: 0,
      failedLogins: 0,
      recentActivity: [],
      activeSessions: 1, // At least current user is active
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;

    // Get options with exchanged token
    const options = await getAuthzOptionsWithToken(sessionJwt);
    const authzUrl = getAuthzBaseUrl();

    // Fetch stats from authz and local DB in parallel
    const appStoreContext = await getAppConfigStoreContextForUser(authResult.user.id, sessionJwt);
    const [authzStats, auditStats, appStats] = await Promise.all([
      fetchAuthzStats(options),
      fetchAuditStats(authzUrl, options.accessToken),
      Promise.all([
        countAppsInStore(appStoreContext.accessToken),
        countAppsInStore(appStoreContext.accessToken, (app) => app.isActive),
      ]).then(([totalApps, activeApps]) => ({ totalApps, activeApps })),
    ]);

    return apiSuccess({
      stats: {
        totalUsers: authzStats.totalUsers,
        activeUsers: authzStats.activeUsers,
        pendingUsers: authzStats.pendingUsers,
        activeSessions: auditStats.activeSessions || 1,
        totalApps: appStats.totalApps,
        activeApps: appStats.activeApps,
        totalRoles: authzStats.totalRoles,
        recentLogins: auditStats.recentLogins,
        failedLogins: auditStats.failedLogins,
      },
      recentActivity: auditStats.recentActivity,
    });
  } catch (error) {
    // Import and use handleApiError for proper session error handling
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to load dashboard data');
  }
}
