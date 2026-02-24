'use client';

import { useState, useEffect, useCallback } from 'react';
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
}

export function HtmlViewer({ fileId, onReprocess, isProcessing, processingStage }: HtmlViewerProps) {
  const api = useBusiboxApi();
  const resolve = useCrossAppApiPath();
  const documentsBase = useCrossAppBasePath('documents');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string>('');
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchHtml = useCallback(async () => {
    setLoading(true);
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
          if (isProcessing) {
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

      // Fix image URLs to use the consuming app's proxy route instead of direct data service.
      // This preserves existing behavior in Busibox Portal and allows other apps to implement the same proxy route.
      // Handle both old format (/api/files/) and new format (/api/documents/) from the HTML renderer.
      // 
      // Detect base path from context, or fallback to detecting from window.location
      let nextBase = (api.nextApiBasePath ?? '').replace(/\/+$/, '');
      if (!nextBase && typeof window !== 'undefined') {
        // Try to detect base path from current URL (e.g., /portal from /portal/documents/...)
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && pathParts[0] !== 'api' && pathParts[0] !== 'documents') {
          nextBase = `/${pathParts[0]}`;
        }
      }
      
      let processedHtml = String(data.html || '');
      // Old format: /api/files/{fileId}/images/{index}
      processedHtml = processedHtml.replace(/\/api\/files\/([^/]+)\/images\//g, `${nextBase}/api/documents/$1/images/`);
      // New format: /api/documents/{fileId}/images/{index} - prepend nextBase if not already present
      // Only prepend if nextBase is set and the URL doesn't already have it
      if (nextBase) {
        processedHtml = processedHtml.replace(
          /src="(\/api\/documents\/[^"]+)"/g, 
          `src="${nextBase}$1"`
        );
      }

      // Fix legacy cached HTML where markdown bold/italic markers were not converted.
      // The old renderer's _add_heading_ids pre-converted headings to HTML before the
      // markdown parser could process inline formatting, leaving literal **text** in the output.
      // Convert **text** to <strong>text</strong> and *text* to <em>text</em> in the HTML.
      // Only match ** that aren't already inside HTML tags.
      processedHtml = processedHtml.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
      processedHtml = processedHtml.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

      // Also clean up TOC entries that still have ** markers
      // (TOC is in a separate data field, handled below)

      // Clean up the "Additional Images" section: convert the bottom dump into
      // a cleaner gallery grid rather than a plain list at the bottom
      processedHtml = processedHtml.replace(
        /<hr\s*\/?>\s*<p><strong>Additional Images:<\/strong><\/p>/gi,
        '<div class="doc-image-gallery"><h3 class="doc-gallery-heading">Document Images</h3>'
      );
      // If the gallery was opened, close it at the end
      if (processedHtml.includes('doc-image-gallery')) {
        // Find all remaining images after the gallery heading and wrap them
        processedHtml += '</div>';
      }

      setHtml(processedHtml);

      // Clean TOC entries - strip ** markers from titles in legacy cached data
      const rawToc = data.toc || [];
      const cleanedToc = rawToc.map((item: TocItem) => ({
        ...item,
        title: item.title.replace(/\*{1,2}/g, ''),
      }));
      setToc(cleanedToc);
      setError(null);
    } catch (err) {
      if (isProcessing) {
        setError(null);
        setHtml('');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load document content');
      console.error('Error fetching HTML:', err);
    } finally {
      setLoading(false);
    }
  }, [api.fallback, api.nextApiBasePath, api.serviceRequestHeaders, api.services?.dataApiUrl, fileId, isProcessing, resolve]);

  useEffect(() => {
    if (fileId) fetchHtml();
  }, [fileId, fetchHtml]);

  useEffect(() => {
    if (!isProcessing && !html && !error && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        fetchHtml();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isProcessing, html, error, retryCount, fetchHtml]);

  useEffect(() => {
    if (!isProcessing && retryCount === 0) {
      fetchHtml();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing]);

  const scrollToSection = (sectionId: string) => {
    let element = document.getElementById(sectionId);
    if (!element) element = document.getElementById(`content-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-8">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        </div>
        <h3 className="mt-6 text-lg font-semibold text-gray-900">Processing Document</h3>
        <p className="mt-2 text-gray-600 text-center max-w-md">
          {processingStage === 'indexing'
            ? 'Generating embeddings and indexing content...'
            : processingStage === 'extracting'
              ? 'Extracting text and images...'
              : processingStage === 'chunking'
                ? 'Creating searchable chunks...'
                : 'Your document is being processed. Content will appear shortly.'}
        </p>
        <p className="mt-4 text-sm text-gray-500 flex items-center gap-2">
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

  return (
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
  );
}




