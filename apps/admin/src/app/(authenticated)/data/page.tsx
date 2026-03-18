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
  FileText, 
  RefreshCw,
  Plus,
  Search,
  ExternalLink,
  TrendingUp,
  Layers,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { CreateLibraryModal } from '@/components/admin/CreateLibraryModal';
import { LibraryDeleteModal } from '@jazzmind/busibox-app/components/documents/LibraryDeleteModal';

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

type DatabaseStats = {
  totalRecords: number;
  tableCount: number;
  vectorCount: number;
  indexSize: number;
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
  const initialTab =
    paramTab === 'overview' || paramTab === 'shared' || paramTab === 'app-data' || paramTab === 'tags'
      ? paramTab
      : 'overview';
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
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'shared' | 'app-data' | 'tags'>(initialTab);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [appFilter, setAppFilter] = useState(searchParams.get('app') || 'all');
  const [sortField, setSortField] = useState<'sourceApp' | 'displayName' | 'recordCount'>(initialSortField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingLibrary, setDeletingLibrary] = useState<Library | null>(null);
  const [deletingLibraryLoading, setDeletingLibraryLoading] = useState(false);

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
    if (activeTab === 'overview') {
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

      // Fetch database stats
      const dbResponse = await fetch('/api/database/stats');
      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        if (dbData.success) {
          setDatabaseStats(dbData.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
    params.set('tab', 'app-data');
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

  return (
    <div className="min-h-full bg-white">
      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Data Management</h1>
              <p className="text-gray-600 mt-1">Manage document libraries, data collections, tags, and storage</p>
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

      {/* Stats Overview Cards */}
      <section className="pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Shared Libraries Card */}
            <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FolderOpen className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-purple-600">Shared Libraries</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{sharedLibraries.length}</p>
              <p className="text-sm text-gray-500 mt-1">{formatNumber(totalSharedDocuments)} documents</p>
            </div>

            {/* App Data Card */}
            <div className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Database className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-green-600">Data Collections</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{safeAppDataLibraries.length}</p>
              <p className="text-sm text-gray-500 mt-1">{formatNumber(totalAppDataRecords)} records</p>
            </div>

            {/* Tags Card */}
            <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-xl p-5">
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
            </div>

            {/* Storage Card */}
            <div className="bg-gradient-to-br from-cyan-50 to-white border border-cyan-100 rounded-xl p-5">
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
            </div>

            {/* Database Card */}
            <div className="bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Database className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-orange-600">Vector DB</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {databaseStats ? formatNumber(databaseStats.vectorCount) : '--'}
              </p>
              <p className="text-sm text-gray-500 mt-1">embeddings indexed</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <section className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-8">
            {[
              { id: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
              { id: 'shared', label: 'Shared Libraries', icon: <FolderOpen className="w-4 h-4" /> },
              { id: 'app-data', label: 'Data Collections', icon: <Database className="w-4 h-4" /> },
              { id: 'tags', label: 'Tags', icon: <Tag className="w-4 h-4" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
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
          {(activeTab === 'shared' || activeTab === 'tags' || activeTab === 'app-data') && (
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
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
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Shared Libraries */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Shared Libraries</h2>
                      <button
                        onClick={() => setActiveTab('shared')}
                        className="text-sm text-purple-600 hover:text-purple-700 hover:underline"
                      >
                        View all
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sharedLibraries.slice(0, 6).map(lib => (
                        <Link
                          key={lib.id}
                          href={`/libraries/${lib.id}`}
                          className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                              <FolderOpen className="w-5 h-5 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">{lib.name}</h3>
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {lib.description || 'No description'}
                              </p>
                              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {lib.documentCount || 0} docs
                                </span>
                                <span>{formatBytes(lib.totalSize || 0)}</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                      {sharedLibraries.length === 0 && (
                        <div className="col-span-3 text-center py-8">
                          <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">No shared libraries yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Data Collections */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Data Collections</h2>
                      <button
                        onClick={() => setActiveTab('app-data')}
                        className="text-sm text-green-600 hover:text-green-700 hover:underline"
                      >
                        View all
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {safeAppDataLibraries.slice(0, 6).map(doc => (
                        <Link
                          key={doc.id}
                          href={`/data/${doc.id}`}
                          className="block cursor-pointer bg-white border border-gray-200 rounded-xl p-5 hover:border-green-300 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                              <Database className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 truncate">
                                {doc.displayName || doc.name}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                <span className="font-medium text-green-600">{doc.sourceApp}</span>
                                {doc.itemLabel && <span className="text-gray-400"> • {doc.itemLabel}s</span>}
                              </p>
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
                      {safeAppDataLibraries.length === 0 && (
                        <div className="col-span-3 text-center py-8">
                          <Database className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">No app data sources yet</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Popular Tags */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Popular Tags</h2>
                    <div className="flex flex-wrap gap-2">
                      {safeTags.slice(0, 20).map(tag => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100 transition-colors cursor-pointer"
                        >
                          <Tag className="w-3 h-3" />
                          {tag.name}
                          <span className="text-blue-400 text-xs">({tag.count})</span>
                        </span>
                      ))}
                      {safeTags.length === 0 && (
                        <p className="text-gray-500 text-sm">No tags yet</p>
                      )}
                    </div>
                  </div>

                  {/* Storage Overview */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Storage Usage</h2>
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Total Storage</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {storageStats ? formatBytes(storageStats.totalSize) : '--'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Used</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {storageStats ? formatBytes(storageStats.usedSize) : '--'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Files</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {storageStats ? formatNumber(storageStats.fileCount) : '--'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Buckets</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {storageStats ? formatNumber(storageStats.bucketCount) : '--'}
                          </p>
                        </div>
                      </div>
                      
                      {storageStats && storageStats.totalSize > 0 && (
                        <div className="mt-6">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-500">Usage</span>
                            <span className="font-medium text-gray-700">
                              {Math.round((storageStats.usedSize / storageStats.totalSize) * 100)}%
                            </span>
                          </div>
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all"
                              style={{ width: `${(storageStats.usedSize / storageStats.totalSize) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Shared Libraries Tab */}
              {activeTab === 'shared' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-gray-500">
                      {filteredSharedLibraries.length} shared {filteredSharedLibraries.length === 1 ? 'library' : 'libraries'}
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
                      <div
                        key={lib.id}
                        className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all"
                      >
                        <div className="p-3 bg-purple-50 rounded-xl">
                          <FolderOpen className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900">{lib.name}</h3>
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
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/libraries/${lib.id}`}
                            className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Edit library"
                          >
                            <Pencil className="w-4 h-4 text-purple-600" />
                          </Link>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingLibrary(lib); }}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete library"
                          >
                            <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {filteredSharedLibraries.length === 0 && (
                      <div className="text-center py-12">
                        <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No shared libraries found</p>
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

              {/* App Data Tab */}
              {activeTab === 'app-data' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-gray-500">
                      {filteredAppData.length} app {filteredAppData.length === 1 ? 'data source' : 'data sources'}
                    </p>
                    <div className="flex items-center gap-2">
                      <select
                        value={appFilter}
                        onChange={(e) => setAppFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
                      >
                        <option value="all">All apps</option>
                        {appFilterOptions.map((app) => (
                          <option key={app} value={app}>
                            {app}
                          </option>
                        ))}
                      </select>
                      <select
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as 'sourceApp' | 'displayName' | 'recordCount')}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white"
                      >
                        <option value="sourceApp">Sort: App Name</option>
                        <option value="displayName">Sort: Data Name</option>
                        <option value="recordCount">Sort: Record Count</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50"
                      >
                        {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedAppData.map(doc => (
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
                            <h3 className="font-medium text-gray-900 truncate">
                              {doc.displayName || doc.name}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              <span className="font-medium text-green-600">{doc.sourceApp}</span>
                              {doc.itemLabel && <span className="text-gray-400"> • {doc.itemLabel}s</span>}
                            </p>
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
                  
                  {filteredAppData.length === 0 && (
                    <div className="text-center py-12">
                      <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No app data sources found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Connect apps that store structured data to see them here
                      </p>
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
    </div>
  );
}
