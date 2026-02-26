'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Download, Trash2, RefreshCw, ChevronDown, X,
  Clock, FileText, Database, Calendar, Hash,
  Layers, Eye, FolderOpen, Check, Loader2, Image as ImageIcon, Film, Wand2, SplitSquareVertical
} from 'lucide-react';
import { Button } from '@jazzmind/busibox-app';
import { HtmlViewer, ProcessingHistoryModal, ChunksBrowser } from '@jazzmind/busibox-app';
import { DocumentTagsAndGraphSection } from '@jazzmind/busibox-app/components/documents/DocumentTagsAndGraphSection';
import { ExtractionSplitView } from '@jazzmind/busibox-app/components/documents/ExtractionSplitView';
import { CodeViewer } from '@jazzmind/busibox-app/components/documents/CodeViewer';
import { ProtectedRoute } from '@jazzmind/busibox-app/components/auth/ProtectedRoute';
import { useSession } from '@jazzmind/busibox-app/components/auth/SessionProvider';
import { Header, Footer } from '@jazzmind/busibox-app';
import type { NavigationItem } from '@jazzmind/busibox-app';

// Polling intervals (in ms)
const POLL_INTERVAL_FAST = 2000;    // When status recently changed
const POLL_INTERVAL_SLOW = 10000;   // When status hasn't changed for a while
const BACKOFF_THRESHOLD = 3;        // Number of unchanged polls before backing off

interface ProcessingStrategy {
  strategy: string;
  success: boolean;
  textLength?: number;
  chunkCount?: number;
  embeddingCount?: number;
  visualEmbeddingCount?: number;
  processingTimeSeconds?: number;
  errorMessage?: string;
  metadata?: any;
  attemptedAt?: string;
}

