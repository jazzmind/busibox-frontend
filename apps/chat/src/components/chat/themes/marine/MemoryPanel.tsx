'use client';

/**
 * Memory panel — what the assistant knows about you, file by file.
 *
 * Shows exactly what the model sees: `profile.md` and `preferences.md` (read
 * into every conversation) and the topic/area/people files (read on demand).
 * Everything is editable and deletable here, there is an on/off switch, and
 * an export. Talks only to `/users/me/memory` — there is no way to look at
 * anyone else's memory, by design (see docs/developers/user-memory.md).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, Download, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Tooltip } from './primitives/Tooltip';

interface MemoryFileInfo {
  path: string;
  description: string;
  version: number;
  size_bytes: number;
  updated_at: string;
}

interface MemoryListResponse {
  enabled: boolean;
  encrypted: boolean;
  files: MemoryFileInfo[];
  limits: { max_files: number; max_file_bytes: number };
}

interface MemoryPanelProps {
  /** Same fetch wrapper ChatShell uses for the agent API (`/api/agent...`). */
  apiCall: (endpoint: string, options?: RequestInit) => Promise<Response>;
  onClose: () => void;
}

const CORE = ['profile.md', 'preferences.md'];

const DEFAULT_CONTENT: Record<string, string> = {
  'profile.md': '---\ndescription: Who I am and what I work on\n---\n- ',
  'preferences.md': '---\ndescription: How I want answers\n---\n- ',
};

function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    try {
      const parsed = JSON.parse(e.message) as { detail?: { message?: string } | string };
      if (parsed && typeof parsed === 'object' && parsed.detail) {
        return typeof parsed.detail === 'string' ? parsed.detail : parsed.detail.message ?? e.message;
      }
    } catch {
      /* not JSON */
    }
    return e.message;
  }
  return String(e);
}

