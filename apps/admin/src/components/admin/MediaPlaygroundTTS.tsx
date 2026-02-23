'use client';

import { useState, useRef } from 'react';
import { Volume2, Download, RefreshCw, CheckCircle, AlertCircle, Play, Pause } from 'lucide-react';

interface Props {
  primaryColor?: string;
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy (neutral)' },
  { value: 'echo', label: 'Echo (male)' },
  { value: 'fable', label: 'Fable (British)' },
  { value: 'onyx', label: 'Onyx (deep)' },
  { value: 'nova', label: 'Nova (female)' },
  { value: 'shimmer', label: 'Shimmer (soft)' },
];

export function MediaPlaygroundTTS({ primaryColor = '#6366f1' }: Props) {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [speed, setSpeed] = useState(1.0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    setElapsed(null);
    setIsPlaying(false);
    const start = Date.now();

    try {
      const res = await fetch('/api/llm-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'voice',
          input: text,
          voice,
          speed,
          response_format: 'mp3',
        }),
      });

      setElapsed(Date.now() - start);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `TTS failed (${res.status})`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (e: unknown) {
      setElapsed(Date.now() - start);
      setError(e instanceof Error ? e.message : 'TTS generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts-${voice}-${Date.now()}.mp3`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Text input */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Text to speak
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Enter text to convert to speech..."
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
        />
        <div className="text-right text-xs text-gray-400 mt-0.5">{text.length} chars</div>
      </div>

      {/* Voice + speed controls */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Voice</label>
          <select
            value={voice}
            onChange={e => setVoice(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            {VOICE_OPTIONS.map(v => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Speed: <span className="font-semibold text-gray-800">{speed.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min={0.25}
            max={4.0}
            step={0.25}
            value={speed}
            onChange={e => setSpeed(parseFloat(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0.25x</span>
            <span>4.0x</span>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!text.trim() || loading}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
        style={{ backgroundColor: primaryColor }}
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
        {loading ? 'Generating...' : 'Generate Speech'}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Audio player */}
      {audioUrl && !error && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-700">
            <CheckCircle className="w-4 h-4" />
            Audio ready
            {elapsed != null && <span className="text-xs text-gray-400 font-normal">({(elapsed / 1000).toFixed(1)}s)</span>}
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <button
              onClick={handlePlayPause}
              className="flex items-center justify-center w-9 h-9 rounded-full text-white transition-colors"
              style={{ backgroundColor: primaryColor }}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              className="flex-1 h-8"
              controls
            />

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 border border-gray-300 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
