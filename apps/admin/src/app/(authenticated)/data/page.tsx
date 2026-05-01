/**
 * Data Management Page
 * 
 * Unified view for all data-related administration:
 * - Document Libraries
 * - Tags management
 * - File storage statistics
 * - Database statistics
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCustomization } from '@jazzmind/busibox-app';
import { 
  Database, 
  FolderOpen, 
  Tag, 
  HardDrive, 
  RefreshCw,
  Plus,
  Search,
  ExternalLink,
  TrendingUp,
  Layers,
  Trash2,
  Loader2,
  Shield,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { CreateLibraryModal } from '@/components/admin/CreateLibraryModal';
import { LibraryDeleteModal } from '@jazzmind/busibox-app/components/documents/LibraryDeleteModal';
import { FileStorageTab } from '@/components/admin/FileStorageTab';

type Library = {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  totalSize: number;
  createdAt: string;
  isPersonal?: boolean;
  libraryType?: string;
};

type AppDataDocument = {
  id: string;
  documentId: string;
  sourceApp: string;
  name: string;
  displayName?: string;
  itemLabel?: string;
  recordCount: number;
  visibility?: string;
  schema?: unknown;
};

type TagInfo = {
  id: string;
  name: string;
  count: number;
  color?: string;
};

type StorageStats = {
  totalSize: number;
  usedSize: number;
  fileCount: number;
  bucketCount: number;
};

type AdminDocument = {
  id: string;
  name: string;
  ownerId: string;
  visibility: string;
  sourceApp: string | null;
  displayName: string | null;
  recordCount: number;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export default function DataManagementPage() {
  const { customization } = useCustomization();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramTab = searchParams.get('tab');
  const validTabs = ['user-libraries', 'app-libraries', 'tags', 'file-storage', 'all-docs'] as const;
  type TabId = typeof validTabs[number];
  const initialTab: TabId =
    paramTab && (validTabs as readonly string[]).includes(paramTab)
      ? (paramTab as TabId)
      // Legacy 'overview' and 'shared' redirect to user-libraries
      : 'user-libraries';
  const paramSortField = searchParams.get('sort');
  const initialSortField =
    paramSortField === 'sourceApp' || paramSortField === 'displayName' || paramSortField === 'recordCount'
      ? paramSortField
      : 'sourceApp';
  const paramSortDirection = searchParams.get('dir');
  const initialSortDirection = paramSortDirection === 'desc' ? 'desc' : 'asc';

  const [libraries, setLibraries] = useState<Library[]>([]);
  const [appDataLibraries, setAppDataLibraries] = useState<AppDataDocument[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [selectedApp, setSelectedApp] = useState<string | null>(searchParams.get('sourceApp') || null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [appFilter, setAppFilter] = useState(searchParams.get('app') || 'all');
  const [sortField, setSortField] = useState<'sourceApp' | 'displayName' | 'recordCount'>(initialSortField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingLibrary, setDeletingLibrary] = useState<Library | null>(null);
  const [deletingLibraryLoading, setDeletingLibraryLoading] = useState(false);

  const [allDocuments, setAllDocuments] = useState<AdminDocument[]>([]);
  const [allDocsTotal, setAllDocsTotal] = useState(0);
  const [allDocsLoading, setAllDocsLoading] = useState(false);
  const [allDocsAppFilter, setAllDocsAppFilter] = useState('all');
  const [allDocsVisFilter, setAllDocsVisFilter] = useState('all');
  const [deletingDoc, setDeletingDoc] = useState<AdminDocument | null>(null);
  const [deletingDocLoading, setDeletingDocLoading] = useState(false);

  const handleDeleteLibrary = async (action: 'delete' | 'move', targetLibraryId?: string) => {
    if (!deletingLibrary) return;
    setDeletingLibraryLoading(true);
    try {
      const params = new URLSearchParams({ document_action: action });
      if (action === 'move' && targetLibraryId) {
        params.set('targetLibraryId', targetLibraryId);
      }
      const response = await fetch(`/api/libraries/${deletingLibrary.id}?${params}`, { method: 'DELETE' });
      if (response.ok) {
        fetchAllData();
      } else {
        console.error('Failed to delete library');
      }
    } catch (error) {
      console.error('Delete library error:', error);
    } finally {
      setDeletingLibraryLoading(false);
      setDeletingLibrary(null);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (activeTab === 'user-libraries') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', activeTab);
    }

    if (searchQuery) nextParams.set('q', searchQuery);
    else nextParams.delete('q');

    if (appFilter !== 'all') nextParams.set('app', appFilter);
    else nextParams.delete('app');

    if (sortField !== 'sourceApp') nextParams.set('sort', sortField);
    else nextParams.delete('sort');

    if (sortDirection !== 'asc') nextParams.set('dir', sortDirection);
    else nextParams.delete('dir');

    nextParams.delete('sourceApp');

    const current = searchParams.toString();
    const next = nextParams.toString();
    if (current !== next) {
      router.replace(`${pathname}${next ? `?${next}` : ''}`, { scroll: false });
    }
  }, [activeTab, appFilter, pathname, router, searchParams, searchQuery, sortDirection, sortField]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Fetch libraries (both regular and app-data)
      const libResponse = await fetch('/api/libraries');
      if (libResponse.ok) {
        const libData = await libResponse.json();
        if (libData.success) {
          setLibraries(libData.data?.libraries || []);
          setAppDataLibraries(libData.data?.appDataLibraries || []);
          console.log('[admin/data] Libraries:', libData.data?.libraries?.length, 'App data:', libData.data?.appDataLibraries?.length);
        }
      }

      // Fetch tags
      const tagResponse = await fetch('/api/tags');
      if (tagResponse.ok) {
        const tagData = await tagResponse.json();
        if (tagData.success) {
          setTags(tagData.data || []);
        }
      }

      // Fetch storage stats
      const storageResponse = await fetch('/api/storage/stats');
      if (storageResponse.ok) {
        const storageData = await storageResponse.json();
        if (storageData.success) {
          setStorageStats(storageData.data);
        }
      }

      // Pre-fetch total admin document count so the All Documents stat card
      // has a number before the user clicks into the tab.
      try {
        const allDocsResponse = await fetch('/api/data/admin/documents?limit=1');
        if (allDocsResponse.ok) {
          const result = await allDocsResponse.json();
          const docsData = result.success ? result.data : result;
          if (typeof docsData?.total === 'number') {
            setAllDocsTotal(docsData.total);
          }
        }
      } catch (err) {
        console.warn('Failed to pre-fetch admin documents total:', err);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdminDocuments = async () => {
    setAllDocsLoading(true);
    try {
      const params = new URLSearchParams();
      if (allDocsAppFilter !== 'all') params.set('sourceApp', allDocsAppFilter);
      if (allDocsVisFilter !== 'all') params.set('visibility', allDocsVisFilter);
      params.set('limit', '500');
      const response = await fetch(`/api/data/admin/documents?${params}`);
      if (response.ok) {
        const result = await response.json();
        const data = result.success ? result.data : result;
        setAllDocuments(data.documents || []);
        setAllDocsTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch admin documents:', error);
    } finally {
      setAllDocsLoading(false);
    }
  };

  const handleDeleteAdminDoc = async () => {
    if (!deletingDoc) return;
    setDeletingDocLoading(true);
    try {
      const response = await fetch(`/api/data/admin/documents/${deletingDoc.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchAdminDocuments();
      } else {
        console.error('Failed to delete document');
      }
    } catch (error) {
      console.error('Delete document error:', error);
    } finally {
      setDeletingDocLoading(false);
      setDeletingDoc(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'all-docs' && allDocuments.length === 0 && !allDocsLoading) {
      fetchAdminDocuments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'all-docs') {
      fetchAdminDocuments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDocsAppFilter, allDocsVisFilter]);

  // Ensure arrays are valid
  const safeLibraries = Array.isArray(libraries) ? libraries : [];
  const safeAppDataLibraries = Array.isArray(appDataLibraries) ? appDataLibraries : [];
  const safeTags = Array.isArray(tags) ? tags : [];

  // Filter to only shared (non-personal) libraries
  const sharedLibraries = safeLibraries.filter(lib => !lib.isPersonal);

  // Calculate totals (for shared libraries only)
  const totalSharedDocuments = sharedLibraries.reduce((sum, lib) => sum + (lib.documentCount || 0), 0);
  const totalAppDataRecords = safeAppDataLibraries.reduce((sum, doc) => sum + (doc.recordCount || 0), 0);
  
  const filteredSharedLibraries = sharedLibraries.filter(lib => 
    lib.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lib.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const appFilterOptions = Array.from(
    new Set(safeAppDataLibraries.map((doc) => doc.sourceApp).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filteredAppData = safeAppDataLibraries.filter((doc) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      doc.name?.toLowerCase().includes(query) ||
      doc.displayName?.toLowerCase().includes(query) ||
      doc.sourceApp?.toLowerCase().includes(query) ||
      doc.itemLabel?.toLowerCase().includes(query);

    const matchesApp = appFilter === 'all' || doc.sourceApp === appFilter;
    return matchesSearch && matchesApp;
  });

  const sortedAppData = [...filteredAppData].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'recordCount') {
      return ((a.recordCount || 0) - (b.recordCount || 0)) * direction;
    }

    const left = sortField === 'sourceApp' ? a.sourceApp || '' : a.displayName || a.name || '';
    const right = sortField === 'sourceApp' ? b.sourceApp || '' : b.displayName || b.name || '';
    return left.localeCompare(right) * direction;
  });

  const filteredTags = safeTags.filter(tag => 
    tag.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const buildAppDataHref = (doc: AppDataDocument) => {
    const params = new URLSearchParams();
    params.set('tab', 'app-libraries');
    if (searchQuery) params.set('q', searchQuery);
    if (appFilter !== 'all') params.set('app', appFilter);
    if (sortField !== 'sourceApp') params.set('sort', sortField);
    if (sortDirection !== 'asc') params.set('dir', sortDirection);

    params.set('name', doc.name || '');
    if (doc.displayName) params.set('displayName', doc.displayName);
    if (doc.sourceApp) params.set('sourceApp', doc.sourceApp);
    if (doc.itemLabel) params.set('itemLabel', doc.itemLabel);
    params.set('recordCount', String(doc.recordCount || 0));
    if (doc.visibility) params.set('visibility', doc.visibility);

    return `/data/${doc.id}?${params.toString()}`;
  };

  const appSummaries = (() => {
    const byApp: Record<string, { collections: number; records: number; visibilities: Set<string> }> = {};
    for (const doc of safeAppDataLibraries) {
      const app = doc.sourceApp || 'unknown';
      if (!byApp[app]) byApp[app] = { collections: 0, records: 0, visibilities: new Set() };
      byApp[app].collections++;
      byApp[app].records += doc.recordCount || 0;
      if (doc.visibility) byApp[app].visibilities.add(doc.visibility);
    }
    return Object.entries(byApp)
      .map(([app, stats]) => ({ app, ...stats }))
      .sort((a, b) => a.app.localeCompare(b.app));
  })();

  return (
    <div className="min-h-full bg-white">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Data Management</h1>
              <p className="text-gray-600 mt-1">Manage user libraries, app libraries, tags, and storage</p>
            </div>
            
            <button
              onClick={fetchAllData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats / Tab Selector Cards */}
      <section className="pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* User Libraries Card */}
            <button
              type="button"
              onClick={() => setActiveTab('user-libraries')}
              aria-pressed={activeTab === 'user-libraries'}
              className={`text-left bg-gradient-to-br from-purple-50 to-white border rounded-xl p-5 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                activeTab === 'user-libraries'
                  ? 'border-purple-500 ring-2 ring-purple-300 shadow-sm'
                  : 'border-purple-100 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FolderOpen className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-purple-600">User Libraries</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{sharedLibraries.length}</p>
              <p className="text-sm text-gray-500 mt-1">{formatNumber(totalSharedDocuments)} documents</p>
            </button>

            {/* App Libraries Card */}
            <button
              type="button"
              onClick={() => setActiveTab('app-libraries')}
              aria-pressed={activeTab === 'app-libraries'}
              className={`text-left bg-gradient-to-br from-green-50 to-white border rounded-xl p-5 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 ${
                activeTab === 'app-libraries'
                  ? 'border-green-500 ring-2 ring-green-300 shadow-sm'
                  : 'border-green-100 hover:border-green-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Database className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-green-600">App Libraries</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{safeAppDataLibraries.length}</p>
              <p className="text-sm text-gray-500 mt-1">{formatNumber(totalAppDataRecords)} records</p>
            </button>

            {/* Tags Card */}
            <button
              type="button"
              onClick={() => setActiveTab('tags')}
              aria-pressed={activeTab === 'tags'}
              className={`text-left bg-gradient-to-br from-blue-50 to-white border rounded-xl p-5 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                activeTab === 'tags'
                  ? 'border-blue-500 ring-2 ring-blue-300 shadow-sm'
                  : 'border-blue-100 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Tag className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-blue-600">Tags</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{safeTags.length}</p>
              <p className="text-sm text-gray-500 mt-1">
                {formatNumber(safeTags.reduce((sum, t) => sum + (t.count || 0), 0))} tagged items
              </p>
            </button>

            {/* File Storage Card */}
            <button
              type="button"
              onClick={() => setActiveTab('file-storage')}
              aria-pressed={activeTab === 'file-storage'}
              className={`text-left bg-gradient-to-br from-cyan-50 to-white border rounded-xl p-5 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                activeTab === 'file-storage'
                  ? 'border-cyan-500 ring-2 ring-cyan-300 shadow-sm'
                  : 'border-cyan-100 hover:border-cyan-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <HardDrive className="w-5 h-5 text-cyan-600" />
                </div>
                <span className="text-sm font-medium text-cyan-600">File Storage</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {storageStats ? formatBytes(storageStats.usedSize) : '--'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {storageStats ? formatNumber(storageStats.fileCount) : '--'} files
              </p>
            </button>

            {/* All Documents Card (replaces Vector DB — that moves to the Search page) */}
            <button
              type="button"
              onClick={() => setActiveTab('all-docs')}
              aria-pressed={activeTab === 'all-docs'}
              className={`text-left bg-gradient-to-br from-amber-50 to-white border rounded-xl p-5 transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                activeTab === 'all-docs'
                  ? 'border-amber-500 ring-2 ring-amber-300 shadow-sm'
                  : 'border-amber-100 hover:border-amber-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Shield className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-amber-600">All Documents</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(allDocsTotal)}</p>
              <p className="text-sm text-gray-500 mt-1">admin view across users</p>
            </button>
          </div>
        </div>
      </section>

      {/* Tabs (secondary text navigation, stays in sync with the stat cards) */}
      <section className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-8 overflow-x-auto">
            {[
              { id: 'user-libraries', label: 'User Libraries', icon: <FolderOpen className="w-4 h-4" /> },
              { id: 'app-libraries', label: 'App Libraries', icon: <Database className="w-4 h-4" /> },
              { id: 'tags', label: 'Tags', icon: <Tag className="w-4 h-4" /> },
              { id: 'file-storage', label: 'File Storage', icon: <HardDrive className="w-4 h-4" /> },
              { id: 'all-docs', label: 'All Documents', icon: <Shield className="w-4 h-4" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-current'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                style={activeTab === tab.id ? { color: customization.primaryColor, borderColor: customization.primaryColor } : undefined}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* Content */}
      <section className="py-8">
        <div className="max-w-6xl mx-auto px-6">
          {/* Search */}
          {(activeTab === 'user-libraries' || activeTab === 'tags' || activeTab === 'app-libraries' || activeTab === 'all-docs') && (
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab.replace('-', ' ')}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* User Libraries Tab */}
              {activeTab === 'user-libraries' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-gray-500">
                      {filteredSharedLibraries.length} user {filteredSharedLibraries.length === 1 ? 'library' : 'libraries'}
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add Library
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {filteredSharedLibraries.map(lib => (
                      <Link
                        key={lib.id}
                        href={`/libraries/${lib.id}?tab=user-libraries`}
                        className="group flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                      >
                        <div className="p-3 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors flex-shrink-0">
                          <FolderOpen className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate">{lib.name}</h3>
                          <p className="text-sm text-gray-500 truncate">
                            {lib.description || 'No description'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{lib.documentCount || 0}</p>
                          <p className="text-xs text-gray-500">documents</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatBytes(lib.totalSize || 0)}</p>
                          <p className="text-xs text-gray-500">size</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-500 transition-colors flex-shrink-0" />
                      </Link>
                    ))}
                    
                    {filteredSharedLibraries.length === 0 && (
                      <div className="text-center py-12">
                        <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No user libraries found</p>
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="text-purple-600 text-sm mt-2 hover:underline"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* File Storage Tab */}
              {activeTab === 'file-storage' && (
                <FileStorageTab storageStats={storageStats} />
              )}

              {/* App Libraries Tab */}
              {activeTab === 'app-libraries' && (
                <div>
                  {!selectedApp ? (
                    <>
                      <p className="text-sm text-gray-500 mb-6">
                        {appSummaries.length} {appSummaries.length === 1 ? 'app' : 'apps'} with {safeAppDataLibraries.length} total collections
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {appSummaries
                          .filter(s => !searchQuery || s.app.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(summary => (
                          <button
                            key={summary.app}
                            onClick={() => setSelectedApp(summary.app)}
                            className="block text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-green-300 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                                <Database className="w-5 h-5 text-green-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-gray-900">{summary.app}</h3>
                                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                                  <span>{summary.collections} {summary.collections === 1 ? 'collection' : 'collections'}</span>
                                  <span>{formatNumber(summary.records)} records</span>
                                </div>
                                <div className="flex gap-1.5 mt-3">
                                  {Array.from(summary.visibilities).map(vis => (
                                    <span key={vis} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      vis === 'personal'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : vis === 'shared'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {vis}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors mt-1" />
                            </div>
                          </button>
                        ))}
                      </div>
                      {appSummaries.length === 0 && (
                        <div className="text-center py-12">
                          <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No app libraries found</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Apps that store structured data will appear here
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-6">
                        <button
                          onClick={() => setSelectedApp(null)}
                          className="text-sm text-gray-500 hover:text-gray-700"
                        >
                          All Apps
                        </button>
                        <span className="text-gray-300">/</span>
                        <span className="text-sm font-medium text-gray-900">{selectedApp}</span>
                        <span className="text-sm text-gray-400 ml-auto">
                          {safeAppDataLibraries.filter(d => d.sourceApp === selectedApp).length} collections
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {safeAppDataLibraries
                          .filter(doc => doc.sourceApp === selectedApp)
                          .filter(doc => {
                            if (!searchQuery) return true;
                            const q = searchQuery.toLowerCase();
                            return doc.name?.toLowerCase().includes(q) || doc.displayName?.toLowerCase().includes(q);
                          })
                          .map(doc => (
                          <Link
                            key={doc.id}
                            href={buildAppDataHref(doc)}
                            className="block cursor-pointer bg-white border border-gray-200 rounded-xl p-5 hover:border-green-300 hover:shadow-md transition-all group"
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                                <Database className="w-5 h-5 text-green-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-gray-900 text-sm line-clamp-2" title={doc.displayName || doc.name}>
                                  {doc.displayName || doc.name}
                                </h3>
                                {doc.itemLabel && (
                                  <p className="text-sm text-gray-500 mt-1">{doc.itemLabel}s</p>
                                )}
                                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <Layers className="w-3 h-3" />
                                    {doc.recordCount || 0} records
                                  </span>
                                  <span className="capitalize">{doc.visibility || 'private'}</span>
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tags Tab */}
              {activeTab === 'tags' && (
                <div>
                  <p className="text-sm text-gray-500 mb-6">
                    {filteredTags.length} {filteredTags.length === 1 ? 'tag' : 'tags'}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredTags.map(tag => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                      >
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Tag className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900">{tag.name}</h3>
                          <p className="text-sm text-gray-500">{tag.count} items</p>
                        </div>
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                  
                  {filteredTags.length === 0 && (
                    <div className="text-center py-12">
                      <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No tags found</p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-purple-600 text-sm mt-2 hover:underline"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* All Documents Tab (Admin) */}
              {activeTab === 'all-docs' && (
                <div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Admin View</p>
                        <p className="text-sm text-amber-700 mt-1">
                          This view shows all data documents across all users, bypassing normal access controls.
                          Only document metadata is visible — record contents are never exposed.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-gray-500">
                      {allDocsTotal} total {allDocsTotal === 1 ? 'document' : 'documents'}
                    </p>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const apps = Array.from(new Set(allDocuments.map(d => d.sourceApp).filter(Boolean))) as string[];
                        return (
                          <select
                            value={allDocsAppFilter}
                            onChange={(e) => setAllDocsAppFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
                          >
                            <option value="all">All apps</option>
                            {apps.sort().map(app => (
                              <option key={app} value={app}>{app}</option>
                            ))}
                          </select>
                        );
                      })()}
                      <select
                        value={allDocsVisFilter}
                        onChange={(e) => setAllDocsVisFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
                      >
                        <option value="all">All visibility</option>
                        <option value="personal">Personal</option>
                        <option value="shared">Shared</option>
                        <option value="authenticated">Authenticated</option>
                      </select>
                      <button
                        onClick={fetchAdminDocuments}
                        disabled={allDocsLoading}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                      >
                        <RefreshCw className={`w-4 h-4 ${allDocsLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {allDocsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source App</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {allDocuments
                            .filter(doc => {
                              if (!searchQuery) return true;
                              const q = searchQuery.toLowerCase();
                              return (
                                doc.name?.toLowerCase().includes(q) ||
                                doc.displayName?.toLowerCase().includes(q) ||
                                doc.sourceApp?.toLowerCase().includes(q) ||
                                doc.ownerId?.toLowerCase().includes(q)
                              );
                            })
                            .map(doc => (
                            <tr key={doc.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="text-sm font-medium text-gray-900 max-w-[300px] break-words" title={doc.displayName || doc.name}>
                                    {doc.displayName || doc.name}
                                  </p>
                                  {doc.displayName && doc.name !== doc.displayName && (
                                    <p className="text-xs text-gray-400 max-w-[300px] break-words">{doc.name}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-600">{doc.sourceApp || '—'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  doc.visibility === 'personal'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : doc.visibility === 'shared'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {doc.visibility}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-gray-500 font-mono">{doc.ownerId.slice(0, 8)}...</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm text-gray-900">{formatNumber(doc.recordCount)}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-500">
                                  {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => setDeletingDoc(doc)}
                                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete document"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {allDocuments.length === 0 && (
                        <div className="text-center py-12">
                          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No documents found</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Create Library Modal */}
      <CreateLibraryModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          fetchAllData();
        }}
      />

      {/* Delete Library Modal */}
      {deletingLibrary && (
        <LibraryDeleteModal
          libraryId={deletingLibrary.id}
          libraryName={deletingLibrary.name}
          documentCount={deletingLibrary.documentCount}
          onConfirm={handleDeleteLibrary}
          onCancel={() => setDeletingLibrary(null)}
          isDeleting={deletingLibraryLoading}
          librariesApiPath="/api/libraries"
        />
      )}

      {/* Admin Delete Document Modal */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Document</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Permanently delete <strong>{deletingDoc.displayName || deletingDoc.name}</strong>?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This will remove the document and its {formatNumber(deletingDoc.recordCount)} records.
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingDoc(null)}
                disabled={deletingDocLoading}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAdminDoc}
                disabled={deletingDocLoading}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deletingDocLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
