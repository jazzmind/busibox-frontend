'use client';

import React, { useEffect, useState } from 'react';

function groupScopesByPrefix(scopes: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  const seen = new Set<string>();
  for (const s of scopes) {
    const trimmed = s.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    const prefix = trimmed.includes('.') ? trimmed.split('.')[0]! : 'other';
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(trimmed);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort();
  }
  return groups;
}

export interface AgentScopesSelectorProps {
  selectedScopes: string[];
  onScopesChange: (scopes: string[]) => void;
  disabled?: boolean;
  /** Optional: preloaded list of available scopes (from /api/scopes). If not provided, fetches on mount. */
  availableScopes?: string[] | null;
}

export function AgentScopesSelector({
  selectedScopes,
  onScopesChange,
  disabled = false,
  availableScopes: availableScopesProp,
}: AgentScopesSelectorProps) {
  const [availableScopes, setAvailableScopes] = useState<string[]>(
    Array.isArray(availableScopesProp) ? availableScopesProp : []
  );
  const [loading, setLoading] = useState(!Array.isArray(availableScopesProp));
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    if (Array.isArray(availableScopesProp)) {
      setAvailableScopes(availableScopesProp);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/scopes', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = Array.isArray(data?.scopes) ? data.scopes : [];
        setAvailableScopes(list);
      } catch {
        if (!cancelled) setAvailableScopes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [availableScopesProp]);

  const grouped = groupScopesByPrefix(availableScopes);
  const groupKeys = Object.keys(grouped).sort();

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      onScopesChange(selectedScopes.filter((s) => s !== scope));
    } else {
      onScopesChange([...selectedScopes, scope]);
    }
  };

  const addCustomScope = () => {
    const raw = customInput.trim();
    if (!raw) return;
    const scope = raw.includes(',') ? raw.split(',')[0]!.trim() : raw;
    if (scope && !selectedScopes.includes(scope)) {
      onScopesChange([...selectedScopes, scope]);
      setCustomInput('');
    }
  };

  const removeScope = (scope: string) => {
    onScopesChange(selectedScopes.filter((s) => s !== scope));
  };

  const customOrWildcardScopes = selectedScopes.filter(
    (s) => !availableScopes.includes(s)
  );

  return (
    <div className="space-y-4">
      {selectedScopes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 self-center">Selected:</span>
          {selectedScopes.map((scope) => (
            <span
              key={scope}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-sm"
            >
              {scope}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeScope(scope)}
                  className="ml-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 p-0.5"
                  aria-label={`Remove ${scope}`}
                >
                  <span className="sr-only">Remove</span>
                  <span aria-hidden>×</span>
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading scopes…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupKeys.map((prefix) => (
              <div
                key={prefix}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50/50 dark:bg-gray-800/50"
              >
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                  {prefix}
                </div>
                <div className="flex flex-col gap-1">
                  {grouped[prefix].map((scope) => (
                    <label
                      key={scope}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded px-2 py-1 -mx-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        disabled={disabled}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200 select-none">
                        {scope}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Custom or wildcard scope
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomScope())}
                disabled={disabled}
                placeholder="e.g. search.* or custom.read"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 dark:placeholder-gray-500"
              />
              <button
                type="button"
                onClick={addCustomScope}
                disabled={disabled || !customInput.trim()}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:pointer-events-none text-sm font-medium"
              >
                Add
              </button>
            </div>
            {customOrWildcardScopes.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Custom/wildcard scopes in use: {customOrWildcardScopes.join(', ')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
