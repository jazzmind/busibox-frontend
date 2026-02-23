/**
 * GET /api/services/status
 * 
 * Returns the status of all Busibox services for the admin dashboard.
 *
 * Design principles:
 *   - This endpoint must return FAST (< 1s). It should never make slow
 *     network calls that could pile up and overload the container.
 *   - Docker: uses `docker compose ps` via deploy-api — one fast call.
 *     The docker compose output already contains State and Health columns
 *     from Docker's own healthchecks, so we don't need to re-probe services.
 *   - Proxmox fallback: individual health checks via deploy-api (these run
 *     outside core-apps so there's no circular dependency).
 *   - Results are cached server-side for 60s. Pass ?fresh=true to bypass.
 *   - No per-service health augmentation — that was making ~20 HTTP calls
 *     per request, including calls back into core-apps (circular), causing
 *     CPU death spirals in dev mode.
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorRequireLogout, getCurrentUserWithSessionFromCookies, requireAdmin, isInvalidSessionError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';
import { getDeployApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

// Deploy API base URL
const DEPLOY_API_URL = process.env.DEPLOY_API_URL || getDeployApiUrl();
const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

// --- Server-side response cache ---
const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedResponse: { data: unknown; timestamp: number } | null = null;

/** Fetch with a timeout. Rejects if the request takes longer than `ms`. */
function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// Service metadata & types
// ---------------------------------------------------------------------------

type ServiceTier = 'infrastructure' | 'llm' | 'api' | 'apps';

const SERVICE_METADATA: Record<string, { name: string; tier: ServiceTier; description: string; order: number }> = {
  // Infrastructure Services
  postgres: { name: 'PostgreSQL', tier: 'infrastructure', description: 'Database', order: 1 },
  redis: { name: 'Redis', tier: 'infrastructure', description: 'Cache & Queue', order: 2 },
  milvus: { name: 'Milvus', tier: 'infrastructure', description: 'Vector Database', order: 3 },
  // Sub-services of Milvus (consolidated into Milvus in display)
  etcd: { name: 'etcd', tier: 'infrastructure', description: 'Milvus Metadata Store', order: 3 },
  'milvus-minio': { name: 'Milvus MinIO', tier: 'infrastructure', description: 'Milvus Object Storage', order: 3 },
  minio: { name: 'MinIO', tier: 'infrastructure', description: 'Object Storage', order: 4 },
  neo4j: { name: 'Neo4j', tier: 'infrastructure', description: 'Graph Database', order: 5 },
  nginx: { name: 'Nginx', tier: 'infrastructure', description: 'Reverse Proxy', order: 6 },
  // LLM Services
  litellm: { name: 'LiteLLM', tier: 'llm', description: 'LLM Gateway', order: 1 },
  'embedding-api': { name: 'Embedding', tier: 'llm', description: 'Text Embeddings', order: 2 },
  mlx: { name: 'MLX', tier: 'llm', description: 'Apple Silicon LLM', order: 3 },
  vllm: { name: 'vLLM', tier: 'llm', description: 'GPU LLM Server', order: 4 },
  'host-agent': { name: 'Host Agent', tier: 'llm', description: 'Host Process Manager', order: 5 },
  // API Services
  'authz-api': { name: 'AuthZ', tier: 'api', description: 'Authentication & Authorization', order: 1 },
  'deploy-api': { name: 'Deploy', tier: 'api', description: 'Deployment Service', order: 2 },
  'data-api': { name: 'Data', tier: 'api', description: 'Document Processing', order: 3 },
  // Sub-service of Data API (consolidated into Data in display)
  'data-worker': { name: 'Data Worker', tier: 'api', description: 'Background Jobs', order: 3 },
  'search-api': { name: 'Search', tier: 'api', description: 'Semantic Search', order: 4 },
  'agent-api': { name: 'Agent', tier: 'api', description: 'AI Agents', order: 5 },
  'docs-api': { name: 'Docs', tier: 'api', description: 'Documentation', order: 6 },
  'bridge-api': { name: 'Bridge', tier: 'api', description: 'Email & Messaging', order: 7 },
  // Apps (core-apps is the container; busibox-portal/busibox-agents are sub-services)
  'core-apps': { name: 'Core Apps', tier: 'apps', description: 'Portal, Agent Manager, and App Builder', order: 1 },
  'busibox-portal': { name: 'Busibox Portal', tier: 'apps', description: 'Admin Dashboard', order: 2 },
  'busibox-agents': { name: 'Agent Manager', tier: 'apps', description: 'Agent UI', order: 3 },
  'busibox-appbuilder': { name: 'App Builder', tier: 'apps', description: 'AI App Builder', order: 4 },
  'user-apps': { name: 'User Apps', tier: 'apps', description: 'Deployed Applications', order: 5 },
};

