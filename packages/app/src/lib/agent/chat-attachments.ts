/**
 * Attachment Service
 *
 * Handles chat attachment processing.
 *
 * All attachments are uploaded to the user's personal library and processed
 * asynchronously by the data service.
 *
 * Uses agent-api HTTP client for attachment records (no Prisma).
 */

import {
  createChatAttachment,
  getChatAttachment,
  deleteChatAttachment as agentDeleteChatAttachment,
} from './chat-api-client';
import {
  uploadChatAttachment,
  getChatAttachmentUrl,
  deleteChatAttachment as deleteDataFile,
} from '../data/app-client';

/** Local attachment type (camelCase for internal use) */
export interface Attachment {
  id: string;
  fileId?: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  fileUrl?: string;
  addedToLibrary?: boolean;
  libraryDocumentId?: string;
  parsedContent?: string;
  messageId?: string;
}

export interface AttachmentProcessingOptions {
  conversationId: string;
  userId: string;
}

export interface ProcessedAttachment {
  id: string;
  fileId?: string;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
  fileUrl: string;
  addedToLibrary: boolean;
  libraryDocumentId?: string;
  parsedContent?: string;
}

/**
 * Supported file types for different processing modes
 */
export const SUPPORTED_FILE_TYPES = {
  // Native LLM support (OpenAI Vision API)
  native: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  
  // Parseable documents
  parseable: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/xml',
  ],
  
  // All supported types (union)
  all: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json',
    'application/xml',
  ],
} as const;

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * Check if file type is supported
 */
export function isFileTypeSupported(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return SUPPORTED_FILE_TYPES.all.includes(mimeType as any);
}

/**
 * Check if file type supports native LLM processing (vision API)
 */
export function supportsNativeFile(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return SUPPORTED_FILE_TYPES.native.includes(mimeType as any);
}

/**
 * Check if file type can be parsed to markdown
 */
