'use client';

import { useState } from 'react';
import { FolderInput, X, Check, Loader2 } from 'lucide-react';

interface ClassificationSuggestion {
  libraryId: string;
  libraryName: string;
  matchScore: number;
  matchedKeywords: string[];
  suggestedAction: string;
}

interface ClassificationSuggestionBadgeProps {
  suggestions: ClassificationSuggestion[];
  documentId: string;
  onMoved?: () => void;
}

export function ClassificationSuggestionBadge({
  suggestions,
  documentId,
  onMoved,
}: ClassificationSuggestionBadgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  if (dismissed || suggestions.length === 0) return null;

  const top = suggestions[0];

  const handleMove = async (libraryId: string) => {
    setMoving(libraryId);
    try {
      const response = await fetch(`/api/files/${documentId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId }),
      });
      if (response.ok) {
        setDismissed(true);
        onMoved?.();
      }
    } catch (err) {
      console.error('Move failed:', err);
    } finally {
      setMoving(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-[11px] text-amber-700 hover:bg-amber-100 transition-colors"
        title={`Suggested for: ${top.libraryName}`}
      >
        <FolderInput className="w-3 h-3" />
        <span className="max-w-[120px] truncate">{top.libraryName}</span>
        <span className="text-amber-500">{Math.round(top.matchScore * 100)}%</span>
      </button>

      {showDetails && (
        <div className="absolute top-full left-0 mt-1 z-30 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-900">Classification Suggestions</span>
            <button onClick={() => setDismissed(true)} className="p-0.5 hover:bg-gray-100 rounded">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{s.libraryName}</p>
                  <p className="text-gray-500 text-[10px] truncate">
                    {s.matchedKeywords.join(', ')} ({Math.round(s.matchScore * 100)}%)
                  </p>
                </div>
                <button
                  onClick={() => handleMove(s.libraryId)}
                  disabled={moving !== null}
                  className="flex-shrink-0 p-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                  title="Move to this library"
                >
                  {moving === s.libraryId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
