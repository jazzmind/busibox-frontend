/**
 * System Dashboard Page
 * 
 * Admin dashboard for managing Busibox services.
 * Shows service status with real-time updates from deploy-api,
 * grouped by tier: Core Services, LLM Services, API Services, Apps.
 * 
 * Includes per-app developer mode controls for toggling individual
 * apps between Turbopack hot-reload (dev) and standalone (prod) modes.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCustomization } from '@jazzmind/busibox-app';
import { RefreshCw, Play, Square, RotateCcw, CheckCircle, XCircle, AlertCircle, Circle, ChevronDown, ChevronUp, Activity, Code2, Zap, Hammer, Wrench } from 'lucide-react';

const BUSIBOX_ENV = process.env.NEXT_PUBLIC_BUSIBOX_ENV;
const IS_DEPLOYED = BUSIBOX_ENV === 'production' || BUSIBOX_ENV === 'staging';

interface AppStatus {
  mode: 'dev' | 'prod';
  pid: number | null;
  port: number;
  basePath: string;
  running: boolean;
  stopping: boolean;
  healthy: boolean;
  restarts: number;
}

interface DevModeData {
  apps: Record<string, AppStatus>;
  appLib?: { running: boolean; pid: number | null };
  fallback?: boolean;
  description?: string;
  enabled?: boolean;
  currentMode?: string;
  reinstalling?: boolean;
}

type ServiceTier = 'infrastructure' | 'llm' | 'api' | 'apps';

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
  consolidatedFrom?: string[];
}

interface TierInfo {
  id: string;
  label: string;
  order: number;
}

interface ServicesByTier {
  infrastructure: ServiceInfo[];
  llm: ServiceInfo[];
  api: ServiceInfo[];
  apps: ServiceInfo[];
}

const APP_DISPLAY_NAMES: Record<string, string> = {
  portal: 'Portal',
  agents: 'Agents',
  admin: 'Admin',
  chat: 'Chat',
  appbuilder: 'App Builder',
  media: 'Media',
  documents: 'Documents',
};

export default function SystemDashboardPage() {
  const { customization } = useCustomization();
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [byTier, setByTier] = useState<ServicesByTier>({ infrastructure: [], llm: [], api: [], apps: [] });
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['infrastructure', 'llm', 'api', 'apps']));
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Per-app dev mode state
  const [devModeData, setDevModeData] = useState<DevModeData | null>(null);
  const [devModeLoading, setDevModeLoading] = useState(false);
  const [appActionInProgress, setAppActionInProgress] = useState<string | null>(null);

  // Redeploy state
  const [isRedeploying, setIsRedeploying] = useState(false);
  const [redeployError, setRedeployError] = useState<string | null>(null);

  const fetchServiceStatus = useCallback(async (fresh = false) => {
    try {
      const url = fresh ? '/api/services/status?fresh=true' : '/api/services/status';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setServices(data.data.services || []);
          setByTier(data.data.byTier || { infrastructure: [], llm: [], api: [], apps: [] });
          setTiers(data.data.tiers || []);
          setApiError(data.data.error || null);
        }
      } else {
        setApiError('Failed to fetch service status');
      }
    } catch (error) {
      console.error('Failed to fetch service status:', error);
      setApiError('Connection error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchDevMode = useCallback(async () => {
    if (IS_DEPLOYED) return;
    setDevModeLoading(true);
    try {
      const response = await fetch('/api/services/core-dev-mode');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setDevModeData(data.data);
          if (data.data.reinstalling !== undefined) {
            setIsRedeploying(data.data.reinstalling);
          }
        }
      }
    } catch {
      // Non-critical
    } finally {
      setDevModeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServiceStatus();
    fetchDevMode();
  }, [fetchServiceStatus, fetchDevMode]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchServiceStatus(true), fetchDevMode()]);
  };

  const handleServiceAction = async (serviceId: string, action: 'start' | 'stop' | 'restart') => {
    setActionInProgress(serviceId);
    try {
      const response = await fetch(`/api/services/${serviceId}/${action}`, { method: 'POST' });
      if (!response.ok) throw new Error('Action failed');
      await fetchServiceStatus(true);
    } catch (error) {
      console.error(`Failed to ${action} service ${serviceId}:`, error);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleStartAll = async (tierId: string) => {
    const tierServices = byTier[tierId as keyof ServicesByTier] || [];
    for (const service of tierServices) {
      if (service.status !== 'running') {
        await handleServiceAction(service.id, 'start');
      }
    }
  };

  const pollForModeChange = useCallback(async (
    targetApps: string[],
    targetMode: 'dev' | 'prod',
    maxAttempts = 60,
    intervalMs = 3000,
  ) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, intervalMs));
      try {
        const response = await fetch('/api/services/core-dev-mode');
        if (!response.ok) continue;
        const data = await response.json();
        if (!data.success || !data.data?.apps) continue;

        setDevModeData(data.data);

        const allDone = targetApps.every(app => {
          const appState = data.data.apps[app];
          return appState && appState.mode === targetMode && appState.running;
        });
        if (allDone) return;
      } catch {
        // keep polling
      }
    }
  }, []);

  const handleToggleAppMode = async (appName: string, newMode: 'dev' | 'prod') => {
    setAppActionInProgress(appName);
    try {
      const response = await fetch('/api/services/core-dev-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appName, mode: newMode }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setDevModeData(prev => prev ? { ...prev, apps: { ...prev.apps, ...data.data } } : prev);
        }
        await pollForModeChange([appName], newMode, 40, 2000);
      } else {
        const err = await response.json().catch(() => ({}));
        console.error('Toggle failed:', err);
      }
    } catch (error) {
      console.error('Failed to toggle app mode:', error);
    } finally {
      setAppActionInProgress(null);
      await fetchDevMode();
    }
  };

  const handleSetAllMode = async (mode: 'dev' | 'prod') => {
    setAppActionInProgress('__all__');
    try {
      const appNames = devModeData?.apps ? Object.keys(devModeData.apps) : [];

      const response = await fetch('/api/services/core-dev-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allApps: mode }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setDevModeData(prev => prev ? { ...prev, apps: { ...prev.apps, ...data.data } } : prev);
        }
        if (appNames.length > 0) {
          await pollForModeChange(appNames, mode);
        }
      }
    } catch (error) {
      console.error('Failed to set all mode:', error);
    } finally {
      setAppActionInProgress(null);
      await fetchDevMode();
    }
  };

  const handleRestartApp = async (appName: string) => {
    setAppActionInProgress(appName);
    try {
      const response = await fetch('/api/services/core-apps-restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: appName }),
      });
      if (response.ok) {
        await fetchDevMode();
      }
    } catch (error) {
      console.error('Failed to restart app:', error);
    } finally {
      setAppActionInProgress(null);
    }
  };

  const handleRedeploy = async () => {
    if (isRedeploying) return;
    setIsRedeploying(true);
    setRedeployError(null);
    try {
      const response = await fetch('/api/services/core-apps-redeploy', {
        method: 'POST',
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setRedeployError(err.error || 'Failed to start redeploy');
        setIsRedeploying(false);
        return;
      }
      // Poll until reinstall completes
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const statusRes = await fetch('/api/services/core-dev-mode');
          if (statusRes.ok) {
            const data = await statusRes.json();
            if (data.success && data.data) {
              setDevModeData(data.data);
              if (!data.data.reinstalling) {
                setIsRedeploying(false);
                return;
              }
            }
          }
        } catch {
          // keep polling - the admin app may restart during redeploy
        }
      }
      setRedeployError('Redeploy timed out');
      setIsRedeploying(false);
    } catch (error) {
      console.error('Failed to redeploy:', error);
      setRedeployError('Failed to start redeploy');
      setIsRedeploying(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const getServiceIcon = (service: ServiceInfo) => {
    if (service.status === 'running') {
      if (service.health === 'unhealthy') return <XCircle className="w-5 h-5 text-red-500" />;
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    if (service.status === 'starting') return <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />;
    if (service.status === 'error') return <XCircle className="w-5 h-5 text-red-500" />;
    if (service.status === 'stopped') return <Circle className="w-5 h-5 text-gray-400" />;
    return <AlertCircle className="w-5 h-5 text-gray-300" />;
  };

  const getStatusBadge = (service: ServiceInfo) => {
    let statusText: string;
    if (service.status === 'running') {
      statusText = service.health === 'unhealthy' ? 'unhealthy' : 'up';
    } else if (service.status === 'stopped') {
      statusText = 'stopped';
    } else if (service.status === 'starting') {
      statusText = 'starting';
    } else if (service.status === 'error') {
      statusText = 'error';
    } else {
      statusText = 'unknown';
    }
    
    const colors: Record<string, string> = {
      up: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      running: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      healthy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      stopped: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      starting: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      unhealthy: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      unknown: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    };

    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[statusText] || colors.unknown}`}>
        {statusText === 'up' ? '✓ up' : statusText}
      </span>
    );
  };

  const healthyCount = services.filter(s => 
    s.status === 'running' && (s.health === 'healthy' || s.health === 'unknown')
  ).length;
  const totalCount = services.length;

  const hasApps = devModeData?.apps && Object.keys(devModeData.apps).length > 0;
  const devAppCount = hasApps ? Object.values(devModeData!.apps).filter(a => a.mode === 'dev').length : 0;
  const totalAppCount = hasApps ? Object.keys(devModeData!.apps).length : 0;

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      {/* Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">System Health</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor and manage infrastructure services</p>
            </div>
            
            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
              healthyCount === totalCount && totalCount > 0
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : healthyCount > 0 
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
              <Activity className={`w-5 h-5 ${
                healthyCount === totalCount && totalCount > 0
                  ? 'text-green-600 dark:text-green-400' 
                  : healthyCount > 0 
                    ? 'text-yellow-600 dark:text-yellow-400' 
                    : 'text-red-600 dark:text-red-400'
              }`} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {healthyCount}/{totalCount} Healthy
                  </p>
                  {BUSIBOX_ENV && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded ${
                      BUSIBOX_ENV === 'production'
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                        : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'
                    }`}>
                      {BUSIBOX_ENV}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {apiError ? apiError : 'Click refresh to update'}
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="ml-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Refresh now"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Mode Banner */}
      {isRedeploying && (
        <div className="bg-amber-500 dark:bg-amber-600">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 p-2 bg-amber-600 dark:bg-amber-700 rounded-lg">
                <Wrench className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white">Maintenance Mode</h3>
                <p className="text-sm text-amber-100">
                  Redeploying all core apps — clearing caches, reinstalling dependencies, and rebuilding.
                  This may take several minutes. Apps will be unavailable until complete.
                </p>
              </div>
              <RefreshCw className="w-5 h-5 text-white animate-spin flex-shrink-0" />
            </div>
            {redeployError && (
              <p className="mt-2 text-sm text-red-100 bg-red-600/30 rounded px-3 py-1">{redeployError}</p>
            )}
          </div>
        </div>
      )}

      {/* Developer Mode Panel — per-app controls (hidden in production/staging) */}
      {!IS_DEPLOYED && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              {/* Panel Header */}
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${devAppCount > 0 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {devAppCount > 0
                      ? <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      : <Code2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    }
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Developer Mode</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isRedeploying ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          Redeploying — clearing caches, reinstalling deps, rebuilding all apps...
                        </span>
                      ) : appActionInProgress !== null ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {appActionInProgress === '__all__'
                            ? 'Switching all apps — this may take a few minutes...'
                            : `Switching ${APP_DISPLAY_NAMES[appActionInProgress] || appActionInProgress}...`}
                        </span>
                      ) :
                       devModeLoading ? 'Loading...' :
                       hasApps ? `${devAppCount}/${totalAppCount} apps in hot-reload mode` :
                       devModeData?.fallback ? 'App manager status unavailable' :
                       'Not connected'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasApps && (appActionInProgress === '__all__' || isRedeploying) ? (
                    <span className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {isRedeploying ? 'Redeploying all apps...' : 'Building & switching apps...'}
                    </span>
                  ) : hasApps && (
                    <>
                      <button
                        onClick={() => handleSetAllMode('dev')}
                        disabled={appActionInProgress !== null || isRedeploying}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 transition-colors"
                      >
                        All Dev
                      </button>
                      <button
                        onClick={() => handleSetAllMode('prod')}
                        disabled={appActionInProgress !== null || isRedeploying}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                      >
                        All Prod
                      </button>
                      <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />
                      <button
                        onClick={handleRedeploy}
                        disabled={appActionInProgress !== null || isRedeploying}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                        title="Clean caches, reinstall deps, rebuild all apps"
                      >
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          Redeploy
                        </span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={fetchDevMode}
                    disabled={devModeLoading}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${devModeLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Per-app rows */}
              {hasApps ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {Object.entries(devModeData!.apps).map(([appName, app]) => {
                    const isThisAppBusy = appActionInProgress === appName || appActionInProgress === '__all__' || isRedeploying;
                    const isDev = app.mode === 'dev';
                    const displayName = APP_DISPLAY_NAMES[appName] || appName;

                    return (
                      <div key={appName} className="px-4 py-3 flex items-center gap-4">
                        {/* Health indicator */}
                        <div className="flex-shrink-0">
                          {isThisAppBusy ? (
                            <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />
                          ) : app.running && app.healthy ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : app.running ? (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                          )}
                        </div>

                        {/* App info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</span>
                            <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded ${
                              isDev
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}>
                              {app.mode}
                            </span>
                            {app.running && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                                :{app.port}
                              </span>
                            )}
                            {app.restarts > 0 && (
                              <span className="text-[10px] text-orange-500 dark:text-orange-400">
                                {app.restarts} restart{app.restarts > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          {/* Mode toggle */}
                          <button
                            onClick={() => handleToggleAppMode(appName, isDev ? 'prod' : 'dev')}
                            disabled={isThisAppBusy}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                              isThisAppBusy
                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                : isDev
                                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                            }`}
                            title={isDev ? 'Switch to prod (build + standalone)' : 'Switch to dev (Turbopack hot-reload)'}
                          >
                            {isThisAppBusy ? (
                              <><RefreshCw className="w-3 h-3 animate-spin" /> {appActionInProgress === '__all__' ? 'Switching...' : 'Building...'}</>
                            ) : isDev ? (
                              <><Hammer className="w-3 h-3" /> Prod</>
                            ) : (
                              <><Zap className="w-3 h-3" /> Dev</>
                            )}
                          </button>

                          {/* Restart */}
                          <button
                            onClick={() => handleRestartApp(appName)}
                            disabled={isThisAppBusy}
                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                            title="Restart app"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : devModeData?.fallback ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  <p>{devModeData.description}</p>
                  <p className="mt-1 text-xs">The app-manager control API is not responding. Apps are running but per-app toggling is unavailable.</p>
                </div>
              ) : devModeLoading ? (
                <div className="px-4 py-6 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  Could not connect to app-manager. Make sure core-apps is running.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Service Groups */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto" style={{ color: customization.primaryColor }} />
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading service status...</p>
            </div>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Services Found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {apiError || 'Unable to connect to deploy-api. Make sure Busibox services are running.'}
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 text-white rounded-lg transition-colors"
              style={{ backgroundColor: customization.primaryColor }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {tiers.map((tier, tierIndex) => {
              const tierServices = byTier[tier.id as keyof ServicesByTier] || [];
              if (tierServices.length === 0) return null;
              
              const isExpanded = expandedGroups.has(tier.id);
              const tierHealthyCount = tierServices.filter(s => 
                s.status === 'running' && (s.health === 'healthy' || s.health === 'unknown')
              ).length;
              const tierTotal = tierServices.length;
              const allHealthy = tierHealthyCount === tierTotal;
              const anyRunning = tierHealthyCount > 0;

              return (
                <div
                  key={tier.id}
                  className={`border rounded-xl overflow-hidden bg-white dark:bg-gray-800 transition-all ${
                    allHealthy ? 'border-green-200 dark:border-green-800' : anyRunning ? 'border-yellow-200 dark:border-yellow-800' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Tier Header */}
                  <button
                    onClick={() => toggleGroup(tier.id)}
                    className="w-full p-4 flex items-start gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="text-sm font-mono pt-1 min-w-[2rem]" style={{ color: customization.primaryColor }}>
                      {String(tierIndex + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 text-left">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{tier.label}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${
                        allHealthy ? 'text-green-600 dark:text-green-400' : anyRunning ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {tierHealthyCount}/{tierTotal} running
                      </span>
                      {allHealthy ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : anyRunning ? (
                        <AlertCircle className="w-6 h-6 text-yellow-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Services */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
                        <button
                          onClick={() => handleStartAll(tier.id)}
                          className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Start All
                        </button>
                      </div>

                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {tierServices.map(service => {
                          const isActionPending = actionInProgress === service.id;

                          return (
                            <div key={service.id} className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="pt-0.5">
                                  {getServiceIcon(service)}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <h4 className="font-medium text-gray-900 dark:text-white">{service.name}</h4>
                                    {getStatusBadge(service)}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {service.description}
                                    {service.consolidatedFrom && service.consolidatedFrom.length > 0 && (
                                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                                        (includes {service.consolidatedFrom.join(', ')})
                                      </span>
                                    )}
                                  </p>
                                  {service.rawStatus && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                                      {service.rawStatus}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {service.status === 'stopped' || service.status === 'unknown' ? (
                                    <button
                                      onClick={() => handleServiceAction(service.id, 'start')}
                                      disabled={isActionPending}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                      title="Start"
                                    >
                                      {isActionPending ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Play className="w-4 h-4" />
                                      )}
                                      Start
                                    </button>
                                  ) : service.status === 'running' ? (
                                    <>
                                      <button
                                        onClick={() => handleServiceAction(service.id, 'restart')}
                                        disabled={isActionPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 disabled:opacity-50 transition-colors"
                                        title="Restart"
                                      >
                                        {isActionPending ? (
                                          <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <RotateCcw className="w-4 h-4" />
                                        )}
                                        Restart
                                      </button>
                                      <button
                                        onClick={() => handleServiceAction(service.id, 'stop')}
                                        disabled={isActionPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                                        title="Stop"
                                      >
                                        <Square className="w-4 h-4" />
                                        Stop
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