export function isParseableFile(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return SUPPORTED_FILE_TYPES.parseable.includes(mimeType as any);
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }

  // Check file type
  if (!isFileTypeSupported(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not supported. Supported types: ${SUPPORTED_FILE_TYPES.all.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Process attachment with dual-mode logic
 *
 * @param token - Agent-api access token
 * @param file - File to process
 * @param options - Processing options
 * @returns Processed attachment metadata
 */
export async function processAttachment(
  token: string,
  file: File,
  options: AttachmentProcessingOptions
): Promise<ProcessedAttachment> {
  const { userId } = options;

  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 1. Upload file to MinIO via data service
  const uploadResult = await uploadChatAttachment(file, userId);

  // 2. Construct file download URL
  // The data service provides a download endpoint at /files/{fileId}/download
  // Use DATA_API_HOST for consistency with other services
  const dataHost = process.env.DATA_API_HOST || 'localhost';
  const dataPort = process.env.DATA_API_PORT || '8002';
  const dataServiceUrl = process.env.DATA_SERVICE_URL || `http://${dataHost}:${dataPort}`;
  const fileUrl = `${dataServiceUrl}/files/${uploadResult.fileId}/download`;

  // 3. Create attachment record via agent-api
  const attachment = await createChatAttachment(token, {
    filename: file.name,
    file_url: fileUrl,
    file_id: uploadResult.fileId,
    mime_type: file.type,
    size_bytes: file.size,
    added_to_library: true,
  });

  return {
    id: attachment.id,
    fileId: attachment.file_id ?? uploadResult.fileId,
    filename: attachment.filename,
    mimeType: attachment.mime_type ?? file.type,
    sizeBytes: attachment.size_bytes ?? file.size,
    fileUrl: attachment.file_url,
    addedToLibrary: attachment.added_to_library,
    libraryDocumentId: attachment.library_document_id ?? undefined,
    parsedContent: attachment.parsed_content ?? undefined,
  };
}

function agentAttachmentToAttachment(a: {
  id: string;
  file_id?: string;
  filename: string;
  file_url: string;
  mime_type?: string;
  size_bytes?: number;
  added_to_library: boolean;
  library_document_id?: string;
  parsed_content?: string;
  message_id?: string;
}): Attachment {
  return {
    id: a.id,
    fileId: a.file_id,
    filename: a.filename,
    fileUrl: a.file_url,
    mimeType: a.mime_type ?? 'application/octet-stream',
    sizeBytes: a.size_bytes ?? 0,
    addedToLibrary: a.added_to_library,
    libraryDocumentId: a.library_document_id,
    parsedContent: a.parsed_content,
    messageId: a.message_id,
  };
}

/**
 * Get attachment by ID
 *
 * @param token - Agent-api access token (enforces access control)
 * @param attachmentId - Attachment ID
 */
export async function getAttachment(
  token: string,
  attachmentId: string
): Promise<Attachment | null> {
  try {
    const attachment = await getChatAttachment(token, attachmentId);
    return agentAttachmentToAttachment(attachment);
  } catch {
    return null;
  }
}

/**
 * Delete attachment
 * 
 * @param attachmentId - Attachment ID
 * @param userId - User ID (must have access)
 * @param deleteFile - Whether to delete file from storage (default: true)
 */
export async function deleteAttachment(
  token: string,
  attachmentId: string,
  userId: string,
  deleteFile: boolean = true
): Promise<boolean> {
  const attachment = await getAttachment(token, attachmentId);

  if (!attachment) {
    return false;
  }

  if (attachment.addedToLibrary && attachment.libraryDocumentId) {
    await agentDeleteChatAttachment(token, attachmentId);
    return true;
  }

  if (deleteFile && attachment.fileUrl) {
    try {
      const fileId = attachment.fileUrl.match(/\/files\/([^/]+)\/download/)?.[1];
      if (fileId) {
        await deleteDataFile(fileId, userId);
      }
    } catch (error) {
      console.error('Failed to delete file from storage:', error);
    }
  }

  await agentDeleteChatAttachment(token, attachmentId);
  return true;
}

/**
 * Get attachment download URL
 *
 * @param token - Agent-api access token
 * @param attachmentId - Attachment ID
 * @param userId - User ID (for presigned URL)
 */
export async function getAttachmentDownloadUrl(
  token: string,
  attachmentId: string,
  userId: string
): Promise<string | null> {
  const attachment = await getAttachment(token, attachmentId);

  if (!attachment) {
    return null;
  }

  if (attachment.addedToLibrary && attachment.libraryDocumentId) {
    return `/api/documents/${attachment.libraryDocumentId}/download`;
  }

  if (!attachment.fileUrl) {
    return null;
  }

  try {
    const fileId = attachment.fileUrl.match(/\/files\/([^/]+)\/download/)?.[1];
    if (fileId) {
      return await getChatAttachmentUrl(fileId, userId);
    }
    return attachment.fileUrl;
  } catch (error) {
    console.error('Failed to get attachment URL:', error);
    return attachment.fileUrl;
  }
}

/**
 * Format attachment for AI context
 * 
 * Returns attachment in format suitable for AI prompt
 */
export async function formatAttachmentForAI(attachment: Attachment, userId?: string): Promise<{
  type: 'native' | 'parsed' | 'library';
  content?: string;
  url?: string;
  filename: string;
}> {
  if (attachment.addedToLibrary && attachment.libraryDocumentId) {
    return {
      type: 'library',
      filename: attachment.filename,
      // Library documents are referenced by ID in search
    };
  }

  if (attachment.parsedContent) {
    return {
      type: 'parsed',
      content: attachment.parsedContent,
      filename: attachment.filename,
    };
  }

  if (supportsNativeFile(attachment.mimeType) && attachment.fileUrl) {
    // Get presigned URL from data service (MinIO)
    // This URL is directly accessible by vLLM without authentication
    try {
      // Extract file ID from fileUrl
      // Format: http://10.96.200.206:8002/files/{fileId}/download
      const fileIdMatch = attachment.fileUrl.match(/\/files\/([^/]+)\/download/);
      if (!fileIdMatch || !userId) {
        console.error('[Attachment] Cannot extract file ID or missing userId', {
          fileUrl: attachment.fileUrl,
          hasUserId: !!userId,
        });
        throw new Error('Cannot extract file ID or missing userId');
      }
      
      const fileId = fileIdMatch[1];
      console.log('[Attachment] Requesting presigned URL', {
        attachmentId: attachment.id,
        fileId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        userId: userId.substring(0, 8) + '...',
      });
      
      const presignedUrl = await getChatAttachmentUrl(fileId, userId, 7200); // 2 hour expiry
      
      console.log('[Attachment] Presigned URL received', {
        attachmentId: attachment.id,
        filename: attachment.filename,
        urlLength: presignedUrl.length,
        urlPreview: presignedUrl.substring(0, 100) + '...',
        fullUrl: presignedUrl,
      });
      
      return {
        type: 'native',
        url: presignedUrl,
        filename: attachment.filename,
      };
    } catch (error) {
      console.error(`[Attachment] Failed to get presigned URL for attachment:`, error);
      // Fallback to parsed content
      return {
        type: 'parsed',
        content: `[Image attachment: ${attachment.filename}]\nNote: Could not generate accessible URL for image.`,
        filename: attachment.filename,
      };
    }
  }

  // Fallback
  return {
    type: 'parsed',
    content: `[File: ${attachment.filename}]`,
    filename: attachment.filename,
  };
}

/**
 * Batch process multiple attachments
 *
 * @param token - Agent-api access token
 * @param files - Files to process
 * @param options - Processing options
 */
export async function processAttachments(
  token: string,
  files: File[],
  options: AttachmentProcessingOptions
): Promise<ProcessedAttachment[]> {
  const results: ProcessedAttachment[] = [];

  for (const file of files) {
    try {
      const processed = await processAttachment(token, file, options);
      results.push(processed);
    } catch (error) {
      console.error(`Failed to process attachment ${file.name}:`, error);
    }
  }

  return results;
}

