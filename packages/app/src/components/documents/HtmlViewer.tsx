'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TocItem } from '../../types/documents';
import { useBusiboxApi, useCrossAppApiPath, useCrossAppBasePath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';
import { Loader2, AlertCircle, FileText, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';

interface HtmlViewerProps {
  fileId: string;
  onReprocess?: () => void;
  isProcessing?: boolean;
  processingStage?: string;
  statusMessage?: string;
  pagesProcessed?: number;
  totalPages?: number;
  progress?: number;
  isEnhancing?: boolean;
  showImages?: boolean;
  showFilteredImages?: boolean;
}

export function HtmlViewer({ fileId, onReprocess, isProcessing, processingStage, statusMessage, pagesProcessed, totalPages, progress, isEnhancing, showImages = true, showFilteredImages = false }: HtmlViewerProps) {
  const api = useBusiboxApi();
  const resolve = useCrossAppApiPath();
  const documentsBase = useCrossAppBasePath('documents');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string>('');
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const prevIsEnhancingRef = useRef(false);
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;
  const enhanceFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPagesProcessedRef = useRef<number | undefined>(pagesProcessed);

  interface ImageMeta {
    is_duplicate?: boolean;
    is_decorative?: boolean;
    is_background?: boolean;
  }

  const [filteredImageCount, setFilteredImageCount] = useState(0);
  const [enhancingPage, setEnhancingPage] = useState<number | null>(null);
  const [visionDropdownPage, setVisionDropdownPage] = useState<number | null>(null);
  const fetchHtmlRef = useRef<() => void>(() => {});

  const enhancePage = useCallback(async (pageNum: number, mode: string, contextText?: string) => {
    setEnhancingPage(pageNum);
    try {
      const response = await fetch(`${documentsBase}/api/documents/${fileId}/pages/${pageNum}/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, context_text: contextText }),
      });
      if (!response.ok) throw new Error('Enhancement failed');
      const data = await response.json();
      if (data.changed) {
        fetchHtmlRef.current();
      }
    } catch (err) {
      console.error('Page enhancement failed:', err);
    } finally {
      setEnhancingPage(null);
    }
  }, [fileId, documentsBase]);

  const fetchImageUrls = useCallback(async (fid: string): Promise<{ urls: Record<string, string>; metadata: Record<string, ImageMeta> }> => {
    try {
      const response = await fetchServiceFirstFallbackNext({
        service: { baseUrl: api.services?.dataApiUrl, path: `/files/${fid}/image-urls`, init: { method: 'GET' } },
        next: { nextApiBasePath: documentsBase, path: `/api/documents/${fid}/image-urls`, init: { method: 'GET' } },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            400, 401, 403,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        return {
          urls: (data.urls as Record<string, string>) ?? {},
          metadata: (data.metadata as Record<string, ImageMeta>) ?? {},
        };
      }
    } catch (e) {
      console.warn('Failed to fetch batch image URLs, falling back to per-image proxy', e);
    }
    return { urls: {}, metadata: {} };
  }, [api.fallback, api.services?.dataApiUrl, api.serviceRequestHeaders, documentsBase]);

  const hasContentRef = useRef(false);

  const fetchHtml = useCallback(async () => {
    if (!hasContentRef.current) setLoading(true);
    setError(null);

    try {
      const servicePath = `/files/${fileId}/html`;
      const response = await fetchServiceFirstFallbackNext({
        service: { baseUrl: api.services?.dataApiUrl, path: servicePath, init: { method: 'GET' } },
        next: { nextApiBasePath: documentsBase, path: `/api/documents/${fileId}/html`, init: { method: 'GET' } },
        fallback: {
          fallbackOnNetworkError: api.fallback?.fallbackOnNetworkError ?? true,
          fallbackStatuses: [
            ...(api.fallback?.fallbackStatuses ?? [404, 405, 501, 502, 503, 504]),
            400,
            401,
            403,
          ],
        },
        serviceHeaders: api.serviceRequestHeaders,
      });

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json().catch(() => ({}));
          if (isProcessingRef.current) {
            setError(null);
            setHtml('');
            return;
          }
          setError((errorData as any).error || 'HTML not available for this document');
          return;
        }
        throw new Error(`Failed to fetch HTML: ${response.statusText}`);
      }

      const data = await response.json();
      const imageCount: number = data.imageCount ?? 0;

      let processedHtml = String(data.html || '');

      // Fetch presigned MinIO URLs for all images in a single authenticated call,
      // then inject them directly so the browser loads images from MinIO with zero auth.
      if (imageCount > 0) {
        const { urls: presignedUrls, metadata: imageMeta } = await fetchImageUrls(fileId);

        if (Object.keys(presignedUrls).length > 0) {
          let filtered = 0;
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          processedHtml = processedHtml.replace(
            /(<img\s[^>]*?)src="(?:[^"]*\/api\/(?:files|documents)\/[^/]+\/images\/(\d+))"([^>]*?>)/g,
            (_match, prefix, idx, suffix) => {
              let url = presignedUrls[idx];
              if (!url) return _match;
              if (url.startsWith('/') && !url.startsWith('//')) {
                url = origin + url;
              }
              const meta = imageMeta[idx];
              const isFiltered = meta && (meta.is_duplicate || meta.is_decorative || meta.is_background);
              if (isFiltered) filtered++;
              let result = `${prefix}src="${url}"${suffix}`;
              // Merge filtered class into existing class attribute rather than adding a duplicate
              if (isFiltered) {
                if (result.includes('class="')) {
                  result = result.replace(/class="([^"]*)"/, 'class="$1 doc-image-filtered"');
                } else {
                  result = result.replace('<img ', '<img class="doc-image-filtered" ');
                }
              }
              return result;
            },
          );
          setFilteredImageCount(filtered);
        } else {
          let nextBase = (api.nextApiBasePath ?? '').replace(/\/+$/, '');
          if (!nextBase && typeof window !== 'undefined') {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'documents') {
              nextBase = `/${pathParts[0]}`;
            }
          }
          processedHtml = processedHtml.replace(
            /\/api\/files\/([^/]+)\/images\//g,
            `${nextBase}/api/documents/$1/images/`,
          );
          if (nextBase) {
            processedHtml = processedHtml.replace(
              /src="(\/api\/documents\/[^"]+)"/g,
              `src="${nextBase}$1"`,
            );
          }
        }
      }

      processedHtml = processedHtml.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
      processedHtml = processedHtml.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

      processedHtml = processedHtml.replace(
        /<hr\s*\/?>\s*<p><strong>Additional Images:<\/strong><\/p>/gi,
        '<div class="doc-image-gallery"><h3 class="doc-gallery-heading">Document Images</h3>'
      );
      if (processedHtml.includes('doc-image-gallery')) {
        processedHtml += '</div>';
      }

      setHtml(processedHtml);
      if (processedHtml) hasContentRef.current = true;

      const rawToc = data.toc || [];
      const cleanedToc = rawToc.map((item: TocItem) => ({
        ...item,
        title: item.title.replace(/\*{1,2}/g, ''),
      }));
      setToc(cleanedToc);
      setError(null);
    } catch (err) {
      if (isProcessingRef.current) {
        setError(null);
        setHtml('');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load document content');
      console.error('Error fetching HTML:', err);
    } finally {
      setLoading(false);
    }
  }, [api.fallback, api.nextApiBasePath, api.serviceRequestHeaders, api.services?.dataApiUrl, fileId, resolve, fetchImageUrls]);

  fetchHtmlRef.current = fetchHtml;

  // Initial fetch when fileId changes (or on mount)
  useEffect(() => {
    if (fileId) fetchHtml();
  }, [fileId, fetchHtml]);

  // Retry if initial fetch came back empty (e.g., document still being processed)
  useEffect(() => {
    if (!isProcessing && !html && !error && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        fetchHtml();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isProcessing, html, error, retryCount, fetchHtml]);

  // Refetch HTML immediately when a new batch of pages has been processed.
  useEffect(() => {
    const prev = prevPagesProcessedRef.current;
    if (
      pagesProcessed !== undefined &&
      pagesProcessed > 0 &&
      pagesProcessed !== prev
    ) {
      fetchHtml();
    }
    prevPagesProcessedRef.current = pagesProcessed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesProcessed]);

  // Refetch HTML when enhancement completes or a new pass finishes.
  // Debounced to avoid flooding requests on rapid status message updates.
  useEffect(() => {
    if (enhanceFetchTimerRef.current) {
      clearTimeout(enhanceFetchTimerRef.current);
      enhanceFetchTimerRef.current = null;
    }

    if (!isEnhancing && prevIsEnhancingRef.current) {
      fetchHtml();
    } else if (isEnhancing && statusMessage) {
      enhanceFetchTimerRef.current = setTimeout(() => {
        fetchHtml();
        enhanceFetchTimerRef.current = null;
      }, 5000);
    }
    prevIsEnhancingRef.current = isEnhancing ?? false;

    return () => {
      if (enhanceFetchTimerRef.current) {
        clearTimeout(enhanceFetchTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnhancing, statusMessage]);

  const scrollToSection = (sectionId: string) => {
    let element = document.getElementById(sectionId);
    if (!element) element = document.getElementById(`content-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  // Inject page-level toolbars into data-page sections after HTML renders
  useEffect(() => {
    if (!html) return;

    const container = document.getElementById('document-content');
    if (!container) return;

    // Remove any previously injected toolbars
    container.querySelectorAll('.page-toolbar-injected').forEach(el => el.remove());

    const pageSections = container.querySelectorAll('[data-page]');
    pageSections.forEach((section) => {
      const pageNum = parseInt(section.getAttribute('data-page') || '0', 10);
      if (!pageNum) return;

      // Make the section position-relative for the floating toolbar
      (section as HTMLElement).style.position = 'relative';

      const toolbar = document.createElement('div');
      toolbar.className = 'page-toolbar-injected';
      toolbar.innerHTML = `
        <span class="page-toolbar-label">Page ${pageNum}</span>
        <button class="page-toolbar-btn" data-action="llm_cleanup" data-page="${pageNum}" title="LLM Cleanup">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>
          Cleanup
        </button>
        <div class="page-toolbar-dropdown-wrapper">
          <button class="page-toolbar-btn" data-action="vision_menu" data-page="${pageNum}" title="Vision Analysis">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            Vision ▾
          </button>
          <div class="page-toolbar-dropdown" data-dropdown-page="${pageNum}">
            <button data-action="vision_describe" data-page="${pageNum}">Describe</button>
            <button data-action="vision_table" data-page="${pageNum}">Extract Table</button>
            <button data-action="vision_chart" data-page="${pageNum}">Extract Chart</button>
            <button data-action="vision_ocr" data-page="${pageNum}">OCR Page</button>
          </div>
        </div>
        <button class="page-toolbar-btn" data-action="view_pdf" data-page="${pageNum}" title="View Source PDF">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          PDF
        </button>
      `;

      section.insertBefore(toolbar, section.firstChild);
    });

    // Delegate click events from toolbars
    const handleToolbarClick = (e: Event) => {
      const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!target) return;

      const action = target.getAttribute('data-action');
      const pageNum = parseInt(target.getAttribute('data-page') || '0', 10);
      if (!pageNum) return;

      if (action === 'llm_cleanup') {
        enhancePage(pageNum, 'llm_cleanup');
      } else if (action === 'vision_describe' || action === 'vision_table' || action === 'vision_chart' || action === 'vision_ocr') {
        enhancePage(pageNum, action);
      } else if (action === 'vision_menu') {
        const dropdown = container.querySelector(`[data-dropdown-page="${pageNum}"]`) as HTMLElement;
        if (dropdown) {
          const isVisible = dropdown.style.display === 'flex';
          // Close all dropdowns first
          container.querySelectorAll('.page-toolbar-dropdown').forEach(d => (d as HTMLElement).style.display = 'none');
          dropdown.style.display = isVisible ? 'none' : 'flex';
        }
      } else if (action === 'view_pdf') {
        window.open(`${documentsBase}/api/documents/${fileId}/download#page=${pageNum}`, '_blank');
      }
    };

    container.addEventListener('click', handleToolbarClick);
    return () => container.removeEventListener('click', handleToolbarClick);
  }, [html, enhancePage, fileId, documentsBase]);

  // Text selection context menu for targeted enhancement
  useEffect(() => {
    const container = document.getElementById('document-content');
    if (!container) return;

    let contextMenu: HTMLDivElement | null = null;

    const removeMenu = () => {
      if (contextMenu && contextMenu.parentNode) {
        contextMenu.parentNode.removeChild(contextMenu);
        contextMenu = null;
      }
    };

    const handleMouseUp = () => {
      removeMenu();
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;

      const selectedText = selection.toString().trim();
      if (selectedText.length < 10) return;

      const range = selection.getRangeAt(0);
      const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;
      const pageSection = startEl?.closest('[data-page]') as HTMLElement | null;

      if (!pageSection) return;
      const pageNum = parseInt(pageSection.getAttribute('data-page') || '0', 10);
      if (!pageNum) return;

      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      contextMenu = document.createElement('div');
      contextMenu.className = 'text-selection-menu';
      contextMenu.style.top = `${rect.bottom - containerRect.top + container.scrollTop + 4}px`;
      contextMenu.style.left = `${rect.left - containerRect.left + rect.width / 2}px`;
      contextMenu.innerHTML = `
        <button data-sel-action="llm_cleanup" data-sel-page="${pageNum}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="m3 21 9-9"/></svg>
          Clean up with LLM
        </button>
        <button data-sel-action="vision_describe" data-sel-page="${pageNum}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          Analyze with vision
        </button>
      `;

      // Store selected text as data attribute
      contextMenu.setAttribute('data-selected-text', selectedText);
      container.appendChild(contextMenu);
    };

    const handleContextClick = (e: Event) => {
      const btn = (e.target as HTMLElement).closest('[data-sel-action]') as HTMLElement | null;
      if (!btn || !contextMenu) return;

      const action = btn.getAttribute('data-sel-action')!;
      const pageNum = parseInt(btn.getAttribute('data-sel-page') || '0', 10);
      const selectedText = contextMenu.getAttribute('data-selected-text') || '';
      removeMenu();
      if (pageNum && selectedText) {
        enhancePage(pageNum, action, selectedText);
      }
    };

    const handleMouseDown = (e: Event) => {
      if (contextMenu && !contextMenu.contains(e.target as Node)) {
        removeMenu();
      }
    };

    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('click', handleContextClick);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('click', handleContextClick);
      document.removeEventListener('mousedown', handleMouseDown);
      removeMenu();
    };
  }, [html, enhancePage]);

  // Show loading state on the page being enhanced
  useEffect(() => {
    const container = document.getElementById('document-content');
    if (!container) return;
    container.querySelectorAll('.doc-page-section').forEach((section) => {
      const p = parseInt(section.getAttribute('data-page') || '0', 10);
      if (p === enhancingPage) {
        (section as HTMLElement).style.opacity = '0.6';
        (section as HTMLElement).style.pointerEvents = 'none';
      } else {
        (section as HTMLElement).style.opacity = '';
        (section as HTMLElement).style.pointerEvents = '';
      }
    });
  }, [enhancingPage]);

  if (isProcessing) {
    const displayMessage = statusMessage || (
      processingStage === 'indexing'
        ? 'Generating embeddings and indexing content...'
        : processingStage === 'extracting' || processingStage === 'parsing'
          ? 'Extracting text and images...'
          : processingStage === 'chunking'
            ? 'Creating searchable chunks...'
            : 'Your document is being processed. Content will appear shortly.'
    );

    const showPageProgress = totalPages && totalPages > 0 && processingStage === 'parsing';

    return (
      <div className="flex flex-col items-center justify-center h-96 p-8">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        </div>
        <h3 className="mt-6 text-lg font-semibold text-gray-900 dark:text-gray-100">Processing Document</h3>
        <p className="mt-2 text-gray-600 dark:text-gray-400 text-center max-w-md">
          {displayMessage}
        </p>
        {showPageProgress && (
          <div className="mt-4 w-64">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Page {pagesProcessed || 0} of {totalPages}</span>
              <span>{Math.min(100, progress || 0)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, totalPages > 0 ? ((pagesProcessed || 0) / totalPages) * 100 : 0)}%` }}
              />
            </div>
          </div>
        )}
        {!showPageProgress && typeof progress === 'number' && progress > 0 && (
          <div className="mt-4 w-64">
            <div className="flex justify-end text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>{Math.min(100, progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
        )}
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Auto-refreshing...
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Loading document content...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 m-4">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Content Not Available</h3>
              <p className="text-gray-700 mb-4">{error}</p>
              {onReprocess && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    This document may have been processed before the content rendering feature was available.
                  </p>
                  <Button onClick={onReprocess} variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Reprocess Document
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!html) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="mt-4 text-gray-600">Loading content...</p>
      </div>
    );
  }

  const enhancingBanner = isEnhancing ? (
    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950 border-b border-blue-100 dark:border-blue-900 text-sm text-blue-700 dark:text-blue-300">
      <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
      <span>{statusMessage || 'Enhancing document quality...'}</span>
    </div>
  ) : null;

  return (
    <div>
      {enhancingBanner}
      <div className="flex gap-6 p-4">
      {toc.length > 0 && (
        <div className="w-64 flex-shrink-0">
          <div className="sticky top-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Table of Contents
                </h3>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <nav className="space-y-1">
                    {toc.map((item, idx) => (
                      <button
                        key={`${item.id}-${idx}`}
                        onClick={() => scrollToSection(item.id)}
                        className={`
                          w-full text-left px-2 py-1.5 rounded text-sm transition-colors
                          ${activeSection === item.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}
                        `}
                        style={{ paddingLeft: `${(item.level - 1) * 0.75 + 0.5}rem` }}
                      >
                        {item.title}
                      </button>
                    ))}
                  </nav>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <style dangerouslySetInnerHTML={{ __html: `
          .doc-image-gallery {
            margin-top: 2rem;
            padding-top: 1.5rem;
            border-top: 1px solid #e5e7eb;
          }
          .doc-image-gallery .doc-gallery-heading {
            font-size: 1.125rem;
            font-weight: 600;
            color: #374151;
            margin-bottom: 1rem;
          }
          .doc-image-gallery img {
            display: inline-block;
            max-width: 100%;
            margin-bottom: 1rem;
          }
          #document-content img.doc-image {
            display: block;
            margin: 1.5rem auto;
            border-radius: 0.5rem;
            box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
          }
          #document-content strong {
            font-weight: 700;
          }
          #document-content em {
            font-style: italic;
          }
          ${!showImages ? '#document-content img { display: none !important; }' : ''}
          ${showImages && !showFilteredImages ? '#document-content img.doc-image-filtered { display: none !important; }' : ''}

          .doc-page-section { position: relative; }
          .page-toolbar-injected {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            position: absolute;
            top: 0;
            right: 0;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 0.375rem;
            padding: 0.25rem 0.5rem;
            z-index: 10;
            font-size: 0.75rem;
          }
          .doc-page-section:hover .page-toolbar-injected,
          .page-toolbar-injected:hover {
            background: white;
            border-color: #e5e7eb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .page-toolbar-label {
            color: #d1d5db;
            font-size: 0.675rem;
            margin-right: 0.25rem;
            white-space: nowrap;
            transition: color 0.15s;
          }
          .doc-page-section:hover .page-toolbar-label {
            color: #9ca3af;
          }
          .page-toolbar-btn {
            display: none;
            align-items: center;
            gap: 0.25rem;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            border: none;
            background: transparent;
            color: #4b5563;
            cursor: pointer;
            font-size: 0.75rem;
            white-space: nowrap;
            transition: background 0.15s, color 0.15s;
          }
          .doc-page-section:hover .page-toolbar-btn,
          .page-toolbar-injected:hover .page-toolbar-btn {
            display: inline-flex;
          }
          .page-toolbar-btn:hover { background: #f3f4f6; color: #1d4ed8; }
          .page-toolbar-btn[disabled] { opacity: 0.5; pointer-events: none; }
          .page-toolbar-dropdown-wrapper {
            position: relative;
            display: none;
          }
          .doc-page-section:hover .page-toolbar-dropdown-wrapper,
          .page-toolbar-injected:hover .page-toolbar-dropdown-wrapper {
            display: block;
          }
          .page-toolbar-dropdown {
            display: none;
            flex-direction: column;
            position: absolute;
            top: 100%;
            right: 0;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 0.375rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            min-width: 140px;
            z-index: 20;
            padding: 0.25rem 0;
          }
          .page-toolbar-dropdown button {
            display: block;
            width: 100%;
            text-align: left;
            padding: 0.375rem 0.75rem;
            border: none;
            background: transparent;
            color: #374151;
            cursor: pointer;
            font-size: 0.75rem;
          }
          .page-toolbar-dropdown button:hover { background: #eff6ff; color: #1d4ed8; }

          .doc-page-section {
            border-left: 2px solid transparent;
            padding-left: 0.5rem;
            margin-left: -0.5rem;
            transition: border-color 0.2s;
          }
          .doc-page-section:hover {
            border-left-color: #dbeafe;
          }

          .text-selection-menu {
            position: absolute;
            transform: translateX(-50%);
            display: flex;
            gap: 0.25rem;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            padding: 0.25rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 50;
            animation: fadeIn 0.15s ease-out;
          }
          @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
          .text-selection-menu button {
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.375rem 0.625rem;
            border: none;
            background: transparent;
            color: #374151;
            cursor: pointer;
            font-size: 0.75rem;
            border-radius: 0.25rem;
            white-space: nowrap;
            transition: background 0.15s, color 0.15s;
          }
          .text-selection-menu button:hover { background: #eff6ff; color: #1d4ed8; }
        ` }} />
        <div
          id="document-content"
          className="prose prose-gray max-w-none
            prose-headings:scroll-mt-20
            prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-2
            prose-h2:text-2xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-8 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200
            prose-h3:text-xl prose-h3:font-semibold prose-h3:mb-2 prose-h3:mt-6
            prose-h4:text-lg prose-h4:font-semibold prose-h4:mb-2 prose-h4:mt-4
            prose-p:mb-4 prose-p:leading-relaxed prose-p:text-gray-700
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
            prose-strong:font-bold prose-strong:text-gray-900
            prose-em:italic
            prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
            prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-pre:rounded-lg
            prose-img:rounded-lg prose-img:shadow-md prose-img:my-6
            prose-blockquote:border-l-4 prose-blockquote:border-blue-300 prose-blockquote:bg-blue-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:italic
            prose-table:border-collapse prose-table:w-full
            prose-th:border prose-th:border-gray-300 prose-th:bg-gray-50 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
            prose-td:border prose-td:border-gray-300 prose-td:px-4 prose-td:py-2
            prose-ul:list-disc prose-ul:ml-6 prose-ul:mb-4
            prose-ol:list-decimal prose-ol:ml-6 prose-ol:mb-4
            prose-li:mb-1.5 prose-li:leading-relaxed
            prose-hr:my-8 prose-hr:border-gray-300
          "
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      </div>
    </div>
  );
}




