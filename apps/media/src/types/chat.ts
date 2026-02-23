/**
 * TypeScript Type Definitions for AI Chat Enhancement
 * 
 * These types define the contract between frontend and backend.
 * Generated from: specs/003-ai-chat-level/spec.md
 * Data Model: specs/003-ai-chat-level/data-model.md
 */

// ============================================================================
// Core Entity Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export type ShareRole = 'VIEWER' | 'EDITOR';

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface Conversation {
  id: string;
  ownerId: string;
  owner?: User;
  title: string;
  isPrivate: boolean;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  
  // Optional relations
  messages?: Message[];
  shares?: ConversationShare[];
  
  // Computed fields
  preview?: string;  // First message snippet
  isShared?: boolean;  // Is this conversation shared with me?
  shareRole?: ShareRole;  // My role if shared
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;  // ISO 8601
  
  // Optional metadata
  webSearchResults?: SearchResult[];
  docSearchResults?: DocumentResult[];
  usedInsights?: string[];  // Insight IDs
  
  // Relations
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;  // bytes
  fileUrl: string;
  addedToLibrary: boolean;
  libraryDocId?: string | null;
  parsedContent?: string | null;
  createdAt: string;  // ISO 8601
}

export interface ConversationShare {
  id: string;
  conversationId: string;
  userId: string;
  user?: User;
  role: ShareRole;
  createdAt: string;  // ISO 8601
}

export interface Insight {
  id: string;
  userId: string;
  content: string;
  sourceConversationId: string;
  sourceMessageIds: string[];
  analyzedAt: string;  // ISO 8601
  
  // Only in search results
  similarity?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface DocumentResult {
  id: string;
  title: string;
  snippet: string;
  source: string;  // "Document Manager", "Library Name", etc.
  url: string;
  score: number;
}

// ============================================================================
// API Request Types
// ============================================================================

export interface CreateConversationRequest {
  title?: string;  // Optional, auto-generated if not provided
  isPrivate?: boolean;  // Default: false
  initialMessage?: string;  // Optional first message
}

export interface UpdateConversationRequest {
  title?: string;
  isPrivate?: boolean;
}

export interface SendMessageRequest {
  content: string;
  attachments?: AttachmentUpload[];
  searchToggles?: {
    webSearch: boolean;
    documentSearch: boolean;
  };
}

export interface AttachmentUpload {
  filename: string;
  mimeType: string;
  size: number;
  fileData: string;  // Base64 encoded OR pre-signed URL
  addToLibrary: boolean;
}

export interface ShareConversationRequest {
  targetUserEmail: string;
  role: ShareRole;
}

export interface GenerateTitleRequest {
  conversationId: string;
}

export interface SearchWebRequest {
  query: string;
  maxResults?: number;  // Default: 5
}

export interface SearchDocumentsRequest {
  query: string;
  maxResults?: number;  // Default: 10
  libraries?: string[];  // Optional: filter specific libraries
}

export interface QueryInsightsRequest {
  query: string;
  limit?: number;  // Default: 3
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
  hasMore: boolean;
}

export interface ConversationDetailResponse {
  conversation: Conversation;
  messages: Message[];
}

export interface MessageResponse {
  message: Message;
}

// Streaming response (Server-Sent Events)
export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  content?: string;
  message?: Message;  // Full message when done
  error?: string;
}

export interface AttachmentUploadResponse {
  attachment: Attachment;
}

export interface ShareResponse {
  share: ConversationShare;
}

export interface SearchWebResponse {
  results: SearchResult[];
  answer?: string;  // Optional AI-generated summary
}

export interface SearchDocumentsResponse {
  results: DocumentResult[];
}

export interface InsightQueryResponse {
  insights: Insight[];
}

export interface GenerateTitleResponse {
  title: string;
}

// ============================================================================
// Error Response Types
// ============================================================================

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ErrorCode = 
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'PRIVATE_CONVERSATION'
  | 'ALREADY_SHARED'
  | 'INTERNAL_ERROR';

// ============================================================================
// Utility Types
// ============================================================================

export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;  // Conversation ID for cursor-based pagination
}

export interface ConversationFilters {
  isPrivate?: boolean;
  isShared?: boolean;
  search?: string;  // Search in titles
}


