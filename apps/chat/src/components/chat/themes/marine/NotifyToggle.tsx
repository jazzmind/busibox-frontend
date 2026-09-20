'use client';

/**
 * Completion-email toggle — a bell icon in the chat header.
 *
 * Chat turns run on the server and finish whether or not this tab is open.
 * When one finishes while nobody is attached to it (laptop asleep, tab
 * closed, or it simply took a long time), the agent emails the user a link
 * to the answer. This toggle sets `notify_email_on_completion` on the user's
 * chat settings (`PUT /users/me/chat-settings`), which is read server-side
 * at the moment the turn ends.
 */

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Tooltip } from './primitives/Tooltip';

interface NotifyToggleProps {
  /** Same fetch wrapper ChatShell uses for the agent API (`/api/agent...`). */
  apiCall: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

export function MarineNotifyToggle({ apiCall }: NotifyToggleProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiCall('/users/me/chat-settings')
      .then((r) => r.json())
      .then((s) => {
        if (!cancelled) setEnabled(s?.notify_email_on_completion !== false);
      })
      .catch(() => {
        if (!cancelled) setEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiCall]);

  const toggle = useCallback(async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setEnabled(next);
    try {
      await apiCall('/users/me/chat-settings', {
        method: 'PUT',
        body: JSON.stringify({ notify_email_on_completion: next }),
      });
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }, [apiCall, enabled, saving]);

  const on = enabled !== false;
  const label = on
    ? 'Email me when a response finishes while I am away: on'
    : 'Email me when a response finishes while I am away: off';

  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={on}
        disabled={enabled === null || saving}
        className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--marine-teal-tint)] disabled:opacity-50"
        style={{
          color: on ? 'var(--marine-teal)' : 'var(--marine-text-subtle)',
          backgroundColor: on ? 'var(--marine-teal-light)' : 'transparent',
          border: `1px solid ${on ? 'var(--marine-teal-border)' : 'transparent'}`,
        }}
      >
        {on ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </button>
    </Tooltip>
  );
}
