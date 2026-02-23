'use client';

import { useEffect, useState, use, useCallback, useRef, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Database, 
  Layers, 
  Calendar, 
  User,
  ChevronRight,
  ChevronDown,
  Loader2,
  ExternalLink,
  Link as LinkIcon,
  List,
  Trash2,
  AlertTriangle,
  Download,
  Upload,
  Shield
} from 'lucide-react';
import type { AppDataRelation, AppDataSchema } from '@jazzmind/busibox-app';
import { DeleteConfirmModal } from '@jazzmind/busibox-app';

interface AppDataDocument {
  id: string;
  documentId: string;
  name: string;
  displayName?: string;
  sourceApp: string;
  itemLabel?: string;
  recordCount: number;
  visibility?: string;
  schema?: AppDataSchema;
  createdAt?: string;
  updatedAt?: string;
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
  recordId: string;
  orphanRelations: {
    relationName: string;
    foreignKey: string;
    foreignKeyValue: string;
    targetDocument: string;
  }[];
}

interface DocumentRole {
  role_id: string;
  role_name: string;
}

interface AdminRole {
  id: string;
  name: string;
}

export default function AppDataDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [document, setDocument] = useState<AppDataDocument | null>(null);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentLookup, setDocumentLookup] = useState<DocumentLookup>({});
  const [relatedRecordsCache, setRelatedRecordsCache] = useState<RelatedRecordsCache>({});
  const [orphanRecords, setOrphanRecords] = useState<{ [recordId: string]: OrphanInfo }>({});
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [relatedDocCounts, setRelatedDocCounts] = useState<{ name: string; count: number }[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [documentVisibility, setDocumentVisibility] = useState<'personal' | 'shared'>('personal');
  const [documentRoles, setDocumentRoles] = useState<DocumentRole[]>([]);
  const [documentRoleIds, setDocumentRoleIds] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AdminRole[]>([]);
  const [currentUserRoleIds, setCurrentUserRoleIds] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [rolesMessage, setRolesMessage] = useState<string | null>(null);
  const [pendingDangerousChange, setPendingDangerousChange] = useState<{
    roleIds: string[];
    visibility: 'personal' | 'shared';
  } | null>(null);

  const backParams = new URLSearchParams();
  const backTab = searchParams.get('tab');
  const backQuery = searchParams.get('q');
  const backApp = searchParams.get('app');
  const backSort = searchParams.get('sort');
  const backDir = searchParams.get('dir');
  if (backTab) backParams.set('tab', backTab);
  if (backQuery) backParams.set('q', backQuery);
  if (backApp) backParams.set('app', backApp);
  if (backSort) backParams.set('sort', backSort);
  if (backDir) backParams.set('dir', backDir);
  const backHref = backParams.toString() ? `/data?${backParams.toString()}` : '/data';

  const fallbackDocument: AppDataDocument = {
    id: resolvedParams.id,
    documentId: resolvedParams.id,
    name: searchParams.get('name') || 'Loading data store...',
    displayName: searchParams.get('displayName') || undefined,
    sourceApp: searchParams.get('sourceApp') || 'unknown',
    itemLabel: searchParams.get('itemLabel') || undefined,
    recordCount: Number(searchParams.get('recordCount') || '0') || 0,
    visibility: searchParams.get('visibility') || undefined,
  };
  const activeDocument = document ?? fallbackDocument;

  // Fetch related records for hasMany relations
  const fetchRelatedRecords = useCallback(async (
    relationName: string,
    relation: AppDataRelation,
    recordId: string
  ) => {
    const cacheKey = `${relationName}:${recordId}`;
    
    // Already loading or loaded
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
          setRelatedRecordsCache(prev => ({
            ...prev,
            [cacheKey]: {
              records: data.data.records || [],
              total: data.data.total || 0,
              loading: false,
              expanded: true,
            },
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

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // First fetch the document metadata
        const docResponse = await fetch(`/api/data/${resolvedParams.id}`);
        if (!docResponse.ok) {
          const errorData = await docResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch document: ${docResponse.status}`);
        }
        
        const docData = await docResponse.json();
        if (docData.success && docData.data) {
          const fetchedDocument = docData.data.document;
          const fetchedRecords = docData.data.records || [];
          
          // Debug logging for schema relations
          console.log('[AppDataDetailPage] Document:', fetchedDocument?.name);
          console.log('[AppDataDetailPage] Schema:', fetchedDocument?.schema 
            ? `${Object.keys(fetchedDocument.schema.fields || {}).length} fields, ${Object.keys(fetchedDocument.schema.relations || {}).length} relations`
            : 'no schema');
          if (fetchedDocument?.schema?.relations) {
            console.log('[AppDataDetailPage] Relations:', Object.keys(fetchedDocument.schema.relations));
          }
          
          setDocument(fetchedDocument);
          setRecords(fetchedRecords);
          
          // Also fetch document list for relation lookups
          const listResponse = await fetch('/api/libraries');
          if (listResponse.ok) {
            const listData = await listResponse.json();
            if (listData.success && listData.data) {
              const lookup: DocumentLookup = {};
              // Process app data libraries
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
          
          // Check for orphan records if there are belongsTo relations
          const relations = fetchedDocument?.schema?.relations || {};
          const hasBelongsTo = Object.values(relations).some(
            (rel) => (rel as AppDataRelation).type === 'belongsTo'
          );
          
          if (hasBelongsTo && fetchedRecords.length > 0) {
            try {
              const orphanResponse = await fetch(`/api/data/${resolvedParams.id}/check-orphans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  records: fetchedRecords,
                  relations,
                }),
              });
              
              if (orphanResponse.ok) {
                const orphanData = await orphanResponse.json();
                if (orphanData.success && orphanData.data?.orphans) {
                  const orphanMap: { [recordId: string]: OrphanInfo } = {};
                  for (const orphan of orphanData.data.orphans) {
                    orphanMap[orphan.recordId] = orphan;
                  }
                  setOrphanRecords(orphanMap);
                }
              }
            } catch (orphanErr) {
              console.error('Error checking orphans:', orphanErr);
              // Non-critical error, continue without orphan info
            }
          }
        } else {
          throw new Error(docData.error || 'Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching app data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.id]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Calculate related document counts for cascade delete
  const calculateRelatedCounts = useCallback(() => {
    if (!document?.schema?.relations) return;
    
    const hasManyRelations = Object.entries(document.schema.relations).filter(
      ([, rel]) => rel.type === 'hasMany'
    );
    
    // Count records that have hasMany relations
    const counts: { name: string; count: number }[] = [];
    for (const [relationName, relation] of hasManyRelations) {
      // Sum up all related records from cache
      let totalForRelation = 0;
      for (const record of records) {
        if (!record.id) continue;
        const cacheKey = `${relationName}:${record.id}`;
        const cachedData = relatedRecordsCache[cacheKey];
        if (cachedData?.total) {
          totalForRelation += cachedData.total;
        }
      }
      if (totalForRelation > 0) {
        counts.push({ name: relation.label || relationName, count: totalForRelation });
      }
    }
    
    setRelatedDocCounts(counts);
  }, [document, records, relatedRecordsCache]);

  // Handle document delete
  const handleDeleteDocument = async (cascade: boolean) => {
    setDeleteLoading(true);
    try {
      const url = `/api/data/${resolvedParams.id}/delete${cascade ? '?cascade=true' : ''}`;
      const response = await fetch(url, { method: 'DELETE' });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete document');
      }
      
      // Navigate back to data management page
      router.push('/data');
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete document');
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  // Open delete modal and calculate related counts
  const openDeleteModal = () => {
    calculateRelatedCounts();
    setShowDeleteModal(true);
  };

  const fetchRolesData = useCallback(async () => {
    setRolesLoading(true);
    setRolesMessage(null);
    try {
      const [docRolesResponse, allRolesResponse, profileResponse] = await Promise.all([
        fetch(`/api/data/${resolvedParams.id}/roles`),
        fetch('/api/roles'),
        fetch('/api/account/profile'),
      ]);

      const docRolesData = await docRolesResponse.json().catch(() => ({}));
      const allRolesData = await allRolesResponse.json().catch(() => ({}));
      const profileData = await profileResponse.json().catch(() => ({}));

      if (docRolesResponse.ok && docRolesData.success) {
        const roleIds = Array.isArray(docRolesData.data?.roleIds) ? docRolesData.data.roleIds : [];
        const roles = Array.isArray(docRolesData.data?.roles) ? docRolesData.data.roles : [];
        setDocumentRoleIds(roleIds);
        setDocumentRoles(roles);
        setDocumentVisibility((docRolesData.data?.visibility || 'personal') as 'personal' | 'shared');
      }

      if (allRolesResponse.ok && allRolesData.success) {
        const roles = Array.isArray(allRolesData.data?.roles) ? allRolesData.data.roles : [];
        setAvailableRoles(
          roles.map((role: { id: string; name: string }) => ({ id: role.id, name: role.name }))
        );
      }

      if (profileResponse.ok && profileData.success) {
        const roleIds = Array.isArray(profileData.profile?.roles)
          ? profileData.profile.roles
              .map((role: { id?: string }) => role.id)
              .filter((id: string | undefined): id is string => Boolean(id))
          : [];
        setCurrentUserRoleIds(roleIds);
      }
    } catch (error) {
      console.error('Failed to fetch roles data:', error);
      setRolesMessage('Failed to load role assignments.');
    } finally {
      setRolesLoading(false);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    fetchRolesData();
  }, [fetchRolesData]);

  const persistRoles = async (nextRoleIds: string[], nextVisibility: 'personal' | 'shared') => {
    setRolesSaving(true);
    setRolesMessage(null);
    try {
      const response = await fetch(`/api/data/${resolvedParams.id}/roles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleIds: nextRoleIds,
          visibility: nextVisibility,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Failed to update roles (${response.status})`);
      }

      const roleIds = Array.isArray(result.data?.roleIds) ? result.data.roleIds : nextRoleIds;
      const roles = Array.isArray(result.data?.roles) ? result.data.roles : [];
      const visibility = (result.data?.visibility || nextVisibility) as 'personal' | 'shared';
      setDocumentRoleIds(roleIds);
      setDocumentRoles(roles);
      setDocumentVisibility(visibility);
      setRolesMessage('Roles and access updated.');
      setPendingDangerousChange(null);
    } catch (error) {
      console.error('Failed to update roles:', error);
      setRolesMessage(error instanceof Error ? error.message : 'Failed to update roles.');
    } finally {
      setRolesSaving(false);
    }
  };

  const wouldRemoveOwnAccess = (nextRoleIds: string[], nextVisibility: 'personal' | 'shared') => {
    if (nextVisibility !== 'shared') return false;
    if (currentUserRoleIds.length === 0) return false;
    const roleSet = new Set(nextRoleIds);
    return currentUserRoleIds.every((roleId) => !roleSet.has(roleId));
  };

  const requestRolesUpdate = async (nextRoleIds: string[], nextVisibility: 'personal' | 'shared') => {
    if (wouldRemoveOwnAccess(nextRoleIds, nextVisibility)) {
      setPendingDangerousChange({ roleIds: nextRoleIds, visibility: nextVisibility });
      setRolesMessage('Warning: this change will remove your own access to this document.');
      return;
    }
    await persistRoles(nextRoleIds, nextVisibility);
  };

  const handleAddRole = async () => {
    if (!selectedRoleId) return;
    if (documentRoleIds.includes(selectedRoleId)) return;
    const nextRoleIds = [...documentRoleIds, selectedRoleId];
    await requestRolesUpdate(nextRoleIds, 'shared');
    setSelectedRoleId('');
  };

  const handleRemoveRole = async (roleId: string) => {
    const nextRoleIds = documentRoleIds.filter((id) => id !== roleId);
    await requestRolesUpdate(nextRoleIds, documentVisibility);
  };

  const handleVisibilityChange = async (nextVisibility: 'personal' | 'shared') => {
    if (nextVisibility === documentVisibility) return;
    const nextRoleIds =
      nextVisibility === 'shared' ? documentRoleIds : [];
    await requestRolesUpdate(nextRoleIds, nextVisibility);
  };

  const handleExport = async () => {
    setExportLoading(true);
    setImportMessage(null);
    try {
      const response = await fetch(`/api/data/${resolvedParams.id}/export`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `${activeDocument.name || 'app-data'}-export.json`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Export failed:', err);
      setImportMessage(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  const parseImportPayload = (value: unknown): unknown[] => {
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === 'object' && Array.isArray((value as { records?: unknown[] }).records)) {
      return (value as { records: unknown[] }).records;
    }
    throw new Error('JSON must be an array of records or an object with a records array.');
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportMessage(null);

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const records = parseImportPayload(payload);

      if (records.length === 0) {
        throw new Error('Import file contains no records.');
      }

      const response = await fetch(`/api/data/${resolvedParams.id}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Import failed (${response.status})`);
      }

      setImportMessage(`Imported ${result.data?.imported ?? records.length} records.`);

      // Refresh records after successful import
      window.location.reload();
    } catch (err) {
      console.error('Import failed:', err);
      setImportMessage(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  if (error && !document && !isLoading) {
    return (
      <div className="min-h-full bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Data Management
          </Link>
          
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              {error || 'Document not found'}
            </h2>
            <p className="text-gray-500">
              The requested app data document could not be loaded.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Data Management
          </Link>
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <Database className="w-8 h-8 text-green-600" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {activeDocument.displayName || activeDocument.name}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    {activeDocument.sourceApp}
                  </span>
                  {activeDocument.itemLabel && (
                    <span className="flex items-center gap-1">
                      <Layers className="w-4 h-4" />
                      {activeDocument.recordCount} {activeDocument.itemLabel}s
                    </span>
                  )}
                  {activeDocument.visibility && (
                    <span className="capitalize">{activeDocument.visibility}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFile}
              />
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                {exportLoading ? 'Exporting...' : 'Export JSON'}
              </button>
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={importLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60"
              >
                <Upload className="w-4 h-4" />
                {importLoading ? 'Importing...' : 'Import Records'}
              </button>
              <button
                onClick={openDeleteModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Document
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {importMessage && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {importMessage}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Records</p>
                {isLoading && !document ? (
                  <div className="h-7 w-16 rounded bg-gray-200 animate-pulse mt-1" />
                ) : (
                  <p className="text-xl font-semibold text-gray-900">{activeDocument.recordCount}</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                {isLoading && !document ? (
                  <div className="h-5 w-32 rounded bg-gray-200 animate-pulse mt-1" />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{formatDate(activeDocument.updatedAt)}</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Source App</p>
                {isLoading && !document ? (
                  <div className="h-5 w-24 rounded bg-gray-200 animate-pulse mt-1" />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{activeDocument.sourceApp}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Roles and Access */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Roles & Access</h2>
          </div>

          {rolesMessage && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {rolesMessage}
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-gray-600">Visibility:</span>
            <button
              type="button"
              disabled={rolesSaving || rolesLoading}
              onClick={() => handleVisibilityChange('personal')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                documentVisibility === 'personal'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              disabled={rolesSaving || rolesLoading}
              onClick={() => handleVisibilityChange('shared')}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                documentVisibility === 'shared'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Shared
            </button>
          </div>

          {rolesLoading ? (
            <p className="text-sm text-gray-500">Loading roles...</p>
          ) : documentVisibility === 'shared' ? (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {documentRoles.length > 0 ? (
                  documentRoles.map((role) => (
                    <span
                      key={role.role_id}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-sm"
                    >
                      {role.role_name}
                      <button
                        type="button"
                        disabled={rolesSaving}
                        onClick={() => handleRemoveRole(role.role_id)}
                        className="text-blue-700 hover:text-blue-900"
                        title={`Remove ${role.role_name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No roles assigned yet.</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  disabled={rolesSaving}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white"
                >
                  <option value="">Select role to add</option>
                  {availableRoles
                    .filter((role) => !documentRoleIds.includes(role.id))
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddRole}
                  disabled={rolesSaving || !selectedRoleId}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Add Role
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              This document is personal. Switch to shared visibility to assign access roles.
            </p>
          )}

          {pendingDangerousChange && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
              <p className="text-sm text-red-700 mb-2">
                This change will remove your own access to this document.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    persistRoles(pendingDangerousChange.roleIds, pendingDangerousChange.visibility)
                  }
                  disabled={rolesSaving}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  Confirm Change
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingDangerousChange(null);
                    setRolesMessage(null);
                  }}
                  disabled={rolesSaving}
                  className="px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Records List */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {activeDocument.itemLabel ? `${activeDocument.itemLabel}s` : 'Records'} ({records.length})
          </h2>
          
          {isLoading && records.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="h-5 w-48 rounded bg-gray-200 animate-pulse mb-2" />
                  <div className="h-4 w-72 rounded bg-gray-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : records.length > 0 ? (
            <div className="space-y-3">
              {records.map((record, index) => {
                // Try to find a display name field
                const displayName = record.name || record.title || record.label || `Record ${index + 1}`;
                const description = record.description || record.content || record.summary;
                const status = record.status as string | undefined;
                
                // Get relations from schema
                const relations = activeDocument.schema?.relations || {};
                const belongsToRelations = Object.entries(relations).filter(
                  ([, rel]) => rel.type === 'belongsTo'
                );
                const hasManyRelations = Object.entries(relations).filter(
                  ([, rel]) => rel.type === 'hasMany'
                );
                
                // Check if this record is orphaned
                const orphanInfo = record.id ? orphanRecords[record.id] : null;
                const isOrphan = !!orphanInfo;
                
                return (
                  <div
                    key={record.id || index}
                    className={`bg-white border rounded-xl hover:border-green-300 transition-colors overflow-hidden ${
                      isOrphan ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200'
                    }`}
                  >
                    {/* Main record info - clickable link to record detail */}
                    <Link
                      href={`/data/${resolvedParams.id}/record/${record.id}`}
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 truncate">
                            {String(displayName)}
                          </h3>
                          {/* Orphan indicator */}
                          {isOrphan && (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-orange-700 bg-orange-100 rounded-full"
                              title={`Parent not found: ${orphanInfo.orphanRelations.map(r => `${r.relationName} (${r.foreignKeyValue.slice(0, 8)}...)`).join(', ')}`}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Orphan
                            </span>
                          )}
                        </div>
                        {typeof description === 'string' && description.length > 0 && (
                          <p className="text-sm text-gray-500 truncate mt-1">
                            {description.slice(0, 100)}
                          </p>
                        )}
                        
                        {/* BelongsTo relations - show as inline badges (non-clickable here) */}
                        {belongsToRelations.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {belongsToRelations.map(([relationName, relation]) => {
                              const foreignKeyValue = record[relation.foreignKey] as string | undefined;
                              if (!foreignKeyValue) return null;
                              
                              const targetDoc = documentLookup[relation.document];
                              const isOrphanRelation = orphanInfo?.orphanRelations.some(
                                r => r.relationName === relationName
                              );
                              
                              return (
                                <span
                                  key={relationName}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                                    isOrphanRelation 
                                      ? 'text-orange-600 bg-orange-100' 
                                      : 'text-green-600 bg-green-50'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                  title={isOrphanRelation ? `Parent not found: ${foreignKeyValue}` : undefined}
                                >
                                  {isOrphanRelation ? (
                                    <AlertTriangle className="w-3 h-3" />
                                  ) : (
                                    <LinkIcon className="w-3 h-3" />
                                  )}
                                  {relation.label || targetDoc?.displayName || relationName}
                                  {isOrphanRelation && ' (missing)'}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {status && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 capitalize">
                          {status.replace(/-/g, ' ')}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                    
                    {/* HasMany relations - expandable sections */}
                    {hasManyRelations.length > 0 && record.id && (
                      <div className="border-t border-gray-100 bg-gray-50/50">
                        {hasManyRelations.map(([relationName, relation]) => {
                          const cacheKey = `${relationName}:${record.id}`;
                          const cachedData = relatedRecordsCache[cacheKey];
                          const isExpanded = cachedData?.expanded;
                          const isLoading = cachedData?.loading;
                          const relatedRecords = cachedData?.records || [];
                          const total = cachedData?.total || 0;
                          
                          const targetDoc = documentLookup[relation.document];
                          
                          return (
                            <div key={relationName} className="border-b border-gray-100 last:border-b-0">
                              <button
                                onClick={() => {
                                  if (!cachedData) {
                                    fetchRelatedRecords(relationName, relation, record.id);
                                  } else {
                                    toggleRelatedRecords(cacheKey);
                                  }
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : isExpanded ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                                <List className="w-3 h-3" />
                                <span>{relation.label || relationName}</span>
                                {cachedData && !isLoading && (
                                  <span className="ml-1 text-xs text-gray-400">({total})</span>
                                )}
                              </button>
                              
                              {isExpanded && !isLoading && relatedRecords.length > 0 && (
                                <div className="px-4 pb-2 space-y-1">
                                  {relatedRecords.slice(0, 5).map((relRecord, relIndex) => {
                                    const relDisplayField = relation.displayField || 'name';
                                    const relDisplayValue = relRecord[relDisplayField] || relRecord.name || relRecord.title || `Item ${relIndex + 1}`;
                                    
                                    return (
                                      <div
                                        key={relRecord.id || relIndex}
                                        className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-white transition-colors"
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                        {targetDoc ? (
                                          <Link
                                            href={`/data/${targetDoc.id}?highlight=${relRecord.id}`}
                                            className="text-gray-700 hover:text-green-600 truncate"
                                          >
                                            {String(relDisplayValue)}
                                          </Link>
                                        ) : (
                                          <span className="text-gray-700 truncate">{String(relDisplayValue)}</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {total > 5 && targetDoc && (
                                    <Link
                                      href={`/data/${targetDoc.id}?filter=${relation.foreignKey}:${record.id}`}
                                      className="block text-xs text-green-600 hover:text-green-700 py-1 px-2"
                                    >
                                      View all {total} {relation.label || relationName}...
                                    </Link>
                                  )}
                                </div>
                              )}
                              
                              {isExpanded && !isLoading && relatedRecords.length === 0 && (
                                <div className="px-4 pb-2 text-xs text-gray-400">
                                  No {relation.label || relationName} found
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Layers className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No records yet</p>
            </div>
          )}
        </div>

        {/* Open in App Link */}
        {activeDocument.sourceApp && activeDocument.sourceApp !== 'unknown' && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              href={`/${activeDocument.sourceApp}`}
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-700"
            >
              <ExternalLink className="w-4 h-4" />
              Open in {activeDocument.sourceApp}
            </Link>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          itemName={activeDocument.displayName || activeDocument.name}
          itemType="document"
          isDocument={true}
          relatedCounts={relatedDocCounts}
          onConfirm={handleDeleteDocument}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={deleteLoading}
        />
      )}
    </div>
  );
}
