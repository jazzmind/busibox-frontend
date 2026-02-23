'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ImageIcon, Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

type ServerStatus = 'stopped' | 'starting' | 'started' | 'processing' | 'finished' | 'stopping';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;

const STATUS_DISPLAY: Record<ServerStatus, { label: string; color: string; bg: string; animate?: boolean }> = {
  stopped:    { label: 'Stopped',       color: 'text-gray-500',   bg: 'bg-gray-100' },
  starting:   { label: 'Starting...',   color: 'text-amber-600',  bg: 'bg-amber-50',  animate: true },
  started:    { label: 'Ready',         color: 'text-green-600',  bg: 'bg-green-50' },
  processing: { label: 'Generating',    color: 'text-indigo-600', bg: 'bg-indigo-50',  animate: true },
  finished:   { label: 'Finished',      color: 'text-green-600',  bg: 'bg-green-50' },
  stopping:   { label: 'Stopping...',   color: 'text-amber-600',  bg: 'bg-amber-50',  animate: true },
};

const SIZE_OPTIONS = [
  { value: '256x256', label: '256 x 256' },
  { value: '512x512', label: '512 x 512' },
  { value: '1024x1024', label: '1024 x 1024' },
];

interface Props {
  primaryColor?: string;
  imageServerRunning?: boolean;
  onEnsureServer?: () => Promise<void>;
  onStatusChange?: () => void;
}

export function MediaPlaygroundImage({ primaryColor = '#6366f1', imageServerRunning, onStatusChange }: Props) {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('512x512');
  const [imageData, setImageData] = useState<{ url?: string; b64_json?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const [serverStatus, setServerStatus] = useState<ServerStatus>(
    imageServerRunning === false ? 'stopped' : imageServerRunning ? 'started' : 'stopped'
  );
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (imageServerRunning === true && (serverStatus === 'stopped' || serverStatus === 'stopping')) {
      setServerStatus('started');
    } else if (imageServerRunning === false && serverStatus === 'started') {
      setServerStatus('stopped');
    }
  }, [imageServerRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const startIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setServerStatus('stopping');
      try {
        await fetch('/api/media/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ server: 'image' }),
        });
      } catch { /* best effort */ }
      if (mountedRef.current) {
        setServerStatus('stopped');
        onStatusChange?.();
      }
    }, IDLE_TIMEOUT_MS);
  }, [onStatusChange]);

  const ensureServerRunning = useCallback(async (): Promise<boolean> => {
    if (serverStatus === 'started' || serverStatus === 'processing' || serverStatus === 'finished') {
      return true;
    }

    setServerStatus('starting');
    clearIdleTimer();

    try {
      await fetch('/api/media/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: 'image' }),
      });

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000));
        if (!mountedRef.current) return false;
        try {
          const statusResp = await fetch('/api/media/status');
          if (statusResp.ok) {
            const statusData = await statusResp.json();
            const server = statusData?.data?.servers?.image;
            if (server?.running && server?.healthy) {
              if (mountedRef.current) {
                setServerStatus('started');
                onStatusChange?.();
              }
              return true;
            }
          }
        } catch { /* keep polling */ }
      }

      if (mountedRef.current) setServerStatus('stopped');
      return false;
    } catch {
      if (mountedRef.current) setServerStatus('stopped');
      return false;
    }
  }, [serverStatus, onStatusChange]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setImageData(null);
    setElapsed(null);
    clearIdleTimer();

    const serverReady = await ensureServerRunning();
    if (!serverReady) {
      setError('Image server failed to start. Please try again.');
      setLoading(false);
      return;
    }

    setServerStatus('processing');
    const start = Date.now();

    try {
      const res = await fetch('/api/llm-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'image', prompt, size, n: 1 }),
      });

      setElapsed(Date.now() - start);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Image generation failed (${res.status})`);
        setServerStatus('started');
        return;
      }

      const data = await res.json();
      const imageObj = data.data?.data?.[0] ?? data.data ?? {};
      setImageData(imageObj);
      setServerStatus('finished');
      startIdleTimer();
    } catch (e: unknown) {
      setElapsed(Date.now() - start);
      setError(e instanceof Error ? e.message : 'Image generation failed');
      setServerStatus('started');
    } finally {
      setLoading(false);
    }
  }, [prompt, size, ensureServerRunning, startIdleTimer]);

  const imageSrc = imageData?.b64_json
    ? `data:image/png;base64,${imageData.b64_json}`
    : imageData?.url ?? null;

  const handleDownload = () => {
    if (!imageSrc) return;
    const a = document.createElement('a');
    a.href = imageSrc;
    a.download = `image-${Date.now()}.png`;
    a.click();
  };

  const sd = STATUS_DISPLAY[serverStatus];
  const isBusy = loading || serverStatus === 'starting' || serverStatus === 'stopping';

  return (
    <div className="space-y-4">
      {/* Server status indicator */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${sd.bg} ${sd.color}`}>
        <span className={`w-2 h-2 rounded-full ${
          serverStatus === 'stopped' || serverStatus === 'stopping' ? 'bg-gray-400' :
          serverStatus === 'starting' || serverStatus === 'processing' ? 'bg-amber-500 animate-pulse' :
          'bg-green-500'
        }`} />
        <span>Image: {sd.label}</span>
        {sd.animate && <RefreshCw className="w-3 h-3 animate-spin ml-1" />}
        {serverStatus === 'stopped' && (
          <span className="text-gray-400 font-normal ml-1">
            — ~4 GB, will auto-start when you generate
          </span>
        )}
        {serverStatus === 'finished' && (
          <span className="text-gray-400 font-normal ml-1">
            — will auto-stop after 2 min idle
          </span>
        )}
      </div>

      {/* Prompt input */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Prompt</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
        />
      </div>

      {/* Size selector + generate */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Size</label>
          <select
            value={size}
            onChange={e => setSize(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            {SIZE_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isBusy}
          className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
          style={{ backgroundColor: primaryColor }}
        >
          {isBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {serverStatus === 'starting' ? 'Starting server...' :
           serverStatus === 'processing' ? 'Generating...' :
           'Generate'}
        </button>
      </div>

      {loading && serverStatus === 'processing' && (
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Generating image — this may take 30-60s for Flux models...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Image result */}
      {imageSrc && !error && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <CheckCircle className="w-4 h-4" />
              Image generated
              {elapsed != null && <span className="text-xs text-gray-400 font-normal">({(elapsed / 1000).toFixed(1)}s)</span>}
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-300 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={prompt}
            className="rounded-lg border border-gray-200 max-w-full"
            style={{ maxHeight: '512px', objectFit: 'contain' }}
          />

          <div className="text-xs text-gray-400 italic truncate" title={prompt}>
            &ldquo;{prompt}&rdquo;
          </div>
        </div>
      )}
    </div>
  );
}
