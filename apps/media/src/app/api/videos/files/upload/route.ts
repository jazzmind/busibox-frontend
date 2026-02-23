/**
 * Video File Upload API Route
 * 
 * Uploads video files to the data service for storage in MinIO.
 * Videos are stored but not processed (no vectorization).
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    
    // Set session JWT for Zero Trust token exchange
    setSessionJwtForUser(user.id, sessionJwt);

    // Get form data from request
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const metadata = formData.get('metadata') as string | null;

    if (!file) {
      return apiError('No file provided', 400);
    }

    // Validate file type - only video files
    if (!file.type.startsWith('video/')) {
      return apiError(`Invalid file type: ${file.type}. Only video files are supported.`, 400);
    }

    // Validate file size (500MB max for videos)
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    if (file.size > MAX_FILE_SIZE) {
      return apiError('File size exceeds 500MB limit', 400);
    }

    // Forward to data service
    const ingestFormData = new FormData();
    ingestFormData.append('file', file);
    
    // Add metadata
    const uploadMetadata = metadata 
      ? metadata 
      : JSON.stringify({
          source: 'video_upload',
          uploaded_by: user.email,
        });
    ingestFormData.append('metadata', uploadMetadata);

    const response = await dataFetch(
      `POST /api/videos/files/upload - upload video ${file.name}`,
      '/upload',
      {
        method: 'POST',
        headers: {
          'X-User-Id': user.id,
        },
        body: ingestFormData,
        userId: user.id, // Required for auth token exchange
      }
    );

    const data = await response.json();

    return apiSuccess({
      fileId: data.fileId,
      status: data.status,
      message: data.message,
    });
  } catch (error: any) {
    // Error is already logged by dataFetch with context
    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}