interface DocumentMetadata {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  embeddingCount: number;
  visualEmbeddingCount?: number;
  visibility?: 'personal' | 'shared';
  libraryId?: string | null;
  extractedKeywords?: string[];
  status: {
    stage: string;
    message?: string;
  };
  metadata: {
    page_count?: number;
    word_count?: number;
    char_count?: number;
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    created_date?: string;
    modified_date?: string;
    language?: string;
    [key: string]: any;
  };
  processingStrategies: ProcessingStrategy[];
  detectedLanguages: string[] | null;
  classificationConfidence: number | null;
  processingDurationSeconds: number | null;
  extractedDate: string | null;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

interface Library {
  id: string;
  name: string;
  isPersonal: boolean;
  documentCount?: number;
}

interface ExtractionSchemaDocument {
  id: string;
  name: string;
}

const adminNavigation: NavigationItem[] = [
  { href: '/admin', label: 'Admin Dashboard' },
  { href: '/portal/docs', label: 'Help' },
];

export default function DocumentDetailsPage({
  params,
}: {
  params: Promise<{ fileId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const session = useSession();
  const [document, setDocument] = useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProcessingHistory, setShowProcessingHistory] = useState(false);
  const [showChunksBrowser, setShowChunksBrowser] = useState(false);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [movingTo, setMovingTo] = useState<string | null>(null);
  const moveMenuRef = useRef<HTMLDivElement>(null);
  const [schemas, setSchemas] = useState<ExtractionSchemaDocument[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [generatingSchema, setGeneratingSchema] = useState(false);
  const [showSplitView, setShowSplitView] = useState(false);
  const [splitRefreshKey, setSplitRefreshKey] = useState(0);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [schemasError, setSchemasError] = useState<string | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);
  const reprocessDropdownRef = useRef<HTMLDivElement>(null);
  
  // Polling backoff state
  const lastStatusRef = useRef<string | null>(null);
  const unchangedCountRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track graph refresh - increments when processing completes to trigger re-fetch
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);
  const prevProcessingRef = useRef<boolean | null>(null);

  const isProcessing = Boolean(document?.status?.stage && 
    !['completed', 'failed'].includes(document.status.stage));
  const triggerStatus = document?.metadata?.triggerStatus as
    | {
        state?: 'pending' | 'running' | 'completed' | 'failed';
        queuedAt?: string;
        startedAt?: string;
        completedAt?: string;
        triggerCount?: number;
        completedCount?: number;
        failedCount?: number;
        error?: string;
      }
    | undefined;
  const isTriggerActive =
    triggerStatus?.state === 'pending' || triggerStatus?.state === 'running';
  const isProcessingOrTriggering = isProcessing || isTriggerActive;
  const extractionMetadata = document?.metadata?.extraction;
  const extractedSchemaId = extractionMetadata?.schemaDocumentId as string | undefined;
  const extractedRecordCount = Number(extractionMetadata?.recordCount ?? 0);
  const hasExtractedEntities =
    extractedRecordCount > 0 ||
    (Array.isArray(extractionMetadata?.records) && extractionMetadata.records.length > 0);

  const fetchDocument = useCallback(async (quiet = false) => {
    try {
      const headers: Record<string, string> = {};
      // Suppress verbose logs on polling requests
      if (quiet) {
        headers['X-Quiet-Logs'] = '1';
      }
      
      const response = await fetch(`/documents/api/documents/${resolvedParams.fileId}/status`, { headers });
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      const result = await response.json();
      const data = result.data || result;
      
      const documentData: DocumentMetadata = {
        ...data,
        metadata: data.metadata || {},
        processingStrategies: data.processingStrategies || [],
        detectedLanguages: data.detectedLanguages || null,
        classificationConfidence: data.classificationConfidence || null,
        processingDurationSeconds: data.processingDurationSeconds || null,
        extractedDate: data.extractedDate || null,
        contentHash: data.contentHash || '',
      };
      
      // Track status changes for backoff logic
      const currentStatus = `${documentData.status?.stage}:${documentData.status?.message}`;
      if (lastStatusRef.current === currentStatus) {
        unchangedCountRef.current++;
      } else {
        unchangedCountRef.current = 0;
        lastStatusRef.current = currentStatus;
      }
      
      setDocument(documentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.fileId]);

  useEffect(() => {
    fetchDocument(false); // Initial fetch with full logging
  }, [fetchDocument]);

  // Refresh graph entities when processing completes
  useEffect(() => {
    if (prevProcessingRef.current === true && !isProcessingOrTriggering) {
      // Transitioned from processing -> completed/failed: refresh graph
      setGraphRefreshKey((k) => k + 1);
    }
    prevProcessingRef.current = isProcessingOrTriggering;
  }, [isProcessingOrTriggering]);

  // Poll for updates if document is still processing (with backoff)
  useEffect(() => {
    if (!isProcessingOrTriggering) {
      // Clear any existing interval when processing completes
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }
    
    const schedulePoll = () => {
      // Use slower interval if status hasn't changed recently
      const interval = unchangedCountRef.current >= BACKOFF_THRESHOLD 
        ? POLL_INTERVAL_SLOW 
        : POLL_INTERVAL_FAST;
      
      pollIntervalRef.current = setTimeout(async () => {
        await fetchDocument(true); // Polling with quiet logging
        schedulePoll(); // Schedule next poll
      }, interval);
    };
    
    schedulePoll();
    
    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isProcessingOrTriggering, fetchDocument]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await fetch(`/api/documents/${resolvedParams.fileId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete document');
      router.push('/');
    } catch (err) {
      alert('Failed to delete document');
    }
  };

  const handleDownload = (format?: string) => {
    if (format) {
      window.open(`/api/documents/${resolvedParams.fileId}/export?format=${format}`, '_blank');
    } else {
      window.open(`/api/documents/${resolvedParams.fileId}/download`, '_blank');
    }
  };

  const handleReprocess = async (startStage?: string) => {
    const stageName = startStage ? `from ${startStage}` : 'from beginning';
    if (!confirm(`Reprocess this document ${stageName}?`)) return;
    
    try {
      const response = await fetch(`/documents/api/documents/${resolvedParams.fileId}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: startStage ? JSON.stringify({ start_stage: startStage }) : undefined,
      });
      if (!response.ok) throw new Error('Failed to reprocess document');
      
      // Immediately update UI to show queued status
      setDocument(prev => prev ? {
        ...prev,
        status: { stage: 'queued', message: `Reprocessing ${stageName}` },
        chunkCount: startStage && !['parsing', 'chunking'].includes(startStage) ? prev.chunkCount : 0,
        embeddingCount: startStage && startStage === 'indexing' ? prev.embeddingCount : 0,
      } : null);
      
      // Then fetch actual status after a brief delay
      setTimeout(fetchDocument, 1000);
    } catch (err) {
      alert('Failed to start reprocessing');
    }
  };

  // Fetch libraries for the move-to-library feature
  useEffect(() => {
    async function fetchLibraries() {
      try {
        const bp = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const response = await fetch(`${bp}/api/libraries`);
        if (!response.ok) return;
        const result = await response.json();
        const libs = result?.data?.libraries || result?.libraries || [];
        setLibraries(libs.map((lib: any) => ({
          id: lib.id,
          name: lib.name,
          isPersonal: lib.isPersonal,
          documentCount: lib._count?.documents || lib.documentCount || 0,
        })));
      } catch {
        // Silently fail - library features will just not appear
      }
    }
    fetchLibraries();
  }, []);

  const fetchSchemas = useCallback(async (preferredId?: string) => {
    setSchemasLoading(true);
    setSchemasError(null);
    try {
      const bp = process.env.NEXT_PUBLIC_BASE_PATH || '';
      const response = await fetch(`${bp}/api/data?type=extraction_schema&limit=100`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to load schemas (${response.status})`);
      }
      const payload = await response.json();
      const docs = payload.documents || [];
      const mapped = docs.map((d: any) => ({ id: d.id, name: d.name }));
      setSchemas(mapped);
      setSelectedSchemaId((current) => {
        if (preferredId && mapped.some((item: ExtractionSchemaDocument) => item.id === preferredId)) {
          return preferredId;
        }
        if (current && mapped.some((item: ExtractionSchemaDocument) => item.id === current)) {
          return current;
        }
        return mapped.length > 0 ? mapped[0].id : '';
      });
    } catch (err: any) {
      console.error('[fetchSchemas] Failed to load extraction schemas:', err);
      setSchemasError(err?.message || 'Failed to load schemas');
    } finally {
      setSchemasLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchemas();
  }, [fetchSchemas]);

  // If the document already has an applied extraction schema in metadata,
  // prefer that schema selection so split view opens with the correct records.
  useEffect(() => {
    const preferredSchemaId = extractedSchemaId;
    if (preferredSchemaId) {
      fetchSchemas(preferredSchemaId);
    }
  }, [extractedSchemaId, fetchSchemas]);

  // Default to split view only when extraction records actually exist.
  // This keeps newly uploaded/in-progress documents on the normal viewer with processing indicators.
  useEffect(() => {
    if (hasExtractedEntities && extractedSchemaId) {
      setShowSplitView(true);
    }
  }, [hasExtractedEntities, extractedSchemaId]);

  // Close move menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moveMenuRef.current && !moveMenuRef.current.contains(event.target as Node)) {
        setShowMoveMenu(false);
      }
    }
    if (showMoveMenu) {
      const doc = globalThis.document;
      if (!doc) return;
      doc.addEventListener('mousedown', handleClickOutside);
      return () => doc.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoveMenu]);

  // Close download/reprocess dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target as Node)) {
        setDownloadOpen(false);
      }
      if (reprocessDropdownRef.current && !reprocessDropdownRef.current.contains(event.target as Node)) {
        setReprocessOpen(false);
      }
    }
    if (downloadOpen || reprocessOpen) {
      const doc = globalThis.document;
      if (!doc) return;
      doc.addEventListener('mousedown', handleClickOutside);
      return () => doc.removeEventListener('mousedown', handleClickOutside);
    }
  }, [downloadOpen, reprocessOpen]);

  const handleMoveToLibrary = async (targetLibraryId: string) => {
    setMovingTo(targetLibraryId);
    try {
      const response = await fetch(`/documents/api/documents/${resolvedParams.fileId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLibraryId, action: 'move' }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Failed to move document');
      }
      // Update document visibility locally based on target library
      const targetLib = libraries.find(l => l.id === targetLibraryId);
      if (targetLib) {
        setDocument(prev => prev ? {
          ...prev,
          visibility: targetLib.isPersonal ? 'personal' : 'shared',
        } : null);
      }
      setShowMoveMenu(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to move document');
    } finally {
      setMovingTo(null);
    }
  };

  const handleGenerateSchema = async () => {
    if (!document) return;
    setGeneratingSchema(true);
    try {
      // Step 1: Call the schema-builder agent to analyze the document
      const agentResponse = await fetch(`/documents/api/documents/${resolvedParams.fileId}/generate-schema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!agentResponse.ok) {
        const errData = await agentResponse.json().catch(() => ({}));
        throw new Error(errData.error || errData.rawOutput || 'Schema generation failed');
      }

      const agentResult = await agentResponse.json();
      if (!agentResult.success || !agentResult.schema) {
        throw new Error(agentResult.error || 'Agent did not return a valid schema');
      }

      // Use the agent-provided schema name (based on document type, not title)
      const schemaName = agentResult.schemaName || 'Extraction Schema';

      // Step 2: Save the agent-generated schema as a data document
      const response = await fetch('/documents/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: schemaName,
          visibility: 'personal',
          metadata: {
            type: 'extraction_schema',
            sourceFileId: resolvedParams.fileId,
            sourceFileName: document.filename,
          },
          schema: agentResult.schema,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to save generated schema');
      }

      const created = await response.json();
      const createdId = created?.id as string | undefined;
      await fetchSchemas(createdId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate schema');
    } finally {
      setGeneratingSchema(false);
    }
  };

  const handleApplySchema = async () => {
    if (!selectedSchemaId) {
      alert('Select a schema first');
      return;
    }
    setExtracting(true);
    try {
      const response = await fetch(`/documents/api/documents/${resolvedParams.fileId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemaDocumentId: selectedSchemaId, storeResults: true }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Extraction failed');
      }
      setShowSplitView(true);
      setSplitRefreshKey((k) => k + 1);
      setGraphRefreshKey((k) => k + 1);
      await fetchDocument(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSeedingDefaults(true);
    try {
      const response = await fetch('/documents/api/data/seed-default-schemas', { method: 'POST' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to seed default schemas');
      }
      await fetchSchemas();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to seed default schemas');
    } finally {
      setSeedingDefaults(false);
    }
  };

  // Find the library this document is currently in
  const currentLibrary = (() => {
    if (!document) return null;
    // Match by libraryId if available (most accurate)
    if (document.libraryId) {
      return libraries.find(l => l.id === document.libraryId) || null;
    }
    // Fallback: match by visibility
    if (document.visibility === 'personal') {
      return libraries.find(l => l.isPersonal) || null;
    }
    return null;
  })();

  const libraryDisplayName = currentLibrary?.name || 
    (document?.visibility === 'shared' ? 'Shared Library' : 'Personal Documents');

  if (loading) {
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
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading document...</p>
            </div>
          </div>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !document) {
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
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-semibold text-center mb-2">Error Loading Document</h2>
                <p className="text-gray-600 text-center mb-4">{error || 'Document not found'}</p>
                <Button onClick={() => router.push('/')} className="w-full">
                  Back to Documents
                </Button>
            </div>
          </div>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  }

  const isMediaFile = document?.mimeType?.startsWith('image/') || document?.mimeType?.startsWith('video/') || document?.mimeType?.startsWith('audio/');
  const CODE_MIME_TYPES = new Set([
    'application/json', 'text/csv', 'text/plain', 'application/xml', 'text/xml',
    'application/javascript', 'text/javascript', 'text/css', 'text/yaml', 'application/x-yaml',
  ]);
  const codeExtensions = new Set(['json', 'csv', 'xml', 'yaml', 'yml', 'js', 'ts', 'py', 'sh', 'sql', 'css', 'html']);
  const fileExt = document?.filename?.split('.').pop()?.toLowerCase() ?? '';
  const isCodeFile = CODE_MIME_TYPES.has(document?.mimeType ?? '') || codeExtensions.has(fileExt);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const mediaUrl = `${basePath}/api/media/${resolvedParams.fileId}`;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
  };

  // If showing chunks browser, render that instead
  if (showChunksBrowser) {
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
          <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChunksBrowser(false)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Document View
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              Chunks: {document.metadata?.title || document.filename}
            </h1>
            <ChunksBrowser fileId={resolvedParams.fileId} totalChunks={document.chunkCount} />
          </div>
          <Footer />
        </div>
      </ProtectedRoute>
    );
  }

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
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Documents
          </Button>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 break-words">
                {document.metadata?.title || document.filename}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  document.status?.stage === 'completed' 
                    ? 'bg-green-100 text-green-800'
                    : document.status?.stage === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {document.status?.stage || 'completed'}
                </span>
                {triggerStatus?.state === 'pending' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Trigger queued
                  </span>
                )}
                {triggerStatus?.state === 'running' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Trigger running
                  </span>
                )}
                {triggerStatus?.state === 'failed' && (
                  <span
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"
                    title={triggerStatus.error || 'Trigger execution failed'}
                  >
                    Trigger failed
                  </span>
                )}
                <span>{formatFileSize(document.sizeBytes)}</span>

                {/* Library location with move popover */}
                {libraries.length > 0 && (
                  <div className="relative" ref={moveMenuRef}>
                    <button
                      onClick={() => setShowMoveMenu(!showMoveMenu)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors border border-gray-200"
                      title="Click to move document to a different library"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{libraryDisplayName}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${showMoveMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showMoveMenu && (
                      <div className="absolute left-0 top-full mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-20 py-1">
                        <div className="px-3 py-2 border-b border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Move to library</p>
                        </div>
                        
                        {/* Personal libraries */}
                        {libraries.filter(l => l.isPersonal).length > 0 && (
                          <div className="py-1">
                            <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Personal</p>
                            {libraries.filter(l => l.isPersonal).map(lib => (
                              <button
                                key={lib.id}
                                onClick={() => handleMoveToLibrary(lib.id)}
                                disabled={movingTo !== null}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                  currentLibrary?.id === lib.id 
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-700 hover:bg-gray-50'
                                } ${movingTo !== null ? 'opacity-50' : ''}`}
                              >
                                {movingTo === lib.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : currentLibrary?.id === lib.id ? (
                                  <Check className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <FolderOpen className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="flex-1 truncate">{lib.name}</span>
                                {currentLibrary?.id === lib.id && (
                                  <span className="text-[10px] text-blue-500 font-medium">Current</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Shared libraries */}
                        {libraries.filter(l => !l.isPersonal).length > 0 && (
                          <div className="py-1 border-t border-gray-100">
                            <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Shared</p>
                            {libraries.filter(l => !l.isPersonal).map(lib => (
                              <button
                                key={lib.id}
                                onClick={() => handleMoveToLibrary(lib.id)}
                                disabled={movingTo !== null}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                  movingTo !== null ? 'opacity-50' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                              >
                                {movingTo === lib.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <FolderOpen className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="flex-1 truncate">{lib.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-auto">
              <div className="flex flex-wrap items-center gap-2">
              {!isMediaFile && (
                <Button variant="secondary" size="sm" onClick={() => setShowSchemaModal(true)}>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Extract
                </Button>
              )}
              {!isMediaFile && (
                <Button variant="secondary" size="sm" onClick={() => setShowProcessingHistory(true)}>
                  <Clock className="w-4 h-4 mr-2" />
                  History
                </Button>
              )}
              
              {isMediaFile ? (
                <Button variant="secondary" size="sm" onClick={() => handleDownload()}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              ) : (
                <div className="relative" ref={downloadDropdownRef}>
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-sm cursor-pointer"
                    onClick={() => { setDownloadOpen(prev => !prev); setReprocessOpen(false); }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                    <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${downloadOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {downloadOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg z-10 overflow-hidden">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleDownload(); setDownloadOpen(false); }}
                      >
                        Original File
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleDownload('markdown'); setDownloadOpen(false); }}
                      >
                        Markdown (.md)
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleDownload('html'); setDownloadOpen(false); }}
                      >
                        HTML (.html)
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleDownload('text'); setDownloadOpen(false); }}
                      >
                        Plain Text (.txt)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!isMediaFile && (
                <div className="relative" ref={reprocessDropdownRef}>
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 shadow-sm cursor-pointer"
                    onClick={() => { setReprocessOpen(prev => !prev); setDownloadOpen(false); }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reprocess
                    <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${reprocessOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {reprocessOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-md border border-gray-200 bg-white shadow-lg z-10 overflow-hidden">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleReprocess(); setReprocessOpen(false); }}
                      >
                        <span className="font-medium">Full Reprocess</span>
                        <span className="text-xs text-gray-500 ml-2">From beginning</span>
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleReprocess('parsing'); setReprocessOpen(false); }}
                      >
                        Re-parse Document <span className="text-xs text-gray-500 ml-2">Extract text again</span>
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleReprocess('chunking'); setReprocessOpen(false); }}
                      >
                        Re-chunk <span className="text-xs text-gray-500 ml-2">Split into chunks</span>
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleReprocess('cleanup'); setReprocessOpen(false); }}
                      >
                        Re-run Cleanup <span className="text-xs text-gray-500 ml-2">LLM text cleanup</span>
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleReprocess('markdown'); setReprocessOpen(false); }}
                      >
                        Regenerate Markdown <span className="text-xs text-gray-500 ml-2">HTML view</span>
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleReprocess('embedding'); setReprocessOpen(false); }}
                      >
                        Re-embed <span className="text-xs text-gray-500 ml-2">Generate embeddings</span>
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        onClick={() => { handleReprocess('indexing'); setReprocessOpen(false); }}
                      >
                        Re-index <span className="text-xs text-gray-500 ml-2">Update Milvus</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar - Horizontal at top */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            {!isMediaFile && (
              <>
                {/* Pages */}
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Pages:</span>
                  <span className="font-medium">{document.metadata?.page_count || 'N/A'}</span>
                </div>

                {/* Chunks with View button */}
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Chunks:</span>
                  <span className="font-medium">{document.chunkCount}</span>
                  {document.chunkCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 px-2 text-xs"
                      onClick={() => setShowChunksBrowser(true)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                  )}
                </div>

                {/* Words */}
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Words:</span>
                  <span className="font-medium">{document.metadata?.word_count?.toLocaleString() || 'N/A'}</span>
                </div>

                {/* Processing Time */}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Processing:</span>
                  <span className="font-medium">{formatDuration(document.processingDurationSeconds)}</span>
                </div>
              </>
            )}

              {/* File Type */}
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">{document.mimeType}</span>
              </div>

              {/* File Size */}
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Size:</span>
                <span className="font-medium">{formatFileSize(document.sizeBytes)}</span>
              </div>

              {/* Uploaded */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Uploaded:</span>
                <span className="font-medium">{new Date(document.createdAt).toLocaleDateString()}</span>
              </div>
          </div>
          {!isMediaFile && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <DocumentTagsAndGraphSection
                fileId={resolvedParams.fileId}
                extractedKeywords={document.extractedKeywords || []}
                onTagsUpdated={(keywords) => setDocument((d) => d ? { ...d, extractedKeywords: keywords } : null)}
                refreshKey={graphRefreshKey}
                mode="full"
              />
            </div>
          )}
        </div>

        {/* Schema Extraction Modal */}
        {!isMediaFile && showSchemaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSchemaModal(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Extract Structured Data</h3>
                <button onClick={() => setShowSchemaModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Use an extraction schema to pull structured records from this document.
                Fields can be indexed for keyword search, semantic search, or added to the knowledge graph.
              </p>
              <div className="space-y-4">
                {schemasError && (
                  <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-sm text-red-700">{schemasError}</p>
                    <button onClick={() => fetchSchemas()} className="text-xs text-red-600 underline mt-1">Retry</button>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Extraction Schema</label>
                  {schemasLoading ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading schemas...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedSchemaId}
                        onChange={(e) => setSelectedSchemaId(e.target.value)}
                        className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                      >
                        <option value="">
                          {schemas.length === 0 ? 'No schemas available' : 'Select schema...'}
                        </option>
                        {schemas.map((schema) => (
                          <option key={schema.id} value={schema.id}>
                            {schema.name}
                          </option>
                        ))}
                      </select>
                      <Button variant="secondary" size="sm" onClick={handleGenerateSchema} disabled={generatingSchema}>
                        <Wand2 className="w-4 h-4 mr-2" />
                        {generatingSchema ? 'Generating...' : 'Auto-Generate'}
                      </Button>
                    </div>
                  )}
                </div>
                {schemas.length === 0 && !schemasLoading && !schemasError && (
                  <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-3">
                    <p className="text-sm text-blue-800 mb-2">No extraction schemas found. You can:</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={handleSeedDefaults} disabled={seedingDefaults}>
                        <Database className="w-4 h-4 mr-2" />
                        {seedingDefaults ? 'Loading...' : 'Load Default Schemas'}
                      </Button>
                      <span className="text-xs text-blue-600">or click Auto-Generate above</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { handleApplySchema(); }}
                    disabled={extracting || !selectedSchemaId}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    {extracting ? 'Extracting...' : 'Extract Records'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setShowSplitView((v) => !v); setShowSchemaModal(false); }}
                    disabled={!selectedSchemaId}
                  >
                    <SplitSquareVertical className="w-4 h-4 mr-2" />
                    {showSplitView ? 'Hide Extractions' : 'View Extractions'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area - Full Width */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          {isMediaFile ? (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                {document.mimeType?.startsWith('video/') ? (
                  <Film className="w-4 h-4" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                <span>{document.mimeType}</span>
              </div>
              <div className="flex justify-center bg-gray-50 rounded-lg p-4">
                {document.mimeType?.startsWith('image/') && (
                  <img
                    src={mediaUrl}
                    alt={document.metadata?.title || document.filename}
                    className="max-w-full max-h-[80vh] object-contain rounded"
                  />
                )}
                {document.mimeType?.startsWith('video/') && (
                  <video
                    src={mediaUrl}
                    controls
                    className="max-w-full max-h-[80vh] rounded"
                  >
                    Your browser does not support the video element.
                  </video>
                )}
                {document.mimeType?.startsWith('audio/') && (
                  <audio
                    src={mediaUrl}
                    controls
                    className="w-full max-w-lg"
                  >
                    Your browser does not support the audio element.
                  </audio>
                )}
              </div>
            </div>
          ) : showSplitView && selectedSchemaId ? (
            <div className="p-4">
              <ExtractionSplitView
                fileId={resolvedParams.fileId}
                schemaDocumentId={selectedSchemaId}
                refreshKey={splitRefreshKey}
              />
            </div>
          ) : isCodeFile && !isProcessing ? (
            <CodeViewer
              fileId={resolvedParams.fileId}
              mimeType={document.mimeType}
              filename={document.filename}
            />
          ) : (
            <HtmlViewer 
              fileId={resolvedParams.fileId} 
              onReprocess={handleReprocess}
              isProcessing={isProcessing}
              processingStage={
                !isProcessing && triggerStatus?.state === 'running'
                  ? 'trigger_running'
                  : !isProcessing && triggerStatus?.state === 'pending'
                  ? 'trigger_pending'
                  : document.status?.stage
              }
              statusMessage={(document.status as Record<string, unknown>)?.statusMessage as string | undefined}
              pagesProcessed={(document.status as Record<string, unknown>)?.pagesProcessed as number | undefined}
              totalPages={(document.status as Record<string, unknown>)?.totalPages as number | undefined}
              progress={(document.status as Record<string, unknown>)?.progress as number | undefined}
            />
          )}
        </div>
      </div>
      <Footer />

      {/* Processing History Modal */}
      {showProcessingHistory && (
        <ProcessingHistoryModal
          fileId={resolvedParams.fileId}
          document={document}
          onClose={() => setShowProcessingHistory(false)}
        />
      )}
    </div>
    </ProtectedRoute>
  );
}
