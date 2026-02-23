/**
 * Chat API Middleware
 * 
 * Error handling, authentication, and common utilities for chat API routes.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface ChatApiError {
  error: string;
  code: string;
  details?: any;
}

/**
 * Standard error response builder
 */
export function errorResponse(
  message: string,
  status: number = 500,
  code?: string,
  details?: any
): NextResponse<ChatApiError> {
  return NextResponse.json(
    {
      error: message,
      code: code || `ERROR_${status}`,
      details,
    },
    { status }
  );
}

/**
 * Success response builder
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Error codes for chat API
 */
export const ChatErrorCodes = {
  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  NO_CONVERSATION_ACCESS: 'NO_CONVERSATION_ACCESS',
  CONVERSATION_IS_PRIVATE: 'CONVERSATION_IS_PRIVATE',
  
  // Not found errors (404)
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  ATTACHMENT_NOT_FOUND: 'ATTACHMENT_NOT_FOUND',
  
  // Validation errors (400)
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  
  // Service errors (503)
  SEARCH_UNAVAILABLE: 'SEARCH_UNAVAILABLE',
  OPENAI_UNAVAILABLE: 'OPENAI_UNAVAILABLE',
  MILVUS_UNAVAILABLE: 'MILVUS_UNAVAILABLE',
  
  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Validate required fields in request body
 */
export function validateRequired<T extends Record<string, any>>(
  body: T,
  requiredFields: (keyof T)[]
): { valid: boolean; missing?: string[] } {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    return { valid: false, missing: missing as string[] };
  }
  
  return { valid: true };
}

/**
 * Parse and validate JSON request body
 */
export async function parseRequestBody<T>(request: NextRequest): Promise<{
  success: boolean;
  data?: T;
  error?: NextResponse;
}> {
  try {
    const body = await request.json();
    return { success: true, data: body as T };
  } catch (error) {
    return {
      success: false,
      error: errorResponse(
        'Invalid JSON in request body',
        400,
        ChatErrorCodes.INVALID_INPUT
      ),
    };
  }
}

/**
 * Extract user ID from request (from auth middleware)
 * 
 * Assumes authentication middleware has already run and set user context.
 */
export function getUserId(request: NextRequest): string | null {
  // This will be populated by your existing auth middleware
  // Adjust based on your authentication implementation
  return request.headers.get('x-user-id') || null;
}

/**
 * Ensure user is authenticated
 */
export function requireAuth(request: NextRequest): {
  authenticated: boolean;
  userId?: string;
  error?: NextResponse;
} {
  const userId = getUserId(request);
  
  if (!userId) {
    return {
      authenticated: false,
      error: errorResponse(
        'Authentication required',
        401,
        ChatErrorCodes.UNAUTHORIZED
      ),
    };
  }
  
  return { authenticated: true, userId };
}

/**
 * Safe async handler wrapper for API routes
 * 
 * Catches errors and returns proper error responses
 */
export function withErrorHandling(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse<unknown>>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse<unknown>> => {
    try {
      return await handler(request, context);
    } catch (error: any) {
      console.error('Chat API error:', {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error.message,
        stack: error.stack,
      });

      // Handle known error types
      if (error.code === 'ECONNREFUSED') {
        return errorResponse(
          'Service temporarily unavailable',
          503,
          ChatErrorCodes.SEARCH_UNAVAILABLE,
          { service: 'data' }
        );
      }

      // Handle OpenAI errors
      if (error.message?.includes('OpenAI')) {
        return errorResponse(
          'AI service temporarily unavailable',
          503,
          ChatErrorCodes.OPENAI_UNAVAILABLE
        );
      }

      // Handle Milvus errors
      if (error.message?.includes('Milvus') || error.message?.includes('vector')) {
        return errorResponse(
          'Search service temporarily unavailable',
          503,
          ChatErrorCodes.MILVUS_UNAVAILABLE
        );
      }

      // Generic error
      return errorResponse(
        'An unexpected error occurred',
        500,
        ChatErrorCodes.INTERNAL_ERROR,
        process.env.NODE_ENV === 'development' ? { message: error.message } : undefined
      );
    }
  };
}

/**
 * Validate file upload
 */
export function validateFileUpload(file: File, options: {
  maxSizeMB?: number;
  allowedTypes?: string[];
} = {}): {
  valid: boolean;
  error?: NextResponse;
} {
  const { maxSizeMB = 25, allowedTypes } = options;

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: errorResponse(
        `File too large. Maximum size is ${maxSizeMB}MB`,
        400,
        ChatErrorCodes.FILE_TOO_LARGE,
        { maxSizeMB, actualSizeMB: (file.size / 1024 / 1024).toFixed(2) }
      ),
    };
  }

  // Check file type
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: errorResponse(
        'File type not supported',
        400,
        ChatErrorCodes.INVALID_FILE_TYPE,
        { allowedTypes, actualType: file.type }
      ),
    };
  }

  return { valid: true };
}

/**
 * Pagination helper
 */
export function parsePagination(request: NextRequest): {
  page: number;
  limit: number;
  offset: number;
} {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Build paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

/**
 * Rate limiting helper (simple in-memory implementation)
 * 
 * For production, use Redis or a proper rate limiting service
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: string,
  options: {
    maxRequests?: number;
    windowMs?: number;
  } = {}
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  error?: NextResponse;
} {
  const { maxRequests = 100, windowMs = 60000 } = options; // 100 requests per minute by default

  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!userLimit || userLimit.resetAt < now) {
    // New window
    rateLimitStore.set(userId, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }

  if (userLimit.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: userLimit.resetAt,
      error: errorResponse(
        'Rate limit exceeded. Please try again later.',
        429,
        ChatErrorCodes.RATE_LIMIT_EXCEEDED,
        {
          resetAt: new Date(userLimit.resetAt).toISOString(),
          limit: maxRequests,
          window: `${windowMs / 1000}s`,
        }
      ),
    };
  }

  // Increment count
  userLimit.count++;
  rateLimitStore.set(userId, userLimit);

  return {
    allowed: true,
    remaining: maxRequests - userLimit.count,
    resetAt: userLimit.resetAt,
  };
}

