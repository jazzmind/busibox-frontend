/**
 * AppList Component
 * 
 * Displays list of applications with filtering and drag-and-drop reordering.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { StatusBadge, AppIcon, useCustomization } from '@jazzmind/busibox-app';
import type { AppType } from '@/types';
import type { IconName } from '@jazzmind/busibox-app';
import { RefreshCw } from 'lucide-react';
import { hexToRgb, getContrastSafeColor } from '@jazzmind/busibox-app/lib/utils';

/**
 * Button style guide:
 * - Primary: solid background with primaryColor, white text
 * - Secondary: tinted background with color (15% opacity), contrast-safe text
 */

type AppListItem = {
  id: string;
  name: string;
  description: string | null;
  type: AppType;
  url: string | null;
  deployedPath: string | null;
  healthEndpoint: string | null;
  iconUrl: string | null;
  selectedIcon: IconName | null;
  displayOrder: number;
  isActive: boolean;
  permissionCount: number;
  createdAt: Date;
  lastDeploymentStatus: string | null;
  lastDeploymentEndedAt: Date | null;
  // Version tracking
  deployedVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  devMode: boolean;
};

type HealthStatus = {
  appId: string;
  status: 'healthy' | 'unhealthy' | 'no-url' | 'error';
  responseTime?: number;
  statusCode?: number;
  error?: string;
};