const TIER_INFO: Record<ServiceTier, { label: string; order: number }> = {
  infrastructure: { label: 'Infrastructure', order: 1 },
  llm: { label: 'LLM Services', order: 2 },
  api: { label: 'API Services', order: 3 },
  apps: { label: 'Apps', order: 4 },
};

/**
 * Sub-service consolidation rules.
 * 
 * Some Docker containers are internal dependencies of a parent service and
 * should not be shown separately. Instead, the parent absorbs their status:
 * if ALL sub-services are healthy the parent shows healthy; if ANY is
 * unhealthy the parent shows unhealthy.
 */
const SUB_SERVICE_GROUPS: Record<string, string[]> = {
  // etcd and milvus-minio are internal Milvus dependencies
  milvus: ['etcd', 'milvus-minio'],
  // data-worker runs alongside data-api as background jobs
  'data-api': ['data-worker'],
};

interface DockerComposeService {
  ID?: string;
  Name: string;
  Service: string;
  Status: string;
  State: string;
  Health?: string;
  Ports?: string;
}

interface ServiceInfo {
  id: string;
  name: string;
  tier: ServiceTier;
  tierLabel: string;
  description: string;
  status: 'running' | 'stopped' | 'starting' | 'error' | 'unknown';
  health: 'healthy' | 'unhealthy' | 'unknown';
  order: number;
  rawStatus?: string;
  rawState?: string;
  /** IDs of sub-services that were consolidated into this entry */
  consolidatedFrom?: string[];
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Parse docker compose ps JSON into ServiceInfo array. No network calls. */
function parseDockerStatus(dockerServices: DockerComposeService[]): ServiceInfo[] {
  return dockerServices.map((svc) => {
    // Docker uses a dedicated "proxy" service; normalize it to nginx for UI consistency.
    const rawServiceName = svc.Service || 'unknown';
    const serviceName = rawServiceName === 'proxy' ? 'nginx' : rawServiceName;
    const meta = SERVICE_METADATA[serviceName];
    const defaultMeta = {
      name: serviceName.charAt(0).toUpperCase() + serviceName.slice(1).replace(/-/g, ' '),
      tier: 'apps' as ServiceTier,
      description: 'Service',
      order: 99,
    };
    const { name, tier, description, order } = meta || defaultMeta;

    let status: ServiceInfo['status'] = 'unknown';
    let health: ServiceInfo['health'] = 'unknown';

    const stateStr = (svc.State || '').toLowerCase();
    const statusStr = (svc.Status || '').toLowerCase();
    const healthStr = (svc.Health || '').toLowerCase();

    if (stateStr === 'running') status = 'running';
    else if (stateStr === 'created' || stateStr.includes('starting')) status = 'starting';
    else if (stateStr.includes('exited') || stateStr === 'stopped' || stateStr === 'dead') status = 'stopped';
    else if (stateStr.includes('restarting')) status = 'error';

    if (healthStr === 'healthy') health = 'healthy';
    else if (healthStr === 'unhealthy') health = 'unhealthy';
    else if (statusStr.includes('(healthy)')) health = 'healthy';
    else if (statusStr.includes('(unhealthy)')) health = 'unhealthy';
    else if (statusStr.includes('(health: starting)')) health = 'unknown';
    // Services with no healthcheck: if running, treat as healthy
    else if (status === 'running') health = 'healthy';

    return {
      id: serviceName, name, tier,
      tierLabel: TIER_INFO[tier]?.label || tier,
      description, status, health, order,
      rawStatus: svc.Status, rawState: svc.State,
    };
  });
}

/**
 * Expand the "core-apps" container entry into its sub-services.
 * 
 * In Docker, nginx/busibox-portal/busibox-agents all run inside the core-apps
 * container. We can't see them individually in `docker compose ps`, so we
 * expand core-apps into sub-entries that inherit its status.
 * 
 * IMPORTANT: No HTTP calls — just uses the core-apps container status.
 * We used to call deploy-api health checks for each sub-service, but that
 * created a circular dependency (busibox-portal → deploy-api → nginx → busibox-portal)
 * and hammered the dev server with compilation requests.
 */
function expandCoreApps(services: ServiceInfo[]): ServiceInfo[] {
  const coreAppsIdx = services.findIndex(s => s.id === 'core-apps');
  if (coreAppsIdx === -1) return services;

  const coreApps = services[coreAppsIdx];

  // Create sub-service entries that inherit core-apps container status.
  // In Docker, nginx runs inside core-apps alongside the Next.js apps.
  // If nginx appears as its own Docker service (hybrid profile), it won't
  // be duplicated because core-apps wouldn't exist in that mode.
  const subServices: ServiceInfo[] = ['busibox-portal', 'busibox-agents', 'busibox-appbuilder'].map(subId => {
    const meta = SERVICE_METADATA[subId]!;
    return {
      id: subId,
      name: meta.name,
      tier: meta.tier,
      tierLabel: TIER_INFO[meta.tier]?.label || meta.tier,
      description: meta.description,
      // Inherit status from the core-apps container.
      status: coreApps.status,
      // Avoid false negatives when core-apps is running but its coarse container
      // health is transiently unhealthy; app-level checks in the UI/actions remain available.
      health: coreApps.status === 'running' && coreApps.health === 'unhealthy' ? 'unknown' : coreApps.health,
      order: meta.order,
      rawStatus: coreApps.status === 'running'
        ? `running (inside core-apps)`
        : `core-apps: ${coreApps.rawStatus || coreApps.status}`,
      rawState: coreApps.rawState,
    };
  });

  // Replace core-apps with the sub-services
  const result = services.filter(s => s.id !== 'core-apps');
  result.push(...subServices);
  return result;
}

/**
 * Consolidate sub-services into their parent service.
 * 
 * For example, etcd and milvus-minio are folded into the "Milvus" entry,
 * and data-worker is folded into the "Data" entry. The parent's health
 * becomes unhealthy if ANY child is unhealthy, and the parent's status
 * becomes the worst of its children.
 */
function consolidateSubServices(services: ServiceInfo[]): ServiceInfo[] {
  const subServiceIds = new Set(
    Object.values(SUB_SERVICE_GROUPS).flat(),
  );

  const result: ServiceInfo[] = [];
  for (const svc of services) {
    // Skip sub-services (they'll be absorbed by the parent)
    if (subServiceIds.has(svc.id)) continue;

    const childIds = SUB_SERVICE_GROUPS[svc.id];
    if (!childIds) {
      result.push(svc);
      continue;
    }

    // Find the child services
    const children = services.filter(s => childIds.includes(s.id));
    if (children.length === 0) {
      result.push(svc);
      continue;
    }

    // Determine consolidated health: unhealthy if any child is unhealthy
    const allEntries = [svc, ...children];
    const anyUnhealthy = allEntries.some(s => s.health === 'unhealthy');
    const anyStopped = allEntries.some(s => s.status === 'stopped' || s.status === 'error');
    const anyStarting = allEntries.some(s => s.status === 'starting');

    let consolidatedStatus = svc.status;
    let consolidatedHealth = svc.health;

    if (anyStopped) {
      consolidatedStatus = 'error';
      consolidatedHealth = 'unhealthy';
    } else if (anyStarting) {
      consolidatedStatus = 'starting';
    }
    if (anyUnhealthy) {
      consolidatedHealth = 'unhealthy';
    }

    result.push({
      ...svc,
      status: consolidatedStatus,
      health: consolidatedHealth,
      consolidatedFrom: children.map(c => c.id),
    });
  }

  return result;
}

function sortAndGroup(services: ServiceInfo[]) {
  services.sort((a, b) => {
    const ta = TIER_INFO[a.tier]?.order || 99;
    const tb = TIER_INFO[b.tier]?.order || 99;
    return ta !== tb ? ta - tb : a.order - b.order;
  });
  const byTier: Record<ServiceTier, ServiceInfo[]> = { infrastructure: [], llm: [], api: [], apps: [] };
  for (const svc of services) {
    byTier[svc.tier]?.push(svc);
  }
  return byTier;
}

function buildResponsePayload(services: ServiceInfo[], error?: string) {
  const healthyCount = services.filter(s =>
    s.status === 'running' && (s.health === 'healthy' || s.health === 'unknown')
  ).length;
  return {
    services,
    byTier: sortAndGroup(services),
    tiers: Object.entries(TIER_INFO).map(([id, info]) => ({
      id, label: info.label, order: info.order,
    })).sort((a, b) => a.order - b.order),
    total: services.length,
    healthy: healthyCount,
    ...(error ? { error } : {}),
  };
}

// ---------------------------------------------------------------------------
// Host-native services — MLX and host-agent run on the host, not in Docker.
// We check them separately via deploy-api health probes when in Docker mode.
// ---------------------------------------------------------------------------

/**
 * Host-native services that don't appear in `docker compose ps`.
 * These are checked via deploy-api health probes and added to the service
 * list when they respond (either healthy or unhealthy).
 */
const HOST_NATIVE_SERVICES = ['host-agent', 'mlx'];

/**
 * Check host-native services (MLX, host-agent) via deploy-api health probes.
 * Returns ServiceInfo entries for services that respond (healthy or unhealthy).
 * Services that are unreachable (host-agent not installed) are silently omitted.
 */
async function checkHostNativeServices(
  deployApiUrl: string,
  adminToken: string,
): Promise<ServiceInfo[]> {
  const results: ServiceInfo[] = [];

  // First check if host-agent is reachable — if not, skip all host services
  const checks = await Promise.all(
    HOST_NATIVE_SERVICES.map(async (serviceId) => {
      try {
        const res = await fetchWithTimeout(`${deployApiUrl}/api/v1/services/health`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ service: serviceId }),
        }, 3_000); // Short timeout — these are on local network
        if (!res.ok) return { serviceId, reachable: true, healthy: false, reason: `http_${res.status}` };
        const payload = (await res.json()) as { healthy?: boolean; reason?: string };
        return { serviceId, reachable: true, healthy: payload.healthy === true, reason: payload.reason || '' };
      } catch {
        // Unreachable — host-agent not installed or host not accessible
        return { serviceId, reachable: false, healthy: false, reason: 'unreachable' };
      }
    }),
  );

  // If host-agent isn't reachable, don't show any host-native services
  const hostAgentCheck = checks.find(c => c.serviceId === 'host-agent');
  if (!hostAgentCheck?.reachable) return [];

  for (const check of checks) {
    // Only show services that are reachable (responding to health checks)
    if (!check.reachable) continue;

    const meta = SERVICE_METADATA[check.serviceId];
    if (!meta) continue;

    results.push({
      id: check.serviceId,
      name: meta.name,
      tier: meta.tier,
      tierLabel: TIER_INFO[meta.tier]?.label || meta.tier,
      description: meta.description,
      status: check.healthy ? 'running' : 'stopped',
      health: check.healthy ? 'healthy' : 'unhealthy',
      order: meta.order,
      rawStatus: check.healthy ? 'running (host process)' : 'not running (host process)',
      rawState: check.healthy ? 'healthy' : 'stopped',
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Proxmox fallback — individual health checks (only used when docker compose
// is not available). These calls go to deploy-api which checks each service
// externally, so there's no circular dependency in the Proxmox environment.
// ---------------------------------------------------------------------------

/**
 * Optional services that may not be present in all configurations.
 * When these fail health checks in Proxmox fallback mode, they are
 * silently omitted rather than shown as "down".
 */
const OPTIONAL_SERVICES = new Set([
  'mlx', 'vllm', 'host-agent', 'neo4j',
  'etcd', 'milvus-minio',  // Only present in Docker (Milvus sub-containers)
]);

async function buildFallbackFromHealthChecks(
  deployApiUrl: string,
  adminToken: string,
): Promise<ServiceInfo[]> {
  // Check all services including sub-services (consolidation happens later)
  const serviceIds = [
    'postgres', 'redis', 'milvus', 'etcd', 'milvus-minio', 'minio', 'neo4j', 'nginx',
    'litellm', 'embedding-api', 'mlx', 'vllm', 'host-agent',
    'authz-api', 'deploy-api', 'data-api', 'data-worker', 'search-api', 'agent-api', 'docs-api', 'bridge-api',
    'busibox-portal', 'busibox-agents',
  ];

  const checks = await Promise.all(
    serviceIds.map(async (serviceId) => {
      try {
        const res = await fetchWithTimeout(`${deployApiUrl}/api/v1/services/health`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ service: serviceId }),
        }, 5_000);
        if (!res.ok) return { serviceId, healthy: false, reason: `http_${res.status}` };
        const payload = (await res.json()) as { healthy?: boolean; reason?: string };
        return { serviceId, healthy: payload.healthy === true, reason: payload.reason || '' };
      } catch (err) {
        return { serviceId, healthy: false, reason: err instanceof Error ? err.message : 'error' };
      }
    }),
  );

  return checks
    // Filter out optional services that are not available
    .filter(({ serviceId, healthy }) => healthy || !OPTIONAL_SERVICES.has(serviceId))
    .map(({ serviceId, healthy, reason }) => {
      const meta = SERVICE_METADATA[serviceId] || {
        name: serviceId.charAt(0).toUpperCase() + serviceId.slice(1).replace(/-/g, ' '),
        tier: 'apps' as ServiceTier, description: 'Service', order: 99,
      };
      return {
        id: serviceId, name: meta.name, tier: meta.tier,
        tierLabel: TIER_INFO[meta.tier]?.label || meta.tier,
        description: meta.description,
        status: healthy ? 'running' : 'stopped',
        health: healthy ? 'healthy' : 'unhealthy',
        order: meta.order,
        rawStatus: healthy ? 'health check passed' : `health check failed (${reason || 'unknown'})`,
        rawState: healthy ? 'healthy' : 'unhealthy',
      };
    });
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const userWithSession = await getCurrentUserWithSessionFromCookies();
    if (!userWithSession) return apiError('Authentication required', 401);

    const { sessionJwt, ...user } = userWithSession;
    if (!requireAdmin(user)) return apiError('Admin access required', 403);

    // Return cache if warm (bypass with ?fresh=true)
    const wantFresh = request.nextUrl.searchParams.get('fresh') === 'true';
    if (!wantFresh && cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL_MS) {
      return apiSuccess(cachedResponse.data);
    }

    // Token exchange for deploy-api
    let adminToken = sessionJwt;
    try {
      const result = await exchangeTokenZeroTrust(
        { sessionJwt, audience: 'deploy-api', scopes: ['admin', 'services:read'], purpose: 'Get service status' },
        { authzBaseUrl: AUTHZ_BASE_URL, verbose: false },
      );
      adminToken = result.accessToken;
    } catch (exchangeError) {
      if (isInvalidSessionError(exchangeError)) {
        return apiErrorRequireLogout(
          'Your session is no longer valid. Please log in again.',
          (exchangeError as { code?: string }).code,
        );
      }
      // Fall through with session token
    }

    // --- Primary path: docker compose ps (fast, one call, no health probes) ---
    try {
      const res = await fetchWithTimeout(`${DEPLOY_API_URL}/api/v1/services/status`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      }, 10_000);

      if (res.ok) {
        const data = await res.json();
        const dockerServices: DockerComposeService[] = data.services || [];
        const parsed = parseDockerStatus(dockerServices);
        const expanded = expandCoreApps(parsed);

        // Check host-native services (MLX, host-agent) — these run on the
        // host machine, not in Docker, so they don't appear in docker compose ps.
        // This adds 1-2 fast health checks (~3s timeout each, in parallel).
        const hostServices = await checkHostNativeServices(DEPLOY_API_URL, adminToken);
        const allServices = [...expanded, ...hostServices];

        const consolidated = consolidateSubServices(allServices);
        const payload = buildResponsePayload(consolidated);

        cachedResponse = { data: payload, timestamp: Date.now() };
        return apiSuccess(payload);
      }
      console.error('[services/status] deploy-api error:', res.status, await res.text());
    } catch (err) {
      console.error('[services/status] deploy-api unreachable:', err);
    }

    // --- Fallback: Proxmox / non-docker — individual health checks ---
    try {
      const rawServices = await buildFallbackFromHealthChecks(DEPLOY_API_URL, adminToken);
      const consolidated = consolidateSubServices(rawServices);
      const payload = buildResponsePayload(consolidated, 'Docker status unavailable; using service health checks');
      cachedResponse = { data: payload, timestamp: Date.now() };
      return apiSuccess(payload);
    } catch (err) {
      console.error('[services/status] fallback failed:', err);
    }

    // --- Final fallback: nothing works ---
    return apiSuccess(buildResponsePayload([], 'Deploy API unavailable'));
  } catch (error) {
    console.error('[services/status] error:', error);
    return apiError('Failed to get service status', 500);
  }
}
