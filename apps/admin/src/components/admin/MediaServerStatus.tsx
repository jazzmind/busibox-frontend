'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Mic, Volume2, Image, Circle, Power, MemoryStick, AlertCircle, Server } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface MediaServerInfo {
  name: string;
  label: string;
  kind: 'always-on' | 'on-demand';
  port: number;
  running: boolean;
  healthy: boolean;
  pid: number | null;
  model: string | null;
  memory_mb: number | null;
  memory_estimate_mb: number;
}

interface LLMServerMemory {
  name: string;
  port: number;
  memory_mb: number | null;
}

interface MediaStatusData {
  available: boolean;
  message?: string;
  servers?: Record<string, MediaServerInfo>;
  llm_servers?: LLMServerMemory[];
  total_media_memory_mb?: number;
  total_llm_memory_mb?: number;
  total_mlx_memory_mb?: number;
}

interface GPUMediaServerInfo {
  name: string;
  service: string;
  label: string;
  port: number;
  running: boolean;
  healthy: boolean;
  memory_estimate_gb: number;
  error?: string;
}

interface GPUMediaStatusData {
  available: boolean;
  servers?: Record<string, GPUMediaServerInfo>;
  message?: string;
}

interface SystemMemoryData {
  system?: {
    total_mb: number | null;
    available_mb: number | null;
    used_mb: number | null;
  };
  mlx?: {
    total_mlx_memory_mb: number;
  };
}

