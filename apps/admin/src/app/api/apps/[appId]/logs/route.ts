/**
 * API Route: Get application logs
 * 
 * GET /api/apps/[appId]/logs?lines=100
 * 
 * Returns logs for a specific application from systemd journalctl
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserWithSessionFromCookies } from '@jazzmind/busibox-app/lib/next/middleware';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getAppConfigById } from '@jazzmind/busibox-app/lib/deploy/app-config';

const execAsync = promisify(exec);

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  type: 'stdout' | 'stderr';
}

// Map app names to their systemd service names
// isLocal: true = local service (same container as busibox-portal), uses journalctl directly
// isLocal: false = remote service, requires SSH with host from env var
interface ServiceConfig {
  serviceName: string;
  isLocal: boolean;
  hostEnvVar?: string;
}

const APP_SERVICE_MAP: Record<string, ServiceConfig> = {
  // Local services (all run on apps-lxc, same container as busibox-portal)
  'busibox-portal': { serviceName: 'busibox-portal.service', isLocal: true },
  'busibox-agents': { serviceName: 'busibox-agents.service', isLocal: true },
 
  // Remote services (require SSH)
  'agent-server': { serviceName: 'agent-server.service', isLocal: false, hostEnvVar: 'AGENT_HOST' },
  'data-api': { serviceName: 'data-api.service', isLocal: false, hostEnvVar: 'DATA_API_HOST' },
  'data-worker': { serviceName: 'data-worker.service', isLocal: false, hostEnvVar: 'DATA_API_HOST' },
  'search-api': { serviceName: 'search-api.service', isLocal: false, hostEnvVar: 'MILVUS_HOST' },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const user = await getCurrentUserWithSessionFromCookies();

  if (!user || !user.roles?.includes('Admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { appId } = await params;
  const { searchParams } = new URL(request.url);
  const lines = parseInt(searchParams.get('lines') || '100', 10);

  try {
    const app = await getAppConfigById({ userId: user.id, sessionJwt: user.sessionJwt }, appId);

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    if (app.type !== 'BUILT_IN' && app.type !== 'LIBRARY') {
      return NextResponse.json(
        { error: 'Logs only available for internal apps' },
        { status: 400 }
      );
    }

    // Get logs from systemd journalctl
    const logs = await getAppLogs(app.name, lines);

    return NextResponse.json({
      appName: app.name,
      lines: logs.length,
      logs,
    });
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

/**
 * Get logs from systemd journalctl for a specific app
 */
async function getAppLogs(appName: string, lines: number): Promise<LogEntry[]> {
  const serviceConfig = APP_SERVICE_MAP[appName];
  
  if (!serviceConfig) {
    throw new Error(`Unknown application: ${appName}. Available apps: ${Object.keys(APP_SERVICE_MAP).join(', ')}`);
  }

  try {
    let cmd: string;
    
    if (serviceConfig.isLocal) {
      // Local service - use journalctl directly
      cmd = `journalctl -u ${serviceConfig.serviceName} -o json -n ${lines} --no-pager`;
    } else {
      // Remote service - use SSH
      const host = serviceConfig.hostEnvVar ? process.env[serviceConfig.hostEnvVar] : null;
      if (!host) {
        throw new Error(`${serviceConfig.hostEnvVar} environment variable not configured for ${appName}`);
      }
      cmd = `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 root@${host} "journalctl -u ${serviceConfig.serviceName} -o json -n ${lines} --no-pager"`;
    }

    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    
    // Parse journalctl JSON output
    const logEntries: LogEntry[] = [];
    const logLines = stdout.trim().split('\n').filter(line => line);

    for (const line of logLines) {
      try {
        const entry = JSON.parse(line);
        
        // journalctl JSON format includes __REALTIME_TIMESTAMP (microseconds), MESSAGE, PRIORITY, etc.
        const priority = entry.PRIORITY;
        let level = 'info';
        let type: 'stdout' | 'stderr' = 'stdout';
        
        if (priority === '3' || priority === '2' || priority === '1' || priority === '0') {
          level = 'error';
          type = 'stderr';
        } else if (priority === '4') {
          level = 'warning';
        }
        
        logEntries.push({
          timestamp: new Date(parseInt(entry.__REALTIME_TIMESTAMP) / 1000).toISOString(),
          level,
          message: entry.MESSAGE || '',
          type,
        });
      } catch {
        // If not valid JSON, skip this line
        continue;
      }
    }

    return logEntries;
  } catch (error: any) {
    if (error.message?.includes('Permission denied')) {
      const host = serviceConfig.hostEnvVar ? process.env[serviceConfig.hostEnvVar] : 'unknown';
      throw new Error(`SSH access denied to ${host}. Check SSH key configuration.`);
    }
    if (error.message?.includes('No journal files')) {
      throw new Error(`No logs found for ${appName}. The service may not have started yet.`);
    }
    throw new Error(`Failed to fetch logs for ${appName}: ${error.message}`);
  }
}

