/**
 * Expiration tracking utilities for video content.
 *
 * OpenAI stores videos temporarily (~7 days after completion).
 */

import type { VideoExpirationStatus } from '../../types/video';
import { EXPIRATION_THRESHOLDS } from '../../types/video';

const OPENAI_RETENTION_PERIOD_DAYS = 7;

export function calculateExpirationDate(completedAt: Date): Date {
  const expires = new Date(completedAt);
  expires.setDate(expires.getDate() + OPENAI_RETENTION_PERIOD_DAYS);
  return expires;
}

export function getExpirationStatus(expiresAt: Date | null): VideoExpirationStatus | null {
  if (!expiresAt) return null;

  const now = new Date();
  const hoursRemaining = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  const daysRemaining = Math.ceil(hoursRemaining / 24);

  if (hoursRemaining <= 0) {
    return {
      status: 'expired',
      severity: 'critical',
      hoursRemaining: null,
      daysRemaining: null,
      label: 'Expired',
      badgeClass: 'bg-gray-100 text-gray-800',
    };
  }

  if (hoursRemaining <= EXPIRATION_THRESHOLDS.CRITICAL) {
    return {
      status: 'expires-soon',
      severity: 'critical',
      hoursRemaining: Math.ceil(hoursRemaining),
      daysRemaining,
      label: `Expires in ${Math.ceil(hoursRemaining)} hours`,
      badgeClass: 'bg-red-100 text-red-800',
    };
  }

  if (hoursRemaining <= EXPIRATION_THRESHOLDS.WARNING) {
    return {
      status: 'expires-soon',
      severity: 'warning',
      hoursRemaining: Math.ceil(hoursRemaining),
      daysRemaining,
      label: `Expires in ${daysRemaining} days`,
      badgeClass: 'bg-orange-100 text-orange-800',
    };
  }

  return {
    status: 'active',
    severity: 'normal',
    hoursRemaining: Math.ceil(hoursRemaining),
    daysRemaining,
    label: `Expires in ${daysRemaining} days`,
    badgeClass: 'bg-blue-100 text-blue-800',
  };
}

export function formatExpirationDate(expiresAt: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(expiresAt);
}

export function isExpiringSoon(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  const now = new Date();
  const hoursRemaining = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursRemaining > 0 && hoursRemaining <= EXPIRATION_THRESHOLDS.WARNING;
}

export function hasExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  const now = new Date();
  return expiresAt.getTime() <= now.getTime();
}

export function getTimeRemaining(expiresAt: Date | null): string {
  if (!expiresAt) return 'Unknown';

  const now = new Date();
  const msRemaining = expiresAt.getTime() - now.getTime();
  if (msRemaining <= 0) return 'Expired';

  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const daysRemaining = Math.floor(hoursRemaining / 24);
  const remainingHours = hoursRemaining % 24;

  if (daysRemaining > 0) {
    if (remainingHours > 0) {
      return `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}, ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
    }
    return `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`;
  }

  return `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`;
}