interface Props {
  primaryColor?: string;
  onStatusChange?: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function formatMb(mb: number | null | undefined): string {
  if (mb == null) return '—';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function ServerIcon({ name }: { name: string }) {
  if (name === 'transcribe') return <Mic className="w-4 h-4" />;
  if (name === 'voice') return <Volume2 className="w-4 h-4" />;
  if (name === 'image') return <Image className="w-4 h-4" />;
  return <Circle className="w-4 h-4" />;
}

// =============================================================================
// Component
// =============================================================================

export function MediaServerStatus({ primaryColor = '#6366f1', onStatusChange }: Props) {
  const [status, setStatus] = useState<MediaStatusData | null>(null);
  const [gpuMediaStatus, setGpuMediaStatus] = useState<GPUMediaStatusData | null>(null);
  const [sysMemory, setSysMemory] = useState<SystemMemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [togglingGpu, setTogglingGpu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [mlxRes, gpuRes] = await Promise.allSettled([
        fetch('/api/media/status'),
        fetch('/api/gpu-media/status'),
      ]);

      if (mlxRes.status === 'fulfilled' && mlxRes.value.ok) {
        const data = await mlxRes.value.json();
        setStatus(data.data ?? data);
      }

      if (gpuRes.status === 'fulfilled' && gpuRes.value.ok) {
        const data = await gpuRes.value.json();
        setGpuMediaStatus(data.data ?? data);
      }

      setError(null);
    } catch {
      setError('Unable to reach server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleToggle = async (serverName: string) => {
    setToggling(serverName);
    try {
      const res = await fetch('/api/media/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: serverName }),
      });
      if (res.ok) {
        await fetchStatus();
        onStatusChange?.();
      } else {
        const data = await res.json();
        alert(`Toggle failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Network error toggling server');
    } finally {
      setToggling(null);
    }
  };

  const handleGpuToggle = async (serverName: string) => {
    setTogglingGpu(serverName);
    try {
      const res = await fetch('/api/gpu-media/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: serverName, action: 'toggle' }),
      });
      if (res.ok) {
        await fetchStatus();
        onStatusChange?.();
      } else {
        const data = await res.json();
        alert(`GPU toggle failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Network error toggling GPU server');
    } finally {
      setTogglingGpu(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading media server status...
      </div>
    );
  }

  if (!status?.available) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-500">
        <AlertCircle className="w-4 h-4 text-gray-400" />
        {status?.message || 'Media server status not available (MLX backend only)'}
      </div>
    );
  }

  const servers = status.servers ? Object.values(status.servers) : [];
  const totalMlxMb = status.total_mlx_memory_mb ?? 0;

  return (
    <div className="space-y-4">
      {/* Server cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {servers.map(server => {
          const isToggling = toggling === server.name;
          const canToggle = server.kind === 'on-demand';
          const memDisplay = server.running && server.memory_mb != null
            ? formatMb(server.memory_mb)
            : `~${formatMb(server.memory_estimate_mb)} est.`;

          return (
            <div
              key={server.name}
              className={`rounded-lg border p-3 transition-colors ${
                server.running ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`p-1.5 rounded ${server.running ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    <ServerIcon name={server.name} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{server.label}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        server.running ? 'text-green-700' : 'text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${server.running ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {server.running ? (server.healthy ? 'Running' : 'Starting') : 'Stopped'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {server.kind === 'always-on' ? '(always-on)' : '(on-demand)'}
                      </span>
                    </div>
                  </div>
                </div>

                {canToggle && (
                  <button
                    onClick={() => handleToggle(server.name)}
                    disabled={isToggling}
                    title={server.running ? `Stop ${server.label}` : `Start ${server.label}`}
                    className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${
                      server.running
                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    } disabled:opacity-50`}
                  >
                    {isToggling
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Power className="w-3.5 h-3.5" />
                    }
                  </button>
                )}
              </div>

              <div className="mt-2 pt-2 border-t border-gray-200/60 space-y-0.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" /> Memory</span>
                  <span className={server.running && server.memory_mb ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                    {memDisplay}
                  </span>
                </div>
                {server.model && (
                  <div className="text-xs text-gray-400 truncate" title={server.model}>
                    {server.model.split('/').pop()}
                  </div>
                )}
                <div className="text-xs text-gray-400">Port {server.port}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* LLM servers memory summary */}
      {status.llm_servers && status.llm_servers.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {status.llm_servers.map(s => (
            <span key={s.name} className="flex items-center gap-1">
              <span className="font-medium text-gray-700">LLM {s.name}</span>
              ({s.port}): {formatMb(s.memory_mb)}
            </span>
          ))}
        </div>
      )}

      {/* Total memory footer */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-gray-600">
          <MemoryStick className="w-4 h-4" />
          <span>Total MLX memory: <strong>{formatMb(totalMlxMb)}</strong></span>
          {status.total_llm_memory_mb != null && status.total_media_memory_mb != null && (
            <span className="text-gray-400 text-xs">
              (LLM {formatMb(status.total_llm_memory_mb)} + Media {formatMb(status.total_media_memory_mb)})
            </span>
          )}
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}

      {/* GPU Media Servers (Proxmox) */}
      {gpuMediaStatus?.available && gpuMediaStatus.servers && Object.keys(gpuMediaStatus.servers).length > 0 && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
            <Server className="w-3.5 h-3.5" />
            Proxmox GPU Media (On-Demand)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(gpuMediaStatus.servers).map(server => {
              const isToggling = togglingGpu === server.name;
              return (
                <div
                  key={server.name}
                  className={`rounded-lg border p-3 transition-colors ${
                    server.running ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded ${server.running ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                        <ServerIcon name={server.name} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{server.label}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${server.running ? 'text-indigo-700' : 'text-gray-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${server.running ? 'bg-indigo-500' : 'bg-gray-400'}`} />
                            {server.running ? (server.healthy ? 'Running' : 'Starting') : 'Stopped'}
                          </span>
                          <span className="text-xs text-gray-400">GPU · Port {server.port}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleGpuToggle(server.name)}
                      disabled={isToggling}
                      title={server.running ? `Stop ${server.label}` : `Start ${server.label}`}
                      className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${
                        server.running
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      } disabled:opacity-50`}
                    >
                      {isToggling
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Power className="w-3.5 h-3.5" />
                      }
                    </button>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200/60 space-y-0.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" /> VRAM est.</span>
                      <span className="text-gray-600 font-medium">~{server.memory_estimate_gb} GB</span>
                    </div>
                    <div className="text-xs text-gray-400">{server.service}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
