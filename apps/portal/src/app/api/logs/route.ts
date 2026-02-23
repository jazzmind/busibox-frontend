import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface LogEntry {
  timestamp: string;
  service: string;
  level: string;
  message: string;
  details?: unknown;
}

// Service configuration: maps service names to their hosts and systemd service names
// isLocal: true = local service (same container as busibox-portal), uses journalctl directly
// isLocal: false = remote service, requires SSH with host from env var
interface ServiceConfig {
  serviceName: string;
  isLocal: boolean;
  hostEnvVar?: string; // Environment variable name for remote services
}

const SERVICE_CONFIG: Record<string, ServiceConfig> = {
  // Local services (all run on apps-lxc, same container as busibox-portal)
  'busibox-portal': { serviceName: 'busibox-portal.service', isLocal: true },
  'busibox-agents': { serviceName: 'busibox-agents.service', isLocal: true },
  
  // Remote services (require SSH) - host comes from environment variables
  // Agent container (agent-lxc)
  'agent-server': { serviceName: 'agent-server.service', isLocal: false, hostEnvVar: 'AGENT_HOST' },
  
  // Data container (data-lxc)
  'data-api': { serviceName: 'data-api.service', isLocal: false, hostEnvVar: 'DATA_API_HOST' },
  'data-worker': { serviceName: 'data-worker.service', isLocal: false, hostEnvVar: 'DATA_API_HOST' },
  
  // Milvus container (milvus-lxc)
  'search-api': { serviceName: 'search-api.service', isLocal: false, hostEnvVar: 'MILVUS_HOST' },
};

/**
 * Get the host for a remote service from environment variables
 */
function getRemoteHost(config: ServiceConfig): string | null {
  if (config.isLocal || !config.hostEnvVar) return null;
  return process.env[config.hostEnvVar] || null;
}

// All available services
const ALL_SERVICES = Object.keys(SERVICE_CONFIG);

/**
 * GET /api/logs
 * 
 * Fetch logs from all services via systemd journalctl
 * 
 * Query params:
 * - service: service name or 'all' (default: 'all')
 *   Available: busibox-portal, busibox-agents, doc-intel, foundation, busibox-analysis, 
 *              innovation, agent-server, data-api, data-worker, search-api
 * - limit: number of log entries to return (default: 100, max: 1000)
 * - since: ISO timestamp to fetch logs since (optional)
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service') || 'all';
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
  const since = searchParams.get('since');

  try {
    const logs: LogEntry[] = [];
    
    // Determine which services to fetch
    const servicesToFetch = service === 'all' 
      ? ALL_SERVICES 
      : SERVICE_CONFIG[service] ? [service] : [];
    
    if (servicesToFetch.length === 0 && service !== 'all') {
      return apiError(`Unknown service: ${service}. Available: ${ALL_SERVICES.join(', ')}`, 400);
    }

    // Fetch logs from all requested services in parallel
    const logPromises = servicesToFetch.map(async (svc) => {
      try {
        const config = SERVICE_CONFIG[svc];
        
        if (config.isLocal) {
          // Local service - use journalctl directly
          return await fetchLocalJournalctlLogs(svc, config.serviceName, limit, since);
        } else {
          // Remote service via SSH
          const host = getRemoteHost(config);
          if (!host) {
            // Environment variable not configured - skip this service
            console.warn(`Skipping ${svc} logs: ${config.hostEnvVar} environment variable not set`);
            return [];
          }
          return await fetchRemoteJournalctlLogs(svc, host, config.serviceName, limit, since);
        }
      } catch (error) {
        console.error(`Failed to fetch ${svc} logs:`, error);
        return [];
      }
    });

    const results = await Promise.all(logPromises);
    results.forEach(result => logs.push(...result));

    // Sort by timestamp descending (most recent first)
    // Logs with 'unknown' timestamp are placed at the end
    logs.sort((a, b) => {
      if (a.timestamp === 'unknown' && b.timestamp === 'unknown') return 0;
      if (a.timestamp === 'unknown') return 1;
      if (b.timestamp === 'unknown') return -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Limit results
    const limitedLogs = logs.slice(0, limit);

    return NextResponse.json({ 
      logs: limitedLogs, 
      count: limitedLogs.length,
      availableServices: ALL_SERVICES,
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return apiError('Failed to fetch logs', 500);
  }
}


/**
 * Fetch logs from local systemd service via journalctl
 */
async function fetchLocalJournalctlLogs(
  serviceName: string,
  systemdUnit: string,
  limit: number,
  since?: string | null
): Promise<LogEntry[]> {
  let cmd = `journalctl -u ${systemdUnit} -o json -n ${limit}`;
  if (since) {
    cmd += ` --since='${since}'`;
  }

  try {
    const { stdout } = await execAsync(cmd, { timeout: 10000 });
    return parseJournalctlOutput(stdout, serviceName);
  } catch (error: any) {
    console.error(`Failed to fetch ${serviceName} logs from journalctl:`, error.message);
    return [];
  }
}

/**
 * Fetch logs from remote systemd service via SSH + journalctl
 */
async function fetchRemoteJournalctlLogs(
  serviceName: string,
  host: string,
  systemdUnit: string,
  limit: number,
  since?: string | null
): Promise<LogEntry[]> {
  let cmd = `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 root@${host} "journalctl -u ${systemdUnit} -o json -n ${limit}`;
  if (since) {
    cmd += ` --since='${since}'`;
  }
  cmd += '"';

  try {
    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    return parseJournalctlOutput(stdout, serviceName);
  } catch (error: any) {
    // Rate limit error logging
    const errorKey = `lastSSHError_${serviceName}`;
    const now = Date.now();
    const lastError = (global as any)[errorKey] || 0;
    if (now - lastError > 60000) {
      console.error(`SSH journalctl error (${serviceName}):`, error.message);
      (global as any)[errorKey] = now;
    }
    return [];
  }
}

/**
 * Parse journalctl JSON output into log entries
 */
function parseJournalctlOutput(stdout: string, serviceName: string): LogEntry[] {
  const lines = stdout.trim().split('\n').filter((line: string) => line);
  
  return lines.map((line: string) => {
    try {
      const entry = JSON.parse(line);
      return {
        timestamp: new Date(parseInt(entry.__REALTIME_TIMESTAMP) / 1000).toISOString(),
        service: serviceName,
        level: entry.PRIORITY === '3' ? 'error' : entry.PRIORITY === '4' ? 'warning' : 'info',
        message: entry.MESSAGE || '',
        details: {
          unit: entry._SYSTEMD_UNIT,
          pid: entry._PID,
        },
      };
    } catch {
      return null;
    }
  }).filter((entry: LogEntry | null) => entry !== null) as LogEntry[];
}


