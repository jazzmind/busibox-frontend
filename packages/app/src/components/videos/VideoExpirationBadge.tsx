'use client';

/**
 * VideoExpirationBadge Component
 */

import { getExpirationStatus } from '../../lib/media/expiration';

interface VideoExpirationBadgeProps {
  expiresAt: Date | null;
  className?: string;
}

export function VideoExpirationBadge({ expiresAt, className = '' }: VideoExpirationBadgeProps) {
  if (!expiresAt) return null;

  const status = getExpirationStatus(expiresAt);
  if (!status) return null;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.badgeClass} ${className}`}
      title={`Video will be deleted from OpenAI servers on ${expiresAt.toLocaleDateString()}`}
    >
      {status.severity === 'critical' && (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      )}

      {status.severity === 'warning' && (
        <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      )}

      {status.label}
    </span>
  );
}

export function VideoExpirationBadgeCompact({ expiresAt }: VideoExpirationBadgeProps) {
  if (!expiresAt) return null;

  const status = getExpirationStatus(expiresAt);
  if (!status) return null;

  if (status.severity === 'normal') return null;

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${status.badgeClass}`} title={status.label}>
      {status.severity === 'critical' && '⚠️'}
      {status.severity === 'warning' && 'ℹ️'}
    </span>
  );
}










