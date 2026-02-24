'use client';

import { useState, useEffect } from 'react';
import type { DocumentChunk } from '../../types/documents';
import { useBusiboxApi, useCrossAppApiPath, useCrossAppBasePath } from '../../contexts/ApiContext';
import { fetchServiceFirstFallbackNext } from '../../lib/http/fetch-with-fallback';
import { Search, Filter, ChevronLeft, ChevronRight, Loader2, FileText, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import ReactMarkdown from 'react-markdown';

interface ChunksBrowserProps {
  fileId: string;
  totalChunks: number;
}

type DataChunk = {
  chunkId?: string;
  chunk_id?: string;
  chunkIndex?: number;
  chunk_index?: number;
  text: string;
  pageNumber?: number;
  page_number?: number;
  sectionHeading?: string;
  section_heading?: string;
  tokenCount?: number;
  token_count?: number;
  processingStrategy?: string;
  processing_strategy?: string;
};

function normalizeChunks(fileId: string, raw: any[]): DocumentChunk[] {
  return (raw || []).map((c: DataChunk) => {
    const chunkIndex = (c.chunk_index ?? c.chunkIndex ?? 0) as number;
    return {
      chunk_id: (c.chunk_id ?? c.chunkId ?? `${fileId}-${chunkIndex}`) as string,
      chunk_index: chunkIndex,
      text: c.text,
      page_number: (c.page_number ?? c.pageNumber) as any,
      section_heading: (c.section_heading ?? c.sectionHeading) as any,
      token_count: (c.token_count ?? c.tokenCount ?? 0) as number,
      processing_strategy: (c.processing_strategy ?? c.processingStrategy) as any,
    };
  });
}

export function ChunksBrowser({ fileId, totalChunks }: ChunksBrowserProps) {
  const api = useBusiboxApi();
  const resolve = useCrossAppApiPath();
  const documentsBase = useCrossAppBasePath('documents');

  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const totalPages = Math.ceil(totalChunks / pageSize);

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  // Selected chunk for detail view
  const [selectedChunkIndex, setSelectedChunkIndex] = useState<number | null>(null);

  // Unique pages and sections for filters
  const [availablePages, setAvailablePages] = useState<number[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  useEffect(() => {
    if (fileId) fetchChunks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, currentPage]);

  const fetchChunks = async () => {
    setLoading(true);
    setError(null);

    try {
      // Service endpoint: /files/{fileId}/chunks?page={page}&page_size={pageSize}
      const servicePath = `/files/${fileId}/chunks?page=${currentPage}&page_size=${pageSize}`;
      const response = await fetchServiceFirstFallbackNext({
        service: {
          baseUrl: api.services?.dataApiUrl,
          path: servicePath,
          init: { method: 'GET' },
        },
        next: {
          nextApiBasePath: documentsBase,
          path: `/api/documents/${fileId}/chunks?page=${currentPage}&pageSize=${pageSize}`,
          init: { method: 'GET' },
        },
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

      if (!response.ok) throw new Error(`Failed to fetch chunks: ${response.statusText}`);

      const data = await response.json();
      const normalized = normalizeChunks(fileId, data.chunks || []);

      setChunks(normalized);

      const pages = [...new Set(normalized.map((c) => c.page_number).filter(Boolean))].sort((a, b) => (a as number) - (b as number));
      const sections = [...new Set(normalized.map((c) => c.section_heading).filter(Boolean))].sort();

      setAvailablePages(pages as number[]);
      setAvailableSections(sections as string[]);

      if (selectedChunkIndex === null && normalized.length > 0) setSelectedChunkIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chunks');
      console.error('Error fetching chunks:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredChunks = chunks.filter((chunk) => {
    if (searchQuery && !chunk.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (pageFilter !== 'all' && chunk.page_number !== parseInt(pageFilter)) return false;
    if (sectionFilter !== 'all' && chunk.section_heading !== sectionFilter) return false;
    return true;
  });

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getChunkNumber = (chunk: DocumentChunk, index: number): number => {
    return chunk.chunk_index !== undefined && chunk.chunk_index !== null ? chunk.chunk_index + 1 : index + 1;
  };

  const selectedChunk = selectedChunkIndex !== null && filteredChunks[selectedChunkIndex] ? filteredChunks[selectedChunkIndex] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Loading chunks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-red-800">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Search within chunks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
            </div>

            {availablePages.length > 0 && (
              <Select value={pageFilter} onValueChange={setPageFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Pages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pages</SelectItem>
                  {availablePages.map((page) => (
                    <SelectItem key={page} value={page.toString()}>
                      Page {page}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {availableSections.length > 0 && (
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {availableSections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <List className="w-4 h-4" />
              Chunks ({filteredChunks.length})
            </h3>
          </div>

          <div className="space-y-2 max-h-[800px] overflow-y-auto pr-2">
            {filteredChunks.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No chunks found</p>
                </CardContent>
              </Card>
            ) : (
              filteredChunks.map((chunk, index) => {
                const chunkNum = getChunkNumber(chunk, index);
                const isSelected = selectedChunkIndex === index;

                return (
                  <button
                    key={chunk.chunk_id}
                    onClick={() => setSelectedChunkIndex(index)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 mb-1">Chunk {chunkNum}</div>
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {chunk.page_number && <div>Page {chunk.page_number}</div>}
                          {chunk.section_heading && <div className="truncate">{chunk.section_heading}</div>}
                          <div>{chunk.token_count} tokens</div>
                        </div>
                      </div>
                      {chunk.processing_strategy && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs whitespace-nowrap">{chunk.processing_strategy}</span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-600 line-clamp-2">{chunk.text}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          {selectedChunk ? (
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Chunk {getChunkNumber(selectedChunk, selectedChunkIndex!)}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setSelectedChunkIndex(Math.max(0, selectedChunkIndex! - 1))} disabled={selectedChunkIndex === 0}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                      {selectedChunkIndex! + 1} / {filteredChunks.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedChunkIndex(Math.min(filteredChunks.length - 1, selectedChunkIndex! + 1))}
                      disabled={selectedChunkIndex === filteredChunks.length - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 mt-2">
                  {selectedChunk.page_number && <span>Page {selectedChunk.page_number}</span>}
                  {selectedChunk.section_heading && (
                    <>
                      <span>•</span>
                      <span>{selectedChunk.section_heading}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{selectedChunk.token_count} tokens</span>
                  {selectedChunk.processing_strategy && (
                    <>
                      <span>•</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{selectedChunk.processing_strategy}</span>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  {searchQuery ? (
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{highlightText(selectedChunk.text, searchQuery)}</p>
                  ) : (
                    <div className="text-gray-700 leading-relaxed">
                      <ReactMarkdown>{selectedChunk.text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select a chunk to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}










