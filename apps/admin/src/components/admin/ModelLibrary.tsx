'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Download, Play } from 'lucide-react';

interface BrowseModel {
  model_key: string;
  model_name: string;
  provider: string;
  description?: string;
  cached: boolean;
}

interface ActiveModel {
  port: number;
  running: boolean;
  healthy: boolean;
  model: string | null;
}

interface ModelLibraryProps {
  backend?: string | null;
}

const VLLM_PORTS = [8000, 8001, 8002, 8003, 8004, 8005];
const MLX_PORTS = [8080, 18081];

export function ModelLibrary({ backend }: ModelLibraryProps) {
  const [models, setModels] = useState<BrowseModel[]>([]);
  const [active, setActive] = useState<ActiveModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portByModel, setPortByModel] = useState<Record<string, number>>({});

  const isMLX = backend === 'mlx';
  const providerFilter = isMLX ? 'mlx' : 'vllm';
  const ports = isMLX ? MLX_PORTS : VLLM_PORTS;
  const defaultPort = ports[0];

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [browseRes, activeRes] = await Promise.all([
        fetch('/api/models/browse'),
        fetch('/api/models/active'),
      ]);
      if (!browseRes.ok) throw new Error(await browseRes.text());
      const browseData = await browseRes.json();
      setModels(browseData.data?.models ?? browseData.models ?? []);
      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActive(activeData.data?.models ?? activeData.models ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load model library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredModels = useMemo(
    () => models.filter((m) => m.provider === providerFilter),
    [models, providerFilter]
  );

  const streamPost = async (url: string, body: unknown, tag: string) => {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Model Library</h3>
          <p className="text-sm text-gray-500">
            Browse cached and available {isMLX ? 'MLX' : 'vLLM'} models
          </p>
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

      <div className="space-y-2">
        {filteredModels.map((m) => (
          <div key={m.model_key} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.model_key}</p>
                <p className="text-xs text-gray-500 truncate">{m.model_name}</p>
                {m.description && <p className="text-xs text-gray-400 mt-1">{m.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded ${m.cached ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {m.cached ? 'Cached' : 'Not cached'}
                </span>
                <button
                  onClick={() => streamPost('/api/models/download', { model_name: m.model_name }, `download:${m.model_key}`)}
                  disabled={busy !== null}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                {!isMLX && (
                  <>
                    <select
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                      value={portByModel[m.model_key] ?? defaultPort}
                      onChange={(e) =>
                        setPortByModel((prev) => ({ ...prev, [m.model_key]: Number(e.target.value) }))
                      }
                    >
                      {ports.map((p) => (
                        <option key={p} value={p}>
                          :{p}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => streamPost('/api/models/load', { port: portByModel[m.model_key] ?? defaultPort }, `load:${m.model_key}`)}
                      disabled={busy !== null}
                      className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Load
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {active.length > 0 && (
        <div className="mt-4 text-xs text-gray-600">
          Active ports: {active.filter((a) => a.running).map((a) => `:${a.port}`).join(', ') || 'none'}
        </div>
      )}
    </div>
  );
}
