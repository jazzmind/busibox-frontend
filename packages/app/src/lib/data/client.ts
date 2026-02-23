/**
 * Data Service Client for busibox-app
 * 
 * Centralized client for communicating with the data service.
 * 
 * Usage:
 * ```typescript
 * const result = await uploadChatAttachment(file, { 
 *   userId: 'user-123',
 *   getAuthzToken: async (userId, audience, scopes) => {
 *     // Custom token acquisition logic
 *     return 'token';
 *   }
 * });
 * ```
 */

// Service URL configuration
const DEFAULT_DATA_HOST = process.env.DATA_API_HOST || process.env.DATA_CONTAINER_IP || 'localhost';
const DEFAULT_DATA_PORT = process.env.DATA_API_PORT || process.env.DATA_SERVICE_PORT || '8002';
const DEFAULT_DATA_URL =
  process.env.DATA_API_URL || `http://${DEFAULT_DATA_HOST}:${DEFAULT_DATA_PORT}`;

export interface DataServiceError extends Error {
  context: string;
  url: string;
  statusCode?: number;
  originalError?: unknown;
}

export interface DataClientOptions {
  /** User ID (server-side) */
  userId?: string;
  /** Custom token acquisition function (server-side) */
  getAuthzToken?: (userId: string, audience: string, scopes: string[]) => Promise<string>;
  /** Pre-acquired Bearer token (when token already obtained via requireAuthWithTokenExchange) */
  accessToken?: string;
  /** Purpose label for audit/debug */
  purpose?: string;
  /** Override data service URL */
  dataUrl?: string;
  /** Request timeout in milliseconds (default: 30000 = 30 seconds) */
  timeout?: number;
}

/**
 * Create an error with context about which part of the code called the data service
 */
function createDataError(
  context: string,
  url: string,
  error: unknown,
  statusCode?: number
): DataServiceError {
  const message = error instanceof Error ? error.message : String(error);
  const dataError: DataServiceError = new Error(
    `[DATA SERVICE ERROR] ${context}: ${message}`
  ) as DataServiceError;
  
  dataError.context = context;
  dataError.url = url;
  dataError.statusCode = statusCode;
  dataError.originalError = error;
  
  // Log the error with full context
  console.error(`[DATA SERVICE ERROR]`, {
    context,
    url,
    statusCode,
    error: message,
    stack: error instanceof Error ? error.stack : undefined,
  });
  
  return dataError;
}

/**
 * Get authorization header for data service calls
 */
async function getAuthHeader(options: DataClientOptions): Promise<string | undefined> {
  // Pre-acquired token (e.g. from requireAuthWithTokenExchange)
  if (options.accessToken) {
    return options.accessToken.startsWith('Bearer ') ? options.accessToken : `Bearer ${options.accessToken}`;
  }
  // Server-side: use custom token acquisition
  if (options.getAuthzToken && options.userId) {
    const token = await options.getAuthzToken(options.userId, 'data-api', []);
    return `Bearer ${token}`;
  }

  // No authentication provided
  return undefined;
}

/**
 * Fetch from data service with error handling, context, timeout, and automatic token refresh retry
 */
