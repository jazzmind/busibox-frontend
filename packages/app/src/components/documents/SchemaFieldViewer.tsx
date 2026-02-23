'use client';

import { useMemo, useState, type JSX } from 'react';
import { Check, Edit3, X } from 'lucide-react';

interface SchemaFieldViewerProps {
  record: Record<string, any>;
  markdown: string;
  schemaFields?: Record<string, { order?: number; display_order?: number }>;
  onSelectProvenance: (value: any) => void;
  onUpdateField?: (field: string, value: any) => Promise<void>;
}

type PathSegment = string | number;
type ProvenanceCandidate = { text?: string; charOffset: number; charLength: number };

function isProvenanceNode(value: unknown): value is { charOffset?: number; charLength?: number; text?: string } {
  return typeof value === 'object' && value !== null && 'charOffset' in (value as any);
}

function findStringCandidates(markdown: string, text: string, maxMatches = 5) {
  const needle = text.trim();
  if (!needle) return [];
  const matches: Array<{ text: string; charOffset: number; charLength: number }> = [];

  const pushUnique = (candidate: { text: string; charOffset: number; charLength: number }) => {
    if (matches.some((m) => m.charOffset === candidate.charOffset && m.charLength === candidate.charLength)) {
      return;
    }
    matches.push(candidate);
  };

  const haystack = markdown.toLowerCase();
  const search = needle.toLowerCase();
  let from = 0;
  while (matches.length < maxMatches) {
    const idx = haystack.indexOf(search, from);
    if (idx === -1) break;
    pushUnique({
      text: markdown.slice(idx, idx + needle.length),
      charOffset: idx,
      charLength: needle.length,
    });
    from = idx + Math.max(1, needle.length);
  }

  if (matches.length > 0) return matches;

  // Fallback: normalized search that tolerates punctuation/whitespace differences.
  const normalize = (input: string) => {
    const chars: string[] = [];
    const map: number[] = [];
    let lastWasSep = false;
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (/[a-zA-Z0-9]/.test(ch)) {
        chars.push(ch.toLowerCase());
        map.push(i);
        lastWasSep = false;
      } else if (!lastWasSep && chars.length > 0) {
        chars.push(' ');
        map.push(i);
        lastWasSep = true;
      }
    }
    if (chars[chars.length - 1] === ' ') {
      chars.pop();
      map.pop();
    }
    return { normalized: chars.join(''), map };
  };

  const normalizedHaystack = normalize(markdown);
  const normalizedNeedle = normalize(needle).normalized;
  if (normalizedNeedle.length < 2) return matches;

  let normFrom = 0;
  while (matches.length < maxMatches) {
    const normIdx = normalizedHaystack.normalized.indexOf(normalizedNeedle, normFrom);
    if (normIdx === -1) break;
    const normEnd = normIdx + normalizedNeedle.length - 1;
    const startIdx = normalizedHaystack.map[normIdx];
    const endIdx = normalizedHaystack.map[normEnd];
    if (typeof startIdx !== 'number' || typeof endIdx !== 'number' || endIdx < startIdx) {
      normFrom = normIdx + 1;
      continue;
    }
    const snippet = markdown.slice(startIdx, endIdx + 1);
    pushUnique({
      text: snippet,
      charOffset: startIdx,
      charLength: Math.max(1, snippet.length),
    });
    normFrom = normIdx + Math.max(1, normalizedNeedle.length);
  }
  return matches;
}

function flattenProvenanceCandidates(source: any): Array<{ text?: string; charOffset: number; charLength: number }> {
  if (!source) return [];
  if (Array.isArray(source)) {
    return source.flatMap((item) => flattenProvenanceCandidates(item));
  }
  if (isProvenanceNode(source) && typeof source.charOffset === 'number' && typeof source.charLength === 'number') {
    return [{ text: source.text, charOffset: source.charOffset, charLength: source.charLength }];
  }
  if (typeof source === 'object') {
    return Object.values(source).flatMap((item) => flattenProvenanceCandidates(item));
  }
  return [];
}

function getByPath(source: any, path: PathSegment[]): any {
  return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), source);
}

function buildPathLabel(path: PathSegment[]): string {
  return path
    .map((part, idx) => (typeof part === 'number' ? `[${part}]` : idx === 0 ? String(part) : `.${String(part)}`))
    .join('');
}

function collectSearchTerms(value: any): string[] {
  if (value == null) return [];
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => collectSearchTerms(item));
  if (typeof value === 'object') return Object.values(value).flatMap((item) => collectSearchTerms(item));
  return [];
}

function dedupeCandidates(candidates: ProvenanceCandidate[]): ProvenanceCandidate[] {
  const seen = new Set<string>();
  const deduped: ProvenanceCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.charOffset}:${candidate.charLength}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  return deduped;
}

function parseDraftValue(originalValue: unknown, draft: string): any {
  if (typeof originalValue === 'string') return draft;
  if (typeof originalValue === 'number') {
    const num = Number(draft);
    if (Number.isNaN(num)) throw new Error('Value must be a number');
    return num;
  }
  if (typeof originalValue === 'boolean') {
    const normalized = draft.trim().toLowerCase();
    if (!['true', 'false'].includes(normalized)) throw new Error('Value must be true or false');
    return normalized === 'true';
  }
  return JSON.parse(draft);
}

