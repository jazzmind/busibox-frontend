'use client';

/**
 * ModelMemoryCard
 *
 * Compact dashboard card showing AI model memory usage.
 * - On MLX (local dev): shows per-process memory for MLX LLM and media servers
 * - On Proxmox/GPU: shows per-GPU VRAM utilization from nvidia-smi
 * Auto-detects which data is available and renders accordingly.
 */

import { useState, useEffect, useCallback } from 'react';
import { Cpu, RefreshCw, ExternalLink, Server, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useCustomization } from '@jazzmind/busibox-app';

// ── Types ──────────────────────────────────────────────────────────────────

interface MLXServer {
  name: string;
  port?: number;
  memory_mb?: number | null;
  running?: boolean;
  healthy?: boolean;
  model?: string | null;
  memory_estimate_mb?: number;
}

interface MLXMemoryData {
  servers?: Record<string, MLXServer>;
  llm_servers?: MLXServer[];
  total_mlx_memory_mb?: number;
  total_media_memory_mb?: number;
  total_llm_memory_mb?: number;
}

interface GPUInfo {
  index: number;
  name: string;
  vram_used_mb: number;
  vram_total_mb: number;
  utilization_pct: number;
  temp_c?: number;
  models?: string[];
}

interface GPUData {
  gpus: GPUInfo[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(mb: number | undefined): string {
  if (mb == null) return '–';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function MemBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const barColor = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : color;
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: barColor }}
      />
    </div>
  );
}

// ── MLX Panel ─────────────────────────────────────────────────────────────

function MLXPanel({ data, primaryColor }: { data: MLXMemoryData; primaryColor: string }) {
  const llmServers = data.llm_servers || [];
  const mediaServers = Object.values(data.servers || {});
  const totalMb = data.total_mlx_memory_mb || 0;

  // System memory is fetched separately; estimate a ceiling for the bar
  // Use 24 GB (24576 MB) as a reasonable M4 Pro baseline
  const SYSTEM_CAP = 24576;

  return (
    <div className="space-y-3">
      {/* Total bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Total MLX Memory</span>
          <span className="font-mono font-medium text-gray-700">{fmt(totalMb)}</span>
        </div>
        <MemBar used={totalMb} total={SYSTEM_CAP} color={primaryColor} />
      </div>

      {/* LLM servers */}
      {llmServers.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">LLM Servers</p>
          {llmServers.map((s) => (
            <div key={s.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${s.running && s.healthy ? 'bg-green-500' : s.running ? 'bg-yellow-500' : 'bg-gray-300'}`}
                />
                <span className="text-gray-700 capitalize">{s.name}</span>
                <span className="text-gray-400">:{s.port}</span>
              </div>
              <span className="font-mono text-gray-600">
                {s.running ? fmt(s.memory_mb ?? undefined) : 'stopped'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Media servers */}
      {mediaServers.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Media Servers</p>
          {mediaServers.map((s) => (
            <div key={s.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${s.running && s.healthy ? 'bg-green-500' : s.running ? 'bg-yellow-500' : 'bg-gray-300'}`}
                />
                <span className="text-gray-700 capitalize">{s.name}</span>
              </div>
              <span className="font-mono text-gray-600">
                {s.running ? fmt(s.memory_mb ?? undefined) : `~${fmt(s.memory_estimate_mb ?? undefined)} (idle)`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GPU Panel ─────────────────────────────────────────────────────────────

function GPUPanel({ data, primaryColor }: { data: GPUData; primaryColor: string }) {
  return (
    <div className="space-y-3">
      {data.gpus.map((gpu) => (
        <div key={gpu.index} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-700 font-medium">GPU {gpu.index} <span className="text-gray-400 font-normal">{gpu.name}</span></span>
            <span className="font-mono text-gray-600">
              {fmt(gpu.vram_used_mb)} / {fmt(gpu.vram_total_mb)}
            </span>
          </div>
          <MemBar used={gpu.vram_used_mb} total={gpu.vram_total_mb} color={primaryColor} />
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{gpu.utilization_pct}% util{gpu.temp_c != null ? ` · ${gpu.temp_c}°C` : ''}</span>
            {gpu.models && gpu.models.length > 0 && (
              <span className="truncate max-w-[140px]" title={gpu.models.join(', ')}>
                {gpu.models[0]}{gpu.models.length > 1 ? ` +${gpu.models.length - 1}` : ''}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ModelMemoryCard() {
  const { customization } = useCustomization();
  const [mlxData, setMlxData] = useState<MLXMemoryData | null>(null);
  const [gpuData, setGpuData] = useState<GPUData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [mlxRes, gpuRes] = await Promise.allSettled([
        fetch('/api/media/status'),
        fetch('/api/gpu/status'),
      ]);

      let gotSomething = false;

      if (mlxRes.status === 'fulfilled' && mlxRes.value.ok) {
        const body = await mlxRes.value.json();
        const payload = body.data ?? body;
        if (payload.available !== false) {
          setMlxData(payload);
          gotSomething = true;
        }
      }

      if (gpuRes.status === 'fulfilled' && gpuRes.value.ok) {
        const body = await gpuRes.value.json();
        if (body.gpus && body.gpus.length > 0) {
          setGpuData(body);
          gotSomething = true;
        }
      }

      if (gotSomething) {
        setError(null);
        setLastUpdated(new Date());
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const hasContent = mlxData || gpuData;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50">
            <Cpu className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Model Memory</h3>
            {lastUpdated && (
              <p className="text-xs text-gray-400">
                {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchData}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/settings?tab=ai-models&ai-section=status"
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title="View in Settings"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
          </Link>
        </div>
      </div>

      {/* Content */}
      {loading && !hasContent ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Loading model memory...</span>
        </div>
      ) : !hasContent ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>No GPU or MLX data available</span>
        </div>
      ) : (
        <div className="space-y-4">
          {gpuData && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Server className="w-3 h-3 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Proxmox GPUs</span>
              </div>
              <GPUPanel data={gpuData} primaryColor={customization.primaryColor} />
            </div>
          )}

          {mlxData && (
            <div>
              {gpuData && <div className="border-t border-gray-100 pt-3" />}
              <div className="flex items-center gap-1.5 mb-2">
                <Cpu className="w-3 h-3 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Local MLX</span>
              </div>
              <MLXPanel data={mlxData} primaryColor={customization.primaryColor} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
