/**
 * Error Handling Utilities
 * 
 * Provides consistent error handling across the application with:
 * - Type-safe error classes
 * - HTTP status code mapping
 * - User-friendly error messages
 * - Logging and monitoring integration points
 */

import { APIError } from './types';

// ==========================================================================
// ERROR CLASSES
// ==========================================================================

export class AgentClientError extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    details?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AgentClientError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentClientError);
    }
  }
}

export class ValidationError extends AgentClientError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AgentClientError {
  constructor(message: string = 'Authentication required', details?: Record<string, any>) {
    super(message, 401, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AgentClientError {
  constructor(message: string = 'Insufficient permissions', details?: Record<string, any>) {
    super(message, 403, details);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AgentClientError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AgentClientError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AgentClientError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, { retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class ServerError extends AgentClientError {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(message, 500, details, false);
    this.name = 'ServerError';
  }
}

export class TimeoutError extends AgentClientError {
  constructor(message: string = 'Request timeout', details?: Record<string, any>) {
    super(message, 504, details);
    this.name = 'TimeoutError';
  }
}

// ==========================================================================
// ERROR PARSING
// ==========================================================================

/**
 * Parse error from API response
 */
export function parseAPIError(response: Response, data?: any): AgentClientError {
  const status = response.status;
  
  // Extract error message from response data
  let message = 'An error occurred';
  let details: Record<string, any> | undefined;
  
  if (data) {
    if (typeof data === 'string') {
      message = data;
    } else if (data.error) {
      message = data.error;
      details = data.details;
    } else if (data.detail) {
      message = data.detail;
      details = data;
    } else if (data.message) {
      message = data.message;
      details = data;
    }
  }
  
  // Map status codes to error classes
  switch (status) {
    case 400:
      return new ValidationError(message, details);
    case 401:
      return new AuthenticationError(message, details);
    case 403:
      return new AuthorizationError(message, details);
    case 404:
      return new NotFoundError(message);
    case 409:
      return new ConflictError(message, details);
    case 429:
      const retryAfter = response.headers.get('Retry-After');
      return new RateLimitError(message, retryAfter ? parseInt(retryAfter) : undefined);
    case 504:
      return new TimeoutError(message, details);
    default:
      if (status >= 500) {
        return new ServerError(message, details);
      }
      return new AgentClientError(message, status, details);
  }
}

/**
 * Parse error from fetch exception
 */
export function parseFetchError(error: any): AgentClientError {
  if (error instanceof AgentClientError) {
    return error;
  }
  
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return new ServerError('Network error: Unable to connect to server', {
      originalError: error.message,
    });
  }
  
  // Timeout errors
  if (error.name === 'AbortError') {
    return new TimeoutError('Request was aborted');
  }
  
  // Generic error
  return new ServerError(error.message || 'Unknown error occurred', {
    originalError: error,
  });
}

// ==========================================================================
// ERROR HANDLING MIDDLEWARE
// ==========================================================================

/**
 * Handle API response and throw appropriate error if not ok
 */
export async function handleAPIResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let data: any;
    try {
      data = await response.json();
    } catch {
      data = await response.text().catch(() => undefined);
    }
    throw parseAPIError(response, data);
  }
  
  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }
  
  try {
    return await response.json();
  } catch (error) {
    throw new ServerError('Invalid JSON response from server');
  }
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AgentClientError) {
        throw error;
      }
      throw parseFetchError(error);
    }
  }) as T;
}

// ==========================================================================
// USER-FRIENDLY MESSAGES
// ==========================================================================

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: Error): string {
  if (error instanceof ValidationError) {
    return `Invalid input: ${error.message}`;
  }
  
  if (error instanceof AuthenticationError) {
    return 'Please sign in to continue';
  }
  
  if (error instanceof AuthorizationError) {
    return 'You do not have permission to perform this action';
  }
  
  if (error instanceof NotFoundError) {
    return error.message;
  }
  
  if (error instanceof ConflictError) {
    return `Conflict: ${error.message}`;
  }
  
  if (error instanceof RateLimitError) {
    const retryMsg = error.retryAfter 
      ? ` Please try again in ${error.retryAfter} seconds.`
      : ' Please try again later.';
    return `Too many requests.${retryMsg}`;
  }
  
  if (error instanceof TimeoutError) {
    return 'Request timed out. Please try again.';
  }
  
  if (error instanceof ServerError) {
    return 'A server error occurred. Please try again later.';
  }
  
  if (error instanceof AgentClientError) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

// ==========================================================================
// LOGGING
// ==========================================================================

/**
 * Log error with context
 */
export function logError(error: Error, context?: string, additionalInfo?: Record<string, any>) {
  const logData: Record<string, any> = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  };
  
  if (context) {
    logData.context = context;
  }
  
  if (error instanceof AgentClientError) {
    logData.error.statusCode = error.statusCode;
    logData.error.details = error.details;
    logData.error.isOperational = error.isOperational;
  }
  
  if (additionalInfo) {
    logData.additionalInfo = additionalInfo;
  }
  
  // In production, send to monitoring service
  // For now, log to console
  if (error instanceof AgentClientError && error.isOperational) {
    console.warn('[AgentClient] Operational error:', logData);
  } else {
    console.error('[AgentClient] Unexpected error:', logData);
  }
  
  // TODO: Integrate with monitoring service (Sentry, DataDog, etc.)
}

// ==========================================================================
// RETRY LOGIC
// ==========================================================================

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableStatuses?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry if not retryable
      if (error instanceof AgentClientError) {
        if (!opts.retryableStatuses.includes(error.statusCode)) {
          throw error;
        }
      }
      
      // Don't retry on last attempt
      if (attempt === opts.maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      );
      
      console.log(`[AgentClient] Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
