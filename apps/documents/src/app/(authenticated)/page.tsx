/**
 * Document Manager Page
 * 
 * Dropbox-like document management interface with library sidebar.
 * Allows users to organize documents into libraries, upload files, 
 * track processing status, and search documents.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@jazzmind/busibox-app/components/auth/ProtectedRoute';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { Header, Footer } from '@jazzmind/busibox-app';
import type { NavigationItem, AppDataLibraryItem } from '@jazzmind/busibox-app';
import { DocumentUpload, DocumentSearchAdvanced, DocumentTagView, useIsMobile } from '@jazzmind/busibox-app';
import { LibrarySelector, LibrarySidebar } from '@jazzmind/busibox-app';
import { FolderOpen, Tag, Plus, X, List, Sparkles, Network, FileJson } from 'lucide-react';
import { AppDataList } from '@jazzmind/busibox-app/components/documents/AppDataList';
import { PortalDocumentList } from '@jazzmind/busibox-app/components/documents/PortalDocumentList';
import { KnowledgeGraph } from '@jazzmind/busibox-app/components/documents/KnowledgeGraph';
import { LibraryTriggers } from '@jazzmind/busibox-app/components/documents/LibraryTriggers';
import { CreatePersonalLibraryModal } from '@jazzmind/busibox-app/components/documents/CreatePersonalLibraryModal';
import { RenamePersonalLibraryModal } from '@jazzmind/busibox-app/components/documents/RenamePersonalLibraryModal';
import { DeleteConfirmModal } from '@jazzmind/busibox-app';

type ViewMode = 'list' | 'tags' | 'appdata' | 'graph';

const adminNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' },
  { href: '/portal/docs', label: 'Help' },
];

export default function DocumentsPage() {
  const router = useRouter();
  const session = useSession();
  const isMobile = useIsMobile();
  const [selectedLibraryId, setSelectedLibraryId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('documents:selectedLibraryId') || undefined;
    }
    return undefined;
  });
  const [selectedAppData, setSelectedAppData] = useState<AppDataLibraryItem | undefined>();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('documents:viewMode');
      return stored === 'tags' || stored === 'appdata' || stored === 'graph' ? stored : 'list';
    }
    return 'list';
  });
  const [showUpload, setShowUpload] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | undefined>(undefined);
  const [isLibraryDrawerOpen, setIsLibraryDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreateLibraryModal, setShowCreateLibraryModal] = useState(false);
  const [createLibraryLoading, setCreateLibraryLoading] = useState(false);
  const [renameLibrary, setRenameLibrary] = useState<{ id: string; name: string } | null>(null);
  const [deleteLibrary, setDeleteLibrary] = useState<{ id: string; name: string } | null>(null);
  const [deleteLibraryLoading, setDeleteLibraryLoading] = useState(false);

  // Persist library selection and view mode to sessionStorage
  const updateSelectedLibraryId = (id: string | undefined) => {
    setSelectedLibraryId(id);
    if (typeof window !== 'undefined') {
      if (id) {
        sessionStorage.setItem('documents:selectedLibraryId', id);
      } else {
        sessionStorage.removeItem('documents:selectedLibraryId');
      }
    }
  };

  const updateViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('documents:viewMode', mode);
    }
  };

  const handleSelectAppData = (item: AppDataLibraryItem) => {
    setSelectedAppData(item);
    updateSelectedLibraryId(undefined);
    updateViewMode('appdata');
  };

  const handleSelectLibrary = (libraryId: string) => {
    updateSelectedLibraryId(libraryId);
    setSelectedAppData(undefined);
    setSelectedTagFilter(undefined);
    if (viewMode === 'appdata') {
      updateViewMode('list');
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    setRefreshKey(prev => prev + 1);
  };

  const handleSelectTag = (tag: string) => {
    // Switch to list view when tag is selected
    setSelectedTagFilter(tag);
    updateViewMode('list');
  };

  const handleDocumentClick = (documentId: string) => {
    router.push(`/${documentId}`);
  };

  const handlePersonalLibraryCreated = (libraryId: string) => {
    setRefreshKey(prev => prev + 1);
    updateSelectedLibraryId(libraryId);
    setSelectedAppData(undefined);
    updateViewMode('list');
  };

  const handleRenameLibrary = () => {
    setRefreshKey(prev => prev + 1);
    if (selectedLibraryId === renameLibrary?.id) {
      updateSelectedLibraryId(undefined);
    }
    setRenameLibrary(null);
  };

  const handleDeleteLibrary = async (_cascade?: boolean) => {
    if (!deleteLibrary) return;
    setDeleteLibraryLoading(true);
    try {
      const response = await fetch(`/api/libraries/${deleteLibrary.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete library');
      }
      setRefreshKey(prev => prev + 1);
      if (selectedLibraryId === deleteLibrary.id) {
        updateSelectedLibraryId(undefined);
      }
      setDeleteLibrary(null);
    } catch (err) {
      console.error('Delete library error:', err);
      window.alert(err instanceof Error ? err.message : 'Failed to delete library');
    } finally {
      setDeleteLibraryLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Header
          session={session}
          onLogout={async () => session.redirectToPortal()}
          appsLink="/portal/home"
          accountLink="/portal/account"
          adminNavigation={adminNavigation}
        />

        <div className="flex-1 flex">
          {/* Sidebar */}
          <LibrarySidebar
            onSelectLibrary={handleSelectLibrary}
            selectedLibraryId={selectedLibraryId}
            onDocumentDropped={(targetLibraryId) => {
              handleSelectLibrary(targetLibraryId);
              setRefreshKey(prev => prev + 1);
            }}
            onSelectAppData={handleSelectAppData}
            selectedAppDataId={selectedAppData?.id}
            showAppData={true}
            onCreatePersonalLibrary={() => setShowCreateLibraryModal(true)}
            createPersonalLibraryLoading={createLibraryLoading}
            refreshTrigger={refreshKey}
            onRenamePersonalLibrary={(id, name) => setRenameLibrary({ id, name })}
            onDeletePersonalLibrary={(id, name) => setDeleteLibrary({ id, name })}
            mobileOpen={isLibraryDrawerOpen}
            onMobileOpenChange={setIsLibraryDrawerOpen}
            showMobileToggleButton={false}
          />

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
              {/* Header with Title and Action Bar */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Title */}
                  <div className="flex-shrink-0">
                    <h1 className="text-xl font-bold text-gray-900">
                      Document Manager
                    </h1>
                  </div>

                  {/* View Mode Tabs & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                    {/* View Mode Tabs */}
                    <div className="w-full sm:w-auto overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="inline-flex min-w-max items-center bg-gray-100 rounded-lg p-1">
                        <button
                        onClick={() => updateViewMode('list')}
                        className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          viewMode === 'list'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <List className="w-4 h-4 mr-1.5" />
                        Documents
                        </button>
                        <button
                        onClick={() => updateViewMode('tags')}
                        className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          viewMode === 'tags'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Tag className="w-4 h-4 mr-1.5" />
                        Tags
                        </button>
                        <button
                        onClick={() => updateViewMode('graph')}
                        className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          viewMode === 'graph'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Network className="w-4 h-4 mr-1.5" />
                        Graph
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => router.push('/schemas')}
                        className="inline-flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        <FileJson className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Schemas</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content Area - Either Upload Panel OR Document Content */}
              {showUpload ? (
                <>
                  {/* Upload Panel (mobile full-screen compact, desktop inline) */}
                  <div className={isMobile ? 'fixed inset-0 z-[60] bg-gray-50' : ''}>
                    <div className={isMobile ? 'h-full overflow-y-auto p-3' : ''}>
                      {isMobile && (
                        <div className="sticky top-0 z-10 flex justify-end pb-2">
                          <button
                            onClick={() => setShowUpload(false)}
                            className="inline-flex items-center justify-center p-2 rounded-full bg-white border border-gray-200 text-gray-700 shadow-sm"
                            aria-label="Close upload"
                            title="Close upload"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      <DocumentUpload 
                        onUploadComplete={handleUploadComplete} 
                        libraryId={selectedLibraryId}
                        compact={isMobile}
                        renderLibrarySelector={({ selectedLibraryId, onSelectLibrary, disabled }) => (
                          <LibrarySelector selectedLibraryId={selectedLibraryId} onSelectLibrary={onSelectLibrary} disabled={disabled} />
                        )}
                      />
                    </div>
                  </div>
                </>
              ) : viewMode === 'graph' ? (
                /* Knowledge Graph View */
                <KnowledgeGraph
                  onDocumentClick={handleDocumentClick}
                />
              ) : viewMode === 'appdata' && selectedAppData ? (
                /* App Data View */
                <AppDataList 
                  key={selectedAppData.id}
                  appDataItem={selectedAppData}
                  onBack={() => {
                    setSelectedAppData(undefined);
                    updateViewMode('list');
                  }}
                />
              ) : selectedLibraryId ? (
                /* Library Selected - Show Documents or Tags + Triggers */
                <div key={refreshKey} className="space-y-6">
                  {viewMode === 'list' ? (
                    <PortalDocumentList
                      libraryId={selectedLibraryId} 
                      onDocumentClick={handleDocumentClick}
                      prefilledTag={selectedTagFilter}
                      onOpenAdvanced={() => setShowAdvancedModal(true)}
                    />
                  ) : (
                    <DocumentTagView 
                      libraryId={selectedLibraryId} 
                      onSelectTag={handleSelectTag} 
                    />
                  )}
                  
                  {/* Library Triggers Panel */}
                  <LibraryTriggers
                    libraryId={selectedLibraryId}
                    libraryName=""
                    canManage={true}
                  />
                </div>
              ) : (
                /* No Library Selected - Empty State */
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a Library
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto mb-6">
                    Choose a library from the sidebar to view its documents, 
                    or use Advanced Search to find documents across all libraries.
                  </p>
                  <button
                    onClick={() => setShowAdvancedModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Advanced Search
                  </button>
                </div>
              )}
            </div>
          </main>
        </div>

        <button
          onClick={() => setIsLibraryDrawerOpen(true)}
          className={`${showUpload ? 'hidden' : 'md:hidden fixed left-4 bottom-4 z-50 inline-flex'} items-center justify-center p-3 rounded-full bg-gray-900 text-white shadow-lg hover:bg-gray-800`}
          title="Open libraries"
          aria-label="Open libraries"
        >
          <FolderOpen className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowUpload((v) => !v)}
          className={`fixed right-4 bottom-4 z-50 inline-flex items-center justify-center p-4 rounded-full text-white shadow-lg ${
            showUpload ? 'bg-gray-700 hover:bg-gray-800' : 'bg-blue-600 hover:bg-blue-700'
          }`}
          title={showUpload ? 'Close upload' : 'Upload documents'}
          aria-label={showUpload ? 'Close upload' : 'Upload documents'}
        >
          {showUpload ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </button>

        <Footer />

        <CreatePersonalLibraryModal
          isOpen={showCreateLibraryModal}
          onClose={() => setShowCreateLibraryModal(false)}
          onCreated={handlePersonalLibraryCreated}
        />

        <RenamePersonalLibraryModal
          isOpen={!!renameLibrary}
          libraryId={renameLibrary?.id ?? null}
          currentName={renameLibrary?.name ?? ''}
          onClose={() => setRenameLibrary(null)}
          onRenamed={handleRenameLibrary}
        />

        {deleteLibrary && (
          <DeleteConfirmModal
            itemName={deleteLibrary.name}
            itemType="library"
            onConfirm={handleDeleteLibrary}
            onCancel={() => setDeleteLibrary(null)}
            isDeleting={deleteLibraryLoading}
          />
        )}

        {showAdvancedModal && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdvancedModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-gray-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-900">Advanced Search</h3>
                <button
                  onClick={() => setShowAdvancedModal(false)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-600"
                  aria-label="Close advanced search"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-3 sm:p-4 overflow-auto max-h-[calc(90vh-57px)]">
                <DocumentSearchAdvanced />
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
