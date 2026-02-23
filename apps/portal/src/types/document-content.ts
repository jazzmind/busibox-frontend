/**
 * TypeScript types for document content (markdown, HTML, images)
 */

export interface MarkdownResponse {
  fileId: string;
  filename: string;
  markdown: string;
  hasImages: boolean;
  imageCount: number;
}

export interface TocItem {
  level: number;
  title: string;
  id: string;
}

export interface HtmlResponse {
  fileId: string;
  filename: string;
  html: string;
  toc: TocItem[];
  hasImages: boolean;
  imageCount: number;
}

export interface DocumentChunk {
  chunk_id: string;
  chunk_index: number;
  text: string;
  page_number?: number;
  section_heading?: string;
  token_count: number;
  processing_strategy?: string;
}

export interface ChunksResponse {
  fileId: string;
  chunks: DocumentChunk[];
  total: number;
  page: number;
  pageSize: number;
}