function formatValue(value: any): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

export function SchemaFieldViewer({
  record,
  markdown,
  schemaFields,
  onSelectProvenance,
  onUpdateField,
}: SchemaFieldViewerProps) {
  const visibleEntries = useMemo(
    () => {
      const entries = Object.entries(record).filter(([key]) => !key.startsWith('_'));
      return entries.sort(([a], [b]) => {
        const aOrder = schemaFields?.[a]?.display_order ?? schemaFields?.[a]?.order ?? Number.POSITIVE_INFINITY;
        const bOrder = schemaFields?.[b]?.display_order ?? schemaFields?.[b]?.order ?? Number.POSITIVE_INFINITY;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.localeCompare(b);
      });
    },
    [record, schemaFields]
  );

  const provenance = (record._provenance || {}) as Record<string, any>;
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const beginEdit = (field: string, value: any) => {
    setSaveError(null);
    setEditingField(field);
    setDraftValue(formatValue(value));
  };

  const cancelEdit = () => {
    setEditingField(null);
    setDraftValue('');
    setSaveError(null);
  };

  const saveEdit = async (field: string, originalValue: any) => {
    if (!onUpdateField) return;
    try {
      setSaveError(null);
      setSavingField(field);
      const parsed = parseDraftValue(originalValue, draftValue);
      await onUpdateField(field, parsed);
      setEditingField(null);
      setDraftValue('');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save field');
    } finally {
      setSavingField(null);
    }
  };

  const handleSelectSource = (path: PathSegment[], value: any) => {
    const label = buildPathLabel(path);
    const directProvenance = getByPath(provenance, path);
    const provenanceCandidates = flattenProvenanceCandidates(directProvenance);

    const fallbackCandidates = collectSearchTerms(value)
      .filter((term) => term.length >= 2)
      .slice(0, 8)
      .flatMap((term) => findStringCandidates(markdown, term, 3));

    const candidates = dedupeCandidates(
      (provenanceCandidates.length > 0 ? provenanceCandidates : fallbackCandidates).slice(0, 12)
    );

    onSelectProvenance({ label, candidates });
  };

  const renderValue = (value: any, path: PathSegment[]): JSX.Element => {
    if (value == null) {
      return (
        <button
          onClick={() => handleSelectSource(path, value)}
          className="w-full rounded bg-gray-100 px-2 py-1 text-left text-xs text-gray-600 transition-colors hover:bg-blue-100 hover:ring-1 hover:ring-blue-400/50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-blue-900/40 dark:hover:ring-blue-500/40"
        >
          {String(value)}
        </button>
      );
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return (
        <button
          onClick={() => handleSelectSource(path, value)}
          className="w-full rounded bg-gray-100 px-2 py-1 text-left text-sm text-gray-900 transition-colors hover:bg-blue-100 hover:ring-1 hover:ring-blue-400/50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-blue-900/40 dark:hover:ring-blue-500/40"
          title="Click to highlight source"
        >
          {String(value)}
        </button>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <div className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">[]</div>;
      }

      const primitiveOnly = value.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
      if (primitiveOnly) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, idx) => (
              <button
                key={`${buildPathLabel(path)}-${idx}`}
                onClick={() => handleSelectSource([...path, idx], item)}
                className="rounded bg-gray-100 px-2 py-0.5 text-left text-xs text-gray-700 transition-colors hover:bg-blue-100 hover:ring-1 hover:ring-blue-400/50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-blue-900/40 dark:hover:ring-blue-500/40"
                title="Click to highlight source"
              >
                {String(item)}
              </button>
            ))}
          </div>
        );
      }

      return (
        <div className="space-y-2">
          {value.map((item, idx) => (
            <div
              key={`${buildPathLabel(path)}-${idx}`}
              className="rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/50"
            >
              <div className="mb-1 text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400">Item {idx + 1}</div>
              {renderValue(item, [...path, idx])}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {Object.entries(value).map(([subKey, subVal]) => (
          <div key={`${buildPathLabel(path)}-${subKey}`} className="space-y-1">
            <div className="text-[10px] font-semibold uppercase text-gray-500 dark:text-gray-400">{subKey}</div>
            {renderValue(subVal, [...path, subKey])}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {saveError ? (
        <div className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-700/50 dark:bg-red-900/30 dark:text-red-200">
          {saveError}
        </div>
      ) : null}
      {visibleEntries.map(([key, value]) => (
        <div
          key={key}
          className="w-full rounded border border-gray-200 bg-white p-2 text-left transition-colors hover:border-blue-400/60 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-500/50"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{key}</div>
            <div className="flex items-center gap-1">
              {onUpdateField && key !== 'id' ? (
                <button
                  onClick={() => beginEdit(key, value)}
                  className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  title="Edit field value"
                  disabled={savingField === key}
                >
                  <Edit3 className="mr-1 h-3 w-3" />
                  Edit
                </button>
              ) : null}
            </div>
          </div>

          {editingField === key ? (
            <div className="space-y-2">
              <textarea
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                className="min-h-[88px] w-full rounded border border-gray-300 p-2 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveEdit(key, value)}
                  className="inline-flex items-center rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                  disabled={savingField === key}
                >
                  <Check className="mr-1 h-3 w-3" />
                  {savingField === key ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <X className="mr-1 h-3 w-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-900">
              {renderValue(value, [key])}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
