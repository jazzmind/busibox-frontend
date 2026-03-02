'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface GpuInfo {
  index: number;
  name: string;
  memory_total_mb: number;
  memory_used_mb: number;
}

interface Assignment {
  model_key: string;
  model_name: string;
  assigned: boolean;
  gpu?: string;
  port?: number;
  tensor_parallel?: number;
}

export function GpuAllocation() {
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [modelKey, setModelKey] = useState('');
  const [gpuIdsInput, setGpuIdsInput] = useState('0');
  const [port, setPort] = useState<number | ''>('');
  const [tp, setTp] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gpuRes, assignRes] = await Promise.all([
        fetch('/api/vllm/gpus'),
        fetch('/api/vllm/assignments'),
      ]);
      if (!gpuRes.ok) throw new Error(await gpuRes.text());
      if (!assignRes.ok) throw new Error(await assignRes.text());
      const gpuData = await gpuRes.json();
      const assignData = await assignRes.json();
      setGpus(gpuData.data?.gpus ?? gpuData.gpus ?? []);
      setAssignments(assignData.data?.assignments ?? assignData.assignments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load GPU allocation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const post = async (url: string, body?: unknown, method: 'POST' | 'DELETE' = 'POST') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const submitManualAssign = async () => {
    if (!modelKey.trim()) return;
    const gpu_ids = gpuIdsInput
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => !Number.isNaN(x));
    await post('/api/vllm/assignments', {
      model_key: modelKey.trim(),
      gpu_ids,
      port: port === '' ? null : Number(port),
      tensor_parallel: tp === '' ? null : Number(tp),
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">GPU Allocation</h3>
          <p className="text-sm text-gray-500">Assign vLLM models to GPU/port routing</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {gpus.map((g) => (
          <div key={g.index} className="border border-gray-200 rounded p-3">
            <p className="text-sm font-medium text-gray-900">GPU {g.index}</p>
            <p className="text-xs text-gray-500">{g.name}</p>
            <p className="text-xs text-gray-500 mt-1">
              {(g.memory_used_mb / 1024).toFixed(1)}GB / {(g.memory_total_mb / 1024).toFixed(1)}GB
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => post('/api/vllm/assignments/auto')}
          disabled={busy}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Auto Assign
        </button>
        <button
          onClick={() => post('/api/vllm/apply')}
          disabled={busy}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Apply
        </button>
      </div>

      <div className="border border-gray-200 rounded p-3 mb-4">
        <p className="text-sm font-medium text-gray-900 mb-2">Manual Assignment</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            value={modelKey}
            onChange={(e) => setModelKey(e.target.value)}
            placeholder="model_key (e.g. qwen3-30b)"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            value={gpuIdsInput}
            onChange={(e) => setGpuIdsInput(e.target.value)}
            placeholder="GPU IDs (e.g. 2,3)"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            value={port}
            onChange={(e) => setPort(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Port (optional)"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
          <input
            value={tp}
            onChange={(e) => setTp(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="TP (optional)"
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={submitManualAssign}
          disabled={busy || !modelKey.trim()}
          className="mt-2 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Save Assignment
        </button>
      </div>

      <div className="space-y-2">
        {assignments.map((a) => (
          <div key={a.model_name} className="border border-gray-200 rounded p-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{a.model_key ?? a.model_name}</p>
              <p className="text-xs text-gray-500">
                {a.assigned ? `GPU ${a.gpu} :${a.port} (TP=${a.tensor_parallel ?? 1})` : 'Unassigned'}
              </p>
            </div>
            {a.model_key && (
              <button
                onClick={() => post(`/api/vllm/assignments/${encodeURIComponent(a.model_key!)}`, undefined, 'DELETE')}
                disabled={busy}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Unassign
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
