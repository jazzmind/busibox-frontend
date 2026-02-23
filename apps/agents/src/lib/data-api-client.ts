/**
 * Data API Client
 * 
 * Client for interacting with the Busibox Data API for file uploads,
 * document processing, and RAG/semantic search.
 */

const DATA_API_URL = process.env.NEXT_PUBLIC_DATA_API_URL || 'http://10.96.200.206:8002';

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

function getDataApiHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || error.message || 'Request failed');
  }
  return response.json();
}

// ==========================================================================
// FILE UPLOAD
// ==========================================================================

export interface FileUploadResult {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
  minio_path: string;
  knowledge_base_id?: string;
  created_at: string;
}

/**
 * Upload file to data API
 * 
 * The file will be:
 * 1. Uploaded to MinIO
 * 2. Processed for text extraction
 * 3. Embedded and stored in Milvus
 * 4. Added to conversation-scoped knowledge base (if conversation_id provided)
 */
export async function uploadFile(
  file: File,
  conversationId: string,
  token?: string
): Promise<FileUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('conversation_id', conversationId);
  formData.append('create_knowledge_base', 'true');
  
  const response = await fetch(`${DATA_API_URL}/data/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  return handleResponse(response);
}

/**
 * Upload multiple files
 */
export async function uploadFiles(
  files: File[],
  conversationId: string,
  token?: string
): Promise<FileUploadResult[]> {
  const results: FileUploadResult[] = [];
  
  for (const file of files) {
    const result = await uploadFile(file, conversationId, token);
    results.push(result);
  }
  
  return results;
}

// ==========================================================================
// KNOWLEDGE BASE
// ==========================================================================

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  conversation_id?: string;
  user_id: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * List knowledge bases
 */
export async function listKnowledgeBases(token?: string): Promise<KnowledgeBase[]> {
  const response = await fetch(`${DATA_API_URL}/knowledge-bases`, {
    headers: getDataApiHeaders(token),
  });
  return handleResponse(response);
}

/**
 * Get knowledge base by ID
 */
export async function getKnowledgeBase(id: string, token?: string): Promise<KnowledgeBase> {
  const response = await fetch(`${DATA_API_URL}/knowledge-bases/${id}`, {
    headers: getDataApiHeaders(token),
  });
  return handleResponse(response);
}

/**
 * Get knowledge base for conversation
 */
export async function getConversationKnowledgeBase(
  conversationId: string,
  token?: string
): Promise<KnowledgeBase | null> {
  const response = await fetch(
    `${DATA_API_URL}/knowledge-bases?conversation_id=${conversationId}`,
    {
      headers: getDataApiHeaders(token),
    }
  );
  const kbs = await handleResponse(response);
  return kbs.length > 0 ? kbs[0] : null;
}

/**
 * Delete knowledge base
 */
export async function deleteKnowledgeBase(id: string, token?: string): Promise<void> {
  const response = await fetch(`${DATA_API_URL}/knowledge-bases/${id}`, {
    method: 'DELETE',
    headers: getDataApiHeaders(token),
  });
  
  if (response.status !== 204) {
    await handleResponse(response);
  }
}

// ==========================================================================
// SEMANTIC SEARCH
// ==========================================================================

export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  source: {
    filename: string;
    page?: number;
    chunk_index?: number;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  knowledge_base_id: string;
  total: number;
}

/**
 * Search knowledge base using semantic search (RAG)
 */
export async function searchKnowledgeBase(
  query: string,
  knowledgeBaseId: string,
  topK: number = 5,
  token?: string
): Promise<SearchResponse> {
  const response = await fetch(`${DATA_API_URL}/search/semantic`, {
    method: 'POST',
    headers: {
      ...getDataApiHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      knowledge_base_id: knowledgeBaseId,
      top_k: topK,
    }),
  });
  
  return handleResponse(response);
}

/**
 * Search conversation's knowledge base
 */
export async function searchConversation(
  query: string,
  conversationId: string,
  topK: number = 5,
  token?: string
): Promise<SearchResponse | null> {
  // First get the conversation's knowledge base
  const kb = await getConversationKnowledgeBase(conversationId, token);
  
  if (!kb) {
    return null;
  }
  
  return searchKnowledgeBase(query, kb.id, topK, token);
}

// ==========================================================================
// DOCUMENT MANAGEMENT
// ==========================================================================

export interface Document {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
  knowledge_base_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  chunk_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * List documents in knowledge base
 */
export async function listDocuments(
  knowledgeBaseId: string,
  token?: string
): Promise<Document[]> {
  const response = await fetch(
    `${DATA_API_URL}/knowledge-bases/${knowledgeBaseId}/documents`,
    {
      headers: getDataApiHeaders(token),
    }
  );
  return handleResponse(response);
}

/**
 * Get document by ID
 */
export async function getDocument(id: string, token?: string): Promise<Document> {
  const response = await fetch(`${DATA_API_URL}/documents/${id}`, {
    headers: getDataApiHeaders(token),
  });
  return handleResponse(response);
}

/**
 * Delete document
 */
export async function deleteDocument(id: string, token?: string): Promise<void> {
  const response = await fetch(`${DATA_API_URL}/documents/${id}`, {
    method: 'DELETE',
    headers: getDataApiHeaders(token),
  });
  
  if (response.status !== 204) {
    await handleResponse(response);
  }
}
