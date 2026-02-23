'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Upload, RefreshCw, CheckCircle, AlertCircle, FileAudio, MicOff, Radio, Wifi, WifiOff } from 'lucide-react';

type ServerStatus = 'stopped' | 'starting' | 'started' | 'processing' | 'finished' | 'stopping';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const RECORD_SAMPLE_RATE = 16000;

const STATUS_DISPLAY: Record<ServerStatus, { label: string; color: string; bg: string; animate?: boolean }> = {
  stopped:    { label: 'Stopped',       color: 'text-gray-500',   bg: 'bg-gray-100' },
  starting:   { label: 'Starting...',   color: 'text-amber-600',  bg: 'bg-amber-50',  animate: true },
  started:    { label: 'Ready',         color: 'text-green-600',  bg: 'bg-green-50' },
  processing: { label: 'Transcribing',  color: 'text-indigo-600', bg: 'bg-indigo-50',  animate: true },
  finished:   { label: 'Finished',      color: 'text-green-600',  bg: 'bg-green-50' },
  stopping:   { label: 'Stopping...',   color: 'text-amber-600',  bg: 'bg-amber-50',  animate: true },
};

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const len = Math.round(buffer.length / ratio);
  const result = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, buffer.length - 1);
    const frac = srcIdx - lo;
    result[i] = buffer[lo] * (1 - frac) + buffer[hi] * frac;
  }
  return result;
}

interface RecordingHandle {
  stream: MediaStream;
  audioCtx: AudioContext;
  scriptNode: ScriptProcessorNode;
  chunks: Float32Array[];
}

type LiveWsState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface LiveHandle {
  stream: MediaStream;
  audioCtx: AudioContext;
  scriptNode: ScriptProcessorNode;
  ws: WebSocket;
}

