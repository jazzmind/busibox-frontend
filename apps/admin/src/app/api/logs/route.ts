/**
 * GET /api/logs - Get service logs with optional service filtering
 * 
 * Proxies to deploy-api's /system/services and /system/services/{service}/logs
 * endpoints. When service=all, fetches logs from all running services.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getDeployApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

const DEPLOY_API_URL = process.env.DEPLOY_API_URL || getDeployApiUrl();
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

interface LogEntry {
  timestamp: string;
  service: string;
  level: string;
  message: string;
}

function parseLogLevel(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('error') || lower.includes('traceback') || lower.includes('exception')) return 'error';
  if (lower.includes('warn')) return 'warn';
  if (lower.includes('info')) return 'info';
  return 'info';
}

function parseTimestamp(line: string): { timestamp: string; rest: string } {
  // ISO 8601: 2026-03-16T10:23:05.123Z or 2026-03-16 10:23:05,123
  const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]?\d*Z?)\s*(.*)/);
  if (isoMatch) return { timestamp: isoMatch[1], rest: isoMatch[2] };

  // Docker log prefix: 2026-03-16T10:23:05.123456789Z
  const dockerMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z?)\s*(.*)/);
  if (dockerMatch) return { timestamp: dockerMatch[1], rest: dockerMatch[2] };

  // systemd/journalctl: Mar 16 10:23:05
  const syslogMatch = line.match(/^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s*(.*)/);
  if (syslogMatch) return { timestamp: syslogMatch[1], rest: syslogMatch[2] };

  return { timestamp: 'unknown', rest: line };
}

function parseRawLogs(rawLogs: string, serviceName: string): LogEntry[] {
  if (!rawLogs) return [];

  const lines = rawLogs.split('\n').filter(line => line.trim());
  return lines.map(line => {
    const { timestamp, rest } = parseTimestamp(line);
    return {
      timestamp,
      service: serviceName,
      level: parseLogLevel(rest || line),
      message: rest || line,
    };
  });
}

async function getDeployApiToken(sessionJwt: string): Promise<string> {
  try {
    const result = await exchangeTokenZeroTrust(
      { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:read'], purpose: 'Read service logs' },
      { authzBaseUrl: AUTHZ_BASE_URL, verbose: false },
    );
    return result.accessToken;
  } catch (exchangeError) {
    if (isInvalidSessionError(exchangeError)) {
      throw exchangeError;
    }
    console.warn('[API/logs] Token exchange error, using session token:', exchangeError);
    return sessionJwt;
  }
}

async function fetchServiceList(token: string): Promise<string[]> {
  try {
    const response = await fetch(`${DEPLOY_API_URL}/system/services`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.services || [])
      .filter((s: any) => s.state === 'running')
      .map((s: any) => {
        const name: string = s.name || '';
        return name.replace(/^(prod|staging|dev|local)-/, '');
      });
  } catch {
    return [];
  }
}

async function fetchServiceLogs(token: string, service: string, lines: number): Promise<LogEntry[]> {
  try {
    const response = await fetch(`${DEPLOY_API_URL}/system/services/${service}/logs?lines=${lines}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return parseRawLogs(data.logs || '', service);
  } catch {
    return [];
  }
}

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

    let token: string;
    try {
      token = await getDeployApiToken(sessionJwt);
    } catch (exchangeError) {
      if (isInvalidSessionError(exchangeError)) {
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code,
        );
      }
      token = sessionJwt;
    }

    const { searchParams } = new URL(request.url);
    const requestedService = searchParams.get('service') || 'all';
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    const availableServices = await fetchServiceList(token);

    let logs: LogEntry[] = [];

    if (requestedService === 'all') {
      const perServiceLimit = Math.max(50, Math.floor(limit / Math.max(availableServices.length, 1)));
      const results = await Promise.allSettled(
        availableServices.map(svc => fetchServiceLogs(token, svc, perServiceLimit))
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          logs.push(...result.value);
        }
      }
      logs.sort((a, b) => {
        if (a.timestamp === 'unknown') return 1;
        if (b.timestamp === 'unknown') return -1;
        return a.timestamp.localeCompare(b.timestamp);
      });
    } else {
      logs = await fetchServiceLogs(token, requestedService, limit);
    }

    return apiSuccess({
      logs,
      availableServices,
    });
  } catch (error) {
    console.error('[API] Service logs error:', error);
    return apiError('Failed to fetch service logs', 500);
  }
}
