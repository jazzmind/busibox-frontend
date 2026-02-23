/**
 * Date/Time Formatting Utilities
 * 
 * Provides consistent, timezone-aware date formatting across the application.
 * All functions automatically convert UTC timestamps to the user's local timezone.
 */

/**
 * Ensure a timestamp is treated as UTC.
 * If the timestamp doesn't have a Z suffix or timezone offset, append Z.
 */
function ensureUTC(timestamp: string): string {
  // If it already has timezone info (Z or +/-offset), return as-is
  if (/[Zz]$/.test(timestamp) || /[+-]\d{2}:\d{2}$/.test(timestamp)) {
    return timestamp;
  }
  // Add Z suffix to treat as UTC
  return timestamp + 'Z';
}

/**
 * Format a date/time string for display with full date and time.
 * Includes timezone indicator for clarity.
 * 
 * Note: Timestamps from the database are stored in UTC. If they don't have
 * a Z suffix, we append one to ensure proper timezone conversion.
 * 
 * @example formatDateTime('2026-01-22T17:16:11.163071Z') => 'Jan 22, 2026, 12:16 PM EST'
 * @example formatDateTime('2026-01-22T17:16:11.163071') => 'Jan 22, 2026, 12:16 PM EST' (same, assumes UTC)
 */
export function formatDateTime(isoString: string | undefined | null): string {
  if (!isoString) return 'N/A';
  
  try {
    const date = new Date(ensureUTC(isoString));
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',  // 'numeric' gives "1" instead of "01"
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a date string for display (date only, no time).
 * 
 * @example formatDate('2026-01-22T17:16:11.163071Z') => 'Jan 22, 2026'
 */
export function formatDate(isoString: string | undefined | null): string {
  if (!isoString) return 'N/A';
  
  try {
    const date = new Date(ensureUTC(isoString));
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a time string for display (time only, no date).
 * 
 * @example formatTime('2026-01-22T17:16:11.163071Z') => '12:16 PM'
 */
export function formatTime(isoString: string | undefined | null): string {
  if (!isoString) return 'N/A';
  
  try {
    const date = new Date(ensureUTC(isoString));
    if (isNaN(date.getTime())) return 'Invalid time';
    
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',  // 'numeric' gives "1" instead of "01"
      minute: '2-digit',
    });
  } catch {
    return 'Invalid time';
  }
}

/**
 * Format a time string with seconds for display.
 * 
 * @example formatTimeWithSeconds('2026-01-22T17:16:11.163071Z') => '12:16:11 PM'
 */
export function formatTimeWithSeconds(isoString: string | undefined | null): string {
  if (!isoString) return 'N/A';
  
  try {
    const date = new Date(ensureUTC(isoString));
    if (isNaN(date.getTime())) return 'Invalid time';
    
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',  // 'numeric' gives "1" instead of "01"
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return 'Invalid time';
  }
}

/**
 * Format a date/time as a relative string (e.g., "2 hours ago", "in 3 days").
 * Falls back to absolute date for times more than 7 days away.
 * 
 * @example formatRelativeTime('2026-01-22T15:16:11.163071Z') => '2 hours ago'
 */
export function formatRelativeTime(isoString: string | undefined | null): string {
  if (!isoString) return 'N/A';
  
  try {
    const date = new Date(ensureUTC(isoString));
    if (isNaN(date.getTime())) return 'Invalid date';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    const isFuture = diffMs < 0;
    
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      const unit = diffMinutes === 1 ? 'minute' : 'minutes';
      return isFuture ? `in ${diffMinutes} ${unit}` : `${diffMinutes} ${unit} ago`;
    } else if (diffHours < 24) {
      const unit = diffHours === 1 ? 'hour' : 'hours';
      return isFuture ? `in ${diffHours} ${unit}` : `${diffHours} ${unit} ago`;
    } else if (diffDays < 7) {
      const unit = diffDays === 1 ? 'day' : 'days';
      return isFuture ? `in ${diffDays} ${unit}` : `${diffDays} ${unit} ago`;
    } else {
      // Fall back to absolute date for anything more than 7 days
      return formatDate(isoString);
    }
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format a short relative time string (e.g., "2h ago", "3d").
 * Good for compact UI elements like lists.
 * 
 * @example formatShortRelativeTime('2026-01-22T15:16:11.163071Z') => '2h ago'
 */
export function formatShortRelativeTime(isoString: string | undefined | null): string {
  if (!isoString) return 'N/A';
  
  try {
    const date = new Date(ensureUTC(isoString));
    if (isNaN(date.getTime())) return '--';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMs < 0) {
      // Future dates
      if (diffMinutes < 60) return `in ${diffMinutes}m`;
      if (diffHours < 24) return `in ${diffHours}h`;
      if (diffDays < 7) return `in ${diffDays}d`;
      return formatDate(isoString);
    }
    
    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older dates, show the date
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '--';
  }
}

/**
 * Format a duration in seconds as a human-readable string.
 * 
 * @example formatDuration(3661) => '1h 1m 1s'
 * @example formatDuration(45) => '45s'
 * @example formatDuration(125.5) => '2m 5.5s'
 */
export function formatDuration(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null) return 'N/A';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    // Show decimal for sub-second precision if needed
    if (secs === Math.floor(secs)) {
      parts.push(`${secs}s`);
    } else {
      parts.push(`${secs.toFixed(1)}s`);
    }
  }
  
  return parts.join(' ');
}

/**
 * Format a timestamp for use in forms (datetime-local input value).
 * Returns a string in the format 'YYYY-MM-DDTHH:mm' in local timezone.
 * 
 * @example formatForDateTimeInput('2026-01-22T17:16:11.163071Z') => '2026-01-22T12:16'
 */
export function formatForDateTimeInput(isoString: string | undefined | null): string {
  if (!isoString) return '';
  
  try {
    const date = new Date(ensureUTC(isoString));
    if (isNaN(date.getTime())) return '';
    
    // Format as local datetime for input
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

/**
 * Parse a datetime-local input value to ISO string (UTC).
 * Converts local time to UTC for storage.
 * 
 * @example parseFromDateTimeInput('2026-01-22T12:16') => '2026-01-22T17:16:00.000Z'
 */
export function parseFromDateTimeInput(localDateTimeString: string): string | null {
  if (!localDateTimeString) return null;
  
  try {
    // datetime-local gives us local time, Date constructor treats it as local
    const date = new Date(localDateTimeString);
    if (isNaN(date.getTime())) return null;
    
    return date.toISOString();
  } catch {
    return null;
  }
}
