'use client';

import { useEffect, useState } from 'react';
import { ProvenanceHighlighter } from './ProvenanceHighlighter';
import { SchemaFieldViewer } from './SchemaFieldViewer';
import { Trash2 } from 'lucide-react';

interface ExtractionSplitViewProps {
  fileId: string;
  schemaDocumentId: string;
  refreshKey?: number;
}

interface SchemaFieldDef {
  order?: number;
  display_order?: number;
}

export function ExtractionSplitView({
  fileId,
  schemaDocumentId,
  refreshKey = 0,
}: ExtractionSplitViewProps) {
  const [markdown, setMarkdown] = useState('');
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [schemaFields, setSchemaFields] = useState<Record<string, SchemaFieldDef>>({});
  const [selectedProvenance, setSelectedProvenance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [markdownResp, extractionResp, schemaResp] = await Promise.all([
          fetch(`/api/documents/${fileId}/markdown`),
          fetch(
            `/api/documents/${fileId}/extractions?schemaDocumentId=${encodeURIComponent(schemaDocumentId)}`
          ),
          fetch(`/api/data/${schemaDocumentId}`),
        ]);
        if (!markdownResp.ok) throw new Error('Failed to load markdown');
        if (!extractionResp.ok) throw new Error('Failed to load extraction records');

        const markdownData = await markdownResp.json();
        const extractionData = await extractionResp.json();
        const schemaData = schemaResp.ok ? await schemaResp.json() : {};
        const markdownText =
          markdownData?.markdown || markdownData?.content || markdownData?.data?.markdown || '';
        const extractionRecords = extractionData?.records || extractionData?.data?.records || [];
        const loadedSchemaFields =
          schemaData?.document?.schema?.fields ||
          schemaData?.data?.document?.schema?.fields ||
          schemaData?.data?.schema?.fields ||
          schemaData?.schema?.fields ||
          {};

        if (!cancelled) {
          setMarkdown(markdownText);
          setRecords(Array.isArray(extractionRecords) ? extractionRecords : []);
          setSchemaFields(loadedSchemaFields && typeof loadedSchemaFields === 'object' ? loadedSchemaFields : {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load split view data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fileId, schemaDocumentId, refreshKey]);

  const handleUpdateField = async (record: Record<string, any>, field: string, value: any) => {
    const recordId = record.id;
    if (!recordId) {
      throw new Error('Cannot edit record without id');
    }
    setSavingRecordId(recordId);
    try {
      const response = await fetch(`/api/data/${schemaDocumentId}/records`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: { [field]: value },
          where: {
            field: 'id',
            op: 'eq',
            value: recordId,
          },
          validate: true,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to save field');
      }

      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, [field]: value } : r))
      );
    } finally {
      setSavingRecordId(null);
    }
  };

  const handleDeleteRecord = async (record: Record<string, any>) => {
    const recordId = record.id;
    if (!recordId) {
      throw new Error('Cannot delete record without id');
    }

    const confirmed = window.confirm('Delete this extracted record? This cannot be undone.');
    if (!confirmed) return;

    setDeletingRecordId(recordId);
    try {
      const response = await fetch(`/api/data/${schemaDocumentId}/records`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordIds: [recordId],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete record');
      }

      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      if (selectedProvenance && record._provenance) {
        setSelectedProvenance(null);
      }
    } finally {
      setDeletingRecordId(null);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-600 dark:text-gray-300">Loading extraction split view...</div>;
  }
  if (error) {
    return <div className="rounded border border-red-300 bg-red-100 p-3 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-200">{error}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
      <div className="flex h-[70vh] min-h-0 flex-col">
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Document</h3>
        <div className="min-h-0 flex-1">
          <ProvenanceHighlighter markdown={markdown} selected={selectedProvenance} />
        </div>
      </div>
      <div className="flex h-[70vh] min-h-0 flex-col">
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Extracted Records ({records.length})
        </h3>
        <div className="min-h-0 flex-1 overflow-auto pr-1">
          {records.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              No extraction records yet for this schema/document pair.
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record, idx) => (
                <div
                  key={record.id || idx}
                  className="rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/50"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Record {idx + 1}</div>
                    <button
                      onClick={() => handleDeleteRecord(record)}
                      className="inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-700/50 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
                      disabled={deletingRecordId === record.id}
                      title="Delete this extracted record"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      {deletingRecordId === record.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                  <SchemaFieldViewer
                    record={record}
                    markdown={markdown}
                    schemaFields={schemaFields}
                    onSelectProvenance={setSelectedProvenance}
                    onUpdateField={async (field, value) => handleUpdateField(record, field, value)}
                  />
                  {savingRecordId === record.id ? (
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-300">Saving...</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
