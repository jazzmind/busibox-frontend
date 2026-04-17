/**
 * Admin Ops tab. Three action cards with confirmations:
 *  - Reconnect driver (safe, no confirm)
 *  - Rebuild indexes (single-click confirm)
 *  - Purge orphans (two-step: dry-run preview, then actual delete)
 */

'use client';

import { useState } from 'react';
import {
  Plug,
  Hammer,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type {
  ReconnectResult,
  RebuildIndexesResult,
  PurgeOrphansResult,
} from './types';

interface Props {
  onReconnected?: (result: ReconnectResult) => void;
}

export function GraphAdminOps({ onReconnected }: Props) {
  return (
    <div className="space-y-4">
      <ReconnectCard onReconnected={onReconnected} />
      <RebuildIndexesCard />
      <PurgeOrphansCard />
    </div>
  );
}

function ReconnectCard({ onReconnected }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReconnectResult | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/graph/admin/reconnect', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as ReconnectResult;
        setResult(data);
        onReconnected?.(data);
      } else {
        setResult({
          available: false,
          uri: null,
          user: null,
          last_connect_error: `HTTP ${res.status}`,
          connected_at: null,
        });
      }
    } catch (e) {
      setResult({
        available: false,
        uri: null,
        user: null,
        last_connect_error: e instanceof Error ? e.message : 'Request failed',
        connected_at: null,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <OpCard
      icon={<Plug className="w-5 h-5 text-indigo-500" />}
      title="Reconnect driver"
      description="Close the current Neo4j driver and re-run connect(). Use this after env var or password changes without redeploying data-api."
      actionLabel="Reconnect"
      actionTone="indigo"
      running={running}
      onClick={run}
    >
      {result && (
        <div
          className={`mt-3 flex items-start gap-2 text-xs ${
            result.available
              ? 'text-green-700 dark:text-green-400'
              : 'text-red-700 dark:text-red-400'
          }`}
        >
          {result.available ? (
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          )}
          <span>
            {result.available
              ? `Connected as ${result.user || 'neo4j'} @ ${result.uri || 'unknown'}`
              : result.last_connect_error || 'Reconnect failed'}
          </span>
        </div>
      )}
    </OpCard>
  );
}

function RebuildIndexesCard() {
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RebuildIndexesResult | null>(null);

  const run = async () => {
    setConfirming(false);
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/graph/admin/rebuild-indexes', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as RebuildIndexesResult;
        setResult(data);
      } else {
        setResult({ created: [], errors: [`HTTP ${res.status}`] });
      }
    } catch (e) {
      setResult({
        created: [],
        errors: [e instanceof Error ? e.message : 'Request failed'],
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <OpCard
        icon={<Hammer className="w-5 h-5 text-amber-500" />}
        title="Rebuild indexes"
        description="Re-runs CREATE INDEX IF NOT EXISTS for the required indexes on GraphNode, Document, Entity."
        actionLabel="Rebuild"
        actionTone="amber"
        running={running}
        onClick={() => setConfirming(true)}
      >
        {result && (
          <div className="mt-3 space-y-1 text-xs">
            {result.created.length > 0 && (
              <p className="text-green-700 dark:text-green-400">
                Ensured {result.created.length} indexes: {result.created.join(', ')}
              </p>
            )}
            {result.errors.length > 0 && (
              <p className="text-red-700 dark:text-red-400">
                {result.errors.length} error(s): {result.errors.join('; ')}
              </p>
            )}
          </div>
        )}
      </OpCard>
      {confirming && (
        <ConfirmModal
          title="Rebuild indexes?"
          body="This will issue CREATE INDEX IF NOT EXISTS for each required index. Safe to run but may briefly hold locks."
          confirmLabel="Rebuild"
          onConfirm={run}
          onCancel={() => setConfirming(false)}
          tone="amber"
        />
      )}
    </>
  );
}

function PurgeOrphansCard() {
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<PurgeOrphansResult | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteResult, setDeleteResult] = useState<PurgeOrphansResult | null>(null);

  const runPreview = async () => {
    setRunning(true);
    setPreview(null);
    setDeleteResult(null);
    try {
      const res = await fetch('/api/graph/admin/purge-orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true }),
      });
      if (res.ok) {
        setPreview((await res.json()) as PurgeOrphansResult);
      }
    } finally {
      setRunning(false);
    }
  };

  const runDelete = async () => {
    setConfirmingDelete(false);
    setRunning(true);
    try {
      const res = await fetch('/api/graph/admin/purge-orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: false }),
      });
      if (res.ok) {
        setDeleteResult((await res.json()) as PurgeOrphansResult);
      }
    } finally {
      setRunning(false);
    }
  };

  const orphans = preview?.preview;
  const hasAny = !!orphans && (
    (orphans.no_node_id || 0) +
    (orphans.no_relationships || 0) +
    (orphans.dangling_rels || 0) > 0
  );

  return (
    <>
      <OpCard
        icon={<Trash2 className="w-5 h-5 text-red-500" />}
        title="Purge orphans"
        description="Removes nodes without node_id, nodes with no relationships (excluding DataDocument/Document), and dangling relationships. Always preview first."
        actionLabel={preview ? 'Re-preview' : 'Preview'}
        actionTone="red"
        running={running}
        onClick={runPreview}
      >
        {orphans && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <OrphanCell label="No node_id" value={orphans.no_node_id} />
              <OrphanCell label="No rels" value={orphans.no_relationships} />
              <OrphanCell label="Dangling rels" value={orphans.dangling_rels} />
            </div>
            {hasAny ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={running}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete orphans
              </button>
            ) : (
              <p className="text-xs text-green-600 dark:text-green-400">
                No orphans found. Graph is clean.
              </p>
            )}
            {deleteResult && !deleteResult.dry_run && (
              <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-800 dark:text-green-300">
                Deleted: no_node_id={deleteResult.deleted.no_node_id ?? 0},
                {' '}no_relationships={deleteResult.deleted.no_relationships ?? 0},
                {' '}dangling_rels={deleteResult.deleted.dangling_rels ?? 0}
              </div>
            )}
          </div>
        )}
      </OpCard>
      {confirmingDelete && orphans && (
        <ConfirmModal
          title="Delete orphans?"
          body={
            `This will DETACH DELETE:\n` +
            `  • ${orphans.no_node_id} nodes without node_id\n` +
            `  • ${orphans.no_relationships} nodes with no relationships\n` +
            `  • ${orphans.dangling_rels} dangling relationships\n\n` +
            `This cannot be undone.`
          }
          confirmLabel="Delete"
          onConfirm={runDelete}
          onCancel={() => setConfirmingDelete(false)}
          tone="red"
        />
      )}
    </>
  );
}

function OpCard({
  icon,
  title,
  description,
  actionLabel,
  actionTone,
  running,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionTone: 'indigo' | 'amber' | 'red';
  running: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  const toneClasses = {
    indigo: 'bg-indigo-600 hover:bg-indigo-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
    red: 'bg-red-600 hover:bg-red-700',
  }[actionTone];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/60">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          {children}
        </div>
        <button
          onClick={onClick}
          disabled={running}
          className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 transition-colors ${toneClasses}`}
        >
          {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : actionLabel}
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  tone,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone: 'amber' | 'red';
}) {
  const toneClasses = {
    amber: 'bg-amber-600 hover:bg-amber-700',
    red: 'bg-red-600 hover:bg-red-700',
  }[tone];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md mx-4 p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {title}
        </h3>
        <pre className="text-sm text-gray-600 dark:text-gray-400 mb-5 whitespace-pre-wrap font-sans">
          {body}
        </pre>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg text-white ${toneClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrphanCell({ label, value }: { label: string; value: number }) {
  const bad = value > 0;
  return (
    <div
      className={`rounded-lg px-2 py-1.5 border ${
        bad
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'
      }`}
    >
      <p
        className={`text-lg font-semibold ${
          bad ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </p>
    </div>
  );
}