function float32ToInt16Base64(samples: Float32Array): string {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface Props {
  primaryColor?: string;
  transcribeServerRunning?: boolean;
  onEnsureServer?: () => Promise<void>;
  onStatusChange?: () => void;
}

export function MediaPlaygroundSTT({ primaryColor = '#6366f1', transcribeServerRunning, onEnsureServer, onStatusChange }: Props) {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [language, setLanguage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingRef = useRef<RecordingHandle | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isLive, setIsLive] = useState(false);
  const [liveWsState, setLiveWsState] = useState<LiveWsState>('disconnected');
  const [livePartial, setLivePartial] = useState('');
  const [liveFinals, setLiveFinals] = useState<string[]>([]);
  const [liveTime, setLiveTime] = useState(0);
  const liveRef = useRef<LiveHandle | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [serverStatus, setServerStatus] = useState<ServerStatus>(
    transcribeServerRunning === false ? 'stopped' : transcribeServerRunning ? 'started' : 'stopped'
  );
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (transcribeServerRunning === true && (serverStatus === 'stopped' || serverStatus === 'stopping')) {
      setServerStatus('started');
    } else if (transcribeServerRunning === false && serverStatus === 'started') {
      setServerStatus('stopped');
    }
  }, [transcribeServerRunning]); // eslint-disable-line react-hooks/exhaustive-deps

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
          body: JSON.stringify({ server: 'transcribe' }),
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
        body: JSON.stringify({ server: 'transcribe' }),
      });

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000));
        if (!mountedRef.current) return false;
        try {
          const statusResp = await fetch('/api/media/status');
          if (statusResp.ok) {
            const statusData = await statusResp.json();
            const server = statusData?.data?.servers?.transcribe;
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

  const languageRef = useRef(language);
  languageRef.current = language;

  const transcribeFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setTranscript(null);
    setElapsed(null);
    clearIdleTimer();

    const serverReady = await ensureServerRunning();
    if (!serverReady) {
      setError('Transcribe server failed to start. Please try again.');
      setLoading(false);
      return;
    }

    setServerStatus('processing');
    const start = Date.now();

    try {
      const formData = new FormData();
      formData.append('file', file, file.name || 'recording.wav');
      formData.append('model', 'transcribe');
      if (languageRef.current) formData.append('language', languageRef.current);

      const res = await fetch('/api/llm-transcribe', {
        method: 'POST',
        body: formData,
      });

      setElapsed(Date.now() - start);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Transcription failed (${res.status})`);
        setServerStatus('started');
        return;
      }

      const data = await res.json();
      setTranscript(data.data?.text ?? data.text ?? JSON.stringify(data.data));
      setServerStatus('finished');
      startIdleTimer();
    } catch (e: unknown) {
      setElapsed(Date.now() - start);
      setError(e instanceof Error ? e.message : 'Transcription failed');
      setServerStatus('started');
    } finally {
      setLoading(false);
    }
  }, [ensureServerRunning, startIdleTimer]);

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setTranscript(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
      handleFileChange(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: { ideal: RECORD_SAMPLE_RATE } },
      });

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      // 4096-sample buffer, mono in, mono out
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];

      scriptNode.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(input));
      };

      source.connect(scriptNode);
      scriptNode.connect(audioCtx.destination);

      recordingRef.current = { stream, audioCtx, scriptNode, chunks };
      setIsRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      setError('Microphone access denied or unavailable');
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);

    const handle = recordingRef.current;
    if (!handle) { setIsRecording(false); return; }

    handle.scriptNode.disconnect();
    handle.stream.getTracks().forEach(t => t.stop());
    const nativeSampleRate = handle.audioCtx.sampleRate;

    const totalLen = handle.chunks.reduce((a, c) => a + c.length, 0);
    const merged = new Float32Array(totalLen);
    let pos = 0;
    for (const chunk of handle.chunks) {
      merged.set(chunk, pos);
      pos += chunk.length;
    }

    const pcm = downsample(merged, nativeSampleRate, RECORD_SAMPLE_RATE);
    const wavBuf = encodeWav(pcm, RECORD_SAMPLE_RATE);
    const wavFile = new File([wavBuf], 'recording.wav', { type: 'audio/wav' });

    void handle.audioCtx.close();
    recordingRef.current = null;
    setIsRecording(false);
    setSelectedFile(wavFile);
    transcribeFile(wavFile);
  };

  const startLiveTranscribe = async () => {
    setError(null);
    setLivePartial('');
    setLiveFinals([]);
    setLiveTime(0);
    setLiveWsState('connecting');

    let token: string;
    try {
      const tokenResp = await fetch('/api/services/transcribe-token', { method: 'POST' });
      if (!tokenResp.ok) throw new Error('Failed to get transcription token');
      const tokenData = await tokenResp.json();
      token = tokenData.data?.token || tokenData.token;
      if (!token) throw new Error('No token in response');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Token exchange failed');
      setLiveWsState('error');
      return;
    }

    const serverReady = await ensureServerRunning();
    if (!serverReady) {
      setError('Transcribe server failed to start');
      setLiveWsState('error');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: { ideal: RECORD_SAMPLE_RATE } },
      });
    } catch {
      setError('Microphone access denied or unavailable');
      setLiveWsState('error');
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/api/agent/llm/transcribe/stream?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setLiveWsState('connected');
      setIsLive(true);
      ws.send(JSON.stringify({
        type: 'session.update',
        model: 'transcribe',
        language: languageRef.current || 'en',
      }));
    };

    ws.onmessage = (evt) => {
      try {
        const event = JSON.parse(evt.data);
        if (event.type === 'transcription.delta') {
          setLivePartial(event.delta || '');
        } else if (event.type === 'transcription.done') {
          const text = event.text || '';
          if (text.trim()) {
            setLiveFinals(prev => [...prev, text]);
          }
          setLivePartial('');
        } else if (event.type === 'error') {
          setError(event.message || 'Transcription error');
        }
      } catch { /* ignore non-JSON */ }
    };

    ws.onerror = () => {
      setLiveWsState('error');
      setError('WebSocket connection error');
    };

    ws.onclose = () => {
      setLiveWsState('disconnected');
      setIsLive(false);
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);

    scriptNode.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const pcm = downsample(new Float32Array(input), audioCtx.sampleRate, RECORD_SAMPLE_RATE);
      const b64 = float32ToInt16Base64(pcm);
      ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: b64,
      }));
    };

    source.connect(scriptNode);
    scriptNode.connect(audioCtx.destination);

    liveRef.current = { stream, audioCtx, scriptNode, ws };
    liveTimerRef.current = setInterval(() => setLiveTime(t => t + 1), 1000);
  };

  const stopLiveTranscribe = () => {
    const handle = liveRef.current;
    if (!handle) return;

    try {
      if (handle.ws.readyState === WebSocket.OPEN) {
        handle.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      }
    } catch { /* best effort */ }

    handle.scriptNode.disconnect();
    handle.stream.getTracks().forEach(t => t.stop());
    void handle.audioCtx.close();

    setTimeout(() => {
      try { handle.ws.close(); } catch { /* ok */ }
    }, 500);

    liveRef.current = null;
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    setIsLive(false);
    setLiveWsState('disconnected');
    startIdleTimer();
  };

  const formatRecordTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  useEffect(() => {
    return () => {
      if (liveRef.current) {
        liveRef.current.scriptNode.disconnect();
        liveRef.current.stream.getTracks().forEach(t => t.stop());
        void liveRef.current.audioCtx.close();
        try { liveRef.current.ws.close(); } catch { /* ok */ }
        liveRef.current = null;
      }
      if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    };
  }, []);

  const sd = STATUS_DISPLAY[serverStatus];
  const isBusy = loading || serverStatus === 'starting' || serverStatus === 'stopping' || liveWsState === 'connecting';

  return (
    <div className="space-y-4">
      {/* Server status indicator */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${sd.bg} ${sd.color}`}>
        <span className={`w-2 h-2 rounded-full ${
          serverStatus === 'stopped' || serverStatus === 'stopping' ? 'bg-gray-400' :
          serverStatus === 'starting' || serverStatus === 'processing' ? 'bg-amber-500 animate-pulse' :
          'bg-green-500'
        }`} />
        <span>Transcribe: {sd.label}</span>
        {sd.animate && <RefreshCw className="w-3 h-3 animate-spin ml-1" />}
        {serverStatus === 'stopped' && (
          <span className="text-gray-400 font-normal ml-1">
            — will auto-start when you transcribe
          </span>
        )}
        {serverStatus === 'finished' && (
          <span className="text-gray-400 font-normal ml-1">
            — will auto-stop after 2 min idle
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* File upload area */}
        <div
          className={`relative border-2 rounded-lg p-4 text-center cursor-pointer transition-colors ${
            loading ? 'border-indigo-500 bg-indigo-50 animate-pulse' :
            selectedFile ? 'border-indigo-400 bg-indigo-50/50' :
            isDragging ? 'border-indigo-400 bg-indigo-50 border-dashed' :
            'border-gray-300 hover:border-gray-400 bg-gray-50 border-dashed'
          }`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          />
          {loading ? (
            <RefreshCw className="w-6 h-6 mx-auto mb-2 text-indigo-500 animate-spin" />
          ) : (
            <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400" />
          )}
          {selectedFile ? (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-sm text-gray-700">
                <FileAudio className="w-4 h-4 text-indigo-500" />
                <span className="font-medium truncate max-w-[160px]">{selectedFile.name}</span>
              </div>
              <div className="text-xs text-gray-400">
                {loading ? 'Transcribing...' : `${(selectedFile.size / 1024).toFixed(0)} KB`}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              <span className="font-medium">Drop audio file</span> or click to browse
              <div className="text-xs text-gray-400 mt-1">mp3, wav, m4a, ogg, webm</div>
            </div>
          )}
        </div>

        {/* Record from mic (batch) */}
        <div className="flex flex-col items-center justify-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-500">Record &amp; transcribe</div>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={(isBusy && !isRecording) || isLive}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isRecording
                ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300 disabled:opacity-50'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4" />
                Stop ({formatRecordTime(recordingTime)})
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Record
              </>
            )}
          </button>
          {isRecording && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Recording...
            </div>
          )}
        </div>

        {/* Live transcribe */}
        <div className="flex flex-col items-center justify-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Radio className="w-3.5 h-3.5" />
            Live transcribe
          </div>
          <button
            onClick={isLive ? stopLiveTranscribe : startLiveTranscribe}
            disabled={(isBusy && !isLive) || isRecording}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              isLive
                ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-300'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300 disabled:opacity-50'
            }`}
          >
            {isLive ? (
              <>
                <Square className="w-4 h-4" />
                Stop ({formatRecordTime(liveTime)})
              </>
            ) : liveWsState === 'connecting' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                Start Live
              </>
            )}
          </button>
          {isLive && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Streaming...
            </div>
          )}
          {liveWsState === 'error' && !isLive && (
            <div className="flex items-center gap-1 text-xs text-red-500">
              <WifiOff className="w-3 h-3" />
              Connection failed
            </div>
          )}
        </div>
      </div>

      {/* Language + controls */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Language (optional)</label>
          <input
            type="text"
            value={language}
            onChange={e => setLanguage(e.target.value)}
            placeholder="e.g. en, es, fr (auto-detect if empty)"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="pt-5">
          <button
            onClick={() => selectedFile && transcribeFile(selectedFile)}
            disabled={!selectedFile || isBusy || isRecording}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: primaryColor }}
          >
            {isBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MicOff className="w-4 h-4" />}
            {serverStatus === 'starting' ? 'Starting server...' :
             serverStatus === 'processing' ? 'Transcribing...' :
             'Transcribe'}
          </button>
        </div>
      </div>

      {/* Live transcript */}
      {(isLive || liveFinals.length > 0 || livePartial) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <Radio className="w-4 h-4" />
              Live Transcript
              {isLive && <span className="text-xs text-gray-400 font-normal">(streaming)</span>}
            </div>
            {liveFinals.length > 0 && (
              <button
                onClick={() => navigator.clipboard.writeText(liveFinals.join(' '))}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Copy
              </button>
            )}
          </div>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 min-h-[80px] max-h-[200px] overflow-y-auto">
            {liveFinals.map((text, i) => (
              <span key={i}>{text} </span>
            ))}
            {livePartial && (
              <span className="text-gray-400 italic">{livePartial}</span>
            )}
            {liveFinals.length === 0 && !livePartial && isLive && (
              <span className="text-gray-400 italic">Listening...</span>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {transcript != null && !error && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-700">
              <CheckCircle className="w-4 h-4" />
              Transcript
              {elapsed != null && <span className="text-xs text-gray-400 font-normal">({(elapsed / 1000).toFixed(1)}s)</span>}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(transcript)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Copy
            </button>
          </div>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 whitespace-pre-wrap min-h-[60px]">
            {transcript}
          </div>
        </div>
      )}
    </div>
  );
}