export function MarineMemoryPanel({ apiCall, onClose }: MemoryPanelProps) {
  const [data, setData] = useState<MemoryListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [version, setVersion] = useState<number | 'new' | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiCall('/users/me/memory');
      setData((await r.json()) as MemoryListResponse);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const open = useCallback(
    async (path: string) => {
      setSelected(path);
      setDirty(false);
      const exists = data?.files.some((f) => f.path === path);
      if (!exists) {
        setContent(DEFAULT_CONTENT[path] ?? `---\ndescription: \n---\n- `);
        setVersion('new');
        return;
      }
      try {
        const r = await apiCall(`/users/me/memory/file?path=${encodeURIComponent(path)}`);
        const f = (await r.json()) as MemoryFileInfo & { content: string };
        setContent(f.content);
        setVersion(f.version);
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [apiCall, data],
  );

  const save = useCallback(async () => {
    if (!selected || version === null) return;
    setSaving(true);
    setError(null);
    try {
      const r = await apiCall('/users/me/memory/file', {
        method: 'PUT',
        body: JSON.stringify({ path: selected, content, if_version: version }),
      });
      const info = (await r.json()) as MemoryFileInfo;
      setVersion(info.version);
      setDirty(false);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [apiCall, content, refresh, selected, version]);

  const remove = useCallback(
    async (path: string) => {
      setError(null);
      try {
        await apiCall(`/users/me/memory/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
        if (selected === path) {
          setSelected(null);
          setContent('');
        }
        await refresh();
      } catch (e) {
        setError(errorMessage(e));
      }
    },
    [apiCall, refresh, selected],
  );

  const wipe = useCallback(async () => {
    setError(null);
    try {
      await apiCall('/users/me/memory', { method: 'DELETE' });
      setSelected(null);
      setContent('');
      setConfirmWipe(false);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [apiCall, refresh]);

  const toggleEnabled = useCallback(async () => {
    if (!data) return;
    const next = !data.enabled;
    setData({ ...data, enabled: next });
    try {
      await apiCall('/users/me/chat-settings', {
        method: 'PUT',
        body: JSON.stringify({ memory_enabled: next }),
      });
    } catch (e) {
      setData({ ...data, enabled: !next });
      setError(errorMessage(e));
    }
  }, [apiCall, data]);

  const exportZip = useCallback(async () => {
    try {
      const r = await apiCall('/users/me/memory/export');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'busibox-memory.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [apiCall]);

  const files = useMemo(() => {
    const present = new Map((data?.files ?? []).map((f) => [f.path, f]));
    const core = CORE.map((p) => present.get(p) ?? { path: p, description: '', version: 0, size_bytes: 0, updated_at: '' });
    const rest = (data?.files ?? []).filter((f) => !CORE.includes(f.path));
    return { core, rest, present };
  }, [data]);

  const addPath = useCallback(() => {
    const p = newPath.trim().toLowerCase();
    if (!/^(topics|areas|people)\/[a-z0-9][a-z0-9-]{0,60}\.md$/.test(p)) {
      setError('Use topics/<name>.md, areas/<name>.md or people/<name>.md (lower-case, dashes).');
      return;
    }
    setNewPath('');
    void open(p);
  }, [newPath, open]);

  return (
    <div
      className="flex h-full w-full max-w-[720px] flex-col border-l"
      style={{ backgroundColor: 'var(--marine-surface)', borderColor: 'var(--marine-border)' }}
      role="dialog"
      aria-label="Your memory"
    >
      <div className="flex h-12 items-center justify-between border-b px-4" style={{ borderColor: 'var(--marine-border)' }}>
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4" style={{ color: 'var(--marine-teal)' }} />
          <span className="text-[15px] font-semibold" style={{ color: 'var(--marine-text)' }}>
            Your memory
          </span>
          {data && (
            <span className="text-[12px]" style={{ color: 'var(--marine-text-subtle)' }}>
              {data.encrypted ? 'encrypted · ' : ''}
              {data.files.length}/{data.limits.max_files} files
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip label="Refresh" side="bottom">
            <button type="button" onClick={() => void refresh()} className="rounded-md p-1.5 hover:bg-[var(--marine-teal-tint)]" aria-label="Refresh">
              <RefreshCw className="h-4 w-4" style={{ color: 'var(--marine-text-muted)' }} />
            </button>
          </Tooltip>
          <Tooltip label="Download all files as a zip" side="bottom">
            <button type="button" onClick={() => void exportZip()} className="rounded-md p-1.5 hover:bg-[var(--marine-teal-tint)]" aria-label="Export">
              <Download className="h-4 w-4" style={{ color: 'var(--marine-text-muted)' }} />
            </button>
          </Tooltip>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 hover:bg-[var(--marine-teal-tint)]" aria-label="Close">
            <X className="h-4 w-4" style={{ color: 'var(--marine-text-muted)' }} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-b px-4 py-2 text-[13px]" style={{ borderColor: 'var(--marine-border)', color: 'var(--marine-text-body)' }}>
        <span>
          Only you can see this. The assistant reads it at the start of your own conversations and updates it
          after them; nothing here is searchable or visible to anyone else.
        </span>
        <label className="ml-4 flex shrink-0 cursor-pointer items-center gap-2">
          <input type="checkbox" checked={data?.enabled ?? true} onChange={() => void toggleEnabled()} disabled={!data} />
          <span>{data?.enabled === false ? 'Off' : 'On'}</span>
        </label>
      </div>

      {error && (
        <div className="border-b px-4 py-2 text-[13px]" style={{ backgroundColor: 'var(--marine-error-tint)', color: 'var(--marine-error-text)', borderColor: 'var(--marine-border)' }} role="alert">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="w-[260px] shrink-0 overflow-y-auto border-r" style={{ borderColor: 'var(--marine-border)' }}>
          {loading && !data ? (
            <div className="p-4 text-[13px]" style={{ color: 'var(--marine-text-muted)' }}>Loading…</div>
          ) : (
            <>
              <div className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--marine-text-subtle)' }}>
                Read every time
              </div>
              {files.core.map((f) => (
                <FileRow key={f.path} file={f} exists={files.present.has(f.path)} active={selected === f.path} onOpen={open} onDelete={remove} />
              ))}
              <div className="px-3 pt-4 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--marine-text-subtle)' }}>
                Read when relevant
              </div>
              {files.rest.length === 0 && (
                <div className="px-3 py-2 text-[12px]" style={{ color: 'var(--marine-text-subtle)' }}>Nothing yet.</div>
              )}
              {files.rest.map((f) => (
                <FileRow key={f.path} file={f} exists active={selected === f.path} onOpen={open} onDelete={remove} />
              ))}
              <div className="flex items-center gap-1 px-3 py-3">
                <input
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPath()}
                  placeholder="topics/reporting.md"
                  className="min-w-0 flex-1 rounded-md border px-2 py-1 text-[12px]"
                  style={{ borderColor: 'var(--marine-border-strong)' }}
                  aria-label="New file path"
                />
                <button type="button" onClick={addPath} className="rounded-md p-1 hover:bg-[var(--marine-teal-tint)]" aria-label="Add file">
                  <Plus className="h-4 w-4" style={{ color: 'var(--marine-teal)' }} />
                </button>
              </div>
              <div className="px-3 pb-4">
                {confirmWipe ? (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span style={{ color: 'var(--marine-error)' }}>Delete everything?</span>
                    <button type="button" onClick={() => void wipe()} className="font-semibold" style={{ color: 'var(--marine-error)' }}>Yes</button>
                    <button type="button" onClick={() => setConfirmWipe(false)} style={{ color: 'var(--marine-text-muted)' }}>No</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmWipe(true)} className="text-[12px]" style={{ color: 'var(--marine-text-muted)' }}>
                    Forget everything
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: 'var(--marine-border)' }}>
                <code className="text-[12px]" style={{ color: 'var(--marine-text-muted)' }}>{selected}</code>
                <div className="flex items-center gap-2">
                  {dirty && <span className="text-[12px]" style={{ color: 'var(--marine-text-subtle)' }}>unsaved</span>}
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!dirty || saving}
                    className="rounded-md px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--marine-teal)' }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
                spellCheck={false}
                className="min-h-0 flex-1 resize-none p-4 font-mono text-[13px] leading-relaxed outline-none"
                style={{ color: 'var(--marine-text-body)', backgroundColor: 'var(--marine-surface-alt)' }}
                aria-label={`Contents of ${selected}`}
              />
              <div className="border-t px-4 py-2 text-[12px]" style={{ borderColor: 'var(--marine-border)', color: 'var(--marine-text-subtle)' }}>
                One fact per line, in your own words. The first lines are a description the assistant uses to decide when to read the file.
                {data ? ` Up to ${data.limits.max_file_bytes.toLocaleString()} characters.` : ''}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px]" style={{ color: 'var(--marine-text-muted)' }}>
              Pick a file to read or edit it. Tell the assistant “remember that…” or “forget…” in chat and it will update these for you.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileRow({
  file,
  exists,
  active,
  onOpen,
  onDelete,
}: {
  file: MemoryFileInfo;
  exists: boolean;
  active: boolean;
  onOpen: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  return (
    <div
      className="group flex items-start gap-2 px-3 py-2 text-[13px] hover:bg-[var(--marine-teal-tint)]"
      style={{ backgroundColor: active ? 'var(--marine-teal-light)' : undefined }}
    >
      <button type="button" onClick={() => onOpen(file.path)} className="min-w-0 flex-1 text-left">
        <div className="truncate font-medium" style={{ color: exists ? 'var(--marine-text)' : 'var(--marine-text-subtle)' }}>
          {file.path}
          {!exists && <span className="ml-1 font-normal">(empty)</span>}
        </div>
        {file.description && (
          <div className="truncate text-[12px]" style={{ color: 'var(--marine-text-muted)' }}>{file.description}</div>
        )}
      </button>
      {exists && (
        <button
          type="button"
          onClick={() => onDelete(file.path)}
          className="rounded p-1 opacity-0 hover:bg-white group-hover:opacity-100"
          aria-label={`Delete ${file.path}`}
        >
          <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--marine-error)' }} />
        </button>
      )}
    </div>
  );
}