function SortableAppRow({ app, healthStatus, healthLoading, onEdit, primaryColor }: {
  app: AppListItem;
  healthStatus: Map<string, HealthStatus>;
  healthLoading: boolean;
  onEdit: (app: AppListItem) => void;
  primaryColor: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getHealthBadge = () => {
    // For EXTERNAL apps, check deployment status first
    if (app.type === 'EXTERNAL') {
      if (!app.lastDeploymentStatus || app.lastDeploymentStatus === 'failed') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            ○ Not Deployed
          </span>
        );
      }
      if (app.lastDeploymentStatus === 'pending' || app.lastDeploymentStatus === 'deploying' || 
          app.lastDeploymentStatus === 'initiating' || app.lastDeploymentStatus === 'provisioning_db' ||
          app.lastDeploymentStatus === 'configuring_nginx') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <span className="inline-block animate-spin">⟳</span> Deploying
          </span>
        );
      }
      // Only check health if deployment is completed
      if (app.lastDeploymentStatus !== 'completed') {
        return null;
      }
    }

    const health = healthStatus.get(app.id);
    
    if (healthLoading) {
      return (
        <span className="text-xs text-gray-400">
          <span className="inline-block animate-spin mr-1">⟳</span>
          Checking...
        </span>
      );
    }

    // For BUILT_IN apps that don't have health checks, show as built-in
    if (!health && app.type === 'BUILT_IN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓ Healthy
        </span>
      );
    }

    // For LIBRARY apps without health status, show default healthy (no separate process)
    if (!health && app.type === 'LIBRARY') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          ✓ Healthy
        </span>
      );
    }

    if (!health) return null;

    const badges: Record<HealthStatus['status'], React.ReactElement | null> = {
      'healthy': (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800" title={`${health.responseTime}ms`}>
          ✓ Healthy
        </span>
      ),
      'unhealthy': (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800" title={`Status: ${health.statusCode}`}>
          ⚠ Unhealthy
        </span>
      ),
      'error': (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800" title={health.error}>
          ✗ Error
        </span>
      ),
      'no-url': null,
    };

    return badges[health.status];
  };

  const getTypeVariant = (type: AppType): 'info' | 'success' | 'warning' => {
    if (type === 'EXTERNAL') return 'info';
    if (type === 'LIBRARY') return 'warning';
    return 'success';
  };

  const getTypeLabel = (type: AppType): string => {
    if (type === 'BUILT_IN') return 'Built-in';
    if (type === 'LIBRARY') return 'Library';
    return 'External';
  };

  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700 ${!app.isActive ? 'bg-gray-50/50 dark:bg-gray-900/50 opacity-75' : ''}`}
      onClick={() => onEdit(app)}
    >
      {/* Drag Handle */}
      <td className="px-4 py-4 w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>
      </td>

      {/* Application */}
      <td className="px-6 py-4">
        <div className="flex items-start gap-3">
          <AppIcon 
            iconName={app.selectedIcon} 
            iconUrl={app.iconUrl} 
            size="md" 
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-white">{app.name}</span>
              <StatusBadge status={getTypeLabel(app.type)} variant={getTypeVariant(app.type)} />
              {!app.isActive && (
                <StatusBadge status="Inactive" variant="danger" />
              )}
            </div>
            {app.description && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1" title={app.description}>
                {truncateText(app.description)}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* URL & Status */}
      <td className="px-6 py-4">
        <div className="space-y-1">
          <div className="text-sm text-gray-700 font-mono">
            {/* For EXTERNAL apps, show deployedPath if deployed, otherwise show GitHub URL in gray */}
            {app.type === 'EXTERNAL' ? (
              app.deployedPath && app.lastDeploymentStatus === 'completed' ? (
                <a
                  href={app.deployedPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: primaryColor }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {app.deployedPath}
                </a>
              ) : (
                <span className="text-gray-400" title={app.url || undefined}>
                  {app.url ? (
                    <>📦 {app.url.replace('https://github.com/', '')}</>
                  ) : (
                    '-'
                  )}
                </span>
              )
            ) : app.url ? (
              <a
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: primaryColor }}
                onClick={(e) => e.stopPropagation()}
              >
                {app.url.length > 40 ? `${app.url.substring(0, 40)}...` : app.url}
              </a>
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getHealthBadge()}
            {app.updateAvailable && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                ↑ Update
              </span>
            )}
            {app.devMode && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Dev
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Roles */}
      <td className="px-6 py-4 w-32">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {app.permissionCount} {app.permissionCount === 1 ? 'role' : 'roles'}
        </span>
      </td>

      {/* Created */}
      <td className="px-6 py-4 w-40">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {new Date(app.createdAt).toLocaleDateString()}
        </span>
      </td>
    </tr>
  );
}

export function AppList() {
  const router = useRouter();
  const { customization } = useCustomization();
  const [apps, setApps] = useState<AppListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showDisabled, setShowDisabled] = useState(() => {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('showDisabledApps') === 'true';
    }
    return false;
  });
  const [healthStatus, setHealthStatus] = useState<Map<string, HealthStatus>>(new Map());
  const [healthLoading, setHealthLoading] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Get colors with contrast adjustment for dark mode
  const secondaryColor = customization.secondaryColor || customization.primaryColor;
  const secondaryRgb = hexToRgb(secondaryColor) ?? { r: 59, g: 130, b: 246 };
  
  // Get contrast-safe version for text on tinted backgrounds
  const contrastSafeSecondary = getContrastSafeColor(
    secondaryColor, 
    isDark,
    '#374151', // gray-700 - approximate tinted dark background
    '#fff7ed', // very light tint for light mode
    4.5
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchApps();
    fetchHealthStatus();
  }, [typeFilter, showDisabled]);

  // Save showDisabled preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('showDisabledApps', showDisabled.toString());
    }
  }, [showDisabled]);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      if (showDisabled) params.append('includeDisabled', 'true');

      const response = await fetch(`/api/apps?${params}`);
      const data = await response.json();

      if (data.success) {
        // Sort by displayOrder
        const sortedApps = [...data.data.apps].sort((a, b) => a.displayOrder - b.displayOrder);
        // Filter out disabled apps if not showing them, but always include BUILT_IN apps
        const filteredApps = showDisabled 
          ? sortedApps 
          : sortedApps.filter(app => app.isActive || app.type === 'BUILT_IN');
        setApps(filteredApps);
      } else {
        setError(data.error || 'Failed to load apps');
      }
    } catch (err) {
      console.error('Failed to fetch apps:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthStatus = async () => {
    setHealthLoading(true);
    try {
      const response = await fetch('/api/apps/health');
      const data = await response.json();

      if (data.success) {
        const healthMap = new Map<string, HealthStatus>();
        data.data.checks.forEach((check: HealthStatus) => {
          healthMap.set(check.appId, check);
        });
        setHealthStatus(healthMap);
      }
    } catch (err) {
      console.error('Failed to fetch health status:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = apps.findIndex((app) => app.id === active.id);
    const newIndex = apps.findIndex((app) => app.id === over.id);

    const newApps = arrayMove(apps, oldIndex, newIndex);
    
    // Optimistically update UI
    setApps(newApps);

    // Update display orders on server
    setReordering(true);
    try {
      const updates = newApps.map((app, index) => ({
        id: app.id,
        displayOrder: index,
      }));

      const response = await fetch('/api/apps/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apps: updates }),
      });

      const data = await response.json();

      if (!data.success) {
        // Revert on error
        setApps(apps);
        setError(data.error || 'Failed to reorder apps');
      }
    } catch (err) {
      console.error('Failed to reorder apps:', err);
      // Revert on error
      setApps(apps);
      setError('An unexpected error occurred while reordering');
    } finally {
      setReordering(false);
    }
  };

  const handleRowClick = (app: AppListItem) => {
    router.push(`/apps/${app.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw 
          className="animate-spin h-12 w-12" 
          style={{ color: customization.primaryColor }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 items-end justify-between">
        <div className="flex gap-4 items-end">
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-2"
              style={{ 
                // @ts-ignore - CSS custom properties work at runtime
                '--tw-ring-color': customization.primaryColor,
              }}
            >
              <option value="">All types</option>
              <option value="BUILT_IN">Built-in</option>
              <option value="LIBRARY">Library</option>
              <option value="EXTERNAL">External</option>
            </select>
          </div>

          <label className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="h-4 w-4 border-gray-300 rounded"
              style={{ accentColor: customization.primaryColor }}
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Show disabled apps
            </span>
          </label>

          <button
            onClick={() => {
              setTypeFilter('');
              setShowDisabled(false);
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition-colors"
            style={{ 
              backgroundColor: `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.15)`,
              color: contrastSafeSecondary,
            }}
          >
            Clear Filter
          </button>
        </div>

        <button
          onClick={fetchHealthStatus}
          disabled={healthLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg hover:opacity-80 disabled:opacity-50 transition-colors"
          style={{ 
            backgroundColor: `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.15)`,
            color: contrastSafeSecondary,
          }}
        >
          <RefreshCw className={`w-4 h-4 ${healthLoading ? 'animate-spin' : ''}`} />
          Refresh Health
        </button>
      </div>

      {/* Info Message - using secondary color theme */}
      <div 
        className="rounded-lg p-3 border"
        style={{ 
          backgroundColor: `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.1)`,
          borderColor: `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.3)`,
        }}
      >
        <p className="text-sm" style={{ color: contrastSafeSecondary }}>
          💡 <strong>Tip:</strong> Drag and drop apps to reorder them. The order here determines how they appear on the dashboard.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button 
            onClick={fetchApps} 
            className="mt-2 px-4 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition-colors"
            style={{ 
              backgroundColor: `rgba(${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}, 0.15)`,
              color: contrastSafeSecondary,
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Table */}
      {apps.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No applications found</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={apps.map(app => app.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 w-8"></th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Application
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        URL & Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                        Roles
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-40">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800">
                    {apps.map((app) => (
                      <SortableAppRow
                        key={app.id}
                        app={app}
                        healthStatus={healthStatus}
                        healthLoading={healthLoading}
                        onEdit={handleRowClick}
                        primaryColor={customization.primaryColor}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {reordering && (
        <div 
          className="fixed bottom-4 right-4 text-white px-4 py-2 rounded-lg shadow-lg"
          style={{ backgroundColor: customization.primaryColor }}
        >
          Saving order...
        </div>
      )}
    </div>
  );
}
