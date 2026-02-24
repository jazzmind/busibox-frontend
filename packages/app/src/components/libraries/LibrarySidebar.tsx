'use client';

import React, { useEffect, useState } from 'react';
import type { LibrarySidebarItem, AppDataLibraryItem, AppDataGroup } from '../../types/library';
import { useBusiboxApi, useCrossAppApiPath, useCrossAppBasePath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';
import { useIsMobile } from '../../lib/hooks/useIsMobile';

interface LibrarySidebarProps {
  onSelectLibrary: (libraryId: string) => void;
  selectedLibraryId?: string;
  onDocumentDropped?: (libraryId: string) => void;
  onSelectAppData?: (item: AppDataLibraryItem) => void;
  selectedAppDataId?: string;
  showAppData?: boolean;
  /** Callback when user wants to create a new personal library. If provided, shows "+" button. */
  onCreatePersonalLibrary?: () => void;
  /** Whether the create action is in progress (e.g. API call). Disables the create button. */
  createPersonalLibraryLoading?: boolean;
  /** When this value changes, libraries will be re-fetched (e.g. after creating a new library). */
  refreshTrigger?: number;
  /** Callback to rename a custom personal library. If provided, shows rename option for CUSTOM libraries. */
  onRenamePersonalLibrary?: (libraryId: string, currentName: string) => void;
  /** Callback to delete a custom personal library. If provided, shows delete option for CUSTOM libraries. */
  onDeletePersonalLibrary?: (libraryId: string, libraryName: string) => void;
  /** Initial mobile drawer state when component mounts on small screens. */
  defaultMobileOpen?: boolean;
  /** Controlled mobile drawer state (optional). */
  mobileOpen?: boolean;
  /** Controlled mobile drawer state callback (optional). */
  onMobileOpenChange?: (open: boolean) => void;
  /** Show the built-in floating mobile toggle button. */
  showMobileToggleButton?: boolean;
}

export function LibrarySidebar({ 
  onSelectLibrary, 
  selectedLibraryId, 
  onDocumentDropped,
  onSelectAppData,
  selectedAppDataId,
  showAppData = true,
  onCreatePersonalLibrary,
  createPersonalLibraryLoading = false,
  refreshTrigger,
  onRenamePersonalLibrary,
  onDeletePersonalLibrary,
  defaultMobileOpen = false,
  mobileOpen: controlledMobileOpen,
  onMobileOpenChange,
  showMobileToggleButton = true,
}: LibrarySidebarProps) {
  const api = useBusiboxApi();
  const resolve = useCrossAppApiPath();
  const documentsBase = useCrossAppBasePath('documents');
  const isMobile = useIsMobile();
  const [libraries, setLibraries] = useState<LibrarySidebarItem[]>([]);
  const [appDataGroups, setAppDataGroups] = useState<AppDataGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());
  const [dragOverLibraryId, setDragOverLibraryId] = useState<string | null>(null);
  const [libraryMenuOpen, setLibraryMenuOpen] = useState<string | null>(null);
  const [internalMobileOpen, setInternalMobileOpen] = useState(defaultMobileOpen);
  const mobileOpen = controlledMobileOpen ?? internalMobileOpen;
  const setMobileOpen = (open: boolean) => {
    if (onMobileOpenChange) {
      onMobileOpenChange(open);
    } else {
      setInternalMobileOpen(open);
    }
  };

  useEffect(() => {
    loadLibraries();
    if (showAppData) {
      loadAppDataLibraries();
    }
  }, [showAppData, refreshTrigger]);

  useEffect(() => {
    if (isMobile) {
      setCollapsed(false);
    } else {
      setMobileOpen(false);
    }
  }, [isMobile]);

  const handleSelectLibrary = (libraryId: string) => {
    onSelectLibrary(libraryId);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleSelectAppDataItem = (item: AppDataLibraryItem) => {
    onSelectAppData?.(item);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const sidebarPanelClass = isMobile
    ? 'w-72 max-w-[85vw] h-full border-r border-gray-200 bg-white p-4 flex flex-col shadow-xl'
    : `${collapsed ? 'w-16' : 'w-64'} border-r border-gray-200 bg-white p-4 transition-all duration-200 flex flex-col`;

  const renderSidebarShell = (content: React.ReactNode) => {
    if (!isMobile) {
      return <div className={sidebarPanelClass}>{content}</div>;
    }

    return (
      <>
        {!mobileOpen && showMobileToggleButton && (
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden fixed left-3 top-24 z-50 p-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
            title="Open libraries"
            aria-label="Open libraries"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        )}

        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className={`relative z-10 ${sidebarPanelClass}`}>
              {content}
            </div>
          </div>
        )}
      </>
    );
  };

  async function loadLibraries() {
    try {
      setLoading(true);
      const response = await fetchServiceFirstFallbackNext({
        service: { baseUrl: undefined, path: '/libraries', init: { method: 'GET' } },
        next: { nextApiBasePath: documentsBase, path: '/api/libraries', init: { method: 'GET' } },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });
      if (!response.ok) {
        throw new Error('Failed to load libraries');
      }
      const data = await response.json();
      
      // Handle case where libraries might be undefined or null
      // API returns { success: true, data: { libraries: [...] } }
      const librariesArray = data?.data?.libraries || data?.libraries || [];
      
      const items: LibrarySidebarItem[] = librariesArray.map((lib: any) => ({
        id: lib.id,
        name: lib.name,
        isPersonal: lib.isPersonal,
        libraryType: lib.libraryType ?? lib.library_type ?? null,
        documentCount: lib._count?.documents || 0,
        role: lib.role,
        roles: lib.roles || (lib.libraryRoles ? lib.libraryRoles.map((lr: any) => lr.role) : undefined),
      }));
      
      setLibraries(items);
      
      // Auto-select personal library if none selected
      if (!selectedLibraryId && items.length > 0) {
        const personal = items.find(l => l.isPersonal);
        if (personal) {
          handleSelectLibrary(personal.id);
        } else if (items[0]) {
          // Fallback to first library if no personal library
          handleSelectLibrary(items[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load libraries:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAppDataLibraries() {
    try {
      // Use same pattern as loadLibraries - rely on consuming app's fetch wrapper for basePath
      const response = await fetchServiceFirstFallbackNext({
        service: { baseUrl: undefined, path: '/libraries/app-data', init: { method: 'GET' } },
        next: { nextApiBasePath: documentsBase, path: '/api/libraries/app-data', init: { method: 'GET' } },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });
      
      if (!response.ok) {
        // Silently fail for app data - it's optional
        console.debug('App data libraries not available');
        return;
      }
      
      const data = await response.json();
      // Handle apiSuccess wrapper: { success: true, data: { groups: [...], ... } }
      // Also handle direct response: { grouped: [...], data: [...], ... }
      const responseData = data?.data || data;
      const groups: AppDataGroup[] = responseData?.groups || responseData?.grouped || [];
      setAppDataGroups(groups);
      
      // App data groups start collapsed by default
    } catch (err) {
      console.debug('Failed to load app data libraries:', err);
      // Silently fail - app data is optional
    }
  }

  function toggleAppExpansion(sourceApp: string) {
    setExpandedApps(prev => {
      const next = new Set(prev);
      if (next.has(sourceApp)) {
        next.delete(sourceApp);
      } else {
        next.add(sourceApp);
      }
      return next;
    });
  }

  async function handleDrop(event: React.DragEvent, targetLibraryId: string) {
    event.preventDefault();
    const docId =
      event.dataTransfer.getData('application/doc-id') ||
      event.dataTransfer.getData('text/plain');

    if (!docId) {
      return;
    }

    const confirmMove = window.confirm('Move this file to the selected library? (Copy not yet supported)');
    if (!confirmMove) {
      return;
    }

    try {
      const res = await fetchServiceFirstFallbackNext({
        service: { baseUrl: undefined, path: `/documents/${docId}/move`, init: { method: 'POST' } },
        next: {
          nextApiBasePath: documentsBase,
          path: `/api/documents/${docId}/move`,
          init: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetLibraryId, action: 'move' }),
          },
        },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to move document');
      }

      // Notify parent to refresh
      onDocumentDropped?.(targetLibraryId);
    } catch (err) {
      console.error('Failed to move document', err);
      window.alert('Failed to move document. Please try again.');
    }
  }

  // Get icon for a library based on its type
  function getLibraryIcon(libraryType?: string | null) {
    switch (libraryType) {
      case 'DOCS':
        // Document/file icon
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />;
      case 'RESEARCH':
        // Magnifying glass / search icon
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />;
      case 'TASKS':
        // Checklist icon
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />;
      case 'MEDIA':
        // Image/photo icon
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />;
      case 'CUSTOM':
        // Folder icon
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />;
      default:
        // Generic folder icon
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />;
    }
  }

  // Filter libraries based on search
  const filteredLibraries = libraries.filter(lib =>
    lib.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lib.role?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate personal and shared libraries
  // Support multiple personal libraries (DOCS, RESEARCH, TASKS)
  const personalLibraries = filteredLibraries.filter(l => l.isPersonal);
  const sharedLibraries = filteredLibraries.filter(l => !l.isPersonal);
  
  // For backward compatibility, also expose the first personal library
  const personalLibrary = personalLibraries[0];

  if (loading) {
    return renderSidebarShell(
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          {!collapsed && <h2 className="text-lg font-semibold">Libraries</h2>}
        </div>
        {!collapsed && (
          <div className="flex-1">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-16 mt-4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return renderSidebarShell(
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          {!collapsed && <h2 className="text-lg font-semibold">Libraries</h2>}
        </div>
        {!collapsed && (
          <div className="text-sm text-red-500 p-4 bg-red-50 rounded-md">
            <p className="font-medium">Error loading libraries</p>
            <p className="mt-1">{error}</p>
            <button
              onClick={loadLibraries}
              className="mt-2 text-blue-600 hover:text-blue-800 underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  return renderSidebarShell(
    <div className="h-full flex flex-col">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between mb-4">
        {!collapsed && <h2 className="text-lg font-semibold">Libraries</h2>}
        {isMobile ? (
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded hover:bg-gray-100"
            title="Close libraries"
            aria-label="Close libraries"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-gray-100"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search libraries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Libraries List */}
          <div className="flex-1 overflow-y-auto">
            {/* Personal Libraries Section */}
            {personalLibraries.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Personal
                  </h3>
                  {onCreatePersonalLibrary && (
                    <button
                      onClick={onCreatePersonalLibrary}
                      disabled={createPersonalLibraryLoading}
                      className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Create new library"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}
                </div>
                <ul className="space-y-1">
                  {personalLibraries.map((library) => {
                    const isCustom = library.libraryType === 'CUSTOM';
                    const showLibraryMenu = isCustom && (onRenamePersonalLibrary || onDeletePersonalLibrary);
                    const isMenuOpen = libraryMenuOpen === library.id;
                    return (
                      <li key={library.id} className="relative group">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectLibrary(library.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectLibrary(library.id); } }}
                          onDragOver={(e) => { e.preventDefault(); setDragOverLibraryId(library.id); }}
                          onDragLeave={() => setDragOverLibraryId(null)}
                          onDrop={(e) => { setDragOverLibraryId(null); handleDrop(e, library.id); }}
                          className={`w-full text-left px-3 py-2 rounded-md transition-all cursor-pointer ${
                            dragOverLibraryId === library.id
                              ? 'bg-blue-200 text-blue-900 ring-2 ring-blue-400 ring-inset'
                              : selectedLibraryId === library.id
                              ? 'bg-blue-100 text-blue-900'
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center space-x-2 min-w-0">
                              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {getLibraryIcon(library.libraryType)}
                              </svg>
                              <span className="font-medium truncate">{library.name}</span>
                            </div>
                            {showLibraryMenu && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setLibraryMenuOpen(isMenuOpen ? null : library.id); }}
                                className="p-1 rounded hover:bg-gray-200 flex-shrink-0"
                                title="Library options"
                              >
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1 ml-6">
                            {library.documentCount} {library.documentCount === 1 ? 'document' : 'documents'}
                            {dragOverLibraryId === library.id && (
                              <span className="text-blue-600 ml-1 font-medium">Drop here</span>
                            )}
                          </div>
                        </div>
                        {isMenuOpen && showLibraryMenu && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setLibraryMenuOpen(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                              {onRenamePersonalLibrary && (
                                <button
                                  onClick={() => { onRenamePersonalLibrary(library.id, library.name); setLibraryMenuOpen(null); }}
                                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  Rename
                                </button>
                              )}
                              {onDeletePersonalLibrary && (
                                <button
                                  onClick={() => { onDeletePersonalLibrary(library.id, library.name); setLibraryMenuOpen(null); }}
                                  className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Shared Libraries Section */}
            {sharedLibraries.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Shared
                </h3>
                <ul className="space-y-1">
                  {sharedLibraries.map((library) => (
                    <li key={library.id}>
                      <button
                        onClick={() => handleSelectLibrary(library.id)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverLibraryId(library.id); }}
                        onDragLeave={() => setDragOverLibraryId(null)}
                        onDrop={(e) => { setDragOverLibraryId(null); handleDrop(e, library.id); }}
                        className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                          dragOverLibraryId === library.id
                            ? 'bg-blue-200 text-blue-900 ring-2 ring-blue-400 ring-inset'
                            : selectedLibraryId === library.id
                            ? 'bg-blue-100 text-blue-900'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="font-medium truncate">{library.name}</span>
                        </div>
                        {dragOverLibraryId === library.id ? (
                          <div className="text-xs text-blue-600 mt-1 ml-6 font-medium">Drop to move here</div>
                        ) : (
                          <>
                            {(library.roles && library.roles.length > 0) ? (
                              <div className="text-xs text-purple-600 mt-1 ml-6">
                                {library.roles.map(r => r.name).join(', ')}
                              </div>
                            ) : library.role && (
                              <div className="text-xs text-purple-600 mt-1 ml-6">
                                {library.role.name}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 ml-6">
                              {library.documentCount} {library.documentCount === 1 ? 'doc' : 'docs'}
                            </div>
                          </>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* App Data Section */}
            {showAppData && appDataGroups.length > 0 && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  App Data
                </h3>
                <ul className="space-y-1">
                  {appDataGroups.map((group) => (
                    <li key={group.sourceApp}>
                      {/* App Header */}
                      <button
                        onClick={() => toggleAppExpansion(group.sourceApp)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                          </svg>
                          <span className="font-medium text-sm capitalize">
                            {group.sourceApp.replace(/-/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            {group.totalRecords}
                          </span>
                          <svg 
                            className={`w-4 h-4 text-gray-400 transition-transform ${expandedApps.has(group.sourceApp) ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      
                      {/* App Data Documents (expanded) */}
                      {expandedApps.has(group.sourceApp) && (
                        <ul className="ml-4 mt-1 space-y-1">
                          {group.documents.map((item) => (
                            <li key={item.id}>
                              <button
                                onClick={() => handleSelectAppDataItem(item)}
                                className={`w-full text-left px-3 py-1.5 rounded-md transition-colors text-sm ${
                                  selectedAppDataId === item.id
                                    ? 'bg-purple-100 text-purple-900'
                                    : 'hover:bg-gray-100'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{item.displayName || item.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {item.recordCount}
                                  </span>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* No personal library warning */}
            {personalLibraries.length === 0 && !searchQuery && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-xs text-yellow-700">
                  Personal library not found. It should be created automatically.
                </p>
                <button
                  onClick={loadLibraries}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Refresh
                </button>
              </div>
            )}

            {/* No results */}
            {filteredLibraries.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                {searchQuery ? 'No libraries found' : 'No libraries available'}
              </div>
            )}
          </div>
        </>
      )}

      {/* Collapsed state */}
      {collapsed && (
        <div className="flex flex-col items-center space-y-4">
          {personalLibraries.map((library) => (
            <button
              key={library.id}
              onClick={() => handleSelectLibrary(library.id)}
              className={`p-2 rounded-md transition-colors ${
                selectedLibraryId === library.id
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-100'
              }`}
              title={library.name}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {getLibraryIcon(library.libraryType)}
              </svg>
            </button>
          ))}
          {sharedLibraries.map((library) => (
            <button
              key={library.id}
              onClick={() => handleSelectLibrary(library.id)}
              className={`p-2 rounded-md transition-colors ${
                selectedLibraryId === library.id
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-100'
              }`}
              title={library.name}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

