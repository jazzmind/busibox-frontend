import { NextRequest, NextResponse } from 'next/server';
import * as dataClient from '@/lib/data-api-client';
import { getTokenFromRequest } from '@jazzmind/busibox-app/lib/authz/auth-helper';

/**
 * POST /api/upload
 * Upload files to data API
 * 
 * Files are:
 * 1. Uploaded to MinIO
 * 2. Processed for text extraction
 * 3. Embedded and stored in Milvus
 * 4. Added to conversation-scoped knowledge base
 */
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const conversationId = formData.get('conversation_id') as string;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate file types and sizes
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
    ];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds maximum size of 50 MB` },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type} is not allowed` },
          { status: 400 }
        );
      }
    }

    // Upload files to data API
    const uploadedFiles = await dataClient.uploadFiles(files, conversationId, token);

    return NextResponse.json(uploadedFiles);
  } catch (error: any) {
    console.error('[API] Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload files' },
      { status: error.statusCode || 500 }
    );
  }
}
