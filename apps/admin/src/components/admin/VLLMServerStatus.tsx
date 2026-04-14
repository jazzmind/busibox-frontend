'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Cpu, Mic, Volume2, Circle, Power, AlertCircle, Server } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface VLLMModelInfo {
  port: number;
  service: string;
  running: boolean;
  healthy: boolean;
  model: string | null;
  gpu: string | null;
}

interface VLLMMediaInfo {
  name: string;
  service: string;
  label: string;
  port: number;
  running: boolean;
  healthy: boolean;
  memory_estimate_gb: number;
  error?: string;
}

interface VLLMGpuInfo {
  index: number;
  name: string;
  memory_total_mb: number;
  memory_used_mb: number;
  memory_free_mb: number;
  utilization_pct: number;
}

interface VLLMStatusData {
  available: boolean;
  ssh_reachable?: boolean;
  vllm_host?: string;
  models?: VLLMModelInfo[];
  media?: VLLMMediaInfo[];
  gpus?: VLLMGpuInfo[];
  message?: string;
  errors?: string[];
}

interface Props {
  primaryColor?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function MediaIcon({ name }: { name: string }) {
  if (name === 'transcribe') return <Mic className="w-4 h-4" />;
  if (name === 'voice') return <Volume2 className="w-4 h-4" />;
  return <Circle className="w-4 h-4" />;
}

function VramBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
        {formatMb(used)} / {formatMb(total)}
      </span>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function VLLMServerStatus({ primaryColor = '#6366f1' }: Props) {
  const [status, setStatus] = useState<VLLMStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/vllm/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data.data ?? data);
        setError(null);
      } else {
        setStatus({ available: false });
      }
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

  const handleMediaToggle = async (serverName: string) => {
    setToggling(serverName);
    try {
      const res = await fetch('/api/gpu-media/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: serverName, action: 'toggle' }),
      });
      if (res.ok) {
        await fetchStatus();
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading vLLM status...
      </div>
    );
  }

  if (!status?.available) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium">{status?.message || 'vLLM status not available'}</p>
            {status?.vllm_host && (
              <p className="text-xs text-amber-600 mt-1">Host: <span className="font-mono">{status.vllm_host}</span></p>
            )}
            {status?.ssh_reachable === false && status?.vllm_host && (
              <p className="text-xs text-amber-600 mt-1">SSH connection to the vLLM host failed. Check that SSH keys are configured and the host is reachable from the deploy-api container.</p>
            )}
            {!status?.vllm_host && (
              <p className="text-xs text-amber-600 mt-1">Set the <span className="font-mono">VLLM_HOST</span> environment variable in the deploy-api service to enable GPU server monitoring.</p>
            )}
          </div>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  const models = status.models ?? [];
  const media = status.media ?? [];
  const gpus = status.gpus ?? [];
  const runningModels = models.filter(m => m.running);

  return (
    <div className="space-y-5">
      {/* GPU VRAM Cards */}
      {gpus.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <Cpu className="w-3.5 h-3.5" />
            GPU VRAM ({gpus.length} GPU{gpus.length !== 1 ? 's' : ''})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {gpus.map(gpu => {
              const gpuModels = runningModels.filter(m =>
                m.gpu?.split(',').map(g => g.trim()).includes(String(gpu.index))
              );
              const gpuMedia = media.filter(m => m.running);
              return (
                <div key={gpu.index} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">GPU {gpu.index}</span>
                      <span className="text-xs text-gray-400">{gpu.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{gpu.utilization_pct.toFixed(0)}% util</span>
                  </div>
                  <VramBar used={gpu.memory_used_mb} total={gpu.memory_total_mb} />
                  {gpuModels.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {gpuModels.map(m => (
                        <div key={m.port} className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                          <span className="font-mono truncate" title={m.model ?? undefined}>
                            {m.model ? m.model.split('/').pop() : `vllm-${m.port}`}
                          </span>
                          <span className="text-gray-400 ml-auto">:{m.port}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Show on-demand media on GPU 0 */}
                  {gpu.index === 0 && gpuMedia.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {gpuMedia.map(m => (
                        <div key={m.name} className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                          <span className="truncate">{m.label}</span>
                          <span className="text-gray-400 ml-auto">:{m.port}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* vLLM Model Servers */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          <Server className="w-3.5 h-3.5" />
          vLLM Model Servers ({runningModels.length}/{models.length} running)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {models.map(m => (
            <div
              key={m.port}
              className={`rounded-lg border p-3 transition-colors ${
                m.running && m.healthy
                  ? 'bg-green-50 border-green-200'
                  : m.running
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      m.running && m.healthy ? 'bg-green-500' : m.running ? 'bg-yellow-500' : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-sm font-medium text-gray-900">{m.service}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  m.running && m.healthy
                    ? 'bg-green-100 text-green-700'
                    : m.running
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                }`}>
                  {m.running && m.healthy ? 'Healthy' : m.running ? 'Starting' : 'Stopped'}
                </span>
              </div>
              {m.model && (
                <p className="text-xs text-gray-600 font-mono truncate mt-1" title={m.model}>
                  {m.model}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                <span>Port {m.port}</span>
                {m.gpu && <span>GPU {m.gpu}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Media Models (On-Demand) */}
      {media.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <Mic className="w-3.5 h-3.5" />
            GPU Media Models (On-Demand, GPU 0)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {media.map(m => {
              const isToggling = toggling === m.name;
              return (
                <div
                  key={m.name}
                  className={`rounded-lg border p-3 transition-colors ${
                    m.running ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded ${m.running ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                        <MediaIcon name={m.name} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{m.label}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.running ? 'text-indigo-700' : 'text-gray-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${m.running ? 'bg-indigo-500' : 'bg-gray-400'}`} />
                            {m.running ? (m.healthy ? 'Running' : 'Starting') : 'Stopped'}
                          </span>
                          <span className="text-xs text-gray-400">Port {m.port}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleMediaToggle(m.name)}
                      disabled={isToggling}
                      title={m.running ? `Stop ${m.label}` : `Start ${m.label}`}
                      className={`flex-shrink-0 p-1.5 rounded-md transition-colors ${
                        m.running
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
                  <div className="mt-2 pt-2 border-t border-gray-200/60 text-xs text-gray-500">
                    <span>VRAM est. ~{m.memory_estimate_gb} GB</span>
                    <span className="mx-1.5 text-gray-300">|</span>
                    <span className="text-gray-400">{m.service}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-500">
          {status.vllm_host && (
            <span className="text-xs text-gray-400">Host: <span className="font-mono">{status.vllm_host}</span></span>
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

      {status.errors && status.errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
          <p className="text-xs font-medium text-amber-800 mb-1">Partial errors:</p>
          {status.errors.map((e, i) => (
            <p key={i} className="text-xs text-amber-700">{e}</p>
          ))}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
