'use client';

import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Database, 
  ChevronRight,
  ChevronDown,
  Loader2,
  Trash2,
  LinkIcon,
  List,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Lock
} from 'lucide-react';
import type { AppDataRelation, AppDataSchema } from '@jazzmind/busibox-app';

interface AppDataDocument {
  id: string;
  name: string;
  displayName?: string;
  sourceApp: string;
  itemLabel?: string;
  schema?: AppDataSchema;
}

interface DataRecord {
  id: string;
  [key: string]: unknown;
}

interface DocumentLookup {
  [documentName: string]: {
    id: string;
    displayName?: string;
    itemLabel?: string;
  };
}

interface RelatedRecordsCache {
  [key: string]: {
    records: DataRecord[];
    total: number;
    loading: boolean;
    expanded: boolean;
  };
}

interface OrphanInfo {
  relationName: string;
  foreignKey: string;
  foreignKeyValue: string;
  targetDocument: string;
}

export default function RecordDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string; recordId: string }> 
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  
  const [record, setRecord] = useState<DataRecord | null>(null);
  const [document, setDocument] = useState<AppDataDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [adminMeta, setAdminMeta] = useState<{
    recordId: string;
    documentId: string;
    ownerId: string | null;
    visibility: string;
    createdAt: string | null;
    updatedAt: string | null;
  } | null>(null);
  const [documentLookup, setDocumentLookup] = useState<DocumentLookup>({});
  const [relatedRecordsCache, setRelatedRecordsCache] = useState<RelatedRecordsCache>({});
  const [orphanRelations, setOrphanRelations] = useState<OrphanInfo[]>([]);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cascadeDelete, setCascadeDelete] = useState(false);
  const [relatedCounts, setRelatedCounts] = useState<{ [key: string]: number }>({});

  // Fetch related records for hasMany relations
  const fetchRelatedRecords = useCallback(async (
    relationName: string,
    relation: AppDataRelation,
    recordId: string
  ) => {
    const cacheKey = `${relationName}:${recordId}`;
    
    if (relatedRecordsCache[cacheKey]?.loading || relatedRecordsCache[cacheKey]?.records) {
      return;
    }

    setRelatedRecordsCache(prev => ({
      ...prev,
      [cacheKey]: { records: [], total: 0, loading: true, expanded: true },
    }));

    try {
      const response = await fetch(
        `/api/data/${resolvedParams.id}/related?document=${encodeURIComponent(relation.document)}&foreignKey=${encodeURIComponent(relation.foreignKey)}&value=${encodeURIComponent(recordId)}&limit=10`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const total = data.data.total || 0;
          setRelatedRecordsCache(prev => ({
            ...prev,
            [cacheKey]: {
              records: data.data.records || [],
              total,
              loading: false,
              expanded: true,
            },
          }));
          // Update related counts for delete modal
          setRelatedCounts(prev => ({
            ...prev,
            [relationName]: total,
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching related records:', err);
      setRelatedRecordsCache(prev => ({
        ...prev,
        [cacheKey]: { records: [], total: 0, loading: false, expanded: true },
      }));
    }
  }, [resolvedParams.id, relatedRecordsCache]);

  // Toggle expansion for related records section
  const toggleRelatedRecords = useCallback((cacheKey: string) => {
    setRelatedRecordsCache(prev => ({
      ...prev,
      [cacheKey]: {
        ...prev[cacheKey],
        expanded: !prev[cacheKey]?.expanded,
      },
    }));
  }, []);

  // Check for orphan parent relations
  const checkOrphanRelations = useCallback(async (
    rec: DataRecord,
    doc: AppDataDocument,
    lookup: DocumentLookup
  ) => {
    const orphans: OrphanInfo[] = [];
    const relations = doc.schema?.relations || {};
    const belongsToRelations = Object.entries(relations).filter(
      ([, rel]) => rel.type === 'belongsTo'
    );

    for (const [relationName, relation] of belongsToRelations) {
      const foreignKeyValue = rec[relation.foreignKey] as string | undefined;
      if (!foreignKeyValue) continue;

      const targetDoc = lookup[relation.document];
      if (!targetDoc) continue;

      // Check if the parent record exists
      try {
        const response = await fetch(
          `/api/data/${targetDoc.id}/record/${foreignKeyValue}`
        );
        if (!response.ok) {
          // Parent not found - this is an orphan
          orphans.push({
            relationName,
            foreignKey: relation.foreignKey,
            foreignKeyValue,
            targetDocument: relation.document,
          });
        }
      } catch {
        // Consider as orphan on error
        orphans.push({
          relationName,
          foreignKey: relation.foreignKey,
          foreignKeyValue,
          targetDocument: relation.document,
        });
      }
    }

    setOrphanRelations(orphans);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch the record
        const recordResponse = await fetch(
          `/api/data/${resolvedParams.id}/record/${resolvedParams.recordId}`
        );
        
        if (!recordResponse.ok) {
          const errorData = await recordResponse.json().catch(() => ({}));
          if (recordResponse.status === 403) {
            setIsAccessDenied(true);
            setError(errorData.error || 'Access denied');
            if (errorData.adminMeta) {
              setAdminMeta(errorData.adminMeta);
            }
            if (errorData.document) {
              setDocument(errorData.document);
            }
            setIsLoading(false);
            return;
          }
          throw new Error(errorData.error || `Failed to fetch record: ${recordResponse.status}`);
        }
        
        const recordData = await recordResponse.json();
        if (recordData.success && recordData.data) {
          setRecord(recordData.data.record);
          setDocument(recordData.data.document);
          
          // Also fetch document list for relation lookups
          const listResponse = await fetch('/api/libraries');
          let lookup: DocumentLookup = {};
          if (listResponse.ok) {
            const listData = await listResponse.json();
            if (listData.success && listData.data) {
              const appData = listData.data.appDataLibraries || [];
              for (const doc of appData) {
                lookup[doc.name] = {
                  id: doc.id,
                  displayName: doc.displayName || doc.name,
                  itemLabel: doc.itemLabel,
                };
              }
              setDocumentLookup(lookup);
            }
          }

          // Check for orphan relations
          if (recordData.data.record && recordData.data.document) {
            await checkOrphanRelations(recordData.data.record, recordData.data.document, lookup);
          }

          // Pre-fetch related record counts for hasMany relations
          const doc = recordData.data.document;
          const rec = recordData.data.record;
          if (doc?.schema?.relations && rec?.id) {
            const hasManyRelations = Object.entries(doc.schema.relations).filter(
              ([, rel]) => (rel as AppDataRelation).type === 'hasMany'
            );
            for (const [relationName, relation] of hasManyRelations) {
              fetchRelatedRecords(relationName, relation as AppDataRelation, rec.id);
            }
          }
        } else {
          throw new Error(recordData.error || 'Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching record:', err);
        setError(err instanceof Error ? err.message : 'Failed to load record');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.id, resolvedParams.recordId, fetchRelatedRecords, checkOrphanRelations]);

  // Handle delete
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const url = `/api/data/${resolvedParams.id}/record/${resolvedParams.recordId}${cascadeDelete ? '?cascade=true' : ''}`;
      const response = await fetch(url, { method: 'DELETE' });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete record');
      }
      
      // Navigate back to document page
      router.push(`/data/${resolvedParams.id}`);
    } catch (err) {
      console.error('Error deleting record:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete record');
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      try {
        return new Date(value).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return value;
      }
    }
    return String(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading record...</p>
        </div>
      </div>
    );
  }

  if (isAccessDenied) {
    const metaFormatDate = (dateStr?: string | null) => {
      if (!dateStr) return '—';
      try {
        return new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      } catch { return dateStr; }
    };

    return (
      <div className="min-h-full bg-white">
        <div className="border-b border-gray-200 bg-white">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <Link
              href={`/data/${resolvedParams.id}`}
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {document?.displayName || document?.name || 'Collection'}
            </Link>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-50 rounded-xl">
                <Lock className="w-8 h-8 text-amber-500" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Record Metadata</h1>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                  {document?.sourceApp && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      {document.sourceApp}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                  <span>{document?.displayName || document?.name || 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Data access restricted</p>
              <p className="text-xs text-amber-700 mt-0.5">
                You don&apos;t have the app-specific role needed to view this record&apos;s full data.
                Below is the admin-level metadata for this record.
              </p>
            </div>
          </div>

          {adminMeta ? (
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <table className="w-full">
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-100/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-500 w-1/3">Record ID</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{adminMeta.recordId}</td>
                  </tr>
                  <tr className="hover:bg-gray-100/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-500">Document ID</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{adminMeta.documentId}</td>
                  </tr>
                  <tr className="hover:bg-gray-100/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-500">Owner</td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{adminMeta.ownerId || '—'}</td>
                  </tr>
                  <tr className="hover:bg-gray-100/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-500">Visibility</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        adminMeta.visibility === 'personal'
                          ? 'bg-yellow-100 text-yellow-800'
                          : adminMeta.visibility === 'shared'
                          ? 'bg-green-100 text-green-800'
                          : adminMeta.visibility === 'inherit'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {adminMeta.visibility}
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-100/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-500">Created</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{metaFormatDate(adminMeta.createdAt)}</td>
                  </tr>
                  <tr className="hover:bg-gray-100/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-500">Updated</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{metaFormatDate(adminMeta.updatedAt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              No metadata available for this record.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error || !record || !document) {
    return (
      <div className="min-h-full bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link
            href={`/data/${resolvedParams.id}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Document
          </Link>
          
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              {error || 'Record not found'}
            </h2>
            <p className="text-gray-500">
              The requested record could not be loaded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Get display name for the record
  const displayName = record.name || record.title || record.label || `Record`;
  
  // Get schema info
  const schema = document.schema;
  const fields = schema?.fields || {};
  const relations = schema?.relations || {};
  const belongsToRelations = Object.entries(relations).filter(
    ([, rel]) => rel.type === 'belongsTo'
  );
  const hasManyRelations = Object.entries(relations).filter(
    ([, rel]) => rel.type === 'hasMany'
  );

  // Calculate total related records for delete modal
  const totalRelatedRecords = Object.values(relatedCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="min-h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href={`/data/${resolvedParams.id}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {document.displayName || document.name}
          </Link>
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <Database className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {String(displayName)}
                </h1>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    {document.sourceApp}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                  <span>{document.displayName || document.name}</span>
                </div>
                
                {/* Orphan warning */}
                {orphanRelations.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-2 rounded-lg text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      Parent not found: {orphanRelations.map(o => `${o.relationName} (${o.foreignKeyValue.slice(0, 8)}...)`).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Fields Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Fields</h2>
          <div className="bg-gray-50 rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody className="divide-y divide-gray-200">
                {Object.entries(record)
                  .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
                  .map(([key, value]) => {
                    const fieldDef = fields[key];
                    const isRelationField = belongsToRelations.some(([, rel]) => rel.foreignKey === key);
                    
                    return (
                      <tr key={key} className="hover:bg-gray-100/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 w-1/3">
                          {fieldDef?.label || key}
                          {fieldDef?.required && <span className="text-red-500 ml-1">*</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {isRelationField && typeof value === 'string' ? (
                            <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                              {value}
                            </span>
                          ) : (
                            <span className="whitespace-pre-wrap">{formatValue(value)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                
                {/* System fields */}
                <tr className="bg-gray-100/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-400">ID</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">{record.id}</td>
                </tr>
                {Boolean(record.createdAt) && (
                  <tr className="bg-gray-100/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-400">Created</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatValue(record.createdAt)}</td>
                  </tr>
                )}
                {Boolean(record.updatedAt) && (
                  <tr className="bg-gray-100/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-400">Updated</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatValue(record.updatedAt)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Relations Section */}
        {(belongsToRelations.length > 0 || hasManyRelations.length > 0) && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Relations</h2>
            
            {/* BelongsTo Relations */}
            {belongsToRelations.length > 0 && (
              <div className="space-y-3 mb-4">
                {belongsToRelations.map(([relationName, relation]) => {
                  const foreignKeyValue = record[relation.foreignKey] as string | undefined;
                  if (!foreignKeyValue) return null;
                  
                  const targetDoc = documentLookup[relation.document];
                  const isOrphan = orphanRelations.some(o => o.relationName === relationName);
                  
                  return (
                    <div
                      key={relationName}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        isOrphan 
                          ? 'bg-orange-50 border-orange-200' 
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <LinkIcon className={`w-5 h-5 ${isOrphan ? 'text-orange-500' : 'text-gray-400'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {relation.label || relationName}
                          </p>
                          {isOrphan ? (
                            <p className="text-xs text-orange-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Parent not found ({foreignKeyValue.slice(0, 8)}...)
                            </p>
                          ) : (
                            <p className="text-xs text-gray-500">
                              {targetDoc?.displayName || relation.document}
                            </p>
                          )}
                        </div>
                      </div>
                      {targetDoc && !isOrphan && (
                        <Link
                          href={`/data/${targetDoc.id}/record/${foreignKeyValue}`}
                          className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* HasMany Relations */}
            {hasManyRelations.length > 0 && record.id && (
              <div className="space-y-3">
                {hasManyRelations.map(([relationName, relation]) => {
                  const cacheKey = `${relationName}:${record.id}`;
                  const cachedData = relatedRecordsCache[cacheKey];
                  const isExpanded = cachedData?.expanded;
                  const isLoading = cachedData?.loading;
                  const relatedRecords = cachedData?.records || [];
                  const total = cachedData?.total || 0;
                  
                  const targetDoc = documentLookup[relation.document];
                  
                  return (
                    <div key={relationName} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => {
                          if (!cachedData) {
                            fetchRelatedRecords(relationName, relation, record.id);
                          } else {
                            toggleRelatedRecords(cacheKey);
                          }
                        }}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <List className="w-5 h-5 text-gray-400" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-gray-900">
                              {relation.label || relationName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {isLoading ? 'Loading...' : `${total} record${total !== 1 ? 's' : ''}`}
                            </p>
                          </div>
                        </div>
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        ) : isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      
                      {isExpanded && !isLoading && (
                        <div className="border-t border-gray-100">
                          {relatedRecords.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                              {relatedRecords.slice(0, 10).map((relRecord, relIndex) => {
                                const relDisplayField = relation.displayField || 'name';
                                const relDisplayValue = relRecord[relDisplayField] || relRecord.name || relRecord.title || `Item ${relIndex + 1}`;
                                
                                return (
                                  <Link
                                    key={relRecord.id || relIndex}
                                    href={targetDoc ? `/data/${targetDoc.id}/record/${relRecord.id}` : '#'}
                                    className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                      <span className="text-sm text-gray-700">{String(relDisplayValue)}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                  </Link>
                                );
                              })}
                              {total > 10 && targetDoc && (
                                <Link
                                  href={`/data/${targetDoc.id}?filter=${relation.foreignKey}:${record.id}`}
                                  className="block text-sm text-green-600 hover:text-green-700 p-3 hover:bg-gray-50"
                                >
                                  View all {total} {relation.label || relationName}...
                                </Link>
                              )}
                            </div>
                          ) : (
                            <div className="p-4 text-sm text-gray-400 text-center">
                              No {relation.label || relationName} found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete &ldquo;{String(displayName)}&rdquo;?
                </h3>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                This action cannot be undone. The record will be permanently deleted.
              </p>
              
              {/* Cascade option */}
              {totalRelatedRecords > 0 && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cascadeDelete}
                      onChange={(e) => setCascadeDelete(e.target.checked)}
                      className="mt-1 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Also delete related records
                      </p>
                      <ul className="mt-1 text-xs text-gray-600">
                        {Object.entries(relatedCounts).map(([name, count]) => (
                          count > 0 && (
                            <li key={name}>• {count} {name}</li>
                          )
                        ))}
                      </ul>
                    </div>
                  </label>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete{cascadeDelete && totalRelatedRecords > 0 ? ' All' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
