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
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Download,
  Upload,
  Shield,
  Lock,
  CheckCircle2,
  Eye
} from 'lucide-react';
import type { AppDataSchema } from '@jazzmind/busibox-app';
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

interface AdminRecordMeta {
  recordId: string;
  documentId: string;
  ownerId: string | null;
  visibility: string;
  createdAt: string | null;
  updatedAt: string | null;
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
  const [totalRecordCount, setTotalRecordCount] = useState<number>(0);
  const [accessibleRecordIds, setAccessibleRecordIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Unified record table (admin bypass metadata + pagination)
  const PAGE_SIZE = 50;
  const [adminRecords, setAdminRecords] = useState<AdminRecordMeta[]>([]);
  const [adminRecordsTotal, setAdminRecordsTotal] = useState(0);
  const [adminRecordsLoading, setAdminRecordsLoading] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [deletingRecordLoading, setDeletingRecordLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesSaving, setRolesSaving] = useState(false);
  const [documentVisibility, setDocumentVisibility] = useState<'personal' | 'shared' | 'app'>('personal');
  const [documentRoles, setDocumentRoles] = useState<DocumentRole[]>([]);
  const [documentRoleIds, setDocumentRoleIds] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AdminRole[]>([]);
  const [currentUserRoleIds, setCurrentUserRoleIds] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [rolesMessage, setRolesMessage] = useState<string | null>(null);
  const [pendingDangerousChange, setPendingDangerousChange] = useState<{
    roleIds: string[];
    visibility: 'personal' | 'shared' | 'app';
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
    name: searchParams.get('name') || 'Loading collection...',
    displayName: searchParams.get('displayName') || undefined,
    sourceApp: searchParams.get('sourceApp') || 'unknown',
    itemLabel: searchParams.get('itemLabel') || undefined,
    recordCount: Number(searchParams.get('recordCount') || '0') || 0,
    visibility: searchParams.get('visibility') || undefined,
  };
  const activeDocument = document ?? fallbackDocument;

  useEffect(() => {
    const fetchDocumentMeta = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const docResponse = await fetch(`/api/data/${resolvedParams.id}`);
        if (!docResponse.ok) {
          const errorData = await docResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch collection: ${docResponse.status}`);
        }
        
        const docData = await docResponse.json();
        if (docData.success && docData.data) {
          const fetchedDocument = docData.data.document;
          const fetchedTotalCount = docData.data.totalRecordCount ?? fetchedDocument?.recordCount ?? 0;
          const fetchedAccessibleIds: string[] = docData.data.accessibleRecordIds || [];
          
          setDocument(fetchedDocument);
          setTotalRecordCount(fetchedTotalCount);
          setAccessibleRecordIds(new Set(fetchedAccessibleIds));
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

    fetchDocumentMeta();
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


  // Handle document delete
  const handleDeleteDocument = async (cascade: boolean) => {
    setDeleteLoading(true);
    try {
      const url = `/api/data/${resolvedParams.id}/delete${cascade ? '?cascade=true' : ''}`;
      const response = await fetch(url, { method: 'DELETE' });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete collection');
      }
      
      // Navigate back to data management page
      router.push('/data');
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete collection');
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  const openDeleteModal = () => {
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

      let allRolesList: { id: string; name: string }[] = [];
      if (allRolesResponse.ok && allRolesData.success) {
        const roles = Array.isArray(allRolesData.data?.roles) ? allRolesData.data.roles : [];
        allRolesList = roles.map((role: { id: string; name: string }) => ({ id: role.id, name: role.name }));
        setAvailableRoles(allRolesList);
      }

      if (docRolesResponse.ok && docRolesData.success) {
        const roleIds = Array.isArray(docRolesData.data?.roleIds) ? docRolesData.data.roleIds : [];
        const roles = Array.isArray(docRolesData.data?.roles) ? docRolesData.data.roles : [];
        setDocumentRoleIds(roleIds);
        setDocumentRoles(roles);
        const rawVis = docRolesData.data?.visibility || 'personal';
        if (rawVis === 'shared' && roles.length > 0) {
          const allRolesMap = new Map(allRolesList.map((r) => [r.id, r.name]));
          const hasAppRole = roles.every((r: DocumentRole) => {
            const storedName = r.role_name || '';
            if (storedName.startsWith('app:')) return true;
            const resolvedName = allRolesMap.get(r.role_id) || '';
            return /^app:[^:]+$/.test(resolvedName);
          });
          setDocumentVisibility(hasAppRole ? 'app' : 'shared');
        } else if (rawVis === 'shared') {
          setDocumentVisibility('shared');
        } else {
          setDocumentVisibility('personal');
        }
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

  const persistRoles = async (nextRoleIds: string[], nextVisibility: 'personal' | 'shared' | 'app') => {
    setRolesSaving(true);
    setRolesMessage(null);
    const apiVisibility = nextVisibility === 'app' ? 'shared' : nextVisibility;
    const roleNamesMap: Record<string, string> = {};
    for (const id of nextRoleIds) {
      const match = availableRoles.find((r) => r.id === id);
      if (match) roleNamesMap[id] = match.name;
    }
    try {
      const response = await fetch(`/api/data/${resolvedParams.id}/roles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleIds: nextRoleIds,
          visibility: apiVisibility,
          roleNames: roleNamesMap,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Failed to update roles (${response.status})`);
      }

      const roleIds = Array.isArray(result.data?.roleIds) ? result.data.roleIds : nextRoleIds;
      const roles = Array.isArray(result.data?.roles) ? result.data.roles : [];
      setDocumentRoleIds(roleIds);
      setDocumentRoles(roles);
      setDocumentVisibility(nextVisibility);
      setRolesMessage('Roles and access updated.');
      setPendingDangerousChange(null);
    } catch (error) {
      console.error('Failed to update roles:', error);
      setRolesMessage(error instanceof Error ? error.message : 'Failed to update roles.');
    } finally {
      setRolesSaving(false);
    }
  };

  const wouldRemoveOwnAccess = (nextRoleIds: string[], nextVisibility: 'personal' | 'shared' | 'app') => {
    if (nextVisibility === 'personal') return false;
    if (currentUserRoleIds.length === 0) return false;
    const roleSet = new Set(nextRoleIds);
    return currentUserRoleIds.every((roleId) => !roleSet.has(roleId));
  };

  const requestRolesUpdate = async (nextRoleIds: string[], nextVisibility: 'personal' | 'shared' | 'app') => {
    if (wouldRemoveOwnAccess(nextRoleIds, nextVisibility)) {
      setPendingDangerousChange({ roleIds: nextRoleIds, visibility: nextVisibility });
      setRolesMessage('Warning: this change will remove your own access to this collection.');
      return;
    }
    await persistRoles(nextRoleIds, nextVisibility);
  };

  const handleAddRole = async () => {
    if (!selectedRoleId) return;
    if (documentRoleIds.includes(selectedRoleId)) return;
    const nextRoleIds = [...documentRoleIds, selectedRoleId];
    const vis = documentVisibility === 'personal' ? 'shared' : documentVisibility;
    await requestRolesUpdate(nextRoleIds, vis);
    setSelectedRoleId('');
  };

  const handleRemoveRole = async (roleId: string) => {
    const nextRoleIds = documentRoleIds.filter((id) => id !== roleId);
    if (nextRoleIds.length === 0) {
      await requestRolesUpdate([], 'personal');
    } else {
      await requestRolesUpdate(nextRoleIds, documentVisibility);
    }
  };

  const handleVisibilityChange = async (nextVisibility: 'personal' | 'shared' | 'app') => {
    if (nextVisibility === documentVisibility) return;
    if (nextVisibility === 'personal') {
      await requestRolesUpdate([], nextVisibility);
    } else if (nextVisibility === 'shared') {
      const orgOnlyRoles = documentRoleIds.filter((id) => {
        const role = availableRoles.find((r) => r.id === id);
        return role && !role.name.startsWith('app:');
      });
      if (orgOnlyRoles.length === 0) {
        // No org roles assigned yet — just switch UI mode so user can pick a role
        setDocumentVisibility(nextVisibility);
        setRolesMessage(null);
        return;
      }
      await requestRolesUpdate(orgOnlyRoles, nextVisibility);
    } else {
      const appOnlyRoles = documentRoleIds.filter((id) => {
        const role = availableRoles.find((r) => r.id === id);
        return role && role.name.startsWith('app:');
      });
      if (appOnlyRoles.length === 0) {
        // No app roles assigned yet — just switch UI mode so user can pick a role
        setDocumentVisibility(nextVisibility);
        setRolesMessage(null);
        return;
      }
      await requestRolesUpdate(appOnlyRoles, nextVisibility);
    }
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

  const fetchAdminRecords = useCallback(async (page: number) => {
    setAdminRecordsLoading(true);
    try {
      const offset = page * PAGE_SIZE;
      const response = await fetch(`/api/data/admin/documents/${resolvedParams.id}/records?limit=${PAGE_SIZE}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setAdminRecords(data.records || []);
        setAdminRecordsTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch admin records:', err);
    } finally {
      setAdminRecordsLoading(false);
    }
  }, [resolvedParams.id]);

  // Load admin records on mount and when page changes
  useEffect(() => {
    fetchAdminRecords(tablePage);
  }, [fetchAdminRecords, tablePage]);

  const handleAdminDeleteRecord = async (recordId: string) => {
    setDeletingRecordLoading(true);
    try {
      const response = await fetch(`/api/data/admin/documents/${resolvedParams.id}/records/${recordId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDeletingRecordId(null);
        fetchAdminRecords(tablePage);
      }
    } catch (err) {
      console.error('Failed to delete record:', err);
    } finally {
      setDeletingRecordLoading(false);
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
              {error || 'Collection not found'}
            </h2>
            <p className="text-gray-500">
              The requested data collection could not be loaded.
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
                Delete Collection
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
            {(['personal', 'shared', 'app'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={rolesSaving || rolesLoading}
                onClick={() => handleVisibilityChange(mode)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  documentVisibility === mode
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {mode === 'personal' ? 'Personal' : mode === 'shared' ? 'Shared' : 'App'}
              </button>
            ))}
          </div>

          {rolesLoading ? (
            <p className="text-sm text-gray-500">Loading roles...</p>
          ) : documentVisibility === 'shared' || documentVisibility === 'app' ? (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {documentRoles.length > 0 ? (
                  documentRoles.map((role) => {
                    const displayName =
                      role.role_name && !role.role_name.startsWith('Role-')
                        ? role.role_name
                        : availableRoles.find((r) => r.id === role.role_id)?.name || role.role_name;
                    return (
                    <span
                      key={role.role_id}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                        documentVisibility === 'app'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {displayName}
                      <button
                        type="button"
                        disabled={rolesSaving}
                        onClick={() => handleRemoveRole(role.role_id)}
                        className={documentVisibility === 'app' ? 'text-indigo-700 hover:text-indigo-900' : 'text-blue-700 hover:text-blue-900'}
                        title={`Remove ${displayName}`}
                      >
                        ×
                      </button>
                    </span>
                    );
                  })
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
                    .filter((role) => {
                      if (documentRoleIds.includes(role.id)) return false;
                      if (documentVisibility === 'app') {
                        // Only show base app roles (app:<name>), not sub-roles (app:<name>:<sub>)
                        return /^app:[^:]+$/.test(role.name);
                      }
                      return !role.name.startsWith('app:');
                    })
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

              <p className="mt-2 text-xs text-gray-500">
                {documentVisibility === 'app'
                  ? 'App visibility: only app-specific roles can access this collection. Records inherit these roles.'
                  : 'Shared visibility: organization and team roles can access this collection.'}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-600">
              This collection is personal. Switch to Shared or App visibility to assign access roles.
            </p>
          )}

          {pendingDangerousChange && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3">
              <p className="text-sm text-red-700 mb-2">
                This change will remove your own access to this collection.
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

        {/* Records Table */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {activeDocument.itemLabel ? `${activeDocument.itemLabel}s` : 'Records'} ({adminRecordsTotal})
          </h2>

          {/* Required roles for this collection */}
          {!isLoading && !rolesLoading && documentRoles.length > 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <Shield className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Required roles for data access:</p>
                <div className="flex flex-wrap gap-1.5">
                  {documentRoles.map((role) => {
                    const roleName =
                      role.role_name && !role.role_name.startsWith('Role-')
                        ? role.role_name
                        : availableRoles.find((r) => r.id === role.role_id)?.name || role.role_name;
                    const adminHasRole = currentUserRoleIds.includes(role.role_id);
                    return (
                      <span
                        key={role.role_id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          adminHasRole
                            ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                            : 'bg-gray-200 text-gray-500'
                        }`}
                        title={adminHasRole ? 'You have this role' : 'You do not have this role'}
                      >
                        {adminHasRole ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3" />
                        )}
                        {roleName}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {adminRecordsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : adminRecords.length > 0 ? (
            <>
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-12">Access</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Record ID</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Visibility</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adminRecords.map(rec => {
                      const hasAccess = accessibleRecordIds.has(rec.recordId);
                      return (
                        <tr key={rec.recordId} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5">
                            {hasAccess ? (
                              <span title="You have data access"><CheckCircle2 className="w-4 h-4 text-green-500" /></span>
                            ) : (
                              <span title="Metadata only — you lack the required role"><Lock className="w-4 h-4 text-gray-300" /></span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-600">
                            {rec.recordId.slice(0, 16)}…
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-500">
                            {rec.ownerId ? `${rec.ownerId.slice(0, 8)}…` : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              rec.visibility === 'personal'
                                ? 'bg-yellow-100 text-yellow-800'
                                : rec.visibility === 'shared'
                                ? 'bg-green-100 text-green-800'
                                : rec.visibility === 'inherit'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {rec.visibility}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">
                            {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Link
                                href={`/data/${resolvedParams.id}/record/${rec.recordId}`}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  hasAccess
                                    ? 'text-green-700 bg-green-50 hover:bg-green-100'
                                    : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                                }`}
                                title={hasAccess ? 'View full record data' : 'View metadata only'}
                              >
                                <Eye className="w-3 h-3" />
                                {hasAccess ? 'View' : 'Meta'}
                              </Link>
                              <button
                                onClick={() => setDeletingRecordId(rec.recordId)}
                                className="p-1 hover:bg-red-50 rounded transition-colors"
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {adminRecordsTotal > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    Showing {tablePage * PAGE_SIZE + 1}–{Math.min((tablePage + 1) * PAGE_SIZE, adminRecordsTotal)} of {adminRecordsTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTablePage(p => Math.max(0, p - 1))}
                      disabled={tablePage === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {tablePage + 1} of {Math.ceil(adminRecordsTotal / PAGE_SIZE)}
                    </span>
                    <button
                      onClick={() => setTablePage(p => p + 1)}
                      disabled={(tablePage + 1) * PAGE_SIZE >= adminRecordsTotal}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Layers className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No records yet</p>
            </div>
          )}
        </div>

        {/* Admin Delete Record Modal */}
        {deletingRecordId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Record</h3>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Permanently delete record <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{deletingRecordId.slice(0, 12)}...</code>?
              </p>
              <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeletingRecordId(null)}
                  disabled={deletingRecordLoading}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAdminDeleteRecord(deletingRecordId)}
                  disabled={deletingRecordLoading}
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {deletingRecordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

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
          itemType="collection"
          isDocument={true}
          relatedCounts={[]}
          onConfirm={handleDeleteDocument}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={deleteLoading}
        />
      )}
    </div>
  );
}
