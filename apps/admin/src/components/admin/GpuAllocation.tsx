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
  model_key?: string;
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
  const [editingKey, setEditingKey] = useState<string | null>(null);
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
      let resolved: Assignment[] = assignData.data?.assignments ?? assignData.assignments ?? [];

      // Fallback: if model_config.yml has no assignments, synthesise from running
      // vLLM processes detected via the status endpoint (same SSH-based detection
      // that powers the Status tab).
      if (resolved.length === 0) {
        try {
          const statusRes = await fetch('/api/vllm/status');
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const statusPayload = statusData.data ?? statusData;
            const runningModels: Array<{ model: string; port: number; gpu?: string; running: boolean }> =
              statusPayload.models ?? [];
            resolved = runningModels
              .filter((m) => m.running && m.model)
              .map((m) => ({
                model_name: m.model,
                model_key: undefined,
                assigned: true,
                gpu: m.gpu ?? '?',
                port: m.port,
                tensor_parallel: 1,
              }));
          }
        } catch {
          // status fetch failed — leave assignments empty, not an error
        }
      }
      setAssignments(resolved);
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

  const prefillEdit = (a: Assignment) => {
    setModelKey(a.model_key ?? '');
    setGpuIdsInput(a.gpu ?? '0');
    setPort(a.port ?? '');
    setTp(a.tensor_parallel ?? '');
    setEditingKey(a.model_key ?? null);
  };

  const cancelEdit = () => {
    setModelKey('');
    setGpuIdsInput('0');
    setPort('');
    setTp('');
    setEditingKey(null);
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
    cancelEdit();
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

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
          <p className="text-xs text-red-600 mt-1">
            Ensure <span className="font-mono">VLLM_HOST</span> is configured in deploy-api and SSH access to the vLLM container is working.
          </p>
        </div>
      )}

      {!error && !loading && gpus.length === 0 && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">No GPUs detected.</p>
          <p className="text-xs text-amber-600 mt-1">
            GPU detection requires SSH access from deploy-api to the vLLM host and <span className="font-mono">nvidia-smi</span> installed on the GPU server.
          </p>
        </div>
      )}

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

      <div className={`border rounded p-3 mb-4 ${editingKey ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
        <p className="text-sm font-medium text-gray-900 mb-2">
          {editingKey ? `Editing: ${editingKey}` : 'Manual Assignment'}
        </p>
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
            placeholder="GPU IDs (e.g. 0 or 1,2)"
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
        <div className="mt-2 flex gap-2">
          <button
            onClick={submitManualAssign}
            disabled={busy || !modelKey.trim()}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            {editingKey ? 'Update Assignment' : 'Save Assignment'}
          </button>
          {editingKey && (
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {assignments.map((a) => (
          <div
            key={a.model_name}
            className={`border rounded p-2 flex items-center justify-between ${
              editingKey === a.model_key ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{a.model_key ?? a.model_name}</p>
              {a.model_key && a.model_key !== a.model_name && (
                <p className="text-xs text-gray-400">{a.model_name}</p>
              )}
              <p className="text-xs text-gray-500">
                {a.assigned
                  ? `GPU ${a.gpu ?? '?'} :${a.port ?? '?'} (TP=${a.tensor_parallel ?? 1})`
                  : 'Unassigned'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {a.model_key && (
                <button
                  onClick={() => prefillEdit(a)}
                  disabled={busy}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                >
                  Edit
                </button>
              )}
              {a.model_key && (
                <button
                  onClick={() => post(`/api/vllm/assignments/${encodeURIComponent(a.model_key!)}`, undefined, 'DELETE')}
                  disabled={busy}
                  className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                >
                  Unassign
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
