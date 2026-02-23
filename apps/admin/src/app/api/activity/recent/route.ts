/**
 * Admin Recent Activity API Route
 * 
 * Aggregates recent activity from multiple sources:
 * 1. Agent API - recent agent runs/conversations
 * 2. AuthZ audit logs - logins, role changes, app access (excluding oauth token noise)
 * 
 * Returns a unified, time-sorted activity feed for the live dashboard.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzOptionsWithToken, exchangeWithSubjectToken, getUserIdFromSessionJwt, getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';
import { listUsers } from '@jazzmind/busibox-app';

type ActivityEvent = Record<string, unknown> & {
  createdAt?: string | number | Date;
  user?: unknown;
};

// Actions to exclude from the audit log feed (noisy background events)
const EXCLUDED_ACTIONS = [
  'oauth.token.issued',
  'oauth.token_generated',
  'oauth.token_validated',
];

// Map authz audit actions to user-friendly activity descriptions
function describeAuditAction(action: string, details: Record<string, unknown> = {}): { message: string; type: string } {
  switch (action) {
    case 'user.login':
      return { message: 'User logged in', type: 'login' };
    case 'user.login.failed':
      return { message: 'Failed login attempt', type: 'login' };
    case 'user.logout':
      return { message: 'User logged out', type: 'login' };
    case 'user.created':
      return { message: 'New user account created', type: 'login' };
    case 'user.updated':
      return { message: 'User profile updated', type: 'login' };
    case 'magic_link.sent':
      return { message: 'Magic link email sent', type: 'login' };
    case 'magic_link.used':
      return { message: 'User authenticated via magic link', type: 'login' };
    case 'role.assigned':
      return { message: `Role assigned: ${details.role_name || 'unknown'}`, type: 'login' };
    case 'role.removed':
      return { message: `Role removed: ${details.role_name || 'unknown'}`, type: 'login' };
    case 'app.accessed':
      return { message: `Accessed ${details.app_name || 'application'}`, type: 'login' };
    default:
      // Clean up the action name for display
      return { message: action.replace(/[._]/g, ' '), type: 'login' };
  }
}

// Extract a short description from the agent run input
function getRunDescription(run: Record<string, unknown>): string {
  const input = run.input as Record<string, unknown> | undefined;
  if (!input) return '';
  
  // Try to get a meaningful prompt/description from the input
  const prompt = (input.prompt as string) || (input.message as string) || (input.query as string) || '';
  if (prompt) {
    // Truncate long prompts
    return prompt.length > 80 ? prompt.substring(0, 77) + '...' : prompt;
  }
  return '';
}

// Map agent run status to activity format
function describeAgentRun(run: Record<string, unknown>): { message: string; type: string; status: string } {
  const runStatus = (run.status as string) || 'unknown';
  const description = getRunDescription(run);
  
  switch (runStatus) {
    case 'completed':
    case 'succeeded':
      return { 
        message: description || 'Agent task completed', 
        type: 'agent', 
        status: 'success' 
      };
    case 'running':
      return { 
        message: description ? `Running: ${description}` : 'Agent task in progress...', 
        type: 'agent', 
        status: 'pending' 
      };
    case 'failed':
      return { 
        message: description ? `Failed: ${description}` : 'Agent task failed', 
        type: 'agent', 
        status: 'error' 
      };
    case 'cancelled':
      return { 
        message: description ? `Cancelled: ${description}` : 'Agent task cancelled', 
        type: 'agent', 
        status: 'error' 
      };
    default:
      return { 
        message: description || `Agent run — ${runStatus}`, 
        type: 'agent', 
        status: 'success' 
      };
  }
}

async function fetchAgentNameMap(agentApiUrl: string, accessToken: string): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  try {
    const response = await fetch(`${agentApiUrl}/agents?limit=100`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (response.ok) {
      const data = await response.json();
      const agents = Array.isArray(data) ? data : (data.agents || data.data || []);
      for (const agent of agents) {
        if (agent.id && agent.name) {
          nameMap.set(String(agent.id), agent.name);
        }
      }
    }
  } catch {
    // Non-critical — fall back to generic names
  }
  return nameMap;
}

async function fetchAgentActivity(sessionJwt: string): Promise<ActivityEvent[]> {
  try {
    const agentApiUrl = process.env.AGENT_API_URL || process.env.NEXT_PUBLIC_AGENT_API_URL || 'http://localhost:8000';
    
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return [];

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'agent-api',
      purpose: 'admin-activity-feed',
    });

    const authHeader = { 'Authorization': `Bearer ${tokenResult.accessToken}` };

    // Fetch recent agent runs and agent names in parallel
    const [runsResponse, agentNames] = await Promise.all([
      fetch(`${agentApiUrl}/runs?limit=10&offset=0`, { headers: authHeader }),
      fetchAgentNameMap(agentApiUrl, tokenResult.accessToken),
    ]);

    if (!runsResponse.ok) return [];

    const runsData = await runsResponse.json();
    const runs = Array.isArray(runsData) ? runsData : (runsData.runs || runsData.data || []);

    return runs.map((run: Record<string, unknown>) => {
      const { message, type, status } = describeAgentRun(run);
      const agentId = String(run.agent_id || '');
      const agentName = agentNames.get(agentId);
      
      // Prefix with agent name if available and message doesn't already reference it
      const displayMessage = agentName ? `${agentName}: ${message}` : message;

      return {
        id: `run-${run.id}`,
        eventType: type,
        action: displayMessage,
        success: status === 'success',
        status,
        createdAt: run.created_at || run.updated_at,
        user: { email: (run.created_by as string) || 'System' },
        source: 'agent-api',
      };
    });
  } catch (error) {
    console.error('Failed to fetch agent activity:', error);
    return [];
  }
}

async function fetchAuditActivity(sessionJwt: string): Promise<ActivityEvent[]> {
  try {
    const options = await getAuthzOptionsWithToken(sessionJwt);
    
    const response = await fetch(`${options.authzUrl}/audit/logs?limit=30`, {
      headers: {
        'Authorization': `Bearer ${options.accessToken}`,
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const logs = data.logs || data.events || data || [];

    // Filter out noisy oauth events and transform
    return logs
      .filter((event: Record<string, unknown>) => {
        const action = (event.action as string) || '';
        return !EXCLUDED_ACTIONS.includes(action);
      })
      .slice(0, 15)
      .map((event: Record<string, unknown>) => {
        const action = (event.action as string) || 'activity';
        const details = (event.details as Record<string, unknown>) || {};
        const { message, type } = describeAuditAction(action, details);
        
        return {
          id: event.id || event.event_id,
          eventType: type,
          action: message,
          success: event.success !== false,
          status: event.success !== false ? 'success' : 'error',
          createdAt: event.created_at || event.createdAt || event.timestamp,
          user: event.user || { email: (event.user_email as string) || (event.actor_email as string) || 'System' },
          source: 'authz',
        };
      });
  } catch (error) {
    console.error('Failed to fetch audit activity:', error);
    return [];
  }
}

// Build a user ID -> display name map from authz user list
async function buildUserNameMap(authzOptions: { authzUrl: string; accessToken: string }): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  try {
    const usersResp = await listUsers({ limit: 100 }, authzOptions);
    for (const user of usersResp.users || []) {
      if (user.id && user.email) {
        nameMap.set(user.id, user.email);
      }
      // Also map the deprecated user_id field
      if (user.user_id && user.email) {
        nameMap.set(user.user_id, user.email);
      }
    }
  } catch {
    // Non-critical
  }
  return nameMap;
}

// Check if a string looks like a UUID
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s);
}

// Resolve a user identifier to a readable name
function resolveUserName(userField: unknown, userNameMap: Map<string, string>): string {
  if (!userField) return 'System';
  
  if (typeof userField === 'object' && userField !== null) {
    const obj = userField as Record<string, unknown>;
    const email = (obj.email as string) || (obj.name as string) || '';
    const id = (obj.id as string) || (obj.user_id as string) || '';
    
    // If the email looks like a UUID, try to resolve it to a real email
    if (email && isUuid(email)) {
      if (userNameMap.has(email)) return userNameMap.get(email)!;
    }
    
    // Try resolving explicitly by ID
    if (id && userNameMap.has(id)) return userNameMap.get(id)!;
    
    // If email is a real email (not UUID), return it
    if (email && !isUuid(email) && email !== 'System') return email;
    
    return 'System';
  }
  
  if (typeof userField === 'string') {
    // Check if it's a UUID and try to resolve
    if (isUuid(userField) && userNameMap.has(userField)) {
      return userNameMap.get(userField)!;
    }
    // Return as-is if it looks like a real name/email
    if (!isUuid(userField)) return userField;
    return 'System';
  }
  
  return 'System';
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;

    // Get authz options for user name resolution
    const authzOptions = await getAuthzOptionsWithToken(sessionJwt);

    // Fetch from multiple sources in parallel
    const [agentActivity, auditActivity, userNameMap] = await Promise.all([
      fetchAgentActivity(sessionJwt),
      fetchAuditActivity(sessionJwt),
      buildUserNameMap(authzOptions),
    ]);

    const toTimestamp = (value: ActivityEvent['createdAt']): number => {
      if (value === null || value === undefined) return 0;
      const date = new Date(value);
      const ts = date.getTime();
      return Number.isNaN(ts) ? 0 : ts;
    };

    // Merge, resolve user names, and sort by time (newest first)
    const allActivity = [...agentActivity, ...auditActivity]
      .map((event) => ({
        ...event,
        createdAt: event.createdAt,
        user: { email: resolveUserName(event.user, userNameMap) },
      }))
      .sort((a, b) => {
        const dateA = toTimestamp(a.createdAt);
        const dateB = toTimestamp(b.createdAt);
        return dateB - dateA;
      })
      .slice(0, 20);

    return apiSuccess(allActivity);
  } catch (error) {
    console.error('Activity API error:', error);
    return apiError('Internal server error', 500);
  }
}