export async function dataFetch(
  context: string,
  path: string,
  options: DataClientOptions & RequestInit
): Promise<Response> {
  const { userId, getAuthzToken, accessToken, purpose, dataUrl, timeout, ...fetchOptions } = options;
  const baseUrl = dataUrl || DEFAULT_DATA_URL;
  const url = `${baseUrl}${path}`;
  
  // Default timeout of 30 seconds (can be overridden per-request)
  const requestTimeout = timeout ?? 30000;
  
  // Internal fetch function that can be retried
  const performFetch = async (forceRefresh = false): Promise<Response> => {
    // Get authorization header
    const authHeader = await getAuthHeader({ userId, getAuthzToken, accessToken, purpose });
    
    // Only log if verbose logging is enabled (set VERBOSE_DATA_LOGGING=true in env)
    if (process.env.VERBOSE_DATA_LOGGING === 'true') {
      console.log('[DATA FETCH] Request:', {
        url,
        method: fetchOptions.method || 'GET',
        hasAuthHeader: !!authHeader,
        authHeaderPrefix: authHeader?.substring(0, 20) + '...',
        isRetry: forceRefresh,
      });
    }
    
    const headers: Record<string, string> = {
      ...(fetchOptions.headers as Record<string, string>),
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
    
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${requestTimeout}ms`);
      }
      throw err;
    }
  };
  
  try {
    // First attempt
    let response = await performFetch(false);
    
    // If we get a 401/403 (token expired/invalid), try refreshing the token once
    if ((response.status === 401 || response.status === 403)) {
      const errorText = await response.text();
      const isTokenError = errorText.includes('JWT') || 
                          errorText.includes('token') || 
                          errorText.includes('expired') ||
                          errorText.includes('Invalid or expired');
      
      if (isTokenError) {
        console.log('[DATA FETCH] Token expired/invalid, refreshing and retrying...', {
          status: response.status,
          errorText: errorText.substring(0, 200),
        });
        
        // For server-side, we need to clear the cache manually
        if (getAuthzToken && userId) {
          // Clear the token cache by requesting a new token
          // This will bypass the cache since we just used it and it failed
          const token = await getAuthzToken(userId, 'data-api', []);
          const headers: Record<string, string> = {
            ...(fetchOptions.headers as Record<string, string>),
            'Authorization': `Bearer ${token}`,
          };
          
          // Use timeout for retry as well
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), requestTimeout);
          try {
            response = await fetch(url, {
              ...fetchOptions,
              headers,
              signal: retryController.signal,
            });
            clearTimeout(retryTimeoutId);
          } catch (retryErr) {
            clearTimeout(retryTimeoutId);
            if (retryErr instanceof Error && retryErr.name === 'AbortError') {
              throw new Error(`Retry request timed out after ${requestTimeout}ms`);
            }
            throw retryErr;
          }
        }
      }
    }
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let errorBody: any = {};
      try {
        const text = await response.text();
        // Always log errors - they're important
        console.log('[DATA FETCH] Error response body:', text);
        try {
          errorBody = JSON.parse(text);
          errorMessage = errorBody.error || errorBody.message || errorBody.detail || errorMessage;
        } catch {
          errorMessage = text || response.statusText || errorMessage;
        }
      } catch {
        // If we can't read body, use status text
        errorMessage = response.statusText || errorMessage;
      }
      
      // Always log errors - they're important
      console.log('[DATA FETCH] Request failed:', {
        status: response.status,
        errorMessage,
        errorBody,
      });
      
      throw createDataError(context, url, errorMessage, response.status);
    }
    
    return response;
  } catch (error: unknown) {
    // Check if it's already an DataServiceError
    if (error && typeof error === 'object' && 'context' in error) {
      throw error;
    }
    
    // Handle connection errors
    if (error instanceof TypeError && error.message.includes('fetch failed')) {
      const cause = (error as any).cause;
      if (cause && cause.code === 'ECONNREFUSED') {
        throw createDataError(
          context,
          url,
          `Connection refused to data service at ${url}. Is the service running?`,
          undefined
        );
      }
    }
    
    throw createDataError(context, url, error);
  }
}

/**
 * Get the data service base URL
 */
export function getDataServiceUrl(customUrl?: string): string {
  return customUrl || DEFAULT_DATA_URL;
}

// ============================================================================
// Chat Attachment Processing (Dual-Mode)
// ============================================================================

/**
 * Upload a file for chat attachment
 * 
 * @param file - File to upload
 * @param options - Client options (tokenManager or userId + getAuthzToken)
 * @returns File ID and metadata
 */
export async function uploadChatAttachment(
  file: File,
  options: DataClientOptions
): Promise<{
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await dataFetch(
    'Upload chat attachment',
    '/upload',
    {
      ...options,
      method: 'POST',
      body: formData,
    }
  );

  return response.json();
}

/**
 * Parse file to markdown without full data
 * 
 * This is for chat attachments that should be passed to the LLM
 * without chunking, embedding, or storage in the document library.
 * 
 * @param fileId - File ID from upload
 * @param options - Client options
 * @returns Parsed markdown content
 */
export async function parseFileToMarkdown(
  fileId: string,
  options: DataClientOptions
): Promise<{
  markdown: string;
  metadata: {
    pageCount?: number;
    wordCount?: number;
    language?: string;
  };
}> {
  const response = await dataFetch(
    `Parse file ${fileId} to markdown`,
    `/files/${fileId}/markdown`,
    {
      ...options,
      method: 'GET',
    }
  );

  const data = await response.json();
  
  // Transform response to match expected format
  return {
    markdown: data.markdown,
    metadata: {
      // Data service doesn't return these fields, provide empty metadata
    },
  };
}

/**
 * Ingest file with full processing (chunking, embeddings, storage)
 * 
 * This is for chat attachments that the user wants to add to their
 * document library for future searches.
 * 
 * @param fileId - File ID from upload
 * @param options - Client options
 * @param ingestOptions - Data configuration
 * @returns Data job ID and status
 */
export async function dataChatAttachment(
  fileId: string,
  options: DataClientOptions,
  ingestOptions: {
    collection?: string;
    chunkSize?: number;
    chunkOverlap?: number;
  } = {}
): Promise<{
  jobId: string;
  status: string;
  documentId: string;
}> {
  const response = await dataFetch(
    `Ingest chat attachment ${fileId}`,
    `/files/${fileId}/data`,
    {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collection: ingestOptions.collection || 'default',
        chunkSize: ingestOptions.chunkSize || 512,
        chunkOverlap: ingestOptions.chunkOverlap || 50,
      }),
    }
  );

  return response.json();
}

/**
 * Get file download URL (presigned URL from MinIO)
 * 
 * @param fileId - File ID
 * @param options - Client options
 * @param expirySeconds - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Presigned download URL
 */
export async function getChatAttachmentUrl(
  fileId: string,
  options: DataClientOptions,
  expirySeconds: number = 3600
): Promise<string> {
  const response = await dataFetch(
    `Get presigned URL for ${fileId}`,
    `/files/${fileId}/presigned-url?expiry=${expirySeconds}`,
    options
  );

  const data = await response.json();
  return data.url;
}

/**
 * Delete chat attachment file
 * 
 * @param fileId - File ID
 * @param options - Client options
 */
export async function deleteChatAttachment(
  fileId: string,
  options: DataClientOptions
): Promise<void> {
  await dataFetch(
    `Delete chat attachment ${fileId}`,
    `/files/${fileId}`,
    {
      ...options,
      method: 'DELETE',
    }
  );
}

